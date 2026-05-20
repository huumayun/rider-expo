export function toDate(ts: any) {
  if (!ts) return null;
  if (ts?.seconds) return new Date(ts.seconds * 1000);
  if (ts?.toDate) return ts.toDate();
  return new Date(ts);
}

export function formatAppDate(ts: any, lang: string) {
  try {
    const d = toDate(ts);
    if (!d) return '—';
    const locale = lang === 'bn' ? 'bn-BD' : 'en-GB';
    return `${d.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
  } catch (e) {
    return '—';
  }
}
