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

export function WelcomeScreen({ error, busy, sentTo, devLink, onEmailSubmit }: Props) {
  const [email, setEmail] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    onEmailSubmit(email.trim());
  }

  return (
    <section className={styles.welcomeCard}>
      <h1>Sign in</h1>
      <p>
        Free REST API keys for integrators.
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
