from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import AnswerOption, Domain, PracticeSession, Question

User = get_user_model()


class QuestionDeliveryTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="student1", email="student1@gmail.com", password="Str0ngPass!23"
        )
        self.domain = Domain.objects.create(name="Fundamentals")
        self.question = Question.objects.create(domain=self.domain, text="What is testing?")
        self.correct = AnswerOption.objects.create(question=self.question, text="Right", is_correct=True)
        AnswerOption.objects.create(question=self.question, text="Wrong", is_correct=False)
        self.client.force_authenticate(user=self.user)

    def test_question_list_creates_session_and_hides_correct_answer(self):
        response = self.client.get("/api/questions/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("session_id", response.data)
        self.assertEqual(len(response.data["questions"]), 1)
        for option in response.data["questions"][0]["options"]:
            self.assertNotIn("is_correct", option)

    def test_question_list_requires_auth(self):
        self.client.force_authenticate(user=None)
        response = self.client.get("/api/questions/")
        self.assertEqual(response.status_code, 401)

    def test_answer_submit_correct(self):
        session = PracticeSession.objects.create(user=self.user, question_count=1)
        response = self.client.post(
            "/api/questions/submit/",
            {
                "session_id": session.id,
                "question_id": self.question.id,
                "selected_option_id": self.correct.id,
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_correct"])

    def test_answer_submit_updates_analytics(self):
        from analytics.models import PerformanceAnalytics

        session = PracticeSession.objects.create(user=self.user, question_count=1)
        self.client.post(
            "/api/questions/submit/",
            {
                "session_id": session.id,
                "question_id": self.question.id,
                "selected_option_id": self.correct.id,
            },
        )
        record = PerformanceAnalytics.objects.get(user=self.user, domain=self.domain)
        self.assertEqual(record.total_count, 1)
        self.assertEqual(record.correct_count, 1)

    def test_answer_submit_rejects_other_users_session(self):
        other = User.objects.create_user(
            username="student2", email="student2@gmail.com", password="Str0ngPass!23"
        )
        session = PracticeSession.objects.create(user=other, question_count=1)
        response = self.client.post(
            "/api/questions/submit/",
            {
                "session_id": session.id,
                "question_id": self.question.id,
                "selected_option_id": self.correct.id,
            },
        )
        self.assertEqual(response.status_code, 404)


class AdminQuestionCrudTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin1", email="admin1@gmail.com", password="Str0ngPass!23", role=User.Role.ADMIN
        )
        self.student = User.objects.create_user(
            username="student3", email="student3@gmail.com", password="Str0ngPass!23"
        )
        self.domain = Domain.objects.create(name="Test Design")

    def test_student_cannot_create_question(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.post(
            "/api/questions/admin/questions/",
            {
                "domain": self.domain.id,
                "text": "New question",
                "difficulty": "easy",
                "options": [{"text": "A", "is_correct": True}, {"text": "B", "is_correct": False}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_admin_can_create_question_with_options(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/questions/admin/questions/",
            {
                "domain": self.domain.id,
                "text": "New question",
                "difficulty": "easy",
                "options": [{"text": "A", "is_correct": True}, {"text": "B", "is_correct": False}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        question = Question.objects.get(id=response.data["id"])
        self.assertEqual(question.options.count(), 2)

    def test_admin_create_rejects_missing_correct_option(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/questions/admin/questions/",
            {
                "domain": self.domain.id,
                "text": "New question",
                "difficulty": "easy",
                "options": [{"text": "A", "is_correct": False}, {"text": "B", "is_correct": False}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
