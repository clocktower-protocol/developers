import { useState } from 'react';
import styles from '../styles/App.module.css';

type Props = {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (label: string) => void;
};

export function CreateKeyModal({ open, busy, onClose, onSubmit }: Props) {
  const [label, setLabel] = useState('');
  if (!open) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="create-key-title">
      <div className={styles.modal}>
        <h3 id="create-key-title">Create API key</h3>
        <p>Optional label to help you remember this key. The secret is shown only once.</p>
        <div className={styles.field}>
          <label htmlFor="key-label">Label</label>
          <input
            id="key-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. local-dev"
            maxLength={100}
            disabled={busy}
          />
        </div>
        <div className={styles.modalActions}>
          <button type="button" className={styles.btn} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={busy}
            onClick={() => onSubmit(label.trim())}
          >
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
