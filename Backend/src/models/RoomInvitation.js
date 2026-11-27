import mongoose from 'mongoose';

const roomInvitationSchema = new mongoose.Schema({
  roomId: { type: String, required: true, trim: true, maxlength: 128 },
  inviterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  inviteeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'expired'],
    default: 'pending',
    required: true,
  },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

roomInvitationSchema.index(
  { roomId: 1, inviteeId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);
roomInvitationSchema.index({ inviteeId: 1, status: 1, expiresAt: 1 });
roomInvitationSchema.index({ inviterId: 1, roomId: 1, status: 1 });

export default mongoose.models.RoomInvitation
  || mongoose.model('RoomInvitation', roomInvitationSchema);
