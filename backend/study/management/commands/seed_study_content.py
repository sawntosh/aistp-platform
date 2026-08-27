"""
Seeds Study Mode content for all 6 CTFL v4.0 domains.

Grounded in data already in the bank: each topic below corresponds
exactly to a group of `learning_objective_id` values (e.g. "1.3.1")
already present on existing, real Question rows in that domain -- the
same ISTQB CTFL syllabus sub-chapter numbering the question bank itself
uses. Running this command tags those existing questions with their
Topic (Question.topic) and creates the matching StudyContent reading.

Safe to re-run: every write is get_or_create/update_or_create.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from questions.models import Domain, Question, Topic
from study.models import StudyContent

DOMAIN_1_TOPICS = [
    {
        "title": "What Is Testing?",
        "description": "Test objectives, and how testing differs from debugging.",
        "objective_ids": ["1.1.1", "1.1.2"],
        "content": """## Introduction

Testing is a set of activities used to find defects in a component or system and to evaluate whether it meets its specified requirements. It happens throughout the software development lifecycle, not just after coding is finished.

## Key idea

Testing is not the same as debugging. Testing finds failures; debugging finds and fixes the cause of a failure.

## Why does this matter?

Confusing testing with debugging is one of the most common misunderstandings for new testers. Testers identify that something is wrong; developers typically diagnose the root cause and fix it, and testers then confirm the fix worked.

## Key points

- Testing includes planning, analysis, design, execution, and evaluation -- not just running test cases.
- Typical test objectives include finding defects, gaining confidence in quality, preventing defects, and providing information for decisions.
- Testing and debugging are separate, complementary activities, usually performed by different people with different goals.""",
    },
    {
        "title": "Why Is Testing Necessary?",
        "description": "How testing supports decisions, and the relationship between error, defect, and failure.",
        "objective_ids": ["1.2.1", "1.2.2", "1.2.3"],
        "content": """## Introduction

Software errors can be expensive, damage a company's reputation, or in safety-critical systems, even cost lives. Testing exists to manage this risk.

## Key idea

Testing provides stakeholders with information about the quality of the software and the risk of releasing it -- it does not, and cannot, prove the software is defect-free.

## Why does this matter?

Testing informs decisions. It gives project stakeholders the evidence they need to decide whether software is ready to release, needs more work, or carries an acceptable level of risk.

## Testing and quality assurance

Testing is a form of quality control -- it evaluates a specific product. Quality assurance is broader: it focuses on the processes used to build the product, aiming to prevent defects rather than just find them.

## From error to failure

- A **mistake** (human error) can introduce a **defect** into the code or a document.
- A defect **may** cause a **failure** -- but only if the defective part of the code is actually executed under the right conditions to trigger it.
- Not every defect leads to a failure, and not every failure is caused by a defect in the code -- it could be environmental, for example.

## Key points

- Testing provides information to support release and risk decisions.
- Quality assurance is process-focused and preventive; testing is product-focused.
- A mistake leads to a defect, which may (or may not) cause a failure.""",
    },
    {
        "title": "Seven Testing Principles",
        "description": "Seven general principles that apply across almost all testing.",
        "objective_ids": ["1.3.1"],
        "content": """## Introduction

Over decades of practice, testers have identified seven general principles that hold true across almost all types of testing.

## The seven principles

1. **Testing shows the presence of defects, not their absence.** Testing can show that defects exist, but cannot prove software is defect-free.
2. **Exhaustive testing is impossible.** Except in trivial cases, testing every input and precondition combination is not feasible.
3. **Early testing saves time and money.** Static testing and early dynamic testing find defects early, when they are cheaper to fix.
4. **Defects cluster together.** A small number of modules usually contain most of the defects found, or account for most operational failures.
5. **Beware of the pesticide paradox.** Repeating the same tests eventually stops finding new defects -- tests need to be reviewed and varied over time.
6. **Testing is context dependent.** Testing is done differently for, say, a safety-critical medical system than for a simple website.
7. **Absence-of-defects is a fallacy.** Finding and fixing defects doesn't help if the system built does not meet users' needs and expectations.

