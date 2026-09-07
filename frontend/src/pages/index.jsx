import Link from "next/link";
import { BarChart3, Check, Sparkles, Target } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { Card } from "../components/ui/Card";

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI explanations",
    description: "Ask for a plain-English explanation on any question you're unsure about.",
  },
  {
    icon: BarChart3,
    title: "Progress by domain",
    description: "See your accuracy across all six CTFL domains and where to focus next.",
  },
  {
    icon: Target,
    title: "Know where to focus",
    description: "Your dashboard flags weak domains so you know what to practice next.",
  },
];

const PREVIEW_OPTIONS = [
  { label: "A test basis is a document from which requirements can be derived.", correct: true },
  { label: "A test basis is a formal record of executed test cases.", correct: false },
  { label: "A test basis is a synonym for a test plan.", correct: false },
];

function QuestionPreviewCard() {
  return (
    <Card className="w-full max-w-md p-6 shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <Badge tone="primary">Testing Fundamentals</Badge>
        <span className="text-caption text-text-muted">Question 3 of 10</span>
      </div>
      <p className="mb-4 text-body font-medium text-text-primary">Which statement best defines a &ldquo;test basis&rdquo;?</p>
      <div className="space-y-2">
        {PREVIEW_OPTIONS.map((option) => (
          <div
            key={option.label}
            className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-body-sm ${
              option.correct ? "border-success bg-success-muted text-success" : "border-border text-text-secondary"
            }`}
          >
            {option.correct && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
            <span>{option.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="bg-background">
      <section className="px-4 py-16 sm:py-24">
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div>
            <Badge tone="primary" className="uppercase tracking-wide">
              ISTQB CTFL practice
            </Badge>
            <h1 className="mt-4 text-display leading-[1.1] text-text-primary">
              Prepare for the ISTQB CTFL exam
            </h1>
            <p className="mt-4 max-w-md text-body-lg text-text-muted">
              Practice exam-style questions, get an explanation when you&apos;re stuck, and track your accuracy
              by domain.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {user ? (
                <>
                  <Button href="/practice" size="lg">
                    Continue practicing
                  </Button>
                  <Button href="/dashboard" variant="outline" size="lg">
                    View analytics
                  </Button>
                </>
              ) : (
                <>
                  <Button href="/register" size="lg">
                    Get started free
                  </Button>
                  <Button href="/login" variant="outline" size="lg">
                    Log in
                  </Button>
                </>
              )}
            </div>

            <div className="mt-8 flex flex-wrap gap-2 text-caption font-medium text-text-muted">
              <span className="rounded-full bg-surface-muted px-3 py-1">6 CTFL domains</span>
              <span className="rounded-full bg-surface-muted px-3 py-1">Instant feedback</span>
              <span className="rounded-full bg-surface-muted px-3 py-1">Progress tracking</span>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <QuestionPreviewCard />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-center text-h1 text-text-primary">What&apos;s included</h2>
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="p-6 transition-shadow duration-150 hover:shadow-sm">
                <span className="flex h-11 w-11 items-center justify-center rounded-md bg-primary-muted text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold text-text-primary">{feature.title}</h3>
                <p className="mt-1 text-body-sm text-text-muted">{feature.description}</p>
              </Card>
            );
          })}
        </div>
      </section>

      {!user && (
        <section className="mx-4 mb-16 max-w-5xl rounded-lg bg-primary px-8 py-10 text-center sm:mx-auto">
          <h2 className="text-h1 text-primary-foreground">Ready to start?</h2>
          <p className="mt-2 text-body text-primary-foreground/80">Create a free account and start practicing.</p>
          <Button href="/register" variant="secondary" size="lg" className="mt-6 bg-white text-primary hover:bg-white/90">
            Get started free
          </Button>
        </section>
      )}
    </div>
  );
}
