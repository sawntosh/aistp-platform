"""Admin question/generation-job management coverage that tests.py's
AdminQuestionCrudTests and AdminGenerationJobTests don't reach: those only
cover `create`. This file covers list (with pagination), retrieve, update,
delete and the domain-filter query param on AdminQuestionViewSet, plus
list/retrieve on AdminGenerationJobViewSet -- and locks down that both
viewsets reject non-admin and unauthenticated callers on every action.
"""
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from questions.models import AnswerOption, Domain, GenerationJob, Question

User = get_user_model()


class AdminQuestionListRetrieveTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin-list", email="admin-list@gmail.com", password="Str0ngPass!23", role=User.Role.ADMIN
        )
        self.student = User.objects.create_user(
            username="student-list", email="student-list@gmail.com", password="Str0ngPass!23"
        )
        self.domain = Domain.objects.create(name="Test Design")
        self.other_domain = Domain.objects.create(name="Static Testing")
        self.question = Question.objects.create(domain=self.domain, text="Q in Test Design")
        AnswerOption.objects.create(question=self.question, text="Right", is_correct=True)
        AnswerOption.objects.create(question=self.question, text="Wrong", is_correct=False)
        self.other_question = Question.objects.create(domain=self.other_domain, text="Q in Static Testing")
        AnswerOption.objects.create(question=self.other_question, text="Right", is_correct=True)
        AnswerOption.objects.create(question=self.other_question, text="Wrong", is_correct=False)

    def test_unauthenticated_cannot_list(self):
        response = self.client.get("/api/questions/admin/questions/")
        self.assertEqual(response.status_code, 401)

    def test_student_cannot_list(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.get("/api/questions/admin/questions/")
        self.assertEqual(response.status_code, 403)

    def test_admin_list_is_paginated(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/questions/admin/questions/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("count", response.data)
        self.assertIn("results", response.data)
        self.assertEqual(response.data["count"], 2)

    def test_admin_list_filters_by_domain(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(f"/api/questions/admin/questions/?domain={self.domain.id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.question.id)

    def test_admin_list_with_non_integer_domain_returns_empty_not_500(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/questions/admin/questions/?domain=not-a-number")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)

    def test_admin_can_retrieve_single_question(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(f"/api/questions/admin/questions/{self.question.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], self.question.id)
        self.assertEqual(response.data["text"], "Q in Test Design")

    def test_student_cannot_retrieve_single_question(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.get(f"/api/questions/admin/questions/{self.question.id}/")
        self.assertEqual(response.status_code, 403)


class AdminQuestionUpdateDeleteTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin-write", email="admin-write@gmail.com", password="Str0ngPass!23", role=User.Role.ADMIN
        )
        self.student = User.objects.create_user(
            username="student-write", email="student-write@gmail.com", password="Str0ngPass!23"
        )
        self.domain = Domain.objects.create(name="Test Design")
        self.question = Question.objects.create(domain=self.domain, text="Original text", difficulty="easy")
        AnswerOption.objects.create(question=self.question, text="Right", is_correct=True)
        AnswerOption.objects.create(question=self.question, text="Wrong", is_correct=False)

    def _payload(self, **overrides):
        payload = {
            "domain": self.domain.id,
            "text": "Updated text",
            "difficulty": "hard",
            "options": [{"text": "Right", "is_correct": True}, {"text": "Wrong", "is_correct": False}],
        }
        payload.update(overrides)
        return payload

    def test_admin_can_update_question(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.put(
            f"/api/questions/admin/questions/{self.question.id}/", self._payload(), format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.question.refresh_from_db()
        self.assertEqual(self.question.text, "Updated text")
        self.assertEqual(self.question.difficulty, "hard")

    def test_student_cannot_update_question(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.put(
            f"/api/questions/admin/questions/{self.question.id}/", self._payload(), format="json"
        )
        self.assertEqual(response.status_code, 403)
        self.question.refresh_from_db()
        self.assertEqual(self.question.text, "Original text")

    def test_unauthenticated_cannot_update_question(self):
        response = self.client.put(
            f"/api/questions/admin/questions/{self.question.id}/", self._payload(), format="json"
        )
        self.assertEqual(response.status_code, 401)

    def test_admin_can_delete_question(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(f"/api/questions/admin/questions/{self.question.id}/")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Question.objects.filter(id=self.question.id).exists())

    def test_student_cannot_delete_question(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.delete(f"/api/questions/admin/questions/{self.question.id}/")
        self.assertEqual(response.status_code, 403)
        self.assertTrue(Question.objects.filter(id=self.question.id).exists())


class AdminGenerationJobListRetrieveTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin-jobs", email="admin-jobs@gmail.com", password="Str0ngPass!23", role=User.Role.ADMIN
        )
        self.student = User.objects.create_user(
            username="student-jobs", email="student-jobs@gmail.com", password="Str0ngPass!23"
        )
        self.job = GenerationJob.objects.create(
            created_by=self.admin,
            source_file=SimpleUploadedFile("syllabus.pdf", b"%PDF-1.4 fake", content_type="application/pdf"),
            source_filename="syllabus.pdf",
            question_types=["mcq"],
            domain_names=[],
            target_per_domain=5,
        )

    def test_unauthenticated_cannot_list_jobs(self):
        response = self.client.get("/api/questions/admin/generate/")
        self.assertEqual(response.status_code, 401)

    def test_student_cannot_list_jobs(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.get("/api/questions/admin/generate/")
        self.assertEqual(response.status_code, 403)

    def test_admin_can_list_jobs(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/questions/admin/generate/")
        self.assertEqual(response.status_code, 200)
        ids = [row["id"] for row in response.data]
        self.assertIn(self.job.id, ids)

    def test_admin_can_retrieve_job_status(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(f"/api/questions/admin/generate/{self.job.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], self.job.id)
        self.assertEqual(response.data["status"], GenerationJob.Status.PENDING)

    def test_student_cannot_retrieve_job_status(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.get(f"/api/questions/admin/generate/{self.job.id}/")
        self.assertEqual(response.status_code, 403)