## Key idea

Testing can reveal failures, but testing cannot prove that a system contains no defects.

## Why does this matter?

Understanding these principles helps testers set realistic expectations, prioritize testing effort, and explain to stakeholders why "100% tested" is never really achievable.

## Key points

- Testing reduces risk; it does not eliminate it.
- Exhaustive testing is not the goal -- risk-based prioritization is.
- Vary your tests over time to avoid the pesticide paradox.""",
    },
    {
        "title": "Test Process",
        "description": "The fundamental test process, and why traceability matters.",
        "objective_ids": ["1.4.1", "1.4.4"],
        "content": """## Introduction

The fundamental test process describes the set of activities that together make up a well-managed testing effort, from planning through to closure.

## The fundamental test activities

- **Test planning** -- defining objectives and approach.
- **Test monitoring and control** -- comparing progress against the plan and taking corrective action.
- **Test analysis** -- determining *what* to test, by analyzing the test basis and defining test conditions.
- **Test design** -- determining *how* to test, by elaborating test conditions into test cases and other testware.
- **Test implementation** -- preparing the testware needed for execution, such as scripts, data, and environments.
- **Test execution** -- running the tests and comparing actual results to expected results.
- **Test completion** -- consolidating results, reporting, and archiving testware for later reuse.

## Key idea

Test analysis answers "what to test?" while test design answers "how to test?" -- distinct activities, even though they can overlap in practice.

## Traceability

Maintaining traceability between the test basis (for example, requirements) and testware (test cases, test data) makes it possible to assess the impact of changes, and to report progress and quality in terms stakeholders understand.

## Key points

- The fundamental test process is iterative, not strictly linear.
- Good traceability supports impact analysis and meaningful progress reporting.
- Each activity produces its own testware, feeding into the next.""",
    },
    {
        "title": "Testware",
        "description": "The artifacts testing produces, and why they're worth keeping organized.",
        "objective_ids": ["1.4.3"],
        "content": """## Introduction

Testware is the collective term for all the artifacts produced during testing.

## Key idea

Testware is created throughout every activity of the test process, not just during test design.

## Examples of testware

- Test plans and test strategies
- Test conditions and test cases
- Test scripts and test data
- Test environments and configurations
- Test logs, incident/defect reports, and test summary reports

## Why does this matter?

Well-maintained testware makes testing repeatable, supports regression testing on future changes, and gives new team members a reliable record of what was tested and why.

## Key points

- Testware is produced across the whole test process, not only at design time.
- Keeping testware organized supports reuse, maintenance, and audits.""",
    },
    {
        "title": "Roles and Responsibilities",
        "description": "Test management vs. testing roles, and the tradeoffs of independence.",
        "objective_ids": ["1.4.5", "1.5.3"],
        "content": """## Introduction

The CTFL syllabus distinguishes two generic roles in testing: the test management role and the testing role.

## Key idea

Test managers are responsible for the overall testing effort -- planning, monitoring, staffing. Testers are responsible for the detailed activities -- analysis, design, execution.

## Independence of testing

Having someone other than the author test a piece of work can improve defect-finding, since an independent perspective isn't biased by the author's assumptions. But independence has drawbacks too.

## Key points

- Common levels of independence range from no independence at all (developers testing their own code) to fully independent teams or outside specialists.
- Benefits of independence: an unbiased perspective, more likely to notice different types of defects.
- Drawbacks of independence: potential isolation from the development team, and possibly being seen as a bottleneck late in the schedule.""",
    },
    {
        "title": "The Psychology of Testing",
        "description": "The tester mindset, and why how you report a defect matters as much as finding it.",
        "objective_ids": ["1.5.1"],
        "content": """## Introduction

Testing requires a specific mindset. Testers spend much of their time looking for problems in someone else's work, which has real psychological implications for both testers and the people whose work they test.

## Key idea

A good tester is professionally curious, has a critical eye, pays attention to detail, and communicates diplomatically -- raising defects and risk without making it personal.

## Why does this matter?

Reporting a defect can be perceived as criticism of the person, not the product, if it isn't communicated carefully. That can create friction between testers and developers if it isn't managed well.

