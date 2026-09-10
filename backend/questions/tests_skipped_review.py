"""
Test Mode review must surface *skipped* questions -- ones the learner
navigated past without answering -- not just the questions that got an
Attempt row. SessionReviewView takes the served question ids from the
client (?questions=) because a PracticeSession doesn't persist them.
"""
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import AnswerOption, Domain, PracticeSession, Question

User = get_user_model()


class SkippedQuestionReviewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="skipper", email="skipper@gmail.com", password="Str0ngPass!23"
        )
        self.domain = Domain.objects.create(name="Skip Domain")
        self.q_answered = Question.objects.create(domain=self.domain, text="Answered?")
        self.a_ok = AnswerOption.objects.create(question=self.q_answered, text="yes", is_correct=True)
        AnswerOption.objects.create(question=self.q_answered, text="no", is_correct=False)

        self.q_skipped = Question.objects.create(domain=self.domain, text="Skipped?")
        self.s_ok = AnswerOption.objects.create(question=self.q_skipped, text="right", is_correct=True)
        AnswerOption.objects.create(question=self.q_skipped, text="wrong", is_correct=False)

        self.client.force_authenticate(user=self.user)

    def _session(self, count=2):
        return PracticeSession.objects.create(
            user=self.user, question_count=count, mode=PracticeSession.Mode.TEST
        )

    def _answer_first_only(self, session):
        self.client.post(
            "/api/questions/submit/",
            {
                "session_id": session.id,
                "question_id": self.q_answered.id,
                "selected_option_id": self.a_ok.id,
                "confidence": 3,
            },
        )
        self.client.post(f"/api/questions/sessions/{session.id}/finish/")

    def _review(self, session, question_ids=None):
        url = f"/api/questions/sessions/{session.id}/review/"
        if question_ids is not None:
            url += "?questions=" + ",".join(str(q) for q in question_ids)
        return self.client.get(url)

    def test_skipped_question_appears_in_review(self):
        session = self._session()
        self._answer_first_only(session)

        data = self._review(session, [self.q_answered.id, self.q_skipped.id]).data
        by_id = {r["question_id"]: r for r in data["results"]}

        self.assertIn(self.q_skipped.id, by_id)
        skipped = by_id[self.q_skipped.id]
        self.assertTrue(skipped["skipped"])
        self.assertFalse(skipped["is_correct"])
        self.assertEqual(skipped["your_answer"], {})
        self.assertIsNone(skipped["confidence"])
        # The answer key is still revealed for a skipped question.
        self.assertEqual(skipped["correct_option_text"], "right")

    def test_answered_question_is_not_flagged_skipped(self):
        session = self._session()
        self._answer_first_only(session)

        data = self._review(session, [self.q_answered.id, self.q_skipped.id]).data
        answered = next(r for r in data["results"] if r["question_id"] == self.q_answered.id)
        self.assertFalse(answered["skipped"])
        self.assertTrue(answered["is_correct"])

    def test_results_follow_the_served_order_and_count_skips(self):
        session = self._session()
        self._answer_first_only(session)

        data = self._review(session, [self.q_skipped.id, self.q_answered.id]).data
        self.assertEqual(
            [r["question_id"] for r in data["results"]],
            [self.q_skipped.id, self.q_answered.id],
        )
        self.assertEqual(data["skipped_count"], 1)

    def test_without_the_param_only_answered_questions_are_returned(self):
        session = self._session()
        self._answer_first_only(session)

        data = self._review(session).data
        self.assertEqual([r["question_id"] for r in data["results"]], [self.q_answered.id])
        self.assertEqual(data["skipped_count"], 0)

    def test_unknown_ids_in_the_param_are_ignored(self):
        session = self._session()
        self._answer_first_only(session)

        data = self._review(session, [self.q_answered.id, 999999, self.q_skipped.id]).data
        self.assertEqual(
            sorted(r["question_id"] for r in data["results"]),
            sorted([self.q_answered.id, self.q_skipped.id]),
        )

    def test_served_ids_are_capped_at_the_session_size(self):
        session = self._session(count=1)
        self._answer_first_only(session)

        data = self._review(session, [self.q_answered.id, self.q_skipped.id]).data
        self.assertEqual(len(data["results"]), 1)
        self.assertEqual(data["results"][0]["question_id"], self.q_answered.id)
