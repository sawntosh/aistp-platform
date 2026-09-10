"""
FR-06: admin-managed question images.

Covers the `image` sub-action on AdminQuestionViewSet (upload / replace /
delete, admin-only, image + size validation) and that the stored image
URL is surfaced to learners by QuestionPublicSerializer.
"""
import io

from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APITestCase

from .models import AnswerOption, Domain, PracticeSession, Question

User = get_user_model()


def make_png(size=(4, 4), color=(255, 0, 0)):
    buffer = io.BytesIO()
    Image.new("RGB", size, color).save(buffer, format="PNG")
    buffer.seek(0)
    return SimpleUploadedFile("diagram.png", buffer.read(), content_type="image/png")


class QuestionImageAdminTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="imgadmin", email="imgadmin@gmail.com",
            password="Str0ngPass!23", role=User.Role.ADMIN,
        )
        self.student = User.objects.create_user(
            username="imgstudent", email="imgstudent@gmail.com",
            password="Str0ngPass!23",
        )
        self.domain = Domain.objects.create(name="Image Domain")
        self.question = Question.objects.create(domain=self.domain, text="See the diagram.")

    def _url(self, qid=None):
        return f"/api/questions/admin/questions/{qid or self.question.id}/image/"

    def test_admin_can_upload_an_image(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.post(self._url(), {"image": make_png()}, format="multipart")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["image"])
        self.question.refresh_from_db()
        self.assertTrue(self.question.image.name.startswith("question_images/"))
        self.question.image.delete(save=True)

    def test_second_upload_replaces_the_image(self):
        self.client.force_authenticate(self.admin)
        r1 = self.client.post(self._url(), {"image": make_png()}, format="multipart")
        r2 = self.client.post(
            self._url(), {"image": make_png(color=(0, 0, 255))}, format="multipart"
        )
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r2.status_code, 200)
        self.question.refresh_from_db()
        self.assertTrue(self.question.image)
        self.assertTrue(default_storage.exists(self.question.image.name))
        self.question.image.delete(save=True)

    def test_admin_can_delete_the_image(self):
        self.client.force_authenticate(self.admin)
        self.client.post(self._url(), {"image": make_png()}, format="multipart")
        resp = self.client.delete(self._url())
        self.assertEqual(resp.status_code, 200)
        self.assertIsNone(resp.data["image"])
        self.question.refresh_from_db()
        self.assertFalse(self.question.image)

    def test_non_image_upload_is_rejected(self):
        self.client.force_authenticate(self.admin)
        bad = SimpleUploadedFile("notes.txt", b"just text", content_type="text/plain")
        resp = self.client.post(self._url(), {"image": bad}, format="multipart")
        self.assertEqual(resp.status_code, 400)

    def test_oversize_image_is_rejected(self):
        self.client.force_authenticate(self.admin)
        big = SimpleUploadedFile(
            "big.png", b"\x89PNG\r\n\x1a\n" + b"0" * (5 * 1024 * 1024 + 1),
            content_type="image/png",
        )
        resp = self.client.post(self._url(), {"image": big}, format="multipart")
        self.assertEqual(resp.status_code, 400)

    def test_student_cannot_upload(self):
        self.client.force_authenticate(self.student)
        resp = self.client.post(self._url(), {"image": make_png()}, format="multipart")
        self.assertIn(resp.status_code, (403, 401))

    def test_image_url_is_served_to_learners(self):
        self.client.force_authenticate(self.admin)
        self.client.post(self._url(), {"image": make_png()}, format="multipart")

        AnswerOption.objects.create(question=self.question, text="A", is_correct=True)
        AnswerOption.objects.create(question=self.question, text="B", is_correct=False)

        self.client.force_authenticate(self.student)
        resp = self.client.get("/api/questions/?count=1")
        self.assertEqual(resp.status_code, 200)
        served = resp.data["questions"][0]
        self.assertIn("image", served)
        self.assertTrue(served["image"].startswith("http"))

        self.question.refresh_from_db()
        self.question.image.delete(save=True)

    def test_question_without_image_serves_null(self):
        AnswerOption.objects.create(question=self.question, text="A", is_correct=True)
        AnswerOption.objects.create(question=self.question, text="B", is_correct=False)
        self.client.force_authenticate(self.student)
        resp = self.client.get("/api/questions/?count=1")
        self.assertIsNone(resp.data["questions"][0]["image"])

    def tearDown(self):
        PracticeSession.objects.all().delete()
