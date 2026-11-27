import { Router } from 'express';
import mongoose from 'mongoose';
import Friendship from '../models/Friendship.js';
import RoomInvitation from '../models/RoomInvitation.js';
import User from '../models/User.js';
import { ensureUsername, requireAuth } from './AuthRoute.js';
import { isValidUsername, normalizeUsername } from '../utils/username.js';

const router = Router();

router.use(requireAuth);

router.get('/summary', async (req, res) => {
  const now = new Date();
  const [incomingRequestCount, roomInvitationCount] = await Promise.all([
    Friendship.countDocuments({
      status: 'pending',
      requestedBy: { $ne: req.userId },
      $or: [{ userA: req.userId }, { userB: req.userId }],
    }),
    RoomInvitation.countDocuments({
      inviteeId: req.userId,
      status: 'pending',
      expiresAt: { $gt: now },
    }),
  ]);
  return res.json({
    incomingRequestCount,
    roomInvitationCount,
    notificationCount: incomingRequestCount + roomInvitationCount,
  });
});

router.get('/directory', async (req, res) => {
  const after = typeof req.query.after === 'string' ? req.query.after : '';
  if (after && !mongoose.isValidObjectId(after)) {
    return res.status(400).json({ error: 'Invalid user directory cursor.' });
  }
  const requestedLimit = Number(req.query.limit);
  const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 30)
    : 20;
  const userFilter = { _id: { $ne: req.userId } };
  if (after) userFilter._id.$gt = after;

  const page = await User.find(userFilter)
    .select('username displayName')
    .sort({ _id: 1 })
    .limit(limit + 1);
  const hasMore = page.length > limit;
  const users = page.slice(0, limit);
  await Promise.all(users.map((user) => ensureUsername(user)));

  const currentUserId = req.userId.toString();
  const userIds = users.map((user) => user._id);
  const relationships = userIds.length
    ? await Friendship.find({
        $or: [
          { userA: req.userId, userB: { $in: userIds } },
          { userB: req.userId, userA: { $in: userIds } },
        ],
      }).select('userA userB requestedBy status').lean()
    : [];
  const relationshipsByUser = new Map(relationships.map((relationship) => {
    const otherId = relationship.userA.toString() === currentUserId
      ? relationship.userB.toString()
      : relationship.userA.toString();
    return [otherId, relationship];
  }));
  const lastUser = users[users.length - 1];

  return res.json({
    users: users.map((user) => {
      const relationship = relationshipsByUser.get(user._id.toString());
      const relationshipStatus = getRelationshipStatus(relationship, req.userId);
      return {
        ...publicFriend(user),
        relationship: relationshipStatus,
        ...(relationshipStatus === 'incoming' || relationshipStatus === 'outgoing'
          ? { requestId: relationship._id.toString() }
          : {}),
      };
    }),
    nextCursor: hasMore && lastUser ? lastUser._id.toString() : null,
  });
});

router.get('/invitations/sent', async (req, res) => {
  const roomId = typeof req.query.roomId === 'string' ? req.query.roomId.trim() : '';
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(roomId)) {
    return res.status(400).json({ error: 'Invalid room ID.' });
  }
  const invitations = await RoomInvitation.find({
    inviterId: req.userId,
    roomId,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  }).select('inviteeId').lean();
  return res.json({
    inviteeIds: invitations.map((invitation) => invitation.inviteeId.toString()),
  });
});

