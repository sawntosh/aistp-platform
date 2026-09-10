"""
Editing a saved answer before finishing an exam (the "Change answer"
button). Re-submitting a question updates its single Attempt row and keeps
the per-domain running total honest -- total_count never moves, correct_count
follows the new verdict.
"""
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from analytics.models import PerformanceAnalytics

from .models import AnswerOption, Attempt, Domain, PracticeSession, Question

User = get_user_model()


class AnswerEditTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="editor", email="editor@gmail.com", password="Str0ngPass!23"
        )
        self.domain = Domain.objects.create(name="Edit Domain")
        self.q = Question.objects.create(domain=self.domain, text="2 + 2 = ?")
        self.right = AnswerOption.objects.create(question=self.q, text="4", is_correct=True)
        self.wrong = AnswerOption.objects.create(question=self.q, text="5", is_correct=False)
        self.client.force_authenticate(user=self.user)

    def _session(self, mode=PracticeSession.Mode.TEST, count=2):
        return PracticeSession.objects.create(
            user=self.user, question_count=count, mode=mode
        )

    def _submit(self, session, option, confidence=3):
        payload = {
            "session_id": session.id,
            "question_id": self.q.id,
            "selected_option_id": option.id,
        }
        if session.mode == PracticeSession.Mode.TEST:
            payload["confidence"] = confidence
        return self.client.post("/api/questions/submit/", payload)

    def _analytics(self):
        return PerformanceAnalytics.objects.get(user=self.user, domain=self.domain)

    def test_wrong_then_corrected_updates_attempt_and_analytics(self):
        session = self._session()
        self._submit(session, self.wrong, confidence=2)
        self.assertEqual(self._analytics().correct_count, 0)
        self.assertEqual(self._analytics().total_count, 1)

        resp = self._submit(session, self.right, confidence=5)
        self.assertEqual(resp.status_code, 200)

        self.assertEqual(Attempt.objects.filter(session=session).count(), 1)
        attempt = Attempt.objects.get(session=session)
        self.assertEqual(attempt.selected_option, self.right)
        self.assertTrue(attempt.is_correct)
        self.assertEqual(attempt.confidence, 5)

        self.assertEqual(self._analytics().total_count, 1)  # unchanged
        self.assertEqual(self._analytics().correct_count, 1)  # +1 for the fix

    def test_correct_then_broken_decrements_correct_count(self):
        session = self._session()
        self._submit(session, self.right)
        self.assertEqual(self._analytics().correct_count, 1)

        self._submit(session, self.wrong)
        self.assertEqual(self._analytics().total_count, 1)
        self.assertEqual(self._analytics().correct_count, 0)

    def test_editing_does_not_consume_a_question_slot(self):
        session = self._session(count=1)
        self.assertEqual(self._submit(session, self.wrong).status_code, 200)
        # Session is "full" (1/1) but editing the same question still works.
        self.assertEqual(self._submit(session, self.right).status_code, 200)
        self.assertEqual(Attempt.objects.filter(session=session).count(), 1)

    def test_cannot_edit_after_the_session_is_finished(self):
        session = self._session(count=1)
        self._submit(session, self.wrong)
        self.client.post(f"/api/questions/sessions/{session.id}/finish/")
        resp = self._submit(session, self.right)
        self.assertEqual(resp.status_code, 409)

    def test_mock_mode_edit_does_not_touch_analytics(self):
        session = self._session(mode=PracticeSession.Mode.MOCK)
        self._submit(session, self.wrong)
        self._submit(session, self.right)
        self.assertFalse(
            PerformanceAnalytics.objects.filter(user=self.user, domain=self.domain).exists()
        )
