"""
study/tests.py -- Study Mode behavior, and (critically) its isolation
from Test Mode's scoring/analytics pipeline. See also
questions/tests.py for the Test Mode regression tests this feature
must not break.
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from analytics.models import PerformanceAnalytics
from questions.models import AnswerOption, Domain, PracticeSession, Question, Topic
from study.models import StudyAttempt, StudyProgress, StudySession

User = get_user_model()


class StudyModeTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="learner", email="learner@test.local", password="testpass123")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.domain = Domain.objects.create(name="Fundamental of Testing")
        self.topic = Topic.objects.create(domain=self.domain, title="Seven Testing Principles", order=0)

        self.question = Question.objects.create(
            domain=self.domain,
            topic=self.topic,
            text="Which principle states exhaustive testing is impossible?",
            question_type=Question.QuestionType.MCQ,
        )
        self.correct_option = AnswerOption.objects.create(question=self.question, text="Exhaustive testing is impossible", is_correct=True)
        AnswerOption.objects.create(question=self.question, text="Testing proves correctness", is_correct=False)

        # An untagged question in the same domain -- must never surface as
        # a Study Mode question for this topic.
        self.unrelated_question = Question.objects.create(
            domain=self.domain,
            text="Untagged bank question",
            question_type=Question.QuestionType.MCQ,
        )
        AnswerOption.objects.create(question=self.unrelated_question, text="A", is_correct=True)
        AnswerOption.objects.create(question=self.unrelated_question, text="B", is_correct=False)

    def _start_topic(self):
        return self.client.post(f"/api/study/topics/{self.topic.id}/start/")

    # -- 1: session creation -------------------------------------------------
    def test_can_create_study_session(self):
        resp = self._start_topic()
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(StudySession.objects.filter(user=self.user, topic=self.topic).exists())

    # -- 2: content retrieval -------------------------------------------------
    def test_study_content_can_be_retrieved(self):
        from study.models import StudyContent

        StudyContent.objects.create(topic=self.topic, title="Seven Testing Principles", content="## Key idea\n\nTest content.")
        resp = self._start_topic()
        self.assertEqual(resp.json()["content"]["title"], "Seven Testing Principles")

    # -- 3: domain/topic relationship ----------------------------------------
    def test_topic_domain_relationship_enforced(self):
        resp = self.client.get(f"/api/study/domains/{self.domain.id}/topics/")
        self.assertEqual(resp.status_code, 200)
        titles = [t["title"] for t in resp.json()["topics"]]
        self.assertIn("Seven Testing Principles", titles)

    # -- 4: study questions belong to the selected topic ----------------------
    def test_study_questions_belong_to_topic_only(self):
        resp = self._start_topic()
        question_ids = [q["id"] for q in resp.json()["questions"]]
        self.assertIn(self.question.id, question_ids)
        self.assertNotIn(self.unrelated_question.id, question_ids)

    # -- 5/6: answer submission + individual feedback --------------------------
    def test_study_answer_submission_and_feedback(self):
        start_resp = self._start_topic()
        session_id = start_resp.json()["session_id"]

        correct_resp = self.client.post(
            f"/api/study/sessions/{session_id}/answer/",
            {"question_id": self.question.id, "selected_option_id": self.correct_option.id},
            format="json",
        )
        self.assertEqual(correct_resp.status_code, 200)
        self.assertTrue(correct_resp.json()["is_correct"])
        self.assertEqual(correct_resp.json()["correct_option_id"], self.correct_option.id)

        wrong_option = self.question.options.filter(is_correct=False).first()
        wrong_resp = self.client.post(
            f"/api/study/sessions/{session_id}/answer/",
            {"question_id": self.question.id, "selected_option_id": wrong_option.id},
            format="json",
        )
        self.assertFalse(wrong_resp.json()["is_correct"])
        self.assertEqual(StudyAttempt.objects.filter(session_id=session_id).count(), 2)

    # -- 7: no score/percentage anywhere in Study Mode responses --------------
    def test_study_mode_never_returns_a_score(self):
        start_resp = self._start_topic()
        session_id = start_resp.json()["session_id"]
        answer_resp = self.client.post(
            f"/api/study/sessions/{session_id}/answer/",
            {"question_id": self.question.id, "selected_option_id": self.correct_option.id},
            format="json",
        )
        complete_resp = self.client.post(f"/api/study/sessions/{session_id}/complete/")

        for payload in (start_resp.json(), answer_resp.json(), complete_resp.json()):
            for forbidden in ("score", "percent", "accuracy", "pass", "fail", "grade"):
                self.assertNotIn(forbidden, str(payload).lower().replace("is_correct", ""))

    # -- 8: no scored PracticeSession is ever created --------------------------
    def test_study_mode_does_not_create_practice_session(self):
        before = PracticeSession.objects.count()
        start_resp = self._start_topic()
        session_id = start_resp.json()["session_id"]
        self.client.post(
            f"/api/study/sessions/{session_id}/answer/",
            {"question_id": self.question.id, "selected_option_id": self.correct_option.id},
            format="json",
        )
        self.client.post(f"/api/study/sessions/{session_id}/complete/")
        self.assertEqual(PracticeSession.objects.count(), before)

    # -- 9: normal scoring pipeline (questions.Attempt) is never touched -------
    def test_study_mode_does_not_write_questions_attempt(self):
        from questions.models import Attempt

        before = Attempt.objects.count()
        start_resp = self._start_topic()
        session_id = start_resp.json()["session_id"]
        self.client.post(
            f"/api/study/sessions/{session_id}/answer/",
            {"question_id": self.question.id, "selected_option_id": self.correct_option.id},
            format="json",
        )
        self.assertEqual(Attempt.objects.count(), before)

    # -- 10: analytics are completely unaffected --------------------------------
    def test_study_mode_does_not_affect_analytics(self):
        before = list(PerformanceAnalytics.objects.values("user", "domain", "correct_count", "total_count"))
        start_resp = self._start_topic()
        session_id = start_resp.json()["session_id"]
        for _ in range(3):
            self.client.post(
                f"/api/study/sessions/{session_id}/answer/",
                {"question_id": self.question.id, "selected_option_id": self.correct_option.id},
                format="json",
            )
        self.client.post(f"/api/study/sessions/{session_id}/complete/")

        after = list(PerformanceAnalytics.objects.values("user", "domain", "correct_count", "total_count"))
        self.assertEqual(before, after)

        dashboard_resp = self.client.get("/api/analytics/dashboard/")
        self.assertEqual(dashboard_resp.json()["overall_accuracy"], 0)
        self.assertEqual(dashboard_resp.json()["sessions"], [])

    # -- progress transitions -----------------------------------------------
    def test_study_progress_transitions_not_started_to_completed(self):
        progress = StudyProgress.objects.filter(user=self.user, topic=self.topic).first()
        self.assertIsNone(progress)

        start_resp = self._start_topic()
        progress = StudyProgress.objects.get(user=self.user, topic=self.topic)
        self.assertEqual(progress.status, StudyProgress.Status.IN_PROGRESS)

        session_id = start_resp.json()["session_id"]
        self.client.post(f"/api/study/sessions/{session_id}/complete/")
        progress.refresh_from_db()
        self.assertEqual(progress.status, StudyProgress.Status.COMPLETED)

    def test_review_this_concept_topic_stays_reachable_after_wrong_answer(self):
        # "Review this concept" just re-navigates to the topic's content --
        # confirm the content is still fetchable mid-session (no lock).
        start_resp = self._start_topic()
        session_id = start_resp.json()["session_id"]
        wrong_option = self.question.options.filter(is_correct=False).first()
        self.client.post(
            f"/api/study/sessions/{session_id}/answer/",
            {"question_id": self.question.id, "selected_option_id": wrong_option.id},
            format="json",
        )
        second_resp = self._start_topic()
        self.assertEqual(second_resp.status_code, 200)
        self.assertEqual(second_resp.json()["session_id"], session_id)


class TestModeRegressionTests(TestCase):
    """Confirms Test Mode's existing scoring/analytics pipeline still
    works unmodified alongside Study Mode."""

    def setUp(self):
        self.user = User.objects.create_user(username="examinee", email="examinee@test.local", password="testpass123")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.domain = Domain.objects.create(name="Test Analysis and Design")
        self.question = Question.objects.create(
            domain=self.domain, text="Sample question", question_type=Question.QuestionType.MCQ
        )
        self.correct_option = AnswerOption.objects.create(question=self.question, text="Right", is_correct=True)
        AnswerOption.objects.create(question=self.question, text="Wrong", is_correct=False)

    def test_test_mode_still_calculates_scores(self):
        list_resp = self.client.get("/api/questions/?count=1&mode=practice")
        self.assertEqual(list_resp.status_code, 200)
        session_id = list_resp.json()["session_id"]

        submit_resp = self.client.post(
            "/api/questions/submit/",
            {"session_id": session_id, "question_id": self.question.id, "selected_option_id": self.correct_option.id},
            format="json",
        )
        self.assertTrue(submit_resp.json()["is_correct"])

        finish_resp = self.client.post(f"/api/questions/sessions/{session_id}/finish/")
        self.assertEqual(finish_resp.json()["score"], 1)

    def test_test_mode_analytics_still_update(self):
        list_resp = self.client.get("/api/questions/?count=1&mode=practice")
        session_id = list_resp.json()["session_id"]
        self.client.post(
            "/api/questions/submit/",
            {"session_id": session_id, "question_id": self.question.id, "selected_option_id": self.correct_option.id},
            format="json",
        )
        record = PerformanceAnalytics.objects.get(user=self.user, domain=self.domain)
        self.assertEqual(record.correct_count, 1)
        self.assertEqual(record.total_count, 1)
