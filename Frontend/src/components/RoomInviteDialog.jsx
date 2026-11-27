import { useEffect, useState } from 'react';
import { friendsRequest } from '../services/friendsApi';

export default function RoomInviteDialog({ roomId, onClose, onSessionExpired }) {
  const [friends, setFriends] = useState([]);
  const [invitedIds, setInvitedIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      friendsRequest('', {}, onSessionExpired),
      friendsRequest(`/invitations/sent?roomId=${encodeURIComponent(roomId)}`, {}, onSessionExpired),
    ])
      .then(([friendsResult, invitationsResult]) => {
        if (cancelled) return;
        setFriends(friendsResult.friends ?? []);
        setInvitedIds(new Set(invitationsResult.inviteeIds ?? []));
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [onSessionExpired, roomId]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const sendInvitation = async (friend) => {
    setWorkingId(friend.id);
    setError('');
    setNotice('');
    try {
      await friendsRequest(
        '/invitations',
        {
          method: 'POST',
          body: JSON.stringify({ roomId, inviteeId: friend.id }),
        },
        onSessionExpired
      );
      setInvitedIds((previous) => new Set(previous).add(friend.id));
      setNotice(`Invitation sent to @${friend.username}.`);
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setWorkingId('');
    }
  };

  return (
    <div
      className="vc-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="vc-dialog vc-invite-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-invite-title"
      >
        <div className="vc-dialog__header">
          <div>
            <h2 id="room-invite-title" className="sr-font-heading">Invite friends</h2>
            <p>Choose a friend to invite to room <strong>{roomId}</strong>. Invitations expire after 24 hours.</p>
          </div>
          <button type="button" className="vc-dialog__close" onClick={onClose} aria-label="Close dialog">✕</button>
        </div>

        {loading ? (
          <p className="vc-dialog__note" role="status">Loading your friends…</p>
        ) : friends.length === 0 ? (
          <p className="vc-dialog__note">Accept friend requests to invite people to this room.</p>
        ) : (
          <div className="vc-invite__list">
            {friends.map((friend) => {
              const invited = invitedIds.has(friend.id);
              return (
                <div className="vc-invite__person" key={friend.id}>
                  <div className="vc-invite__person-info">
                    <strong>{friend.displayName}</strong>
                    <span>@{friend.username}</span>
                  </div>
                  <button
                    type="button"
                    className="vc-dialog__submit vc-invite__button"
                    disabled={invited || Boolean(workingId)}
                    onClick={() => sendInvitation(friend)}
                  >
                    {invited ? 'Invited' : workingId === friend.id ? 'Sending…' : 'Invite'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {error && <p className="vc-dialog__error" role="alert">{error}</p>}
        {notice && <p className="vc-invite__notice" role="status">{notice}</p>}

        <div className="vc-dialog__actions">
          <button type="button" className="vc-dialog__cancel" onClick={onClose}>Done</button>
        </div>
      </section>
    </div>
  );
}