## Key points

- Useful generic skills for testers include knowledge of testing, thoroughness, attention to detail, good communication, and analytical thinking.
- Frame defect reports around the product and the risk, not the person who wrote the code.
- Independence of testing is one structural way of supporting an objective, unbiased mindset.""",
    },
]

DOMAIN_2_TOPICS = [
    {
        "title": "Testing in the Software Development Lifecycle",
        "description": "How good testing practices adapt to sequential, iterative, and DevOps lifecycles.",
        "objective_ids": ["2.1.1", "2.1.2", "2.1.3", "2.1.4", "2.1.5", "2.1.6"],
        "content": """## Introduction

No matter which software development lifecycle a team uses -- sequential, iterative, or a hybrid -- testing activities need to fit around it, not be bolted on at the end.

## Key idea

Regardless of the lifecycle model, good testing practices stay the same: every development activity has a corresponding test activity, each test level has its own objectives, testers are involved in reviewing work products as soon as drafts exist, and tests are planned and prioritized based on risk.

## Test-first and shift-left

Test-first approaches, such as test-driven development (TDD), acceptance test-driven development (ATDD), and behavior-driven development (BDD), write tests before the corresponding code. This is a form of "shift-left" -- moving testing earlier in the lifecycle so defects are found (and prevented) sooner, when they're cheaper to fix.

## DevOps and continuous delivery

DevOps combines development and operations to shorten delivery cycles through practices like continuous integration, continuous delivery, and frequent automated testing. Effective testing in a DevOps context relies heavily on automation and fast feedback.

## Retrospectives

A retrospective is a workshop held at the end of an iteration or project to reflect on what worked, what didn't, and what to improve -- a mechanism for continuous process improvement that includes testing practices.

## Key points

- Good testing practices are lifecycle-independent: they just need to be adapted to the model in use.
- Shift-left means testing earlier and more often, not testing less.
- DevOps depends on fast, automated feedback loops.
- Retrospectives turn lessons learned into concrete process improvements.""",
    },
    {
        "title": "Test Levels and Test Types",
        "description": "Component, integration, system, and acceptance testing, and how test types differ from test levels.",
        "objective_ids": ["2.2.1", "2.2.2", "2.2.3"],
        "content": """## Introduction

Test levels group testing activities that are managed together, while test types group testing activities aimed at a particular characteristic of the software.

## Key idea

The four classic test levels -- component (unit), integration, system, and acceptance testing -- each have their own objectives, test basis, and typical test object, and can be applied within any development lifecycle.

## Test types

- **Functional testing** evaluates what the system does -- specific functions or behavior.
- **Non-functional testing** evaluates *how well* the system performs -- performance, usability, security, reliability, and so on.
- **White-box testing** derives tests from the software's internal structure.
- **Black-box testing** derives tests from external specifications, without looking at the code.

## Confirmation vs. regression testing

Confirmation testing (re-testing) checks that a specific defect fix actually worked. Regression testing checks that previously working functionality still works after a change -- the two are related but not the same, and both matter after a fix.

## Key points

- Test levels are about *when and by whom*; test types are about *what characteristic* is being tested.
- A single test can belong to one test level but exercise multiple test types.
- After fixing a bug, confirm the fix *and* run regression tests -- one doesn't replace the other.""",
    },
    {
        "title": "Maintenance Testing",
        "description": "What triggers testing on software that's already live.",
        "objective_ids": ["2.3", "2.3.1"],
        "content": """## Introduction

Software keeps needing testing long after its first release, whenever it's modified, migrated, or retired.

## Key idea

Maintenance testing is triggered by modification (enhancements, corrective/emergency fixes), migration (e.g. moving to a new platform), or planned retirement of a system.

## Why does this matter?

Changes made during maintenance can have unintended side effects on parts of the system that weren't directly touched -- this is exactly why impact analysis and regression testing matter so much during maintenance.

## Key points

- Maintenance testing triggers: modification, migration, and retirement.
- Impact analysis helps decide how much regression testing a change actually needs.
- Retirement testing might focus on data archiving and migration rather than new functionality.""",
    },
]

