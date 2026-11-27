import { useState } from 'react';
import StudyRoomsBrand from '../components/StudyRoomsBrand';

const featureCards = [
  { number: '01', icon: '◉', title: 'Talk it through', text: 'Meet face to face with live video and audio, right in your study room.' },
  { number: '02', icon: '✳', title: 'Think out loud', text: 'Sketch diagrams, annotate ideas, and work through problems on a shared board.' },
  { number: '03', icon: '▷', title: 'Learn in sync', text: 'Watch a YouTube lesson together and keep playback in step for everyone.' },
];

export default function LandingPage({ onCreateRoom, onJoinRoom, onOpenDashboard, notice = '' }) {
  const [roomCode, setRoomCode] = useState('');
  const [inputError, setInputError] = useState('');

  const handleJoinSubmit = (event) => {
    event.preventDefault();
    const trimmed = roomCode.trim();
    if (!trimmed) {
      setInputError('Enter a room code or invite link to continue.');
      return;
    }

    try {
      if (trimmed.includes('?room=')) {
        const code = new URL(trimmed).searchParams.get('room');
        if (code?.trim()) {
          onJoinRoom(code.trim());
          return;
        }
      }
    } catch {
      // Treat input that is not a URL as a room code.
    }

    const code = trimmed.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!code) {
      setInputError('That room code does not look valid.');
      return;
    }
    onJoinRoom(code);
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRoomCode(text);
        setInputError('');
      }
    } catch {
      setInputError('Clipboard access is unavailable. Paste your invite link into the field.');
    }
  };

  return (
    <div className="sr-home">
      <header className="sr-home__header">
        <StudyRoomsBrand size="md" className="sr-home__brand" />
        <nav className="sr-home__nav" aria-label="Main navigation">
          <a href="#study-tools">Study tools</a>
          <a href="#how-it-works">How it works</a>
          <button type="button" className="sr-home__dashboard" onClick={onOpenDashboard}>Dashboard <span aria-hidden="true">↗</span></button>
        </nav>
        <button type="button" className="sr-home__header-cta" onClick={onCreateRoom}>Create a room <span aria-hidden="true">↗</span></button>
      </header>

      <main>
        <section className="sr-home__hero" aria-labelledby="home-heading">
          <div className="sr-home__hero-copy">
            <div className="sr-home__eyebrow"><span /> A little more together</div>
            <h1 id="home-heading">Good ideas grow<br />in <em>good company.</em></h1>
            <p className="sr-home__lede">A shared study space for the moments when learning is better together. Meet, talk it through, sketch it out, and keep going.</p>
            <div className="sr-home__hero-actions">
              <button type="button" className="sr-home__primary" onClick={onCreateRoom}>Start a study room <span aria-hidden="true">↗</span></button>
              <span className="sr-home__action-note">No setup. Just send a link.</span>
            </div>
            <form className="sr-home__join" onSubmit={handleJoinSubmit}>
              <label htmlFor="home-room-code">Already have an invite?</label>
              <div className="sr-home__join-row">
                <div className="sr-home__input-wrap">
                  <span aria-hidden="true">⌁</span>
                  <input id="home-room-code" value={roomCode} onChange={(event) => { setRoomCode(event.target.value); setInputError(''); }} placeholder="Paste a room code or link" aria-describedby={inputError ? 'home-room-error' : undefined} />
                  <button type="button" onClick={handlePasteClipboard}>Paste</button>
                </div>
                <button type="submit" className="sr-home__join-submit">Join room</button>
              </div>
              {inputError && <p id="home-room-error" className="sr-home__error" role="alert">{inputError}</p>}
            </form>
            <div className="sr-home__trust"><span className="sr-home__avatars" aria-hidden="true"><i>A</i><i>M</i><i>J</i></span><span>Bring your study group together, wherever you are.</span></div>
          </div>

          <div className="sr-home__stage" aria-label="Study room preview">
            <div className="sr-home__stage-top"><span><i /> STUDY ROOM</span><span className="sr-home__live"><i /> LIVE</span></div>
            <div className="sr-home__stage-main">
              <div className="sr-home__stage-board">
                <span className="sr-home__board-label">Shared whiteboard <b>✳</b></span>
                <div className="sr-home__equation">f(x) = <span>∫</span> e<sup>−x²</sup> dx</div>
                <svg className="sr-home__graph" viewBox="0 0 390 150" fill="none" aria-hidden="true">
                  <path d="M14 126H375M26 12V140" stroke="#d7ddd3" strokeWidth="1" strokeDasharray="3 5" />
                  <path d="M26 117C59 115 72 104 98 101C132 97 137 60 177 57C215 54 219 99 252 96C286 93 292 46 333 42C351 40 359 42 375 34" stroke="#528274" strokeWidth="3" strokeLinecap="round" />
                  <path d="m320 37 14 5-6 13" stroke="#528274" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="177" cy="57" r="5" fill="#e3a778" stroke="white" strokeWidth="2" />
                </svg>
                <div className="sr-home__board-note"><span>✎</span> try x = 0 first</div>
                <span className="sr-home__cursor sr-home__cursor--one">Maya</span>
                <span className="sr-home__cursor sr-home__cursor--two">You</span>
              </div>
              <div className="sr-home__people">
                <div className="sr-home__person sr-home__person--maya"><span className="sr-home__face">M</span><span>Maya <i>◖</i></span></div>
                <div className="sr-home__person sr-home__person--you"><span className="sr-home__face">Y</span><span>You <i>◖</i></span></div>
                <div className="sr-home__person sr-home__person--alex"><span className="sr-home__face">A</span><span>Alex <i>◖</i></span></div>
              </div>
            </div>
            <div className="sr-home__stage-controls" aria-hidden="true">
              <span className="is-on">◖</span><span className="is-on">▣</span><span>⌕</span><span>▧</span><span className="is-end">↗</span>
              <b>08:24</b>
            </div>
            <div className="sr-home__float-card"><span>✳</span><div><b>Nice, that makes sense!</b><small>Alex · just now</small></div></div>
            <div className="sr-home__stage-shadow" />
          </div>
        </section>

        <section className="sr-home__ribbon" aria-label="Study room features">
          <span>ONE ROOM, ROOM TO THINK</span>
          <i /> <b>Video & audio</b><i /> <b>Shared whiteboard</b><i /> <b>Watch together</b><i /> <b>Screen sharing</b>
        </section>

        <section className="sr-home__features" id="study-tools">
          <div className="sr-home__section-heading"><div><span className="sr-home__eyebrow">A shared study session</span><h2>Everything you need<br />to figure it out.</h2></div><p>Keep the conversation, the working, and the learning in one place. Use the tools that help your group make progress.</p></div>
          <div className="sr-home__feature-grid">
            {featureCards.map((feature) => <article className="sr-home__feature" key={feature.number}><span className="sr-home__feature-number">{feature.number}</span><span className="sr-home__feature-icon">{feature.icon}</span><h3>{feature.title}</h3><p>{feature.text}</p><span className="sr-home__feature-arrow" aria-hidden="true">↗</span></article>)}
          </div>
        </section>

        <section className="sr-home__workflow" id="how-it-works">
          <div className="sr-home__workflow-copy"><span className="sr-home__eyebrow">Easy to get started</span><h2>From “meet here”<br />to “we got it.”</h2><p>Create a room for your group or join with a link. Check your camera and mic, then get straight into the session.</p><button type="button" className="sr-home__text-link" onClick={onCreateRoom}>Make a room for your group <span aria-hidden="true">→</span></button></div>
          <div className="sr-home__steps">
            <article><span>01</span><div><h3>Start or join</h3><p>Make a room in a click, or enter the invite your classmate sent.</p></div><b>↗</b></article>
            <article><span>02</span><div><h3>Get set up</h3><p>Preview your camera and choose your mic before you join.</p></div><b>◉</b></article>
            <article><span>03</span><div><h3>Work it out together</h3><p>Talk, share a screen, sketch, or watch a lesson as a group.</p></div><b>✳</b></article>
          </div>
        </section>

        <section className="sr-home__personal">
          <div className="sr-home__personal-icon">☷</div>
          <div><span className="sr-home__eyebrow">And between sessions</span><h2>Your own space to stay on track.</h2><p>Keep personal tasks and notes with your account, and find your recent rooms on this device.</p></div>
          <button type="button" onClick={onOpenDashboard}>Explore your dashboard <span aria-hidden="true">↗</span></button>
        </section>
      </main>

      <footer className="sr-home__footer"><StudyRoomsBrand size="sm" className="sr-home__brand" /><span>Study together, wherever you are.</span><button type="button" onClick={onCreateRoom}>Create a study room <span aria-hidden="true">↗</span></button></footer>
    </div>
  );
}
