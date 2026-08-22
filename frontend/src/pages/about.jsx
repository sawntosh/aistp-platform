const VALUES = [
  {
    icon: "🤖",
    gradient: "from-indigo-500 to-violet-500",
    title: "AI-guided learning",
    description:
      "Every practice question is paired with an AI tutor that can explain the reasoning behind the correct answer in plain English.",
  },
  {
    icon: "📊",
    gradient: "from-emerald-500 to-teal-500",
    title: "Data-driven progress",
    description:
      "We track your accuracy across all 6 CTFL domains so you always know exactly where to focus your study time.",
  },
  {
    icon: "🎯",
    gradient: "from-amber-500 to-rose-500",
    title: "Exam-realistic practice",
    description:
      "Questions are modeled on the real ISTQB CTFL exam format, so what you practice is what you'll see on test day.",
  },
];

export default function AboutPage() {
  return (
    <div className="bg-white">
      <section className="relative overflow-hidden bg-gradient-to-b from-sky-50 via-white to-white px-4 py-16 sm:py-24">
        <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-cyan-300/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 top-40 h-72 w-72 rounded-full bg-violet-300/30 blur-3xl" />

        <div className="relative mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
            About AISTP
          </span>
          <h1 className="mt-4 text-4xl font-bold leading-tight text-gray-900 sm:text-5xl">
            The AI Assisted Software Testing Practice Platform
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            AISTP helps aspiring software testers prepare for the ISTQB Certified Tester Foundation Level (CTFL)
            exam through realistic practice questions, instant AI-generated explanations, and detailed progress
            analytics. Our goal is to make exam prep focused, personalized, and a little less stressful.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-center text-2xl font-semibold text-gray-900">What we&apos;re built on</h2>
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {VALUES.map((value) => (
            <div
              key={value.title}
              className="rounded-xl border border-gray-100 bg-white p-6 shadow transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br text-lg ${value.gradient}`}
              >
                {value.icon}
              </span>
              <h3 className="mt-4 font-semibold text-gray-900">{value.title}</h3>
              <p className="mt-1 text-sm text-gray-600">{value.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16">
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-8">
          <h2 className="text-xl font-semibold text-gray-900">Why AISTP?</h2>
          <p className="mt-3 text-gray-600">
            Studying for a certification exam alone can be overwhelming, especially when you don&apos;t know why an
            answer is wrong. AISTP pairs targeted practice with an AI tutor that explains each concept as you go,
            and surfaces exactly which of the 6 CTFL domains need more attention, so every study session moves you
            closer to passing.
          </p>
        </div>
      </section>
    </div>
  );
}