DOMAIN_3_TOPICS = [
    {
        "title": "Static Testing Basics",
        "description": "What static testing examines, and how it differs from dynamic testing.",
        "objective_ids": ["3.1.1", "3.1.2", "3.1.3"],
        "content": """## Introduction

Static testing examines a work product directly, without executing the code -- reviews of documents, and static analysis of source code.

## Key idea

Almost any work product can be examined statically: requirements, designs, code, test plans, and test cases -- not just source code.

## Why does this matter?

Because static testing doesn't require running the software, it can start very early in the lifecycle, before there's anything executable at all -- catching defects, like an ambiguous requirement, far earlier than dynamic testing ever could.

## Static vs. dynamic testing

Static testing finds defects directly, before execution -- for example, spotting an inconsistency in a requirements document. Dynamic testing finds failures by running the software and observing whether the actual result matches the expected result, then works backward to the defect that caused it.

## Key points

- Static testing can be applied to almost any work product, at any stage.
- Static and dynamic testing are complementary, not competing -- they tend to find different classes of defects.
- The earlier a defect is caught statically, the cheaper it typically is to fix.""",
    },
    {
        "title": "Reviews and Feedback",
        "description": "The formal review process, review roles, and the different review types.",
        "objective_ids": ["3.2.1", "3.2.2", "3.2.3", "3.2.4", "3.2.5"],
        "content": """## Introduction

A review is a type of static testing where people examine a work product and give feedback -- ranging from an informal read-through to a highly structured formal inspection.

## Key idea

Getting early and frequent feedback from stakeholders through reviews catches misunderstandings and defects long before they'd otherwise be found, when they are far cheaper to fix.

## The formal review process

A formal review typically moves through planning, kick-off, individual review (preparation), review meeting/issue communication, and rework and follow-up -- with a clear entry and exit process, not just an ad hoc meeting.

## Roles in a review

- **Author** -- creates and fixes the work product under review.
- **Moderator/Facilitator** -- leads the review process.
- **Scribe/Recorder** -- logs issues found.
- **Reviewers** -- examine the work product and identify potential defects.
- **Manager** -- decides on the execution of reviews and allocates resources and time.

## Review types

Review types range from informal (no defined process) through walkthrough (author-led) and technical review (peer-driven, focused on technical content) to inspection (the most formal, with defined roles, metrics, and entry/exit criteria).

## Key points

- Reviews are a form of static testing performed by people, not tools.
- More formal review types find more defects but cost more time and structure.
- Success factors include clear objectives, the right participants, a blame-free atmosphere, and management support.""",
    },
]

