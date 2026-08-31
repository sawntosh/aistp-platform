"""
Analytics dashboard tests -- FR-05.

Covers the QA-map Analytics branch: overall/per-domain accuracy math,
Test-vs-Practice-vs-Study contribution rules, per-user isolation, and the
confidence summary derivation.
"""
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from questions.models import AnswerOption, Domain, PracticeSession, Question

User = get_user_model()


class DashboardAccuracyTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="ana", email="ana@gmail.com", password="Str0ngPass!23"
        )
        self.domain = Domain.objects.create(name="Analytics Domain")
        # 10 single-option questions; option[0] is always the correct one.
        self.questions = []
        for i in range(10):
            q = Question.objects.create(domain=self.domain, text=f"Q{i}")
            AnswerOption.objects.create(question=q, text="right", is_correct=True)
            AnswerOption.objects.create(question=q, text="wrong", is_correct=False)
            self.questions.append(q)
        self.client.force_authenticate(user=self.user)

    def _answer(self, session, question, correct):
        opt = question.options.get(is_correct=correct)
        payload = {"session_id": session.id, "question_id": question.id, "selected_option_id": opt.id}
        if session.mode == PracticeSession.Mode.TEST:
            payload["confidence"] = 3
        return self.client.post("/api/questions/submit/", payload)

    def _test_session(self, n):
        return PracticeSession.objects.create(
            user=self.user, question_count=n, mode=PracticeSession.Mode.TEST
        )

    def test_seven_of_ten_correct_is_seventy_percent(self):
        session = self._test_session(10)
        for i, q in enumerate(self.questions):
            self._answer(session, q, correct=(i < 7))

        data = self.client.get("/api/analytics/dashboard/").data
        self.assertEqual(data["overall_accuracy"], 70.0)
        row = next(d for d in data["domains"] if d["domain"] == self.domain.name)
        self.assertEqual((row["correct_count"], row["total_count"]), (7, 10))
        self.assertEqual(row["accuracy_percent"], 70.0)

    def test_practice_mode_answers_do_not_count_towards_analytics(self):
        practice = PracticeSession.objects.create(
            user=self.user, question_count=5, mode=PracticeSession.Mode.PRACTICE
        )
        for q in self.questions[:5]:
            self._answer(practice, q, correct=True)

        data = self.client.get("/api/analytics/dashboard/").data
        self.assertEqual(data["overall_accuracy"], 0)
        self.assertEqual(data["domains"], [])

    def test_dashboard_is_isolated_per_user(self):
        session = self._test_session(3)
        for q in self.questions[:3]:
            self._answer(session, q, correct=True)

        other = User.objects.create_user(
            username="mallory", email="mallory@gmail.com", password="Str0ngPass!23"
        )
        self.client.force_authenticate(user=other)
        data = self.client.get("/api/analytics/dashboard/").data
        self.assertEqual(data["overall_accuracy"], 0)
        self.assertEqual(data["sessions"], [])

    def test_finished_session_accuracy_never_exceeds_100(self):
        session = self._test_session(1)
        for _ in range(6):  # replayed submits for the one question
            self._answer(session, self.questions[0], correct=True)
        self.client.post(f"/api/questions/sessions/{session.id}/finish/")

        data = self.client.get("/api/analytics/dashboard/").data
        row = data["sessions"][0]
        self.assertLessEqual(row["accuracy_percent"], 100.0)


class ConfidenceSummaryTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="connie", email="connie@gmail.com", password="Str0ngPass!23"
        )
        self.domain = Domain.objects.create(name="Confidence Analytics Domain")
        self.q = []
        for i in range(4):
            q = Question.objects.create(domain=self.domain, text=f"C{i}")
            AnswerOption.objects.create(question=q, text="right", is_correct=True)
            AnswerOption.objects.create(question=q, text="wrong", is_correct=False)
            self.q.append(q)
        self.client.force_authenticate(user=self.user)

    def _submit(self, session, question, correct, confidence):
        opt = question.options.get(is_correct=correct)
        return self.client.post(
            "/api/questions/submit/",
            {
                "session_id": session.id,
                "question_id": question.id,
                "selected_option_id": opt.id,
                "confidence": confidence,
            },
        )

    def test_confidence_summary_counts_high_conf_mistakes_and_low_conf_correct(self):
        session = PracticeSession.objects.create(
            user=self.user, question_count=4, mode=PracticeSession.Mode.TEST
        )
        self._submit(session, self.q[0], correct=False, confidence=5)  # high-conf mistake
        self._submit(session, self.q[1], correct=False, confidence=4)  # high-conf mistake
        self._submit(session, self.q[2], correct=False, confidence=3)  # neither
        self._submit(session, self.q[3], correct=True, confidence=1)   # low-conf correct

        summary = self.client.get("/api/analytics/dashboard/").data["confidence"]
        self.assertEqual(summary["high_confidence_mistakes"], 2)
        self.assertEqual(summary["low_confidence_correct"], 1)
        self.assertEqual(summary["rated_count"], 4)
        self.assertEqual(summary["average_confidence"], 3.25)

    def test_practice_mode_attempts_are_excluded_from_confidence_summary(self):
        practice = PracticeSession.objects.create(
            user=self.user, question_count=1, mode=PracticeSession.Mode.PRACTICE
        )
        opt = self.q[0].options.get(is_correct=True)
        self.client.post(
            "/api/questions/submit/",
            {"session_id": practice.id, "question_id": self.q[0].id, "selected_option_id": opt.id},
        )
        summary = self.client.get("/api/analytics/dashboard/").data["confidence"]
        self.assertEqual(summary["rated_count"], 0)
        self.assertIsNone(summary["average_confidence"])
