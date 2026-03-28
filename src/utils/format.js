export function fmt(v) {
  if (v == null) return '\u2014';
  if (typeof v === 'number') return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1);
  return v;
}
