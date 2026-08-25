import Link from "next/link";

// Two visual variants so Study and Test read as distinct experiences
// even though they're built from the same card shape: "study" leans
// calm/educational (soft indigo, book icon), "test" leans
// assessment/measurable (solid slate, target icon).
const VARIANTS = {
  study: {
    wrapper: "border-indigo-100 bg-gradient-to-br from-indigo-50 to-white hover:border-indigo-300",
    icon: "bg-indigo-100 text-indigo-700",
    title: "text-indigo-950",
    cta: "bg-indigo-600 hover:bg-indigo-500 text-white",
  },
  test: {
    wrapper: "border-gray-200 bg-gradient-to-br from-gray-50 to-white hover:border-gray-400",
    icon: "bg-gray-900 text-white",
    title: "text-gray-950",
    cta: "bg-gray-900 hover:bg-gray-800 text-white",
  },
};

export default function StudyModeCard({ variant, icon, title, description, bullets = [], ctaLabel, href }) {
  const styles = VARIANTS[variant] ?? VARIANTS.study;

  return (
    <Link
      href={href}
      className={`group flex flex-col rounded-2xl border-2 p-6 shadow-sm transition-all hover:shadow-md active:scale-[0.99] ${styles.wrapper}`}
    >
      <span className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl ${styles.icon}`} aria-hidden="true">
        {icon}
      </span>
      <h2 className={`mt-4 text-lg font-semibold ${styles.title}`}>{title}</h2>
      <p className="mt-1.5 text-sm text-gray-600">{description}</p>
      {bullets.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-gray-500">
          {bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      )}
      <span
        className={`mt-5 inline-flex w-fit items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-all group-active:scale-[0.98] ${styles.cta}`}
      >
        {ctaLabel} <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}