router.get('/invitations', async (req, res) => {
  const invitations = await RoomInvitation.find({
    inviteeId: req.userId,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .populate('inviterId', 'displayName username')
    .lean();
  return res.json({
    invitations: invitations
      .filter((invitation) => invitation.inviterId)
      .map((invitation) => ({
        id: invitation._id.toString(),
        roomId: invitation.roomId,
        inviter: publicFriend(invitation.inviterId),
        expiresAt: invitation.expiresAt,
      })),
  });
});

router.post('/invitations', async (req, res) => {
  const roomId = typeof req.body?.roomId === 'string' ? req.body.roomId.trim() : '';
  const inviteeId = req.body?.inviteeId;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(roomId) || !mongoose.isValidObjectId(inviteeId)) {
    return res.status(400).json({ error: 'Provide a valid room ID and friend.' });
  }
  const normalizedInviteeId = new mongoose.Types.ObjectId(inviteeId);
  if (normalizedInviteeId.equals(req.userId)) {
    return res.status(400).json({ error: 'You cannot invite yourself.' });
  }

  const [userA, userB] = getUserPair(req.userId, normalizedInviteeId);
  const friendship = await Friendship.findOne({ userA, userB, status: 'accepted' });
  if (!friendship) return res.status(403).json({ error: 'You can only invite friends to a room.' });

  const now = new Date();
  const existing = await RoomInvitation.findOne({
    roomId,
    inviteeId: normalizedInviteeId,
    status: 'pending',
  });
  if (existing?.expiresAt > now) {
    return res.status(409).json({ error: 'This friend already has a pending invite to this room.' });
  }
  if (existing) {
    await RoomInvitation.updateOne(
      { _id: existing._id, status: 'pending' },
      { $set: { status: 'expired' } }
    );
  }

  try {
    const invitation = await RoomInvitation.create({
      roomId,
      inviterId: req.userId,
      inviteeId: normalizedInviteeId,
      status: 'pending',
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    });
    return res.status(201).json({ invitationId: invitation._id.toString() });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return res.status(409).json({ error: 'This friend already has a pending invite to this room.' });
  }
});

router.patch('/invitations/:invitationId', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.invitationId)) {
    return res.status(404).json({ error: 'Room invitation not found.' });
  }
  const action = req.body?.action;
  if (action !== 'accept' && action !== 'decline') {
    return res.status(400).json({ error: 'Choose whether to join or decline this invitation.' });
  }

  const filter = {
    _id: req.params.invitationId,
    inviteeId: req.userId,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  };
  const invitation = await RoomInvitation.findOneAndUpdate(
    filter,
    { $set: { status: action === 'accept' ? 'accepted' : 'declined' } },
    { new: true }
  );
  if (!invitation) return res.status(404).json({ error: 'Room invitation not found or expired.' });
  return res.json({ ok: true, ...(action === 'accept' ? { roomId: invitation.roomId } : {}) });
});

function getUserPair(firstId, secondId) {
  return [firstId.toString(), secondId.toString()].sort();
}

function getRelationshipStatus(relationship, userId) {
  if (!relationship) return 'none';
  if (relationship.status === 'accepted') return 'friends';
  return relationship.requestedBy.toString() === userId.toString() ? 'outgoing' : 'incoming';
}

function publicFriend(user) {
  return {
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName,
  };
}

function conflictMessage(relationship, userId) {
  const status = getRelationshipStatus(relationship, userId);
  if (status === 'friends') return 'You are already friends.';
  if (status === 'outgoing') return 'You already sent this person a friend request.';
  return 'This person already sent you a request. Accept it from incoming requests.';
}

router.get('/', async (req, res) => {
  const relationships = await Friendship.find({
    $or: [{ userA: req.userId }, { userB: req.userId }],
  }).lean();
  const currentUserId = req.userId.toString();
  const otherIds = [...new Set(relationships.map((relationship) => (
    relationship.userA.toString() === currentUserId
      ? relationship.userB.toString()
      : relationship.userA.toString()
  )))];
  const users = otherIds.length
    ? await User.find({ _id: { $in: otherIds } }).select('username displayName').lean()
    : [];
  const usersById = new Map(users.map((user) => [user._id.toString(), user]));
  const result = { friends: [], incomingRequests: [], outgoingRequests: [] };

  for (const relationship of relationships) {
    const otherId = relationship.userA.toString() === currentUserId
      ? relationship.userB.toString()
      : relationship.userA.toString();
    const user = usersById.get(otherId);
    if (!user) continue;
    const friend = publicFriend(user);
    if (relationship.status === 'accepted') {
      result.friends.push(friend);
    } else if (relationship.requestedBy.toString() === currentUserId) {
      result.outgoingRequests.push({ ...friend, requestId: relationship._id.toString() });
    } else {
      result.incomingRequests.push({ ...friend, requestId: relationship._id.toString() });
    }
  }

  return res.json(result);
});

