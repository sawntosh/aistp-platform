import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  ClipboardCheck,
  Gauge,
  Puzzle,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { cn } from "../lib/cn";

const STATS = [
  { value: "6", label: "CTFL domains" },
  { value: "5", label: "Question types" },
  { value: "1–5", label: "Confidence scale" },
  { value: "AI", label: "Answer explanations" },
];

const MODES = [
  {
    tone: "study",
    icon: BookOpen,
    name: "Study Mode",
    tagline: "Learn, unscored",
    points: [
      "Read a syllabus topic, then reinforce it with tagged questions",
      "Immediate feedback and AI explanations on every answer",
      "Completely isolated from your Test Mode analytics",
    ],
  },
  {
    tone: "test",
    icon: ClipboardCheck,
    name: "Test Mode",
    tagline: "Simulate the exam",
    points: [
      "Answers, explanations and links withheld until you finish",
      "Rate your confidence 1–5 on every question",
      "Full session review with high-confidence-mistake flags",
    ],
  },
];

const FEATURES = [
  {
    tone: "primary",
    icon: Sparkles,
    title: "AI-powered explanations",
    description: "Stuck on a question? Get an instant, structured breakdown from an AI tutor grounded in the answer key.",
  },
  {
    tone: "study",
    icon: BarChart3,
    title: "Domain-by-domain analytics",
    description: "See your accuracy across all 6 CTFL domains and spot exactly where to focus next.",
  },
  {
    tone: "test",
    icon: Gauge,
    title: "Confidence tracking",
    description: "Every Test Mode answer carries a 1–5 self-rating, surfacing the questions you got wrong while sure.",
  },
];

const DOMAINS = [
  "Fundamentals of Testing",
  "Testing Throughout the SDLC",
  "Static Testing",
  "Test Analysis & Design",
  "Managing Test Activities",
  "Test Tools",
];

const TONE_TILE = {
  primary: "bg-primary-muted text-primary",
  study: "bg-study-muted text-study",
  test: "bg-test-muted text-test",
};

const TONE_RING = {
  primary: "ring-primary/20",
  study: "ring-study/20",
  test: "ring-test/20",
};

