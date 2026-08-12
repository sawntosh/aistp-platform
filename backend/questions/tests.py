import json

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


class DomainListTests(APITestCase):
    def test_domain_list_requires_auth(self):
        response = self.client.get("/api/questions/domains/")
        self.assertEqual(response.status_code, 401)

    def test_domain_list_returns_domains(self):
        user = User.objects.create_user(username="student4", email="student4@gmail.com", password="Str0ngPass!23")
        Domain.objects.create(name="Static Testing")
        self.client.force_authenticate(user=user)
        response = self.client.get("/api/questions/domains/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["name"], "Static Testing")


class AdminQuestionImportTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin2", email="admin2@gmail.com", password="Str0ngPass!23", role=User.Role.ADMIN
        )
        self.student = User.objects.create_user(
            username="student5", email="student5@gmail.com", password="Str0ngPass!23"
        )
        self.valid_rows = [
            {
                "Domain": "Domain 1 - Fundamentals of Testing",
                "Question Type": "MCQ",
                "Difficulty": "Easy",
                "Cognitive Level": "K1",
                "Learning Objective ID": "1.1.1",
                "Learning Objective": "Identify typical test objectives",
                "Question Text": "Which of the following is a typical test objective?",
                "Option A": "Writing source code",
                "Option B": "Building confidence in quality",
                "Option C": "Managing the project budget",
                "Option D": "Designing the UI",
                "Correct Option": "B",
                "Source Section": "1.1.1 Test Objectives",
            },
            {
                "Domain": "Domain 1 - Fundamentals of Testing",
                "Difficulty": "Medium",
                "Question Text": "Which statement differentiates testing from debugging?",
                "Option A": "They are identical",
                "Option B": "Testing triggers failures; debugging finds and removes causes",
                "Correct Option": "B",
            },
        ]

    def test_student_cannot_import(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.post(
            "/api/questions/admin/questions/import/", self.valid_rows, format="json"
        )
        self.assertEqual(response.status_code, 403)

    def test_admin_import_raw_json_body(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/questions/admin/questions/import/", self.valid_rows, format="json"
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["created"], 2)
        self.assertEqual(response.data["domains"]["Domain 1 - Fundamentals of Testing"], 2)

        domain = Domain.objects.get(name="Domain 1 - Fundamentals of Testing")
        self.assertEqual(domain.questions.count(), 2)
        first = domain.questions.get(learning_objective_id="1.1.1")
        self.assertEqual(first.options.count(), 4)
        self.assertTrue(first.options.get(text="Building confidence in quality").is_correct)

    def test_admin_import_file_upload(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        self.client.force_authenticate(user=self.admin)
        payload = json.dumps(self.valid_rows).encode("utf-8")
        upload = SimpleUploadedFile("questions.json", payload, content_type="application/json")
        response = self.client.post(
            "/api/questions/admin/questions/import/", {"file": upload}, format="multipart"
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["created"], 2)

    def test_admin_import_reuses_existing_domain(self):
        Domain.objects.create(name="Domain 1 - Fundamentals of Testing")
        self.client.force_authenticate(user=self.admin)
        self.client.post("/api/questions/admin/questions/import/", self.valid_rows, format="json")
        self.assertEqual(Domain.objects.filter(name="Domain 1 - Fundamentals of Testing").count(), 1)

    def test_admin_import_rejects_whole_batch_on_bad_row(self):
        self.client.force_authenticate(user=self.admin)
        rows = self.valid_rows + [{"Domain": "Domain 1 - Fundamentals of Testing", "Difficulty": "impossible"}]
        response = self.client.post("/api/questions/admin/questions/import/", rows, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("errors", response.data)
        self.assertEqual(Question.objects.count(), 0)

    def test_admin_import_rejects_invalid_json_file(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        self.client.force_authenticate(user=self.admin)
        upload = SimpleUploadedFile("questions.json", b"not json", content_type="application/json")
        response = self.client.post(
            "/api/questions/admin/questions/import/", {"file": upload}, format="multipart"
        )
        self.assertEqual(response.status_code, 400)
