"""
API input-validation regression tests.

  BUG-03  over-long text_answer -> clean 400, not a PostgreSQL DataError/500
  BUG-04  non-integer ?domain= on the admin question list -> no 500
"""
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import AnswerOption, Domain, FillBlankAnswer, PracticeSession, Question

User = get_user_model()


class TextAnswerLengthTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="typer", email="typer@gmail.com", password="Str0ngPass!23"
        )
        self.domain = Domain.objects.create(name="Fill Domain")
        self.question = Question.objects.create(
            domain=self.domain,
            text="The V-model is a type of _____ model.",
            question_type=Question.QuestionType.FILL_BLANK,
        )
        FillBlankAnswer.objects.create(question=self.question, answer_text="sequential")
        self.client.force_authenticate(user=self.user)

    def test_text_answer_over_255_chars_is_a_400_not_a_500(self):
        session = PracticeSession.objects.create(user=self.user, question_count=1)
        resp = self.client.post(
            "/api/questions/submit/",
            {"session_id": session.id, "question_id": self.question.id, "text_answer": "x" * 300},
        )
        self.assertEqual(resp.status_code, 400)


class AdminDomainFilterTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="adminf", email="adminf@gmail.com", password="Str0ngPass!23", role=User.Role.ADMIN
        )
        self.domain = Domain.objects.create(name="Filter Domain")
        Question.objects.create(domain=self.domain, text="Q")
        self.client.force_authenticate(user=self.admin)

    def test_non_integer_domain_filter_does_not_500(self):
        resp = self.client.get("/api/questions/admin/questions/?domain=abc")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["count"], 0)

    def test_integer_domain_filter_still_works(self):
        resp = self.client.get(f"/api/questions/admin/questions/?domain={self.domain.id}")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["count"], 1)