function PreviewQuestionCard() {
  const options = [
    { label: "A document from which requirements can be derived", correct: true },
    { label: "A formal record of executed test cases", correct: false },
    { label: "A synonym for the test plan", correct: false },
  ];
  return (
    <Card className="w-full max-w-sm overflow-hidden p-0 shadow-lg">
      <div className="flex items-center justify-between border-b border-border bg-surface-muted/60 px-5 py-3">
        <Badge tone="primary">Fundamentals of Testing</Badge>
        <span className="text-caption tabular-nums text-text-muted">Q3 / 10</span>
      </div>
      <div className="p-5">
        <p className="text-body font-medium text-text-primary">Which best defines a &ldquo;test basis&rdquo;?</p>
        <div className="mt-4 space-y-2">
          {options.map((o) => (
            <div
              key={o.label}
              className={cn(
                "flex items-start gap-2 rounded-md border px-3 py-2.5 text-body-sm transition-colors",
                o.correct
                  ? "border-success/60 bg-success-muted text-success"
                  : "border-border text-text-secondary"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                  o.correct ? "border-success bg-success text-white" : "border-border-strong"
                )}
              >
                {o.correct && <Check className="h-3 w-3" aria-hidden="true" />}
              </span>
              <span>{o.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-md bg-primary-muted/50 px-3 py-2 text-caption text-primary">
          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          AI: the test basis is the source you derive test cases from — not a record of running them.
        </div>
      </div>
    </Card>
  );
}

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="bg-background">
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        {/* decorative wash + grid */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute right-0 top-10 h-72 w-72 rounded-full bg-test/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-study/20 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle,_rgb(148_163_184_/_0.14)_1px,_transparent_1px)] [background-size:22px_22px]" />
        </div>

        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <Badge tone="primary" className="uppercase tracking-wide">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              AI-assisted CTFL prep
            </Badge>
            <h1 className="mt-4 text-balance text-[2.15rem] leading-[1.12] text-text-primary sm:text-display">
              Pass ISTQB CTFL with an{" "}
              <span className="bg-gradient-to-r from-primary via-test to-study bg-clip-text text-transparent">
                AI tutor
              </span>{" "}
              by your side
            </h1>
            <p className="mt-5 max-w-md text-body-lg text-text-muted">
              Practice real exam-style questions across all six domains, get structured AI explanations,
              and track accuracy and confidence until you&apos;re ready.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {user ? (
                <>
                  <Button href="/practice" size="lg" className="bg-gradient-to-r from-primary to-test shadow-sm shadow-primary/30 hover:opacity-90">
                    Continue practicing <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button href="/dashboard" variant="outline" size="lg">View analytics</Button>
                </>
              ) : (
                <>
                  <Button href="/register" size="lg" className="bg-gradient-to-r from-primary to-test shadow-sm shadow-primary/30 hover:opacity-90">
                    Get started free <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button href="/login" variant="outline" size="lg">Log in</Button>
                </>
              )}
            </div>

            <dl className="mt-10 grid max-w-md grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-6 sm:grid-cols-4">
              {STATS.map((s) => (
                <div key={s.label}>
                  <dt className="text-h2 font-bold tabular-nums text-text-primary">{s.value}</dt>
                  <dd className="text-caption text-text-muted">{s.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* stacked preview */}
          <div className="relative mx-auto flex w-full max-w-md justify-center lg:justify-end">
            <div className="rotate-[-2deg]">
              <PreviewQuestionCard />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Two modes ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <h2 className="text-h1 text-text-primary">Two ways to prepare</h2>
          <p className="mx-auto mt-2 max-w-lg text-body text-text-muted">
            Learn a topic without pressure, then prove it under exam conditions.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          {MODES.map((m) => {
            const Icon = m.icon;
            return (
              <Card
                key={m.name}
                className={cn(
                  "p-7 ring-1 transition-transform duration-150 hover:-translate-y-0.5",
                  TONE_RING[m.tone]
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={cn("flex h-11 w-11 items-center justify-center rounded-lg", TONE_TILE[m.tone])}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-text-primary">{m.name}</h3>
                    <p className="text-caption uppercase tracking-wide text-text-muted">{m.tagline}</p>
                  </div>
                </div>
                <ul className="mt-5 space-y-2.5">
                  {m.points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-body-sm text-text-secondary">
                      <Check
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0",
                          m.tone === "study" ? "text-study" : "text-test"
                        )}
                        aria-hidden="true"
                      />
                      {p}
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-h1 text-text-primary">Built to get you exam-ready</h2>
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <Card key={f.title} className="p-6 transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-sm">
                <span className={cn("flex h-11 w-11 items-center justify-center rounded-lg", TONE_TILE[f.tone])}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold text-text-primary">{f.title}</h3>
                <p className="mt-1 text-body-sm text-text-muted">{f.description}</p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ---------- Domains ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-border bg-surface p-7 sm:p-9">
          <div className="flex items-center gap-2 text-text-muted">
            <Puzzle className="h-4 w-4" aria-hidden="true" />
            <span className="text-caption font-medium uppercase tracking-wide">Full CTFL v4.0 syllabus coverage</span>
          </div>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {DOMAINS.map((d, i) => (
              <span
                key={d}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-muted/60 px-3.5 py-1.5 text-body-sm text-text-secondary"
              >
                <span className="tabular-nums text-text-muted">{i + 1}</span>
                {d}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      {!user && (
        <section className="mx-4 mb-20 sm:mx-auto sm:max-w-6xl">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-test px-8 py-12 text-center">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgb(255_255_255_/_0.18),_transparent_55%)]" />
            <div className="relative">
              <h2 className="text-h1 text-white">Ready to ace your CTFL exam?</h2>
              <p className="mx-auto mt-2 max-w-md text-body text-white/85">
                Create a free account and start your first session in under a minute.
              </p>
              <Button
                href="/register"
                size="lg"
                className="mt-7 bg-white text-primary shadow-sm hover:bg-white/90"
              >
                Get started free <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
