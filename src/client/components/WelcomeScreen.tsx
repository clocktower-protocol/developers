import { useState, type FormEvent } from 'react';
import styles from '../styles/App.module.css';

type Props = {
  error: string | null;
  busy: boolean;
  sentTo: string | null;
  devLink?: string;
  onEmailSubmit: (email: string) => void;
};

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.94.85.09-.67.35-1.12.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.73 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.84c.85 0 1.71.12 2.51.35 1.9-1.32 2.74-1.05 2.74-1.05.55 1.42.2 2.47.1 2.73.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.6.69.49A10.03 10.03 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.24 1.26-.96 2.33-2.04 3.05l3.3 2.56c1.92-1.77 3.03-4.38 3.03-7.49 0-.72-.07-1.41-.19-2.08H12Z"
      />
      <path
        fill="#34A853"
        d="M5.3 14.35A7.2 7.2 0 0 1 4.9 12c0-.82.14-1.61.38-2.35l-3.5-2.71A11.96 11.96 0 0 0 0 12c0 1.93.46 3.75 1.28 5.36l4.02-3.01Z"
      />
      <path
        fill="#4A90E2"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.3-2.56c-.91.62-2.09.98-3.65.98-2.81 0-5.2-1.9-6.05-4.45l-4.02 3.1C4.8 21.64 8.13 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.45-3.45C17.95 1.15 15.24 0 12 0 8.13 0 4.8 2.36 2.78 5.94l3.5 2.71C6.8 6.65 9.19 4.75 12 4.75Z"
      />
    </svg>
  );
}

export function WelcomeScreen({ error, busy, sentTo, devLink, onEmailSubmit }: Props) {
  const [email, setEmail] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    onEmailSubmit(email.trim());
  }

  return (
    <section className={styles.welcomeCard}>
      <h1>Sign in to Clocktower Developers</h1>
      <p>
        Create a free account to mint REST API keys. MCP agents continue to use x402 — not API keys.
      </p>
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      <a className={`${styles.btn} ${styles.btnFull} ${styles.btnOauth}`} href="/api/auth/github">
        <GitHubIcon />
        Continue with GitHub
      </a>
      <a className={`${styles.btn} ${styles.btnFull} ${styles.btnOauth}`} href="/api/auth/google">
        <GoogleIcon />
        Continue with Google
      </a>
      <div className={styles.divider}>
        <span>or</span>
      </div>
      {sentTo ? (
        <p className={styles.sentNote} role="status">
          Check <strong>{sentTo}</strong> for a sign-in link. It expires in 15 minutes.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className={styles.emailForm}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
          <button
            type="submit"
            className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`}
            disabled={busy}
          >
            {busy ? 'Sending…' : 'Email me a sign-in link'}
          </button>
        </form>
      )}
      {devLink && (
        <p className={styles.devEcho}>
          Local only:{' '}
          <a href={devLink}>open the magic link</a>
        </p>
      )}
    </section>
  );
}
