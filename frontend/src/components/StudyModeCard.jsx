import Link from "next/link";
import { ArrowRight, BookOpen, Target } from "lucide-react";
import { cn } from "../lib/cn";

const VARIANTS = {
  study: {
    icon: BookOpen,
    ring: "hover:border-study/40",
    iconWrap: "bg-study-muted text-study",
    cta: "text-study",
  },
  test: {
    icon: Target,
    ring: "hover:border-test/40",
    iconWrap: "bg-test-muted text-test",
    cta: "text-test",
  },
};

// Two visual variants so Study and Test read as distinct experiences before
// the copy is even read: emerald/book for learning, indigo/target for assessment.
export default function StudyModeCard({ variant, title, description, bullets = [], ctaLabel, href }) {
  const styles = VARIANTS[variant] ?? VARIANTS.study;
  const Icon = styles.icon;

  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col rounded-lg border border-border bg-surface p-6 transition-all duration-150 hover:shadow-md",
        styles.ring
      )}
    >
      <span className={cn("flex h-11 w-11 items-center justify-center rounded-md", styles.iconWrap)} aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <h2 className="mt-4 text-h3 text-text-primary">{title}</h2>
      <p className="mt-1.5 text-body-sm text-text-muted">{description}</p>
      {bullets.length > 0 && (
        <ul className="mt-3 space-y-1 text-body-sm text-text-muted">
          {bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      )}
      <span className={cn("mt-5 inline-flex w-fit items-center gap-1.5 text-body-sm font-semibold transition-transform group-hover:translate-x-0.5", styles.cta)}>
        {ctaLabel} <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </Link>
  );
}
