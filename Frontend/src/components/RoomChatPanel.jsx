import { useEffect, useRef, useState } from 'react';

export default function RoomChatPanel({
  socket,
  roomId,
  messages,
  error,
  onClearError,
  onError,
  onClose,
}) {
  const [draft, setDraft] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const sendMessage = (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (!socket?.connected) {
      onError('You are disconnected from the room. Reconnect before sending a message.');
      return;
    }

    onClearError();
    socket.emit('chat:send', { roomId, text });
    setDraft('');
  };

  return (
    <aside className="vc-chat" aria-label="Room chat">
      <header className="vc-chat__header">
        <div>
          <h2>Room chat</h2>
          <p>Messages stay in this call and aren’t saved.</p>
        </div>
        <button type="button" className="vc-chat__close" onClick={onClose} aria-label="Close room chat">
          ×
        </button>
      </header>

      <div className="vc-chat__messages" aria-live="polite" aria-relevant="additions text">
        {messages.length === 0 ? (
          <p className="vc-chat__empty">No messages yet. Say hello!</p>
        ) : (
          messages.map((message) => (
            <article
              className={`vc-chat__message ${message.senderId === socket?.id ? 'vc-chat__message--own' : ''}`}
              key={message.id}
            >
              <div className="vc-chat__message-meta">
                <strong>{message.senderName}</strong>
                <time dateTime={message.timestamp}>
                  {new Date(message.timestamp).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </time>
              </div>
              <p>{message.text}</p>
            </article>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && <p className="vc-chat__error" role="alert">{error}</p>}

      <form className="vc-chat__form" onSubmit={sendMessage}>
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={onClearError}
          placeholder="Write a message…"
          maxLength={1000}
          aria-label="Write a room chat message"
        />
        <button type="submit" disabled={!draft.trim()} aria-label="Send message">
          Send
        </button>
      </form>
    </aside>
  );
}
