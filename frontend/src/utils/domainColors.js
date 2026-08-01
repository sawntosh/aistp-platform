// Stable color per domain name, independent of what the backend actually
// names the 6 CTFL domains -- same domain always renders the same color.
const PALETTE = [
  { bg: "bg-indigo-50", text: "text-indigo-700" },
  { bg: "bg-emerald-50", text: "text-emerald-700" },
  { bg: "bg-amber-50", text: "text-amber-700" },
  { bg: "bg-rose-50", text: "text-rose-700" },
  { bg: "bg-sky-50", text: "text-sky-700" },
  { bg: "bg-violet-50", text: "text-violet-700" },
];

export function getDomainColor(name) {
  if (!name) return PALETTE[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
