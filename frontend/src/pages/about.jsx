import { BarChart3, Sparkles, Target } from "lucide-react";
import Badge from "../components/ui/Badge";
import { Card } from "../components/ui/Card";

const VALUES = [
  {
    icon: Sparkles,
    title: "AI-guided learning",
    description:
      "Every practice question is paired with an AI tutor that can explain the reasoning behind the correct answer in plain English.",
  },
  {
    icon: BarChart3,
    title: "Data-driven progress",
    description:
      "We track your accuracy across all 6 CTFL domains so you always know exactly where to focus your study time.",
  },
  {
    icon: Target,
    title: "Exam-realistic practice",
    description:
      "Questions are modeled on the real ISTQB CTFL exam format, so what you practice is what you'll see on test day.",
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
            AISTP helps aspiring software testers prepare for the ISTQB Certified Tester Foundation Level (CTFL)
            exam through realistic practice questions, instant AI-generated explanations, and detailed progress
            analytics. Our goal is to make exam prep focused, personalized, and a little less stressful.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-center text-h1 text-text-primary">What we&apos;re built on</h2>
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
            Studying for a certification exam alone can be overwhelming, especially when you don&apos;t know why an
            answer is wrong. AISTP pairs targeted practice with an AI tutor that explains each concept as you go,
            and surfaces exactly which of the 6 CTFL domains need more attention, so every study session moves you
            closer to passing.
          </p>
        </Card>
      </section>
    </div>
  );
}
