import type { ApiKeyMeta } from '../api/client';
import { formatDate, truncateId } from '../lib/format';
import styles from '../styles/App.module.css';

type Props = {
  keys: ApiKeyMeta[];
  busyId: string | null;
  onRevoke: (id: string) => void;
};

export function KeyList({ keys, busyId, onRevoke }: Props) {
  if (keys.length === 0) {
    return (
      <div className={styles.empty} data-testid="empty-keys">
        No API keys yet. Create one to call Clocktower REST and MCP with higher free limits.
      </div>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Label</th>
            <th>Key id</th>
            <th>Prefix</th>
            <th>Created</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k.id}>
              <td>{k.label || '—'}</td>
              <td className="mono" title={k.id}>
                {truncateId(k.id, 14)}
              </td>
              <td className="mono">{k.tokenHashPrefix}</td>
              <td>{formatDate(k.createdAt)}</td>
              <td>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnDanger}`}
                  disabled={busyId === k.id}
                  onClick={() => {
                    if (window.confirm(`Revoke key ${k.id}? This cannot be undone.`)) {
                      onRevoke(k.id);
                    }
                  }}
                >
                  {busyId === k.id ? 'Revoking…' : 'Revoke'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
