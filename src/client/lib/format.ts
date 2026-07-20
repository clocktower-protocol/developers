export function formatDate(ms: number): string {
  try {
    return new Date(ms).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return String(ms);
  }
}

export function truncateId(id: string, keep = 12): string {
  if (id.length <= keep + 3) return id;
  return `${id.slice(0, keep)}…`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