DOMAIN_4_TOPICS = [
    {
        "title": "Test Techniques Overview",
        "description": "How black-box, white-box, and experience-based techniques differ.",
        "objective_ids": ["4.1", "4.1.1"],
        "content": """## Introduction

A test technique is a defined procedure for deriving and/or selecting test cases.

## Key idea

Test techniques fall into three broad categories: black-box (behavior-based), white-box (structure-based), and experience-based.

## Why does this matter?

Different techniques are good at finding different kinds of defects, and choosing the right mix -- rather than relying on just one -- gives much better test coverage than intuition alone.

## Key points

- Black-box techniques derive tests from a specification, without needing to see the code.
- White-box techniques derive tests from the code's internal structure.
- Experience-based techniques rely on the tester's knowledge and intuition, often as a complement to the more systematic techniques.""",
    },
    {
        "title": "Black-Box Test Techniques",
        "description": "Equivalence partitioning, boundary value analysis, decision tables, and state transition testing.",
        "objective_ids": ["4.2", "4.2.1", "4.2.2", "4.2.3", "4.2.4"],
        "content": """## Introduction

Black-box techniques derive test cases from a specification of behavior, without any knowledge of the internal code structure.

## Key idea

Four black-box techniques cover most everyday testing needs: equivalence partitioning, boundary value analysis, decision table testing, and state transition testing.

## The techniques

- **Equivalence partitioning** divides data into partitions where the software should behave the same way, so testing one value from a partition represents the whole partition.
- **Boundary value analysis** tests the edges of those partitions, where defects cluster most often -- an extension of equivalence partitioning.
- **Decision table testing** captures combinations of conditions and their resulting actions in a table, useful for testing complex business rules.
- **State transition testing** models a system as a set of states and the valid transitions between them, useful when behavior depends on prior events.

## Key points

- Equivalence partitioning and boundary value analysis are usually used together.
- Decision tables are especially good at exposing combinations a tester might otherwise miss.
- State transition testing suits systems whose behavior depends on history, not just current input.""",
    },
    {
        "title": "White-Box Test Techniques",
        "description": "Statement testing and branch testing, and what code coverage actually measures.",
        "objective_ids": ["4.3", "4.3.1", "4.3.2"],
        "content": """## Introduction

White-box techniques derive tests from the internal structure of the code itself, such as statements or decision points.

## Key idea

Statement testing exercises every executable statement in the code at least once; branch testing exercises every branch outcome, such as both the true and false side of an "if", at least once.

## Why does this matter?

Branch coverage is a stronger criterion than statement coverage -- achieving 100% branch coverage guarantees 100% statement coverage, but not the other way around.

## Key points

- Coverage measures how much of the structure testing has actually exercised.
- 100% coverage of any kind does not mean the software is defect-free -- it only measures how much structure was executed, not whether the results were checked correctly.
- White-box techniques complement black-box techniques by targeting logic the specification alone might not reveal.""",
    },
    {
        "title": "Experience-Based Test Techniques",
        "description": "Error guessing and exploratory testing.",
        "objective_ids": ["4.4", "4.4.1", "4.4.2"],
        "content": """## Introduction

Experience-based techniques draw on the tester's own knowledge and intuition, and on experience with similar systems, to design tests.

## Key idea

Error guessing anticipates likely defects based on experience; exploratory testing designs and executes tests simultaneously, using what's learned from each test to inform the next.

## Why does this matter?

Systematic techniques are powerful but can miss things nobody thought to specify -- experience-based techniques are good at catching exactly those gaps, especially when time or documentation is limited.

## Key points

- Error guessing works well alongside a checklist of common defect types.
- Exploratory testing is structured around learning, not improvisation without purpose -- it's typically time-boxed and has a charter or mission.
- Both techniques rely heavily on the individual tester's skill and domain knowledge.""",
    },
    {
        "title": "Collaboration-Based Test Approaches",
        "description": "User stories, acceptance criteria, and acceptance test-driven development.",
        "objective_ids": ["4.5", "4.5.1", "4.5.2", "4.5.3"],
        "content": """## Introduction

Collaboration-based approaches involve testers working closely with developers and business stakeholders to define what needs to be built and tested, before it's built.

## Key idea

A user story is a short, structured description of a feature written from the user's perspective, typically produced collaboratively by the whole team -- including the tester.

## Acceptance criteria and ATDD

Acceptance criteria define the conditions a user story must satisfy to be considered done, and can also serve as the basis for tests. Acceptance test-driven development (ATDD) derives tests from those acceptance criteria *before* the code is written, so the tests themselves help define the required behavior.

## Key points

- Involving testers early in writing user stories improves testability and reduces ambiguity.
- Acceptance criteria are a shared, precise definition of "done" for a story.
- In ATDD, tests are written first and act as executable specifications, not just a check performed afterward.""",
    },
]

