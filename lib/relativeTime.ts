/** Format an ISO timestamp as a Turkish relative-time string. */
export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return 'şimdi';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}sa önce`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'dün';
  if (day < 7) return `${day}g önce`;
  const wk = Math.floor(day / 7);
  if (wk < 4) return `${wk}h önce`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}ay önce`;
  return `${Math.floor(day / 365)}y önce`;
}
