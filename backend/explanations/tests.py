from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase
from django.urls import reverse
from rest_framework.test import APITestCase

from questions.models import AnswerOption, Domain, FillBlankAnswer, MatchingPair, Question
from services.explanation_service import ExplanationServiceError, build_fallback_explanation, generate_explanation

from .models import AIExplanation
from .views import _build_answer_context, _context_hash


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
        mock_generate.return_value = "A defect is a flaw that causes incorrect behaviour."

        response = self.client.post(self.url, {"question_id": self.question.id}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["explanation"], mock_generate.return_value)
        mock_generate.assert_called_once()
        call_args = mock_generate.call_args[0]
        self.assertEqual(call_args[0], self.question.text)
        self.assertEqual(call_args[1], "mcq")
        self.assertIn("A flaw in the software", call_args[2])
        self.assertEqual(AIExplanation.objects.filter(question=self.question).count(), 1)

    @patch("explanations.views.generate_explanation")
    def test_returns_cached_explanation_without_calling_groq(self, mock_generate):
        answer_context = _build_answer_context(self.question)
        AIExplanation.objects.create(
            question=self.question,
            explanation_text="Cached explanation.",
            context_hash=_context_hash(self.question, answer_context["prompt_block"]),
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
        mock_generate.return_value = "Fresh explanation for the current question."
        AIExplanation.objects.create(
            question=self.question,
            explanation_text="Stale explanation from before something changed.",
            context_hash="stale-hash-that-will-never-match-a-real-one",
        )

        response = self.client.post(self.url, {"question_id": self.question.id}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["explanation"], "Fresh explanation for the current question.")
        mock_generate.assert_called_once()
        self.assertEqual(AIExplanation.objects.filter(question=self.question).count(), 1)
        stored = AIExplanation.objects.get(question=self.question)
        self.assertEqual(stored.explanation_text, "Fresh explanation for the current question.")

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
        mock_generate.return_value = "A defect is a flaw that causes incorrect behaviour."

        response = self.client.post(self.url, {"question_id": self.question.id}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["is_fallback"])

    def test_unknown_question_returns_404(self):
        response = self.client.post(self.url, {"question_id": 999999}, format="json")

        self.assertEqual(response.status_code, 404)

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.post(self.url, {"question_id": self.question.id}, format="json")

        self.assertEqual(response.status_code, 401)

    @patch("explanations.views.generate_explanation")
    def test_explains_fill_blank_question(self, mock_generate):
        mock_generate.return_value = "Acceptance testing checks the system against business needs."
        domain = Domain.objects.create(name="Testing Throughout the SDLC")
        question = Question.objects.create(
            domain=domain,
            text="_____ testing is typically the last test level performed before release.",
            question_type=Question.QuestionType.FILL_BLANK,
        )
        FillBlankAnswer.objects.create(question=question, answer_text="Acceptance")

        response = self.client.post(self.url, {"question_id": question.id}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["explanation"], mock_generate.return_value)
        call_args = mock_generate.call_args[0]
        self.assertEqual(call_args[1], "fill_blank")
        self.assertIn("Acceptance", call_args[2])

    @patch("explanations.views.generate_explanation")
    def test_explains_matching_question(self, mock_generate):
        mock_generate.return_value = "Each lifecycle model pairs with its defining characteristic."
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
        self.assertEqual(response.data["explanation"], mock_generate.return_value)
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
