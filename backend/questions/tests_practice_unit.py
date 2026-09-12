"""
Focused unit tests for Practice Mode question delivery and answer
submission (GET /api/questions/, POST /api/questions/submit/, POST
/api/questions/sessions/<id>/finish/). Broader coverage (admin CRUD,
bulk import, RAG generation, every question type) lives in
questions/tests.py -- this file is just the core practice flow a
student goes through, kept small and self-contained.
"""
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import AnswerOption, Domain, PracticeSession, Question

User = get_user_model()

QUESTIONS_URL = "/api/questions/"
SUBMIT_URL = "/api/questions/submit/"


class PracticeQuestionDeliveryUnitTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="student", email="student@gmail.com", password="Str0ngPass!23"
        )
        self.domain = Domain.objects.create(name="Fundamentals of Testing")
        self.question = Question.objects.create(domain=self.domain, text="What is a defect?")
        self.correct_option = AnswerOption.objects.create(
            question=self.question, text="A flaw in a work product", is_correct=True
        )
        AnswerOption.objects.create(question=self.question, text="A test case", is_correct=False)
        self.client.force_authenticate(user=self.user)

    def test_fetching_questions_creates_a_practice_session(self):
        response = self.client.get(QUESTIONS_URL)
        self.assertEqual(response.status_code, 200)
        self.assertIn("session_id", response.data)
        self.assertTrue(PracticeSession.objects.filter(id=response.data["session_id"]).exists())

    def test_fetching_questions_never_reveals_the_correct_option(self):
        response = self.client.get(QUESTIONS_URL)
        for question in response.data["questions"]:
            for option in question["options"]:
                self.assertNotIn("is_correct", option)

    def test_fetching_questions_without_login_is_rejected(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(QUESTIONS_URL)
        self.assertEqual(response.status_code, 401)

    def test_count_param_limits_how_many_questions_are_served(self):
        for i in range(3):
            q = Question.objects.create(domain=self.domain, text=f"Extra question {i}")
            AnswerOption.objects.create(question=q, text="A", is_correct=True)
            AnswerOption.objects.create(question=q, text="B", is_correct=False)

        response = self.client.get(f"{QUESTIONS_URL}?count=2")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["questions"]), 2)

    def test_domain_filter_only_returns_questions_from_that_domain(self):
        other_domain = Domain.objects.create(name="Static Testing")
        other_question = Question.objects.create(domain=other_domain, text="What is a review?")
        AnswerOption.objects.create(question=other_question, text="A", is_correct=True)
        AnswerOption.objects.create(question=other_question, text="B", is_correct=False)

        response = self.client.get(f"{QUESTIONS_URL}?domains={self.domain.id}")
        self.assertEqual(response.status_code, 200)
        returned_ids = [q["id"] for q in response.data["questions"]]
        self.assertEqual(returned_ids, [self.question.id])


class PracticeAnswerSubmitUnitTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="student", email="student@gmail.com", password="Str0ngPass!23"
        )
        self.domain = Domain.objects.create(name="Fundamentals of Testing")
        self.question = Question.objects.create(domain=self.domain, text="What is a defect?")
        self.correct_option = AnswerOption.objects.create(
            question=self.question, text="A flaw in a work product", is_correct=True
        )
        self.wrong_option = AnswerOption.objects.create(
            question=self.question, text="A test case", is_correct=False
        )
        self.session = PracticeSession.objects.create(user=self.user, question_count=1)
        self.client.force_authenticate(user=self.user)

    def _submit(self, option):
        return self.client.post(
            SUBMIT_URL,
            {"session_id": self.session.id, "question_id": self.question.id, "selected_option_id": option.id},
        )

    def test_submitting_the_correct_option_is_marked_correct(self):
        response = self._submit(self.correct_option)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_correct"])

    def test_submitting_the_wrong_option_is_marked_incorrect(self):
        response = self._submit(self.wrong_option)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["is_correct"])

    def test_cannot_submit_an_answer_to_another_users_session(self):
        other_user = User.objects.create_user(
            username="other", email="other@gmail.com", password="Str0ngPass!23"
        )
        other_session = PracticeSession.objects.create(user=other_user, question_count=1)
        response = self.client.post(
            SUBMIT_URL,
            {
                "session_id": other_session.id,
                "question_id": self.question.id,
                "selected_option_id": self.correct_option.id,
            },
        )
        self.assertEqual(response.status_code, 404)

    def test_submitting_without_an_answer_field_returns_400(self):
        response = self.client.post(
            SUBMIT_URL, {"session_id": self.session.id, "question_id": self.question.id}
        )
        self.assertEqual(response.status_code, 400)


class PracticeSessionFinishUnitTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="student", email="student@gmail.com", password="Str0ngPass!23"
        )
        self.domain = Domain.objects.create(name="Fundamentals of Testing")
        self.client.force_authenticate(user=self.user)

    def _make_question(self):
        question = Question.objects.create(domain=self.domain, text="Sample question")
        correct = AnswerOption.objects.create(question=question, text="Right", is_correct=True)
        AnswerOption.objects.create(question=question, text="Wrong", is_correct=False)
        return question, correct

    def test_finishing_a_session_records_the_final_score(self):
        question, correct = self._make_question()
        session = PracticeSession.objects.create(user=self.user, question_count=1)
        self.client.post(
            SUBMIT_URL,
            {"session_id": session.id, "question_id": question.id, "selected_option_id": correct.id},
        )

        response = self.client.post(f"/api/questions/sessions/{session.id}/finish/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["score"], 1)
        session.refresh_from_db()
        self.assertIsNotNone(session.finished_at)

    def test_finishing_is_idempotent(self):
        session = PracticeSession.objects.create(user=self.user, question_count=1)
        first = self.client.post(f"/api/questions/sessions/{session.id}/finish/")
        second = self.client.post(f"/api/questions/sessions/{session.id}/finish/")
        self.assertEqual(first.data["score"], second.data["score"])
        self.assertEqual(first.data["finished_at"], second.data["finished_at"])
