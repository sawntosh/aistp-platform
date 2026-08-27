"""
Confidence tracking (Test Mode) -- see questions/constants.py.

Confidence is a 1-5 self-rating stored on Attempt.confidence. It is a
diagnostic signal only: it must never change correctness, the session
score, or the existing correct/total analytics.
"""
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from analytics.models import PerformanceAnalytics

from .models import AnswerOption, Attempt, Domain, PracticeSession, Question

User = get_user_model()


class ConfidenceTrackingTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="confuser", email="confuser@gmail.com", password="Str0ngPass!23"
        )
        self.domain = Domain.objects.create(name="Confidence Domain")
        self.question = Question.objects.create(domain=self.domain, text="2 + 2 = ?")
        self.correct = AnswerOption.objects.create(question=self.question, text="4", is_correct=True)
        self.wrong = AnswerOption.objects.create(question=self.question, text="5", is_correct=False)
        self.client.force_authenticate(user=self.user)

    def _test_session(self):
        return PracticeSession.objects.create(
            user=self.user, question_count=1, mode=PracticeSession.Mode.TEST
        )

    def _practice_session(self):
        return PracticeSession.objects.create(
            user=self.user, question_count=1, mode=PracticeSession.Mode.PRACTICE
        )

    def _submit(self, session, option, confidence=None):
        payload = {
            "session_id": session.id,
            "question_id": self.question.id,
            "selected_option_id": option.id,
        }
        if confidence is not None:
            payload["confidence"] = confidence
        return self.client.post("/api/questions/submit/", payload)

    def _finish(self, session):
        return self.client.post(f"/api/questions/sessions/{session.id}/finish/")

    def _review(self, session):
        return self.client.get(f"/api/questions/sessions/{session.id}/review/")

    # 1 -----------------------------------------------------------------
    def test_confidence_can_be_saved(self):
        session = self._test_session()
        resp = self._submit(session, self.correct, confidence=3)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(Attempt.objects.get(session=session).confidence, 3)

    # 2 -----------------------------------------------------------------
    def test_confidence_1_is_valid(self):
        resp = self._submit(self._test_session(), self.correct, confidence=1)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(Attempt.objects.get().confidence, 1)

    # 3 -----------------------------------------------------------------
    def test_confidence_5_is_valid(self):
        resp = self._submit(self._test_session(), self.correct, confidence=5)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(Attempt.objects.get().confidence, 5)

    # 4 -----------------------------------------------------------------
    def test_confidence_0_is_rejected(self):
        resp = self._submit(self._test_session(), self.correct, confidence=0)
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(Attempt.objects.count(), 0)

    # 5 -----------------------------------------------------------------
    def test_confidence_6_is_rejected(self):
        resp = self._submit(self._test_session(), self.correct, confidence=6)
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(Attempt.objects.count(), 0)

    def test_test_mode_requires_confidence(self):
        resp = self._submit(self._test_session(), self.correct, confidence=None)
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(Attempt.objects.count(), 0)

    # 6 -----------------------------------------------------------------
    def test_correctness_is_independent_of_confidence(self):
        self._submit(self._test_session(), self.wrong, confidence=1)
        self._submit(self._test_session(), self.wrong, confidence=5)
        self._submit(self._test_session(), self.correct, confidence=1)
        self._submit(self._test_session(), self.correct, confidence=5)
        by_conf_wrong = Attempt.objects.filter(is_correct=False).values_list("confidence", flat=True)
        by_conf_right = Attempt.objects.filter(is_correct=True).values_list("confidence", flat=True)
        self.assertCountEqual(by_conf_wrong, [1, 5])
        self.assertCountEqual(by_conf_right, [1, 5])

    # 7 -----------------------------------------------------------------
    def test_correct_confidence_1_and_5_receive_same_marks(self):
        s1 = self._test_session()
        self._submit(s1, self.correct, confidence=1)
        self._finish(s1)
        s2 = self._test_session()
        self._submit(s2, self.correct, confidence=5)
        self._finish(s2)
        s1.refresh_from_db()
        s2.refresh_from_db()
        self.assertEqual(s1.score, 1)
        self.assertEqual(s2.score, s1.score)

    # 8 -----------------------------------------------------------------
    def test_wrong_confidence_1_and_5_receive_same_marks(self):
        s1 = self._test_session()
        self._submit(s1, self.wrong, confidence=1)
        self._finish(s1)
        s2 = self._test_session()
        self._submit(s2, self.wrong, confidence=5)
        self._finish(s2)
        s1.refresh_from_db()
        s2.refresh_from_db()
        self.assertEqual(s1.score, 0)
        self.assertEqual(s2.score, s1.score)

    # 9 -----------------------------------------------------------------
    def test_wrong_confidence_5_is_a_high_confidence_mistake(self):
        session = self._test_session()
        self._submit(session, self.wrong, confidence=5)
        self._finish(session)
        result = self._review(session).data["results"][0]
        self.assertFalse(result["is_correct"])
        self.assertEqual(result["confidence"], 5)
        self.assertEqual(result["confidence_label"], "Very confident")
        self.assertTrue(result["high_confidence_mistake"])
        self.assertFalse(result["low_confidence_correct"])

    def test_correct_confidence_5_is_not_a_high_confidence_mistake(self):
        session = self._test_session()
        self._submit(session, self.correct, confidence=5)
        self._finish(session)
        result = self._review(session).data["results"][0]
        self.assertFalse(result["high_confidence_mistake"])

    def test_correct_confidence_2_is_a_low_confidence_correct(self):
        session = self._test_session()
        self._submit(session, self.correct, confidence=2)
        self._finish(session)
        result = self._review(session).data["results"][0]
        self.assertTrue(result["is_correct"])
        self.assertTrue(result["low_confidence_correct"])
        self.assertFalse(result["high_confidence_mistake"])

    # 10 ----------------------------------------------------------------
    def test_existing_test_scoring_still_works(self):
        session = self._test_session()
        self._submit(session, self.correct, confidence=3)
        self._finish(session)
        session.refresh_from_db()
        self.assertTrue(Attempt.objects.get(session=session).is_correct)
        self.assertEqual(session.score, 1)

    # 11 ----------------------------------------------------------------
    def test_existing_analytics_still_works_and_confidence_block_added(self):
        for opt, conf in [(self.correct, 5), (self.wrong, 5), (self.correct, 1)]:
            self._submit(self._test_session(), opt, confidence=conf)

        resp = self.client.get("/api/analytics/dashboard/")
        self.assertEqual(resp.status_code, 200)
        # accuracy stays correct/total: 2 of 3
        self.assertEqual(resp.data["overall_accuracy"], round(2 / 3 * 100, 1))

        conf = resp.data["confidence"]
        self.assertEqual(conf["rated_count"], 3)
        self.assertEqual(conf["high_confidence_mistakes"], 1)
        self.assertEqual(conf["low_confidence_correct"], 1)
        self.assertAlmostEqual(conf["average_confidence"], round((5 + 5 + 1) / 3, 2))
        level5 = next(r for r in conf["by_level"] if r["level"] == 5)
        self.assertEqual(level5["total"], 2)
        self.assertEqual(level5["correct"], 1)
        self.assertEqual(level5["accuracy_percent"], 50.0)

        # per-domain confidence is merged onto the domain row, accuracy untouched
        domain_row = next(d for d in resp.data["domains"] if d["domain"] == self.domain.name)
        self.assertIn("average_confidence", domain_row)
        self.assertIn("high_confidence_mistakes", domain_row)
        self.assertEqual(domain_row["correct_count"], 2)
        self.assertEqual(domain_row["total_count"], 3)

    # 12 ----------------------------------------------------------------
    def test_pre_feature_attempt_without_confidence_stays_compatible(self):
        session = self._test_session()
        Attempt.objects.create(
            session=session,
            user=self.user,
            question=self.question,
            selected_option=self.correct,
            is_correct=True,
        )
        session.score = 1
        session.finished_at = timezone.now()
        session.save(update_fields=["score", "finished_at"])

        result = self._review(session).data["results"][0]
        self.assertIsNone(result["confidence"])
        self.assertIsNone(result["confidence_label"])
        self.assertFalse(result["high_confidence_mistake"])
        self.assertFalse(result["low_confidence_correct"])

        dash = self.client.get("/api/analytics/dashboard/")
        self.assertEqual(dash.status_code, 200)
        self.assertEqual(dash.data["confidence"]["rated_count"], 0)

    # 13 ----------------------------------------------------------------
    def test_study_and_practice_mode_excluded_from_confidence_analytics(self):
        # Practice Mode: confidence sent but ignored, no analytics impact.
        practice = self._practice_session()
        resp = self._submit(practice, self.correct, confidence=5)
        self.assertEqual(resp.status_code, 200)
        self.assertIsNone(Attempt.objects.get(session=practice).confidence)
        self.assertFalse(
            PerformanceAnalytics.objects.filter(user=self.user, domain=self.domain).exists()
        )

        dash = self.client.get("/api/analytics/dashboard/")
        self.assertEqual(dash.data["confidence"]["rated_count"], 0)
        self.assertEqual(dash.data["confidence"]["average_confidence"], None)

    def test_practice_mode_submit_without_confidence_still_ok(self):
        resp = self._submit(self._practice_session(), self.correct, confidence=None)
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["is_correct"])
