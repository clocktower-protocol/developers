import { useState } from 'react';
import styles from '../styles/App.module.css';
import { copyText } from '../lib/format';

type Props = {
  open: boolean;
  token: string | null;
  warning?: string;
  onClose: () => void;
};

export function RevealTokenModal({ open, token, warning, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  if (!open || !token) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="reveal-title">
      <div className={styles.modal}>
        <h3 id="reveal-title">Save your API key</h3>
        <p className={styles.warn}>
          {warning || 'Store this token now; it will not be shown again.'}
        </p>
        <div className={`${styles.tokenBox} mono`} data-testid="token-reveal">
          {token}
        </div>
        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.btn}
            onClick={async () => {
              const ok = await copyText(token);
              setCopied(ok);
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onClose}>
            I saved it
          </button>
        </div>
      </div>
    </div>
  );
}
