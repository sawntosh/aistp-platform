import { getInitials } from "../utils/initials";

// Same hash-based approach as utils/domainColors.js -- a given name always
// lands on the same color, no state or backend field required.
const COLORS = [
  "bg-indigo-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-sky-600",
  "bg-violet-600",
];

function colorFor(name) {
  if (!name) return COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length];
}

export default function UserAvatar({ name, size = "sm", className = "" }) {
  const sizeClasses = size === "lg" ? "h-14 w-14 text-lg" : "h-8 w-8 text-xs";

  return (
    <span
      title={name}
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${colorFor(name)} ${sizeClasses} ${className}`}
    >
      {getInitials(name)}
    </span>
  );
}
