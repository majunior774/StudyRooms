import { useEffect, useState } from 'react';
import { friendsRequest } from '../services/friendsApi';
import './FriendsPanel.css';

export default function InvitationsPanel({
  onSessionExpired,
  onJoinRoom,
  onPendingInvitationsChange,
}) {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refreshInvitations = async () => {
    const result = await friendsRequest('/invitations', {}, onSessionExpired);
    const nextInvitations = result.invitations ?? [];
    setInvitations(nextInvitations);
    onPendingInvitationsChange?.(nextInvitations.length);
  };

  useEffect(() => {
    let cancelled = false;
    friendsRequest('/invitations', {}, onSessionExpired)
      .then((result) => {
        if (cancelled) return;
        const nextInvitations = result.invitations ?? [];
        setInvitations(nextInvitations);
        onPendingInvitationsChange?.(nextInvitations.length);
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
  }, [onPendingInvitationsChange, onSessionExpired]);

  const respondToInvitation = async (invitation, action) => {
    setWorkingId(invitation.id);
    setError('');
    setNotice('');
    try {
      const result = await friendsRequest(
        `/invitations/${invitation.id}`,
        { method: 'PATCH', body: JSON.stringify({ action }) },
        onSessionExpired
      );
      if (action === 'accept') {
        onJoinRoom?.(result.roomId);
        return;
      }
      await refreshInvitations();
      setNotice('Room invitation declined.');
    } catch (actionError) {
      setError(actionError.message);
      setWorkingId('');
      return;
    }
    setWorkingId('');
  };

  return (
    <section className="sr-friends-panel" aria-label="Room invitations">
      <div className="sr-friends__card sr-friends__card--full">
        <h2 className="sr-friends__title">Room invitations</h2>
        <p className="sr-friends__description">
          Invitations from your friends expire after 24 hours.
        </p>
        {error && <p className="sr-friends__message is-error" role="alert">{error}</p>}
        {notice && <p className="sr-friends__message is-success" role="status">{notice}</p>}
        {loading ? (
          <p className="sr-friends__message" role="status">Loading invitations…</p>
        ) : invitations.length === 0 ? (
          <p className="sr-friends__message">No pending room invitations.</p>
        ) : (
          <div className="sr-friends__list">
            {invitations.map((invitation) => (
              <div className="sr-friends__person" key={invitation.id}>
                <div className="sr-friends__person-info">
                  <p className="sr-friends__person-name">{invitation.inviter.displayName}</p>
                  <p className="sr-friends__person-username">@{invitation.inviter.username}</p>
                  <p className="sr-friends__status">
                    Invited you to room <strong>{invitation.roomId}</strong>
                  </p>
                </div>
                <div className="sr-friends__person-actions">
                  <button
                    type="button"
                    className="sr-friends__button"
                    disabled={Boolean(workingId)}
                    onClick={() => respondToInvitation(invitation, 'accept')}
                  >
                    Join room
                  </button>
                  <button
                    type="button"
                    className="sr-friends__button is-secondary"
                    disabled={Boolean(workingId)}
                    onClick={() => respondToInvitation(invitation, 'decline')}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
