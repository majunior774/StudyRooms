import { useEffect, useState } from 'react';
import { friendsRequest } from '../services/friendsApi';
import './FriendsPanel.css';

function PersonLine({ person, children }) {
  return (
    <div className="sr-friends__person">
      <div className="sr-friends__person-info">
        <p className="sr-friends__person-name">{person.displayName}</p>
        <p className="sr-friends__person-username">@{person.username}</p>
      </div>
      <div className="sr-friends__person-actions">{children}</div>
    </div>
  );
}

function ActionButton({ children, onClick, disabled = false, secondary = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`sr-friends__button ${secondary ? 'is-secondary' : ''}`}
    >
      {children}
    </button>
  );
}

export default function FriendsPanel({
  onSessionExpired,
  onIncomingRequestsChange,
  onFriendsChange,
  onInviteFriendToNewRoom,
}) {
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [directoryUsers, setDirectoryUsers] = useState([]);
  const [directoryCursor, setDirectoryCursor] = useState(null);
  const [hasMoreDirectoryUsers, setHasMoreDirectoryUsers] = useState(false);
  const [username, setUsername] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [loadingMoreDirectoryUsers, setLoadingMoreDirectoryUsers] = useState(false);
  const [directoryError, setDirectoryError] = useState('');
  const [searching, setSearching] = useState(false);
  const [workingKey, setWorkingKey] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    friendsRequest('', {}, onSessionExpired)
      .then((result) => {
        if (cancelled) return;
        setFriends(result.friends ?? []);
        setIncomingRequests(result.incomingRequests ?? []);
        setOutgoingRequests(result.outgoingRequests ?? []);
        onIncomingRequestsChange?.(result.incomingRequests?.length ?? 0);
        onFriendsChange?.(result.friends ?? []);
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
  }, [onFriendsChange, onIncomingRequestsChange, onSessionExpired]);

  useEffect(() => {
    let cancelled = false;
    friendsRequest('/directory', {}, onSessionExpired)
      .then((result) => {
        if (cancelled) return;
        setDirectoryUsers(result.users ?? []);
        setDirectoryCursor(result.nextCursor ?? null);
        setHasMoreDirectoryUsers(Boolean(result.nextCursor));
      })
      .catch((loadError) => {
        if (!cancelled) setDirectoryError(loadError.message);
      })
      .finally(() => {
        if (!cancelled) setDirectoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onSessionExpired]);

  const refreshFriends = async () => {
    const result = await friendsRequest('', {}, onSessionExpired);
    setFriends(result.friends ?? []);
    setIncomingRequests(result.incomingRequests ?? []);
    setOutgoingRequests(result.outgoingRequests ?? []);
    onIncomingRequestsChange?.(result.incomingRequests?.length ?? 0);
    onFriendsChange?.(result.friends ?? []);
  };

  const refreshDirectory = async () => {
    const result = await friendsRequest('/directory', {}, onSessionExpired);
    setDirectoryUsers(result.users ?? []);
    setDirectoryCursor(result.nextCursor ?? null);
    setHasMoreDirectoryUsers(Boolean(result.nextCursor));
  };

  const loadMoreDirectoryUsers = async () => {
    if (!directoryCursor) return;
    setLoadingMoreDirectoryUsers(true);
    setDirectoryError('');
    try {
      const result = await friendsRequest(
        `/directory?after=${encodeURIComponent(directoryCursor)}`,
        {},
        onSessionExpired
      );
      setDirectoryUsers((previous) => [...previous, ...(result.users ?? [])]);
      setDirectoryCursor(result.nextCursor ?? null);
      setHasMoreDirectoryUsers(Boolean(result.nextCursor));
    } catch (loadError) {
      setDirectoryError(loadError.message);
    } finally {
      setLoadingMoreDirectoryUsers(false);
    }
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    const query = username.trim().replace(/^@/, '');
    if (!query) {
      setError('Enter a username to search.');
      return;
    }

    setSearching(true);
    setError('');
    setNotice('');
    setSearchResult(null);
    try {
      const result = await friendsRequest(
        `/search?username=${encodeURIComponent(query)}`,
        {},
        onSessionExpired
      );
      setSearchResult(result.user);
    } catch (searchError) {
      setError(searchError.message);
    } finally {
      setSearching(false);
    }
  };

  const runAction = async (key, path, method, body, successMessage) => {
    setWorkingKey(key);
    setError('');
    setNotice('');
    try {
      await friendsRequest(
        path,
        { method, ...(body ? { body: JSON.stringify(body) } : {}) },
        onSessionExpired
      );
      await refreshFriends();
      await refreshDirectory();
      setSearchResult(null);
      setNotice(successMessage);
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setWorkingKey('');
    }
  };

  const createRoomAndInvite = async (person) => {
    setWorkingKey(person.id);
    setError('');
    setNotice('');
    try {
      await onInviteFriendToNewRoom(person.id);
    } catch (actionError) {
      setError(actionError.message);
      setWorkingKey('');
    }
  };

  return (
    <section className="sr-friends-panel" aria-label="Friends">
      <div className="sr-friends__card">
        <h2 className="sr-friends__title">Find friends</h2>
        <p className="sr-friends__description">
          Search by their exact username. Email addresses stay private.
        </p>
        <form onSubmit={handleSearch} className="sr-friends__search-form">
          <label className="sr-friends__search-input">
            <span className="sr-friends__search-prefix" aria-hidden="true">@</span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="username"
              autoComplete="off"
              maxLength={33}
              aria-label="Search by username"
            />
          </label>
          <ActionButton disabled={searching || !username.trim()}>
            {searching ? 'Searching…' : 'Search'}
          </ActionButton>
        </form>

        {searchResult && (
          <div className="sr-friends__result">
            <PersonLine person={searchResult}>
              {searchResult.relationship === 'none' && (
                <ActionButton
                  disabled={Boolean(workingKey)}
                  onClick={() => runAction(
                    'send-request',
                    '/requests',
                    'POST',
                    { username: searchResult.username },
                    'Friend request sent.'
                  )}
                >
                  Add friend
                </ActionButton>
              )}
              {searchResult.relationship === 'outgoing' && (
                <span className="sr-friends__status">Request sent</span>
              )}
              {searchResult.relationship === 'incoming' && (
                <span className="sr-friends__status">Check incoming requests</span>
              )}
              {searchResult.relationship === 'friends' && (
                <span className="sr-friends__status is-success">Already friends</span>
              )}
            </PersonLine>
          </div>
        )}
        {error && <p className="sr-friends__message is-error" role="alert">{error}</p>}
        {notice && <p className="sr-friends__message is-success" role="status">{notice}</p>}
      </div>

      <div className="sr-friends__card">
        <h2 className="sr-friends__title">Friend requests</h2>
        {loading ? (
          <p className="sr-friends__message" role="status">Loading requests…</p>
        ) : incomingRequests.length === 0 && outgoingRequests.length === 0 ? (
          <p className="sr-friends__message">No pending requests.</p>
        ) : (
          <div className="sr-friends__list">
            {incomingRequests.map((person) => (
              <PersonLine person={person} key={person.requestId}>
                <ActionButton
                  disabled={Boolean(workingKey)}
                  onClick={() => runAction(
                    person.requestId,
                    `/requests/${person.requestId}`,
                    'PATCH',
                    { action: 'accept' },
                    `You and @${person.username} are now friends.`
                  )}
                >
                  Accept
                </ActionButton>
                <ActionButton
                  secondary
                  disabled={Boolean(workingKey)}
                  onClick={() => runAction(
                    person.requestId,
                    `/requests/${person.requestId}`,
                    'PATCH',
                    { action: 'decline' },
                    'Friend request declined.'
                  )}
                >
                  Decline
                </ActionButton>
              </PersonLine>
            ))}
            {outgoingRequests.map((person) => (
              <PersonLine person={person} key={person.id}>
                <span className="sr-friends__status">Pending</span>
                <ActionButton
                  secondary
                  disabled={Boolean(workingKey)}
                  onClick={() => runAction(
                    person.id,
                    `/requests/${person.requestId}`,
                    'DELETE',
                    null,
                    'Friend request canceled.'
                  )}
                >
                  Cancel
                </ActionButton>
              </PersonLine>
            ))}
          </div>
        )}
      </div>

      <div className="sr-friends__card sr-friends__card--full">
        <h2 className="sr-friends__title">Your friends</h2>
        {loading ? (
          <p className="sr-friends__message" role="status">Loading friends…</p>
        ) : friends.length === 0 ? (
          <p className="sr-friends__message">Friends you accept will appear here.</p>
        ) : (
          <div className="sr-friends__list sr-friends__list--friends">
            {friends.map((person) => (
              <PersonLine person={person} key={person.id}>
                <ActionButton
                  disabled={Boolean(workingKey) || !onInviteFriendToNewRoom}
                  onClick={() => createRoomAndInvite(person)}
                >
                  Create room &amp; invite
                </ActionButton>
                <ActionButton
                  secondary
                  disabled={Boolean(workingKey)}
                  onClick={() => runAction(
                    person.id,
                    `/${person.id}`,
                    'DELETE',
                    null,
                    `Removed @${person.username} from your friends.`
                  )}
                >
                  Remove
                </ActionButton>
              </PersonLine>
            ))}
          </div>
        )}
      </div>

      <div className="sr-friends__card sr-friends__card--full">
        <h2 className="sr-friends__title">People on StudyRooms</h2>
        <p className="sr-friends__description">
          Find other learners and send them a friend request.
        </p>
        {directoryError && (
          <p className="sr-friends__message is-error" role="alert">{directoryError}</p>
        )}
        {directoryLoading ? (
          <p className="sr-friends__message" role="status">Loading people…</p>
        ) : directoryUsers.length === 0 ? (
          <p className="sr-friends__message">No other users to show yet.</p>
        ) : (
          <>
            <div className="sr-friends__list sr-friends__list--directory">
              {directoryUsers.map((person) => (
                <PersonLine person={person} key={person.id}>
                  {person.relationship === 'none' && (
                    <ActionButton
                      disabled={Boolean(workingKey)}
                      onClick={() => runAction(
                        person.id,
                        '/requests',
                        'POST',
                        { username: person.username },
                        'Friend request sent.'
                      )}
                    >
                      Add friend
                    </ActionButton>
                  )}
                  {person.relationship === 'outgoing' && (
                    <span className="sr-friends__status">Request sent</span>
                  )}
                  {person.relationship === 'incoming' && (
                    <>
                      <span className="sr-friends__status">Request received</span>
                      <ActionButton
                        disabled={Boolean(workingKey)}
                        onClick={() => runAction(
                          person.requestId,
                          `/requests/${person.requestId}`,
                          'PATCH',
                          { action: 'accept' },
                          `You and @${person.username} are now friends.`
                        )}
                      >
                        Accept
                      </ActionButton>
                    </>
                  )}
                  {person.relationship === 'friends' && (
                    <span className="sr-friends__status is-success">Friends</span>
                  )}
                </PersonLine>
              ))}
            </div>
            {hasMoreDirectoryUsers && (
              <div className="sr-friends__directory-more">
                <ActionButton
                  secondary
                  disabled={loadingMoreDirectoryUsers}
                  onClick={loadMoreDirectoryUsers}
                >
                  {loadingMoreDirectoryUsers ? 'Loading…' : 'Show more people'}
                </ActionButton>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