DOMAIN_5_TOPICS = [
    {
        "title": "Test Planning",
        "description": "What a test plan covers, entry/exit criteria, estimation, and the test pyramid.",
        "objective_ids": ["5.1", "5.1.1", "5.1.2", "5.1.3", "5.1.4", "5.1.5", "5.1.6", "5.1.7"],
        "content": """## Introduction

A test plan documents the objectives, scope, approach, and resources for a testing effort.

## Key idea

Good test planning also means adding value to iteration and release planning -- for example, by helping estimate testing effort and identifying risks early, not just documenting a plan after decisions are already made.

## Entry and exit criteria

**Entry criteria** define the conditions that must be satisfied before a test activity can start, such as the test environment being ready. **Exit criteria** define what must be true to consider that activity finished, such as reaching a target level of coverage.

## Estimation and prioritization

Test effort can be estimated using techniques based on ratios (metrics from similar past projects) or expert opinion, such as Wideband Delphi. Once tests are identified, they're prioritized -- commonly by risk, so the tests most likely to catch important problems run first.

## Test pyramid and testing quadrants

The **test pyramid** illustrates that most tests should be fast, cheap unit/component tests, with progressively fewer integration and end-to-end/UI tests further up. The **testing quadrants** map test types against whether they support the team versus critique the product, and whether they're technology-facing versus business-facing, helping relate test types to test levels.

## Key points

- A test plan should be a living document, updated as the project's risks and context change.
- Entry/exit criteria stop testing from starting too early or stopping too soon.
- The test pyramid argues for a broad base of fast automated tests, not a "top-heavy" suite of slow, brittle UI tests.""",
    },
    {
        "title": "Risk Management",
        "description": "Risk likelihood, risk impact, and the difference between project risk and product risk.",
        "objective_ids": ["5.2", "5.2.1", "5.2.2"],
        "content": """## Introduction

Risk-based testing uses risk to decide what to test, how much, and in what order.

## Key idea

Risk level is determined by combining **risk likelihood** (how probable the risk is) and **risk impact** (how bad the consequences would be if it occurred) -- higher likelihood and higher impact together mean higher risk.

## Project risks vs. product risks

**Project risks** threaten the project's ability to deliver -- for example, a key team member leaving, or a supplier missing a deadline. **Product risks** are potential failures of the software itself, such as a calculation being wrong under certain conditions.

## Key points

- Risk level typically drives test prioritization: higher-risk areas get tested first and most thoroughly.
- Project risks are managed like any other project risk; product risks specifically justify test effort.
- Risk assessment should be revisited throughout the project, not done once and forgotten.""",
    },
    {
        "title": "Test Monitoring, Control, and Completion",
        "description": "Common test metrics, and turning monitoring into action.",
        "objective_ids": ["5.3", "5.3.1"],
        "content": """## Introduction

Test monitoring gathers information about test progress; test control uses that information to guide the testing effort toward its objectives; test completion wraps testing up and captures what was learned.

## Key idea

Common test metrics include percentage of planned work completed, number of defects found and fixed, test coverage of requirements or code, and stakeholders' confidence levels in the software's quality.

## Why does this matter?

Metrics only matter if they lead to action: if monitoring shows testing is falling behind, or defect density is unusually high in one area, test control might mean reprioritizing, adjusting the schedule, or adding resources.

## Key points

- Monitoring is about visibility; control is about acting on what monitoring reveals.
- Test completion activities include checking all planned deliverables were produced and archiving testware for reuse.
- Metrics should tie back to the test plan's original objectives and exit criteria.""",
    },
    {
        "title": "Configuration Management",
        "description": "Why testing depends on knowing exactly what version of everything was tested.",
        "objective_ids": ["5.4"],
        "content": """## Introduction

Configuration management ensures that every version of every work product -- code, tests, requirements, environments -- is uniquely identified, controlled, and can be retrieved reliably.

## Key idea

For testing specifically, configuration management makes it possible to know exactly which version of the software was tested, with which version of the test cases, in which environment -- essential for reproducing and diagnosing a defect.

## Key points

- Without solid configuration management, "it works on my machine" defects become very hard to pin down.
- Testware itself, such as test cases and test data, needs version control just as much as the code does.
- Good configuration management supports traceability between requirements, code, and tests.""",
    },
    {
        "title": "Defect Management",
        "description": "What makes a defect report actually useful.",
        "objective_ids": ["5.5.1"],
        "content": """## Introduction

A defect report documents a failure observed during testing so it can be investigated, prioritized, and, if valid, fixed.

## Key idea

A good defect report is precise enough that someone who wasn't there can reproduce the problem -- vague reports slow everyone down.

## What a defect report typically includes

- A clear, specific title and description of the problem.
- Steps to reproduce it, plus the expected vs. actual result.
- Test environment/configuration details, severity, and priority.
- Supporting evidence, such as logs or screenshots.

## Key points

- Severity describes how bad the impact is; priority describes how urgently it should be fixed -- they're related but not the same thing.
- A reproducible, well-written defect report is one of a tester's most valuable outputs.
- Defect reports should stay focused on the product and the evidence, not blame.""",
    },
]

