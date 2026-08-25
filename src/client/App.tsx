import { useCallback, useEffect, useState } from 'react';
import {
  ApiError,
  createKey,
  fetchKeys,
  fetchSession,
  logout,
  requestEmailLink,
  revokeKey,
  type ApiKeyMeta,
  type SessionInfo,
} from './api/client';
import { CreateKeyModal } from './components/CreateKeyModal';
import { KeyList } from './components/KeyList';
import { RevealTokenModal } from './components/RevealTokenModal';
import { WelcomeScreen } from './components/WelcomeScreen';
import { copyText } from './lib/format';
import styles from './styles/App.module.css';

const DOCS_REST =
  'https://clocktower.finance/docs/developers/REST%20API/authentication';
const DOCS_HOME = 'https://clocktower.finance/docs/developers';

const CURL_EXAMPLE =
  'curl -H "Authorization: Bearer <YOUR_API_KEY>" https://api.clocktower.finance/catalog';

const AUTH_ERRORS: Record<string, string> = {
  oauth: 'Sign-in was cancelled or failed. Try again.',
  email: 'That sign-in link is invalid or expired. Request a new one.',
};

function CopyIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function readQueryError(): string | null {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('error');
  if (!code) return null;
  return AUTH_ERRORS[code] ?? 'Sign-in failed. Try again.';
}

export default function App() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [keys, setKeys] = useState<ApiKeyMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revealToken, setRevealToken] = useState<string | null>(null);
  const [revealWarning, setRevealWarning] = useState<string | undefined>();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [curlCopied, setCurlCopied] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    setError(null);
    const s = await fetchSession();
    setSession(s);
    if (!s.authenticated) {
      setKeys([]);
      return;
    }
    const k = await fetchKeys();
    setKeys(k.keys);
  }, []);

  useEffect(() => {
    const queryError = readQueryError();
    if (queryError) {
      setError(queryError);
      window.history.replaceState({}, '', '/');
    }
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } catch (e) {
        if (!cancelled) {
          if (e instanceof ApiError && e.code === 'UNAUTHENTICATED') {
            setSession({ authenticated: false });
            setKeys([]);
          } else {
            setError(e instanceof Error ? e.message : String(e));
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function handleCreate(label: string) {
    setCreating(true);
    setError(null);
    try {
      const result = await createKey(label || undefined);
      setRevealToken(result.token);
      setRevealWarning(result.warning);
      setCreateOpen(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await revokeKey(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleEmail(email: string) {
    setEmailBusy(true);
    setError(null);
    try {
      const result = await requestEmailLink(email);
      setSentTo(email);
      setDevLink(result.devLink);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleLogout() {
    setError(null);
    try {
      await logout();
      setSession({ authenticated: false });
      setKeys([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const signedIn = session?.authenticated === true;

  return (
    <div className={styles.shell}>
      <header className={styles.nav}>
        <a className={styles.brand} href="/">
          Clocktower
        </a>
        <nav className={styles.navLinks}>
          {signedIn && <span>API keys</span>}
          <a href={DOCS_HOME} target="_blank" rel="noreferrer">
            Docs
          </a>
          <a href="https://clocktower.finance" target="_blank" rel="noreferrer">
            Home
          </a>
          {signedIn && (
            <>
              <span className={styles.navUser}>{session.email ?? session.provider}</span>
              <button type="button" className={styles.navSignOut} onClick={handleLogout}>
                Sign out
              </button>
            </>
          )}
        </nav>
      </header>

      <main className={styles.main}>
        {loading ? (
          <div className={styles.empty}>Loading…</div>
        ) : !signedIn ? (
          <WelcomeScreen
            error={error}
            busy={emailBusy}
            sentTo={sentTo}
            devLink={devLink}
            onEmailSubmit={handleEmail}
          />
        ) : (
          <>
            <section className={styles.hero}>
              <h1>Developer API keys</h1>
              <p>
                Free REST API keys for integrators. Higher limits than anonymous access. Keys
                authenticate with <code className="mono">Authorization: Bearer ctk_…</code>. MCP
                agents continue to use x402 — not API keys.
              </p>
            </section>

            {error && (
              <div className={styles.error} role="alert">
                {error}
              </div>
            )}

            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>Your keys</h2>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={() => setCreateOpen(true)}
                >
                  Create key
                </button>
              </div>
              <KeyList keys={keys} busyId={busyId} onRevoke={handleRevoke} />
            </section>

            <section className={styles.help}>
              <h3>Using your key</h3>
              <p>
                Send the key on REST requests only. Never commit it or expose it in frontend apps
                that call the API from a browser without a backend.
              </p>
              <div className={styles.curlBlock}>
                <pre className={`mono ${styles.curlExample}`}>{CURL_EXAMPLE}</pre>
                <button
                  type="button"
                  className={`${styles.copyIconBtn} ${curlCopied ? styles.copyIconBtnSuccess : ''}`}
                  title={curlCopied ? 'Copied' : 'Copy curl command'}
                  aria-label={curlCopied ? 'Copied' : 'Copy curl command'}
                  onClick={async () => {
                    const ok = await copyText(CURL_EXAMPLE);
                    if (ok) {
                      setCurlCopied(true);
                      window.setTimeout(() => setCurlCopied(false), 2000);
                    }
                  }}
                >
                  {curlCopied ? (
                    <>
                      <CheckIcon />
                      <span className={styles.copiedLabel} role="status" aria-live="polite">
                        Copied
                      </span>
                    </>
                  ) : (
                    <CopyIcon />
                  )}
                </button>
              </div>
              <p className={styles.helpNote}>
                Replace <code className="mono">&lt;YOUR_API_KEY&gt;</code> with the full secret shown
                once when you create a key (including the <code className="mono">ctk_</code> prefix).
              </p>
              <p>
                <a href={DOCS_REST} target="_blank" rel="noreferrer">
                  REST authentication docs
                </a>
              </p>
            </section>
          </>
        )}
      </main>

      <footer className={styles.footer}>
        Clocktower Developers
      </footer>

      <CreateKeyModal
        open={createOpen}
        busy={creating}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
      <RevealTokenModal
        open={Boolean(revealToken)}
        token={revealToken}
        warning={revealWarning}
        onClose={() => setRevealToken(null)}
      />
    </div>
  );
}
