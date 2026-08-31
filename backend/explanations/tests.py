from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase
from django.urls import reverse
from rest_framework.test import APITestCase

from questions.models import AnswerOption, Domain, FillBlankAnswer, MatchingPair, Question, Topic
from services.explanation_service import (
    ExplanationServiceError,
    build_fallback_explanation,
    explanation_has_required_sections,
    generate_explanation,
)

from .models import AIExplanation
from .views import _build_answer_context, _build_concept_context, _context_hash


# A well-formed Groq reply: every heading ExplainView now requires before
# it will cache and serve an explanation (see
# explanation_service.REQUIRED_SECTION_HEADINGS). Tests that mock
# generate_explanation use this so the response passes structural
# validation the same way a real, correctly-formatted reply would.
VALID_EXPLANATION = (
    "## Correct Answer\n"
    "A flaw in the software.\n\n"
    "## Why Is This Correct?\n"
    "A **defect** is a flaw introduced into a work product.\n\n"
    "## ISTQB Concept\n"
    "This tests the distinction between an error, a defect, and a failure.\n\n"
    "## What Does It Actually Mean?\n"
    "A person makes an error, which can introduce a defect, which may in "
    "turn cause a failure when the code runs.\n\n"
    "## Why Are the Other Options Incorrect?\n"
    "### A test case\n"
    "A test case is how a defect is found, not the defect itself.\n\n"
    "## Key Concept to Remember\n"
    "Error leads to defect leads to failure.\n\n"
    "## Exam Tip\n"
    "The word 'flaw' points to a defect rather than a failure.\n"
)


class ExplainViewTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="learner", password="pass1234")
        self.client.force_authenticate(user=self.user)

        domain = Domain.objects.create(name="Fundamentals")
        self.question = Question.objects.create(domain=domain, text="What is a defect?")
        AnswerOption.objects.create(question=self.question, text="A flaw in the software", is_correct=True)
        AnswerOption.objects.create(question=self.question, text="A test case", is_correct=False)

        self.url = reverse("explain")

    @patch("explanations.views.generate_explanation")
    def test_generates_and_caches_explanation(self, mock_generate):
        mock_generate.return_value = VALID_EXPLANATION

        response = self.client.post(self.url, {"question_id": self.question.id}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["explanation"], VALID_EXPLANATION)
        self.assertFalse(response.data["is_fallback"])
        mock_generate.assert_called_once()
        call_args = mock_generate.call_args[0]
        self.assertEqual(call_args[0], self.question.text)
        self.assertEqual(call_args[1], "mcq")
        # The correct answer is handed to the AI (from the DB), never left
        # for it to decide.
        self.assertIn("Correct answer(s):", call_args[2])
        self.assertIn("A flaw in the software", call_args[2])
        self.assertEqual(AIExplanation.objects.filter(question=self.question).count(), 1)

    @patch("explanations.views.generate_explanation")
    def test_returns_cached_explanation_without_calling_groq(self, mock_generate):
        answer_context = _build_answer_context(self.question)
        AIExplanation.objects.create(
            question=self.question,
            explanation_text="Cached explanation.",
            context_hash=_context_hash(
                self.question,
                answer_context["prompt_block"],
                _build_concept_context(self.question),
            ),
        )

        response = self.client.post(self.url, {"question_id": self.question.id}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["explanation"], "Cached explanation.")
        mock_generate.assert_not_called()

    @patch("explanations.views.generate_explanation")
    def test_stale_cached_explanation_is_regenerated(self, mock_generate):
        """A cached row whose hash doesn't match the question's current
        content (e.g. the question text/options were edited, or the
        prompt template changed) must be treated as stale and overwritten,
        not served forever."""
        mock_generate.return_value = VALID_EXPLANATION
        AIExplanation.objects.create(
            question=self.question,
            explanation_text="Stale explanation from before something changed.",
            context_hash="stale-hash-that-will-never-match-a-real-one",
        )

        response = self.client.post(self.url, {"question_id": self.question.id}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["explanation"], VALID_EXPLANATION)
        mock_generate.assert_called_once()
        self.assertEqual(AIExplanation.objects.filter(question=self.question).count(), 1)
        stored = AIExplanation.objects.get(question=self.question)
        self.assertEqual(stored.explanation_text, VALID_EXPLANATION)

    @patch("explanations.views.generate_explanation")
    def test_groq_failure_returns_fallback_explanation(self, mock_generate):
        mock_generate.side_effect = ExplanationServiceError("upstream error")

        response = self.client.post(self.url, {"question_id": self.question.id}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_fallback"])
        self.assertIn("A flaw in the software", response.data["explanation"])
        # Fallback text is never cached, so a later request retries Groq.
        self.assertFalse(AIExplanation.objects.filter(question=self.question).exists())

    @patch("explanations.views.generate_explanation")
    def test_generated_explanation_is_not_flagged_as_fallback(self, mock_generate):
        mock_generate.return_value = VALID_EXPLANATION

        response = self.client.post(self.url, {"question_id": self.question.id}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["is_fallback"])

    @patch("explanations.views.generate_explanation")
    def test_malformed_ai_response_returns_fallback_and_is_not_cached(self, mock_generate):
        """Groq replied, but the text is missing the required section
        headings (wrong format / prose only / truncated). The learner
        gets the deterministic fallback -- which still names the correct
        answer -- and nothing is cached, so a later request retries."""
        mock_generate.return_value = "Here is a plain paragraph with no headings at all."

        response = self.client.post(self.url, {"question_id": self.question.id}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_fallback"])
        self.assertIn("A flaw in the software", response.data["explanation"])
        self.assertFalse(AIExplanation.objects.filter(question=self.question).exists())

    def test_unknown_question_returns_404(self):
        response = self.client.post(self.url, {"question_id": 999999}, format="json")

        self.assertEqual(response.status_code, 404)

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.post(self.url, {"question_id": self.question.id}, format="json")

        self.assertEqual(response.status_code, 401)

    @patch("explanations.views.generate_explanation")
    def test_explains_fill_blank_question(self, mock_generate):
        mock_generate.return_value = VALID_EXPLANATION
        domain = Domain.objects.create(name="Testing Throughout the SDLC")
        question = Question.objects.create(
            domain=domain,
            text="_____ testing is typically the last test level performed before release.",
            question_type=Question.QuestionType.FILL_BLANK,
        )
        FillBlankAnswer.objects.create(question=question, answer_text="Acceptance")

        response = self.client.post(self.url, {"question_id": question.id}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["explanation"], VALID_EXPLANATION)
        call_args = mock_generate.call_args[0]
        self.assertEqual(call_args[1], "fill_blank")
        self.assertIn("Acceptance", call_args[2])

    @patch("explanations.views.generate_explanation")
    def test_explains_matching_question(self, mock_generate):
        mock_generate.return_value = VALID_EXPLANATION
        domain = Domain.objects.create(name="Testing Throughout the SDLC")
        question = Question.objects.create(
            domain=domain,
            text="Match each model to its characteristic.",
            question_type=Question.QuestionType.MATCHING,
        )
        MatchingPair.objects.create(question=question, prompt_text="V-model", match_text="Parallel test levels", order=0)
        MatchingPair.objects.create(question=question, prompt_text="Agile", match_text="Time-boxed iterations", order=1)

        response = self.client.post(self.url, {"question_id": question.id}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["explanation"], VALID_EXPLANATION)
        call_args = mock_generate.call_args[0]
        self.assertEqual(call_args[1], "matching")
        self.assertIn("V-model -> Parallel test levels", call_args[2])

    def test_fill_blank_question_without_answers_returns_422(self):
        domain = Domain.objects.create(name="Testing Throughout the SDLC")
        question = Question.objects.create(
            domain=domain, text="_____ testing.", question_type=Question.QuestionType.FILL_BLANK
        )

        response = self.client.post(self.url, {"question_id": question.id}, format="json")

        self.assertEqual(response.status_code, 422)

    @patch("explanations.views.generate_explanation")
    def test_prompt_includes_domain_topic_and_learning_objective(self, mock_generate):
        """The AI is given the question's domain, syllabus topic and
        learning objective so the '## ISTQB Concept' section can name the
        right principle -- passed as the concept_context kwarg, separate
        from the answer data."""
        mock_generate.return_value = VALID_EXPLANATION
        domain = Domain.objects.create(name="Fundamentals of Testing")
        topic = Topic.objects.create(domain=domain, title="The Seven Testing Principles")
        question = Question.objects.create(
            domain=domain,
            topic=topic,
            text="Which principle says testing everything is not feasible?",
            learning_objective="Explain the seven testing principles",
        )
        AnswerOption.objects.create(question=question, text="Exhaustive testing is impossible", is_correct=True)
        AnswerOption.objects.create(question=question, text="Tests wear out", is_correct=False)

        response = self.client.post(self.url, {"question_id": question.id}, format="json")

        self.assertEqual(response.status_code, 200)
        concept_context = mock_generate.call_args.kwargs["concept_context"]
        self.assertIn("Fundamentals of Testing", concept_context)
        self.assertIn("The Seven Testing Principles", concept_context)
        self.assertIn("Explain the seven testing principles", concept_context)
        # The correct answer is not in the concept context -- it travels
        # only in the answer-details block, from the DB.
        self.assertNotIn("Exhaustive testing is impossible", concept_context)


class ContextHashTests(SimpleTestCase):
    def test_different_question_text_produces_different_hash(self):
        domain_id = 1
        q1 = Question(id=1, domain_id=domain_id, text="What is a defect?", question_type="mcq")
        q2 = Question(id=1, domain_id=domain_id, text="What is a failure?", question_type="mcq")

        self.assertNotEqual(_context_hash(q1, "Correct answer(s): A flaw"), _context_hash(q2, "Correct answer(s): A flaw"))

    def test_same_content_produces_same_hash(self):
        q = Question(id=1, domain_id=1, text="What is a defect?", question_type="mcq")

        self.assertEqual(
            _context_hash(q, "Correct answer(s): A flaw"),
            _context_hash(q, "Correct answer(s): A flaw"),
        )

    def test_different_concept_context_produces_different_hash(self):
        q = Question(id=1, domain_id=1, text="What is a defect?", question_type="mcq")

        self.assertNotEqual(
            _context_hash(q, "Correct answer(s): A flaw", "Domain: Fundamentals"),
            _context_hash(q, "Correct answer(s): A flaw", "Domain: Test Techniques"),
        )


class RequiredSectionsTests(SimpleTestCase):
    def test_accepts_text_with_every_required_heading(self):
        self.assertTrue(explanation_has_required_sections(VALID_EXPLANATION))

    def test_rejects_text_missing_a_required_heading(self):
        without_concept = VALID_EXPLANATION.replace("## ISTQB Concept\n", "")

        self.assertFalse(explanation_has_required_sections(without_concept))

    def test_rejects_prose_only_and_empty(self):
        self.assertFalse(explanation_has_required_sections("Just a paragraph, no headings."))
        self.assertFalse(explanation_has_required_sections(""))
        self.assertFalse(explanation_has_required_sections("   \n  "))

    def test_tolerates_trailing_punctuation_and_extra_whitespace(self):
        text = VALID_EXPLANATION.replace(
            "## Why Is This Correct?", "##   why is this correct"
        )

        self.assertTrue(explanation_has_required_sections(text))


class ConceptContextTests(TestCase):
    def test_includes_domain_topic_learning_objective_and_section(self):
        domain = Domain.objects.create(
            name="Test Techniques", description="Black-box, white-box and experience-based techniques."
        )
        topic = Topic.objects.create(domain=domain, title="Equivalence Partitioning")
        question = Question.objects.create(
            domain=domain,
            topic=topic,
            text="What is an equivalence partition?",
            learning_objective="Apply equivalence partitioning",
            source_section="4.2.1",
        )

        context = _build_concept_context(question)

        self.assertIn("Domain: Test Techniques", context)
        self.assertIn("Black-box, white-box", context)
        self.assertIn("Syllabus topic: Equivalence Partitioning", context)
        self.assertIn("Learning objective: Apply equivalence partitioning", context)
        self.assertIn("Syllabus section: 4.2.1", context)

    def test_domain_only_question_still_returns_domain_line(self):
        domain = Domain.objects.create(name="Fundamentals of Testing")
        question = Question.objects.create(domain=domain, text="What is testing?")

        context = _build_concept_context(question)

        self.assertIn("Domain: Fundamentals of Testing", context)
        self.assertNotIn("Syllabus topic:", context)


class ExplanationServiceFallbackTests(SimpleTestCase):
    def test_build_fallback_explanation_names_correct_answer_and_flags_ai_unavailable(self):
        text = build_fallback_explanation("A flaw in the software")

        self.assertIn("A flaw in the software", text)
        self.assertIn("AI-generated explanation isn't available", text)

    @patch("services.explanation_service.client")
    def test_generate_explanation_retries_once_before_succeeding(self, mock_client):
        success_response = Mock()
        success_response.choices = [Mock(message=Mock(content="A defect is a flaw that causes incorrect behaviour."))]
        mock_client.chat.completions.create.side_effect = [
            RuntimeError("transient network error"),
            success_response,
        ]

        result = generate_explanation("What is a defect?", "mcq", "Correct answer(s): A flaw")

        self.assertEqual(result, "A defect is a flaw that causes incorrect behaviour.")
        self.assertEqual(mock_client.chat.completions.create.call_count, 2)

    @patch("services.explanation_service.client")
    def test_generate_explanation_raises_after_exhausting_retries(self, mock_client):
        mock_client.chat.completions.create.side_effect = RuntimeError("still down")

        with self.assertRaises(ExplanationServiceError):
            generate_explanation("What is a defect?", "mcq", "Correct answer(s): A flaw")

    @patch("services.explanation_service.client")
    def test_generate_explanation_sends_system_and_user_messages(self, mock_client):
        response = Mock()
        response.choices = [Mock(message=Mock(content="Some explanation."))]
        mock_client.chat.completions.create.return_value = response

        generate_explanation("What is a defect?", "true_false", "Correct answer(s): True")

        _, kwargs = mock_client.chat.completions.create.call_args
        roles = [message["role"] for message in kwargs["messages"]]
        self.assertEqual(roles, ["system", "user"])

    @patch("services.explanation_service.client")
    def test_generate_explanation_includes_concept_context_when_given(self, mock_client):
        response = Mock()
        response.choices = [Mock(message=Mock(content="Some explanation."))]
        mock_client.chat.completions.create.return_value = response

        generate_explanation(
            "Which principle applies?",
            "mcq",
            "Correct answer(s): Exhaustive testing is impossible",
            concept_context="Domain: Fundamentals of Testing\nSyllabus topic: Testing Principles",
        )

        _, kwargs = mock_client.chat.completions.create.call_args
        user_message = kwargs["messages"][1]["content"]
        self.assertIn("Domain: Fundamentals of Testing", user_message)
        self.assertIn("Syllabus topic: Testing Principles", user_message)

    @patch("services.explanation_service.client")
    def test_generate_explanation_omits_concept_block_when_not_given(self, mock_client):
        response = Mock()
        response.choices = [Mock(message=Mock(content="Some explanation."))]
        mock_client.chat.completions.create.return_value = response

        generate_explanation("What is a defect?", "mcq", "Correct answer(s): A flaw")

        _, kwargs = mock_client.chat.completions.create.call_args
        user_message = kwargs["messages"][1]["content"]
        self.assertNotIn("Context for identifying the ISTQB concept", user_message)
