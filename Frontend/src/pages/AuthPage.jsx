import { useState } from 'react';
import StudyRoomsBrand from '../components/StudyRoomsBrand';
import './auth-page.css';

const apiBaseUrl = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');

export default function AuthPage({ isLoading, serviceError, onAuthenticated, onGoToLanding }) {
  const [mode, setMode] = useState('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isRegistering = mode === 'register';

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (isRegistering && (password.length < 8 || password.length > 128)) {
      setError('Use a password between 8 and 128 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/${isRegistering ? 'register' : 'login'}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isRegistering ? { displayName: displayName.trim() } : {}),
          email: email.trim(),
          password,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not sign in. Try again.');
      onAuthenticated(result.user);
    } catch (submitError) {
      setError(submitError.message || 'Could not reach the account service.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="sr-light-page sr-auth">
      <div className="sr-auth__topbar">
        <StudyRoomsBrand size="md" className="sr-auth__brand" />
        <button type="button" className="sr-auth__home" onClick={onGoToLanding}>Explore StudyRooms</button>
      </div>

      <section className="sr-auth__card" aria-labelledby="auth-title">
        {isLoading ? (
          <div className="sr-auth__loading" role="status">Checking your sign-in…</div>
        ) : (
          <>
            <p className="sr-auth__eyebrow">YOUR STUDY SPACE</p>
            <h1 id="auth-title">{isRegistering ? 'Create your account' : 'Welcome back'}</h1>
            <p className="sr-auth__intro">
              {isRegistering
                ? 'Create an account to keep your tasks and notes with you.'
                : 'Sign in to open your personal workspace.'}
            </p>

            <div className="sr-auth__switch" role="tablist" aria-label="Account options">
              <button type="button" role="tab" aria-selected={!isRegistering} className={!isRegistering ? 'is-active' : ''} onClick={() => changeMode('login')}>Sign in</button>
              <button type="button" role="tab" aria-selected={isRegistering} className={isRegistering ? 'is-active' : ''} onClick={() => changeMode('register')}>Create account</button>
            </div>

            {(serviceError || error) && <p className="sr-auth__error" role="alert">{error || serviceError}</p>}

            <form className="sr-auth__form" onSubmit={handleSubmit}>
              {isRegistering && (
                <label>
                  <span>Display name</span>
                  <input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} required />
                </label>
              )}
              <label>
                <span>Email</span>
                <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required />
              </label>
              <label>
                <span>Password</span>
                <input type="password" autoComplete={isRegistering ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={isRegistering ? 8 : undefined} maxLength={128} required />
                {isRegistering && <small>At least 8 characters</small>}
              </label>
              <button className="sr-auth__submit" type="submit" disabled={submitting}>
                {submitting ? 'Please wait…' : isRegistering ? 'Create account' : 'Sign in'}
              </button>
            </form>
            <p className="sr-auth__privacy">Your tasks and notes are stored with this account. Room history stays on this device.</p>
          </>
        )}
      </section>
      <footer className="sr-auth__footer">StudyRooms · Connect. Collaborate. Learn.</footer>
    </main>
  );
}