DOMAIN_6_TOPICS = [
    {
        "title": "Tool Support for Testing",
        "description": "How different categories of test tools support different testing activities.",
        "objective_ids": ["6.1", "6.1.1"],
        "content": """## Introduction

Test tools can support almost every testing activity -- not just running tests.

## Key idea

Tools exist to support management, such as test management and defect tracking; static testing, such as static analysis; test design and execution; and non-functional testing, such as performance testing -- each category supports a different part of the test process.

## Why does this matter?

Choosing the right tool starts with understanding which activity actually needs support -- a team's biggest bottleneck might be defect tracking, not test execution, and the right tool investment depends on knowing which.

## Key points

- Different tools support different test activities -- there's no single "testing tool" that does everything.
- Tool support spans the whole test process, from planning through to reporting.
- Introducing a tool changes the process around it, not just the mechanics of one task.""",
    },
    {
        "title": "Benefits and Risks of Test Automation",
        "description": "What automation is good for, and what it can't replace.",
        "objective_ids": ["6.2", "6.2.1"],
        "content": """## Introduction

Test automation, particularly of test execution, can save time and enable tests that would be impractical to run manually -- but it isn't free of tradeoffs.

## Key idea

Automation is best suited to repetitive, stable, high-value tests, like regression suites; it doesn't replace the human judgment exploratory or usability testing depends on.

## Benefits and risks

**Benefits** include saving time on repetitive work, running tests more often and more consistently, and enabling things manual testing can't easily do, like large-scale load testing. **Risks** include unrealistic expectations about what automation can achieve, underestimating the effort to build and maintain a good automation suite, and over-reliance on automation at the expense of exploratory testing.

## Key points

- Automation pays off best on stable, frequently repeated tests -- not on tests that change every iteration.
- A poorly maintained automated suite can become more of a burden than a benefit.
- Automation complements manual testing; it doesn't eliminate the need for it.""",
    },
]

DOMAIN_SPECS = [
    {"match": "Fundamental of Testing", "topics": DOMAIN_1_TOPICS},
    {"match": "Testing Throughout the Software Development Lifecycle", "topics": DOMAIN_2_TOPICS},
    {"match": "Static Testing", "topics": DOMAIN_3_TOPICS},
    {"match": "Test Analysis and Design", "topics": DOMAIN_4_TOPICS},
    {"match": "Managing Test Activities", "topics": DOMAIN_5_TOPICS},
    {"match": "Test Tools", "topics": DOMAIN_6_TOPICS},
]


class Command(BaseCommand):
    help = "Seed Study Mode topics/content for all CTFL domains and tag matching existing questions."

    def handle(self, *args, **options):
        with transaction.atomic():
            for spec in DOMAIN_SPECS:
                domain = Domain.objects.filter(name__icontains=spec["match"]).first()
                if domain is None:
                    self.stdout.write(self.style.WARNING(f"Skipping -- no domain matching '{spec['match']}'."))
                    continue

                self.stdout.write(f"--- {domain.name} ---")
                for order, topic_spec in enumerate(spec["topics"]):
                    topic, _ = Topic.objects.update_or_create(
                        domain=domain,
                        title=topic_spec["title"],
                        defaults={"description": topic_spec["description"], "order": order, "is_active": True},
                    )
                    StudyContent.objects.update_or_create(
                        topic=topic,
                        defaults={"title": topic_spec["title"], "content": topic_spec["content"], "order": order},
                    )
                    tagged = Question.objects.filter(
                        domain=domain, learning_objective_id__in=topic_spec["objective_ids"], is_active=True
                    ).update(topic=topic)
                    self.stdout.write(f"  {topic_spec['title']}: tagged {tagged} question(s)")

        self.stdout.write(self.style.SUCCESS(f"Seeded Study Mode content for {len(DOMAIN_SPECS)} domains."))
