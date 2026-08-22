import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from .models import AnswerOption, Domain, FillBlankAnswer, GenerationJob, MatchingPair, PracticeSession, Question

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

    def test_question_list_filters_by_domain(self):
        other_domain = Domain.objects.create(name="Static Testing")
        other_question = Question.objects.create(domain=other_domain, text="Static testing Q")
        AnswerOption.objects.create(question=other_question, text="A", is_correct=True)
        AnswerOption.objects.create(question=other_question, text="B", is_correct=False)

        response = self.client.get(f"/api/questions/?domains={self.domain.id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["questions"]), 1)
        self.assertEqual(response.data["questions"][0]["id"], self.question.id)

    def test_question_list_filters_by_multiple_domains(self):
        other_domain = Domain.objects.create(name="Static Testing")
        other_question = Question.objects.create(domain=other_domain, text="Static testing Q")
        AnswerOption.objects.create(question=other_question, text="A", is_correct=True)
        AnswerOption.objects.create(question=other_question, text="B", is_correct=False)

        response = self.client.get(f"/api/questions/?domains={self.domain.id},{other_domain.id}&count=10")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["questions"]), 2)

    def test_question_list_rejects_non_integer_domains(self):
        response = self.client.get("/api/questions/?domains=abc")
        self.assertEqual(response.status_code, 400)

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

    def test_question_list_spreads_across_domains_and_types_instead_of_random_luck(self):
        # Regression test: a plain order_by('?') draw can, by chance,
        # come back all-one-type/all-one-domain on an imbalanced bank.
        # _pick_stratified_question_ids must pull from every distinct
        # (domain, question_type) bucket before it repeats any of them.
        domain_b = Domain.objects.create(name="Static Testing")

        def make_true_false(domain, text):
            q = Question.objects.create(domain=domain, text=text, question_type=Question.QuestionType.TRUE_FALSE)
            AnswerOption.objects.create(question=q, text="True", is_correct=True)
            AnswerOption.objects.create(question=q, text="False", is_correct=False)
            return q

        # self.domain already has 1 mcq question from setUp.
        make_true_false(self.domain, "TF in domain A")
        mcq_b = Question.objects.create(domain=domain_b, text="MCQ in domain B")
        AnswerOption.objects.create(question=mcq_b, text="A", is_correct=True)
        AnswerOption.objects.create(question=mcq_b, text="B", is_correct=False)
        make_true_false(domain_b, "TF in domain B")

        response = self.client.get("/api/questions/?count=4")
        self.assertEqual(response.status_code, 200)
        questions = response.data["questions"]
        self.assertEqual(len(questions), 4)

        combos = {(q["domain"]["id"], q["question_type"]) for q in questions}
        # All 4 distinct (domain, type) buckets should appear at least
        # once in a 4-question draw when exactly 4 buckets exist.
        self.assertEqual(len(combos), 4)


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
    def test_domain_list_is_public(self):
        Domain.objects.create(name="Static Testing")
        response = self.client.get("/api/questions/domains/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["name"], "Static Testing")

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

    def test_admin_import_with_domain_id_overrides_each_rows_domain_field(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        target_domain = Domain.objects.create(name="Domain 3 - Static Testing")
        self.client.force_authenticate(user=self.admin)
        # Neither row names "Domain 3 - Static Testing" -- one names a
        # different domain, the other omits "Domain" entirely.
        rows = [
            {
                "Domain": "Domain 1 - Fundamentals of Testing",
                "Difficulty": "Easy",
                "Question Text": "Which of the following is a typical test objective?",
                "Option A": "Writing source code",
                "Option B": "Building confidence in quality",
                "Correct Option": "B",
            },
            {
                "Difficulty": "Medium",
                "Question Text": "Which statement differentiates testing from debugging?",
                "Option A": "They are identical",
                "Option B": "Testing triggers failures; debugging finds and removes causes",
                "Correct Option": "B",
            },
        ]
        upload = SimpleUploadedFile("questions.json", json.dumps(rows).encode("utf-8"), content_type="application/json")
        response = self.client.post(
            "/api/questions/admin/questions/import/",
            {"file": upload, "domain_id": target_domain.id},
            format="multipart",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["created"], 2)
        self.assertEqual(target_domain.questions.count(), 2)
        self.assertFalse(Domain.objects.filter(name="Domain 1 - Fundamentals of Testing").exists())


class AdminQuestionImportMultiTypeTests(APITestCase):
    """Bulk JSON import across all 5 question types -- rows shaped like a
    real admin-generated export (True/False, Multiple Answer, Fill in
    the Blank, Matching Pairs), not just the original MCQ-only shape."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin5", email="admin5@gmail.com", password="Str0ngPass!23", role=User.Role.ADMIN
        )
        self.client.force_authenticate(user=self.admin)

    def _import(self, rows):
        return self.client.post("/api/questions/admin/questions/import/", rows, format="json")

    def test_true_false_row_imports_correctly(self):
        response = self._import(
            [
                {
                    "Domain": "Domain 1 - Fundamentals of Testing",
                    "Question Type": "True/False",
                    "Difficulty": "Easy",
                    "Question Text": "Testing and debugging are the same activity.",
                    "Correct Answer": "False",
                }
            ]
        )
        self.assertEqual(response.status_code, 201, response.data)
        question = Question.objects.get()
        self.assertEqual(question.question_type, Question.QuestionType.TRUE_FALSE)
        options = {opt.text: opt.is_correct for opt in question.options.all()}
        self.assertEqual(options, {"True": False, "False": True})

    def test_multiple_answer_row_imports_correctly(self):
        response = self._import(
            [
                {
                    "Domain": "Domain 1 - Fundamentals of Testing",
                    "Question Type": "Multiple Answer",
                    "Difficulty": "Medium",
                    "Question Text": "Which are typical test objectives?",
                    "Option A": "Preventing defects",
                    "Option B": "Providing information for decisions",
                    "Option C": "Writing production code",
                    "Option D": "Building confidence",
                    "Option E": "Managing the project budget",
                    "Correct Options": ["A", "B", "D"],
                }
            ]
        )
        self.assertEqual(response.status_code, 201, response.data)
        question = Question.objects.get()
        self.assertEqual(question.question_type, Question.QuestionType.MULTI_SELECT)
        self.assertEqual(question.options.count(), 5)
        self.assertEqual(question.options.filter(is_correct=True).count(), 3)

    def test_fill_blank_row_imports_correctly(self):
        response = self._import(
            [
                {
                    "Domain": "Domain 1 - Fundamentals of Testing",
                    "Question Type": "Fill in the Blank",
                    "Difficulty": "Easy",
                    "Question Text": "________ is a flaw in a work product.",
                    "Correct Answer": "A defect",
                    "Accepted Answers": ["defect"],
                }
            ]
        )
        self.assertEqual(response.status_code, 201, response.data)
        question = Question.objects.get()
        self.assertEqual(question.question_type, Question.QuestionType.FILL_BLANK)
        self.assertEqual(
            set(question.blank_answers.values_list("answer_text", flat=True)), {"A defect", "defect"}
        )

    def test_matching_row_imports_correctly_and_ignores_blank_template_pair(self):
        response = self._import(
            [
                {
                    "Domain": "Domain 1 - Fundamentals of Testing",
                    "Question Type": "Matching Pairs",
                    "Difficulty": "Medium",
                    "Question Text": "Match each term to its definition.",
                    "Pairs": [
                        {"Left": "Error", "Right": "A human action that produces an incorrect result"},
                        {"Left": "Defect", "Right": "A flaw in a work product"},
                    ],
                    "Add Pair": {"Left": "", "Right": ""},
                }
            ]
        )
        self.assertEqual(response.status_code, 201, response.data)
        question = Question.objects.get()
        self.assertEqual(question.question_type, Question.QuestionType.MATCHING)
        self.assertEqual(question.matching_pairs.count(), 2)

    def test_multiple_answer_row_rejects_only_one_correct_option(self):
        response = self._import(
            [
                {
                    "Domain": "Domain 1 - Fundamentals of Testing",
                    "Question Type": "Multiple Answer",
                    "Difficulty": "Medium",
                    "Question Text": "Which are typical test objectives?",
                    "Option A": "Preventing defects",
                    "Option B": "Writing production code",
                    "Correct Options": ["A"],
                }
            ]
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Question.objects.count(), 0)

    def test_unrecognized_question_type_rejects_whole_batch(self):
        response = self._import(
            [{"Domain": "Domain 1 - Fundamentals of Testing", "Difficulty": "Easy", "Question Text": "Q?", "Question Type": "Essay"}]
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("errors", response.data)


class MultiTypeQuestionDeliveryTests(APITestCase):
    """Scoring + submission for the non-MCQ question types."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="student6", email="student6@gmail.com", password="Str0ngPass!23"
        )
        self.domain = Domain.objects.create(name="Multi-type Domain")
        self.client.force_authenticate(user=self.user)

    def _new_session(self):
        return PracticeSession.objects.create(user=self.user, question_count=1)

    def test_true_false_submit(self):
        question = Question.objects.create(
            domain=self.domain, text="Testing can completely prove no defects exist.",
            question_type=Question.QuestionType.TRUE_FALSE,
        )
        AnswerOption.objects.create(question=question, text="True", is_correct=False)
        false_option = AnswerOption.objects.create(question=question, text="False", is_correct=True)

        response = self.client.post(
            "/api/questions/submit/",
            {"session_id": self._new_session().id, "question_id": question.id, "selected_option_id": false_option.id},
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_correct"])

    def test_multi_select_submit_requires_exact_set(self):
        question = Question.objects.create(
            domain=self.domain, text="Which are test levels?", question_type=Question.QuestionType.MULTI_SELECT,
        )
        a = AnswerOption.objects.create(question=question, text="Unit", is_correct=True)
        b = AnswerOption.objects.create(question=question, text="Integration", is_correct=True)
        c = AnswerOption.objects.create(question=question, text="Marketing", is_correct=False)

        partial = self.client.post(
            "/api/questions/submit/",
            {"session_id": self._new_session().id, "question_id": question.id, "selected_option_ids": [a.id]},
        )
        self.assertFalse(partial.data["is_correct"])

        exact = self.client.post(
            "/api/questions/submit/",
            {"session_id": self._new_session().id, "question_id": question.id, "selected_option_ids": [a.id, b.id]},
        )
        self.assertTrue(exact.data["is_correct"])

        with_wrong = self.client.post(
            "/api/questions/submit/",
            {
                "session_id": self._new_session().id,
                "question_id": question.id,
                "selected_option_ids": [a.id, b.id, c.id],
            },
        )
        self.assertFalse(with_wrong.data["is_correct"])

    def test_fill_blank_submit_is_case_and_whitespace_insensitive(self):
        question = Question.objects.create(
            domain=self.domain, text="The V-model is a type of _____ development model.",
            question_type=Question.QuestionType.FILL_BLANK,
        )
        FillBlankAnswer.objects.create(question=question, answer_text="sequential")

        response = self.client.post(
            "/api/questions/submit/",
            {"session_id": self._new_session().id, "question_id": question.id, "text_answer": "  Sequential  "},
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_correct"])

    def test_matching_submit_requires_every_pair_correct(self):
        question = Question.objects.create(
            domain=self.domain, text="Match each term to its description.",
            question_type=Question.QuestionType.MATCHING,
        )
        p1 = MatchingPair.objects.create(question=question, prompt_text="Unit testing", match_text="Tests a single component", order=0)
        p2 = MatchingPair.objects.create(question=question, prompt_text="System testing", match_text="Tests the whole system", order=1)

        correct = self.client.post(
            "/api/questions/submit/",
            {
                "session_id": self._new_session().id,
                "question_id": question.id,
                "matching_response": {str(p1.id): p1.match_text, str(p2.id): p2.match_text},
            },
            format="json",
        )
        self.assertTrue(correct.data["is_correct"])

        swapped = self.client.post(
            "/api/questions/submit/",
            {
                "session_id": self._new_session().id,
                "question_id": question.id,
                "matching_response": {str(p1.id): p2.match_text, str(p2.id): p1.match_text},
            },
            format="json",
        )
        self.assertFalse(swapped.data["is_correct"])


class AdminQuestionTypeCrudTests(APITestCase):
    """Type-aware validation in QuestionAdminSerializer."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin3", email="admin3@gmail.com", password="Str0ngPass!23", role=User.Role.ADMIN
        )
        self.domain = Domain.objects.create(name="Type CRUD Domain")
        self.client.force_authenticate(user=self.admin)

    def test_multi_select_requires_at_least_two_correct(self):
        response = self.client.post(
            "/api/questions/admin/questions/",
            {
                "domain": self.domain.id,
                "text": "Pick two",
                "question_type": "multi_select",
                "options": [
                    {"text": "A", "is_correct": True},
                    {"text": "B", "is_correct": False},
                    {"text": "C", "is_correct": False},
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_multi_select_accepts_two_correct(self):
        response = self.client.post(
            "/api/questions/admin/questions/",
            {
                "domain": self.domain.id,
                "text": "Pick two",
                "question_type": "multi_select",
                "options": [
                    {"text": "A", "is_correct": True},
                    {"text": "B", "is_correct": True},
                    {"text": "C", "is_correct": False},
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)

    def test_fill_blank_requires_at_least_one_answer(self):
        response = self.client.post(
            "/api/questions/admin/questions/",
            {"domain": self.domain.id, "text": "The _____ model.", "question_type": "fill_blank", "blank_answers": []},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_fill_blank_creates_with_answers(self):
        response = self.client.post(
            "/api/questions/admin/questions/",
            {
                "domain": self.domain.id,
                "text": "The _____ model.",
                "question_type": "fill_blank",
                "blank_answers": [{"answer_text": "V"}, {"answer_text": "V-model"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        question = Question.objects.get(id=response.data["id"])
        self.assertEqual(question.blank_answers.count(), 2)

    def test_matching_requires_at_least_two_pairs(self):
        response = self.client.post(
            "/api/questions/admin/questions/",
            {
                "domain": self.domain.id,
                "text": "Match them",
                "question_type": "matching",
                "matching_pairs": [{"prompt_text": "A", "match_text": "1"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_matching_creates_with_pairs(self):
        response = self.client.post(
            "/api/questions/admin/questions/",
            {
                "domain": self.domain.id,
                "text": "Match them",
                "question_type": "matching",
                "matching_pairs": [{"prompt_text": "A", "match_text": "1"}, {"prompt_text": "B", "match_text": "2"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        question = Question.objects.get(id=response.data["id"])
        self.assertEqual(question.matching_pairs.count(), 2)


class AdminGenerationJobTests(APITestCase):
    """Upload endpoint for RAG question generation. run_generation itself
    (which calls Groq) is mocked out -- these tests only cover the
    upload/validation/threading wiring, not the generation pipeline."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin4", email="admin4@gmail.com", password="Str0ngPass!23", role=User.Role.ADMIN
        )
        self.student = User.objects.create_user(
            username="student7", email="student7@gmail.com", password="Str0ngPass!23"
        )

    def test_student_cannot_upload(self):
        self.client.force_authenticate(user=self.student)
        upload = SimpleUploadedFile("syllabus.pdf", b"%PDF-1.4 fake", content_type="application/pdf")
        response = self.client.post("/api/questions/admin/generate/", {"file": upload}, format="multipart")
        self.assertEqual(response.status_code, 403)

    def test_rejects_unsupported_file_type(self):
        self.client.force_authenticate(user=self.admin)
        upload = SimpleUploadedFile("syllabus.txt", b"plain text", content_type="text/plain")
        response = self.client.post("/api/questions/admin/generate/", {"file": upload}, format="multipart")
        self.assertEqual(response.status_code, 400)

    @patch("questions.views.threading.Thread")
    def test_admin_upload_creates_job_and_starts_thread(self, mock_thread):
        self.client.force_authenticate(user=self.admin)
        upload = SimpleUploadedFile("syllabus.pdf", b"%PDF-1.4 fake", content_type="application/pdf")
        response = self.client.post(
            "/api/questions/admin/generate/",
            {"file": upload, "target_per_domain": 5, "question_types": ["mcq", "true_false"]},
            format="multipart",
        )
        self.assertEqual(response.status_code, 202)
        job = GenerationJob.objects.get(id=response.data["id"])
        self.assertEqual(job.target_per_domain, 5)
        self.assertEqual(job.status, GenerationJob.Status.PENDING)
        mock_thread.assert_called_once()
        mock_thread.return_value.start.assert_called_once()

    @patch("questions.views.threading.Thread")
    def test_admin_upload_defaults_to_all_domains(self, mock_thread):
        from services.question_generation_service import DOMAIN_TITLES

        self.client.force_authenticate(user=self.admin)
        upload = SimpleUploadedFile("syllabus.pdf", b"%PDF-1.4 fake", content_type="application/pdf")
        response = self.client.post("/api/questions/admin/generate/", {"file": upload}, format="multipart")

        self.assertEqual(response.status_code, 202)
        job = GenerationJob.objects.get(id=response.data["id"])
        self.assertEqual(job.domain_names, list(DOMAIN_TITLES))

    @patch("questions.views.threading.Thread")
    def test_admin_upload_can_scope_to_one_domain(self, mock_thread):
        self.client.force_authenticate(user=self.admin)
        upload = SimpleUploadedFile("syllabus.pdf", b"%PDF-1.4 fake", content_type="application/pdf")
        response = self.client.post(
            "/api/questions/admin/generate/",
            {"file": upload, "domains": ["Domain 3 - Static Testing"]},
            format="multipart",
        )

        self.assertEqual(response.status_code, 202)
        job = GenerationJob.objects.get(id=response.data["id"])
        self.assertEqual(job.domain_names, ["Domain 3 - Static Testing"])

    def test_admin_upload_rejects_unknown_domain_name(self):
        self.client.force_authenticate(user=self.admin)
        upload = SimpleUploadedFile("syllabus.pdf", b"%PDF-1.4 fake", content_type="application/pdf")
        response = self.client.post(
            "/api/questions/admin/generate/",
            {"file": upload, "domains": ["Not A Real Domain"]},
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)


class GenerationServicePersistenceTests(APITestCase):
    """save_generated_question + the per-type validators, exercised
    directly with hand-built LLM-shaped dicts -- no live Groq calls."""

    def setUp(self):
        self.domain = Domain.objects.create(name="Generation Domain")

    def _base(self):
        return {
            "learning_objective_id": "1.1.1",
            "learning_objective": "Identify typical test objectives",
            "cognitive_level": "K1",
            "difficulty": "easy",
            "source_section": "1.1.1 Test Objectives",
        }

    def test_save_mcq(self):
        from services.question_generation_service import save_generated_question

        data = {
            **self._base(),
            "question": "Which is a test objective?",
            "options": {"A": "Ship faster", "B": "Build confidence", "C": "Cut budget", "D": "Design UI"},
            "correct_option": "B",
        }
        question = save_generated_question(self.domain, data, Question.QuestionType.MCQ)
        self.assertEqual(question.options.count(), 4)
        self.assertTrue(question.options.get(text="Build confidence").is_correct)

    def test_save_true_false(self):
        from services.question_generation_service import save_generated_question

        data = {**self._base(), "statement": "Testing can prove software is defect-free.", "is_true": False}
        question = save_generated_question(self.domain, data, Question.QuestionType.TRUE_FALSE)
        self.assertEqual(question.options.count(), 2)
        self.assertTrue(question.options.get(text="False").is_correct)
        self.assertFalse(question.options.get(text="True").is_correct)

    def test_save_multi_select(self):
        from services.question_generation_service import save_generated_question

        data = {
            **self._base(),
            "question": "Which are test levels?",
            "options": {"A": "Unit", "B": "Integration", "C": "Marketing", "D": "Sales"},
            "correct_options": ["A", "B"],
        }
        question = save_generated_question(self.domain, data, Question.QuestionType.MULTI_SELECT)
        self.assertEqual(question.options.filter(is_correct=True).count(), 2)

    def test_save_fill_blank(self):
        from services.question_generation_service import save_generated_question

        data = {**self._base(), "question": "The V-model is a _____ model.", "answers": ["sequential", "linear"]}
        question = save_generated_question(self.domain, data, Question.QuestionType.FILL_BLANK)
        self.assertEqual(question.blank_answers.count(), 2)

    def test_save_matching(self):
        from services.question_generation_service import save_generated_question

        data = {
            **self._base(),
            "instructions": "Match each term to its description.",
            "pairs": [
                {"prompt": "Unit testing", "match": "Tests a single component"},
                {"prompt": "System testing", "match": "Tests the whole system"},
            ],
        }
        question = save_generated_question(self.domain, data, Question.QuestionType.MATCHING)
        self.assertEqual(question.matching_pairs.count(), 2)
        self.assertEqual(list(question.matching_pairs.values_list("order", flat=True)), [0, 1])

    def test_validators_reject_malformed_shapes(self):
        from services.question_generation_service import _validate_matching, _validate_multi_select

        ok, _ = _validate_multi_select(
            {"question": "Q?", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "correct_options": ["A"]}
        )
        self.assertFalse(ok)  # only 1 correct option -- needs 2 or 3

        ok, _ = _validate_matching({"pairs": [{"prompt": "A", "match": "1"}]})
        self.assertFalse(ok)  # only 1 pair -- needs 3 to 5

    def test_subsection_regex_matches_real_istqb_heading_format(self):
        # Regression test: the ISTQB syllabus formats subsection headings
        # as "1.1 What is Testing?" (single period, inside the number,
        # no trailing period) -- the regex must not require a second
        # period after the number or every chunk comes back empty and
        # SyllabusRetriever crashes on an empty document list.
        from services.question_generation_service import SUBSECTION_RE, build_all_chunks

        chapter_text = (
            "1. Fundamentals of Testing\n\n"
            "1.1 What is Testing?\n\n"
            "Body text long enough to clear the forty character minimum chunk length easily.\n\n"
            "1.2 Why is Testing Necessary?\n\n"
            "More body text long enough to clear the forty character minimum chunk length.\n"
        )
        self.assertEqual(
            SUBSECTION_RE.findall(chapter_text),
            [("1.1", "What is Testing?"), ("1.2", "Why is Testing Necessary?")],
        )

        chunks = build_all_chunks({"Domain 1: Fundamental of Testing": chapter_text})
        self.assertEqual(len(chunks), 2)

    def test_build_all_chunks_raises_clear_error_when_no_subsections_found(self):
        from services.question_generation_service import GenerationError, build_all_chunks

        with self.assertRaises(GenerationError):
            build_all_chunks({"Domain 1: Fundamental of Testing": "Just a wall of text with no headings at all."})

    def test_unrecoverable_auth_errors_are_detected_by_message(self):
        # Regression test: an invalid/missing API key fails identically on
        # every call, so run_generation must recognize it and abort the
        # whole job instead of retrying target_per_domain * 5 times across
        # every one of the 6 domains for something that can never succeed.
        from services.question_generation_service import is_unrecoverable_error

        self.assertTrue(is_unrecoverable_error(Exception("400 API key not valid. Please pass a valid API key.")))
        self.assertTrue(is_unrecoverable_error(Exception("403 PERMISSION_DENIED: caller lacks permission")))
        self.assertFalse(is_unrecoverable_error(Exception("503 The model is overloaded, try again later")))

    def test_rate_limit_errors_are_distinguished_from_auth_errors(self):
        # Regression test: free-tier quota/rate-limit errors are usually
        # per-minute and resolve on their own, unlike a bad API key -- they
        # must be classified as rate_limit (backoff + retry) and NOT as
        # unrecoverable (which would abort the whole job).
        from services.question_generation_service import is_rate_limit_error, is_unrecoverable_error

        quota_error = Exception("429 Resource has been exhausted (e.g. check quota).")
        self.assertTrue(is_rate_limit_error(quota_error))
        self.assertFalse(is_unrecoverable_error(quota_error))

        auth_error = Exception("400 API key not valid. Please pass a valid API key.")
        self.assertFalse(is_rate_limit_error(auth_error))

    def test_groq_exception_types_are_classified_correctly(self):
        # The primary detection path: real groq.AuthenticationError /
        # PermissionDeniedError / RateLimitError instances, not just a
        # string match on the message (see the fallback marker tests
        # above for that path).
        from unittest.mock import Mock

        from groq import AuthenticationError, PermissionDeniedError, RateLimitError
        from services.question_generation_service import is_rate_limit_error, is_unrecoverable_error

        fake_response = Mock(status_code=401, headers={}, request=Mock())
        auth_exc = AuthenticationError("bad key", response=fake_response, body=None)
        self.assertTrue(is_unrecoverable_error(auth_exc))
        self.assertFalse(is_rate_limit_error(auth_exc))

        fake_response = Mock(status_code=403, headers={}, request=Mock())
        permission_exc = PermissionDeniedError("no access", response=fake_response, body=None)
        self.assertTrue(is_unrecoverable_error(permission_exc))

        fake_response = Mock(status_code=429, headers={}, request=Mock())
        rate_limit_exc = RateLimitError("slow down", response=fake_response, body=None)
        self.assertTrue(is_rate_limit_error(rate_limit_exc))
        self.assertFalse(is_unrecoverable_error(rate_limit_exc))
