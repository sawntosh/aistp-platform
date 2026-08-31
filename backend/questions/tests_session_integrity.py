"""
Session / Attempt integrity regression tests -- BUG-01.

A client must not be able to inflate PerformanceAnalytics or a session's
score by:
  * submitting the same question more than once in a session,
  * submitting more answers than the session has questions,
  * submitting answers after the session is finished.

All three previously returned 200 and each call ran record_attempt(),
which let a 1-question Test Mode session finish with score=15 /
question_count=1 (dashboard accuracy_percent 1500.0) and a domain
total_count of 12 from a single served question.
"""
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from analytics.models import PerformanceAnalytics

from .models import AnswerOption, Attempt, Domain, PracticeSession, Question

User = get_user_model()


class SessionAttemptIntegrityTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="integrity", email="integrity@gmail.com", password="Str0ngPass!23"
        )
        self.domain = Domain.objects.create(name="Integrity Domain")
        self.q1 = Question.objects.create(domain=self.domain, text="2 + 2 = ?")
        self.q1_correct = AnswerOption.objects.create(question=self.q1, text="4", is_correct=True)
        self.q1_wrong = AnswerOption.objects.create(question=self.q1, text="5", is_correct=False)
        self.q2 = Question.objects.create(domain=self.domain, text="3 + 3 = ?")
        self.q2_correct = AnswerOption.objects.create(question=self.q2, text="6", is_correct=True)
        self.client.force_authenticate(user=self.user)

    def _session(self, count=1, mode=PracticeSession.Mode.TEST):
        return PracticeSession.objects.create(user=self.user, question_count=count, mode=mode)

    def _submit(self, session, question, option, confidence=5):
        payload = {
            "session_id": session.id,
            "question_id": question.id,
            "selected_option_id": option.id,
        }
        if session.mode == PracticeSession.Mode.TEST:
            payload["confidence"] = confidence
        return self.client.post("/api/questions/submit/", payload)

    # -- duplicate question -------------------------------------------------
    def test_second_submit_for_same_question_is_rejected(self):
        session = self._session(count=1)
        first = self._submit(session, self.q1, self.q1_correct)
        self.assertEqual(first.status_code, 200)

        second = self._submit(session, self.q1, self.q1_correct)
        self.assertEqual(second.status_code, 409)
        self.assertEqual(Attempt.objects.filter(session=session).count(), 1)

    def test_duplicate_submits_do_not_inflate_domain_analytics(self):
        session = self._session(count=1)
        for _ in range(10):
            self._submit(session, self.q1, self.q1_correct)

        record = PerformanceAnalytics.objects.get(user=self.user, domain=self.domain)
        self.assertEqual(record.total_count, 1)
        self.assertEqual(record.correct_count, 1)

    # -- more answers than questions --------------------------------------
    def test_cannot_submit_more_answers_than_question_count(self):
        session = self._session(count=1)
        self.assertEqual(self._submit(session, self.q1, self.q1_correct).status_code, 200)

        overflow = self._submit(session, self.q2, self.q2_correct)
        self.assertEqual(overflow.status_code, 409)
        self.assertEqual(Attempt.objects.filter(session=session).count(), 1)

    # -- submitting after finish ----------------------------------------
    def test_submit_after_finish_is_rejected(self):
        session = self._session(count=2)
        self._submit(session, self.q1, self.q1_correct)
        finish = self.client.post(f"/api/questions/sessions/{session.id}/finish/")
        self.assertEqual(finish.status_code, 200)

        late = self._submit(session, self.q2, self.q2_correct)
        self.assertEqual(late.status_code, 409)
        self.assertEqual(Attempt.objects.filter(session=session).count(), 1)

    # -- score cap -----------------------------------------------------
    def test_finished_score_never_exceeds_question_count(self):
        session = self._session(count=1)
        for _ in range(15):
            self._submit(session, self.q1, self.q1_correct)

        finish = self.client.post(f"/api/questions/sessions/{session.id}/finish/")
        self.assertEqual(finish.status_code, 200)
        self.assertLessEqual(finish.data["score"], finish.data["question_count"])
        self.assertEqual(finish.data["score"], 1)

    # -- guard must not break the normal path --------------------------
    def test_distinct_questions_in_one_session_still_work(self):
        session = self._session(count=2)
        self.assertEqual(self._submit(session, self.q1, self.q1_correct).status_code, 200)
        self.assertEqual(self._submit(session, self.q2, self.q2_correct).status_code, 200)
        finish = self.client.post(f"/api/questions/sessions/{session.id}/finish/")
        self.assertEqual(finish.data["score"], 2)