router.get('/search', async (req, res) => {
  const query = typeof req.query.username === 'string'
    ? req.query.username.trim().replace(/^@/, '')
    : '';
  const username = normalizeUsername(query);
  if (!isValidUsername(username)) {
    return res.status(400).json({ error: 'Enter a valid username to search.' });
  }

  const user = await User.findOne({ username }).select('username displayName');
  if (!user) return res.status(404).json({ error: 'No account found with that username.' });
  if (user._id.equals(req.userId)) {
    return res.status(400).json({ error: 'That is your username.' });
  }

  const [userA, userB] = getUserPair(req.userId, user._id);
  const relationship = await Friendship.findOne({ userA, userB }).select('status requestedBy');
  return res.json({
    user: {
      ...publicFriend(user),
      relationship: getRelationshipStatus(relationship, req.userId),
    },
  });
});

router.post('/requests', async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  if (!isValidUsername(username)) {
    return res.status(400).json({ error: 'Enter a valid username.' });
  }

  const target = await User.findOne({ username }).select('username displayName');
  if (!target) return res.status(404).json({ error: 'No account found with that username.' });
  if (target._id.equals(req.userId)) {
    return res.status(400).json({ error: 'You cannot add yourself as a friend.' });
  }

  const [userA, userB] = getUserPair(req.userId, target._id);
  const pair = { userA, userB };
  const existing = await Friendship.findOne(pair);
  if (existing) return res.status(409).json({ error: conflictMessage(existing, req.userId) });

  try {
    const relationship = await Friendship.create({
      ...pair,
      requestedBy: req.userId,
      status: 'pending',
    });
    return res.status(201).json({ requestId: relationship._id.toString() });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const racedRelationship = await Friendship.findOne(pair);
    if (!racedRelationship) throw error;
    return res.status(409).json({ error: conflictMessage(racedRelationship, req.userId) });
  }
});

router.patch('/requests/:requestId', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.requestId)) {
    return res.status(404).json({ error: 'Friend request not found.' });
  }
  const action = req.body?.action;
  if (action !== 'accept' && action !== 'decline') {
    return res.status(400).json({ error: 'Choose whether to accept or decline the request.' });
  }

  const filter = {
    _id: req.params.requestId,
    status: 'pending',
    requestedBy: { $ne: req.userId },
    $or: [{ userA: req.userId }, { userB: req.userId }],
  };
  const relationship = action === 'accept'
    ? await Friendship.findOneAndUpdate(filter, { $set: { status: 'accepted' } }, { new: true })
    : await Friendship.findOneAndDelete(filter);
  if (!relationship) return res.status(404).json({ error: 'Incoming friend request not found.' });
  return res.json({ ok: true });
});

router.delete('/requests/:requestId', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.requestId)) {
    return res.status(404).json({ error: 'Friend request not found.' });
  }
  const relationship = await Friendship.findOneAndDelete({
    _id: req.params.requestId,
    status: 'pending',
    requestedBy: req.userId,
    $or: [{ userA: req.userId }, { userB: req.userId }],
  });
  if (!relationship) return res.status(404).json({ error: 'Outgoing friend request not found.' });
  return res.json({ ok: true });
});

router.delete('/:friendId', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.friendId)) {
    return res.status(404).json({ error: 'Friend not found.' });
  }
  const [userA, userB] = getUserPair(req.userId, req.params.friendId);
  const relationship = await Friendship.findOneAndDelete({
    userA,
    userB,
    status: 'accepted',
  });
  if (!relationship) return res.status(404).json({ error: 'Friend not found.' });
  return res.json({ ok: true });
});

export default router;
