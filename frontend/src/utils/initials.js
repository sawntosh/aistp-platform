// Derives up to 2 uppercase initials from a name/username, e.g.
// "santosh chapagain" -> "SC", "santosh.chapagain" -> "SC", "santosh" -> "SA".
export function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
