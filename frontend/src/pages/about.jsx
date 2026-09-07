import { BarChart3, Sparkles, Target } from "lucide-react";
import Badge from "../components/ui/Badge";
import { Card } from "../components/ui/Card";

const VALUES = [
  {
    icon: Sparkles,
    title: "Explanations on demand",
    description: "Ask for a plain-English explanation on any question.",
  },
  {
    icon: BarChart3,
    title: "Progress tracking",
    description: "Track your accuracy across all six CTFL domains and see where to focus.",
  },
  {
    icon: Target,
    title: "Exam-style questions",
    description: "Questions follow the ISTQB CTFL exam format.",
  },
];

export default function AboutPage() {
  return (
    <div className="bg-background">
      <section className="px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <Badge tone="primary" className="uppercase tracking-wide">
            About AISTP
          </Badge>
          <h1 className="mt-4 text-display leading-[1.1] text-text-primary">
            The AI Assisted Software Testing Practice Platform
          </h1>
          <p className="mt-4 text-body-lg text-text-muted">
            AISTP helps you prepare for the ISTQB Certified Tester Foundation Level (CTFL) exam with practice
            questions, on-demand explanations, and progress tracking by domain.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-center text-h1 text-text-primary">What you get</h2>
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {VALUES.map((value) => {
            const Icon = value.icon;
            return (
              <Card key={value.title} className="p-6 transition-shadow duration-150 hover:shadow-sm">
                <span className="flex h-11 w-11 items-center justify-center rounded-md bg-primary-muted text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold text-text-primary">{value.title}</h3>
                <p className="mt-1 text-body-sm text-text-muted">{value.description}</p>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16">
        <Card className="bg-surface-muted p-8">
          <h2 className="text-h2 text-text-primary">Why AISTP?</h2>
          <p className="mt-3 text-body text-text-secondary">
            Studying alone is hard, especially when you can&apos;t tell why an answer is wrong. AISTP pairs
            practice with clear explanations and shows which CTFL domains need more attention.
          </p>
        </Card>
      </section>
    </div>
  );
}
