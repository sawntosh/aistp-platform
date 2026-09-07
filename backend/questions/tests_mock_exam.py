"""
questions/tests_mock_exam.py -- the ISTQB CTFL Mock Test mode
(mode=mock). Covers eligibility filtering, the K1/K2/K3 distribution,
randomised non-repeating selection, the "not enough questions" guard,
and the exam-style submit behaviour (correctness withheld, no
confidence required, kept out of analytics).
"""
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from analytics.models import PerformanceAnalytics

from .models import AnswerOption, Attempt, Domain, PracticeSession, Question

User = get_user_model()


def make_mcq(domain, k_level="K2", text="Q?", active=True, qtype=Question.QuestionType.MCQ):
    question = Question.objects.create(
        domain=domain,
        text=text,
        question_type=qtype,
        cognitive_level=k_level,
        is_active=active,
    )
    AnswerOption.objects.create(question=question, text="right", is_correct=True)
    for label in ("wrong1", "wrong2", "wrong3"):
        AnswerOption.objects.create(question=question, text=label, is_correct=False)
    return question


def seed_bank(domains, per_domain_by_level):
    """per_domain_by_level: {"K1": n, "K2": n, "K3": n} created in EACH domain."""
    created = []
    for domain in domains:
        for level, n in per_domain_by_level.items():
            for i in range(n):
                created.append(make_mcq(domain, level, f"{domain.name} {level} #{i}"))
    return created


class MockExamSelectionTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="mockstudent", email="mockstudent@gmail.com", password="Str0ngPass!23"
        )
        self.client.force_authenticate(user=self.user)
        self.domains = [Domain.objects.create(name=f"Domain {i}") for i in range(1, 7)]
        # 6 domains x (K1 6, K2 10, K3 4) = 36 + 60 + 24 = 120 eligible MCQ,
        # comfortably above the 8/24/8 official split.
        seed_bank(self.domains, {"K1": 6, "K2": 10, "K3": 4})

    def _start_mock(self, count=40):
        return self.client.get(f"/api/questions/?mode=mock&count={count}")

    def _levels_of(self, questions):
        ids = [q["id"] for q in questions]
        rows = Question.objects.filter(id__in=ids).values_list("id", "cognitive_level")
        by_id = dict(rows)
        return [by_id[i] for i in ids]

    def test_returns_exactly_40_unique_mcq_questions(self):
        response = self._start_mock(40)
        self.assertEqual(response.status_code, 200)
        questions = response.data["questions"]
        self.assertEqual(len(questions), 40)
        self.assertEqual(len({q["id"] for q in questions}), 40)
        self.assertTrue(all(q["question_type"] == "mcq" for q in questions))
        for q in questions:
            self.assertGreaterEqual(len(q["options"]), 2)
            self.assertTrue(q["text"])

    def test_session_is_created_in_mock_mode(self):
        response = self._start_mock(40)
        session = PracticeSession.objects.get(id=response.data["session_id"])
        self.assertEqual(session.mode, PracticeSession.Mode.MOCK)
        self.assertEqual(session.question_count, 40)
        self.assertEqual(response.data["mode"], "mock")

    def test_follows_official_k_level_split_when_bank_allows(self):
        levels = self._levels_of(self._start_mock(40).data["questions"])
        self.assertEqual(levels.count("K1"), 8)
        self.assertEqual(levels.count("K2"), 24)
        self.assertEqual(levels.count("K3"), 8)

    def test_selection_is_randomised_between_runs(self):
        first = sorted(q["id"] for q in self._start_mock(40).data["questions"])
        second = sorted(q["id"] for q in self._start_mock(40).data["questions"])
        # 40 of 120 -- an identical set twice in a row is astronomically
        # unlikely unless the draw isn't actually random.
        self.assertNotEqual(first, second)

    def test_spreads_across_all_available_domains(self):
        questions = self._start_mock(40).data["questions"]
        domain_ids = {q["domain"]["id"] for q in questions}
        self.assertEqual(len(domain_ids), len(self.domains))

    def test_ignores_domain_filter(self):
        one_domain = self.domains[0].id
        questions = self.client.get(
            f"/api/questions/?mode=mock&count=40&domains={one_domain}"
        ).data["questions"]
        domain_ids = {q["domain"]["id"] for q in questions}
        self.assertGreater(len(domain_ids), 1)

    def test_excludes_non_mcq_and_inactive_questions(self):
        make_mcq(self.domains[0], "K2", "inactive mcq", active=False)
        make_mcq(
            self.domains[0], "K2", "true/false", qtype=Question.QuestionType.TRUE_FALSE
        )
        questions = self._start_mock(40).data["questions"]
        returned_ids = {q["id"] for q in questions}
        blocked = Question.objects.filter(
            text__in=["inactive mcq", "true/false"]
        ).values_list("id", flat=True)
        self.assertTrue(returned_ids.isdisjoint(set(blocked)))
        self.assertTrue(all(q["question_type"] == "mcq" for q in questions))

    def test_backfills_when_a_k_level_is_short(self):
        Question.objects.filter(cognitive_level="K3").delete()
        make_mcq(self.domains[0], "K3", "only K3 #1")
        make_mcq(self.domains[1], "K3", "only K3 #2")
        response = self._start_mock(40)
        self.assertEqual(response.status_code, 200)
        questions = response.data["questions"]
        self.assertEqual(len(questions), 40)
        self.assertEqual(len({q["id"] for q in questions}), 40)
        levels = self._levels_of(questions)
        self.assertLessEqual(levels.count("K3"), 2)  # only 2 K3 in the bank

    def test_shorter_self_test_scales_the_ratio(self):
        levels = self._levels_of(self._start_mock(10).data["questions"])
        self.assertEqual(len(levels), 10)
        self.assertEqual(levels.count("K1"), 2)
        self.assertEqual(levels.count("K2"), 6)
        self.assertEqual(levels.count("K3"), 2)


class MockExamShortageTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="mockstudent2", email="mockstudent2@gmail.com", password="Str0ngPass!23"
        )
        self.client.force_authenticate(user=self.user)
        self.domain = Domain.objects.create(name="Only Domain")

    def test_422_when_bank_has_fewer_than_40_eligible_mcq(self):
        for i in range(20):
            make_mcq(self.domain, "K2", f"q{i}")
        response = self.client.get("/api/questions/?mode=mock&count=40")
        self.assertEqual(response.status_code, 422)
        self.assertIn("fewer than 40", response.data["detail"])
        self.assertEqual(response.data["diagnostic"]["eligible_mcq_total"], 20)
        # No half-built session left behind.
        self.assertEqual(PracticeSession.objects.count(), 0)

    def test_422_when_no_eligible_mcq_at_all(self):
        Question.objects.create(
            domain=self.domain, text="tf", question_type=Question.QuestionType.TRUE_FALSE
        )
        response = self.client.get("/api/questions/?mode=mock&count=40")
        self.assertEqual(response.status_code, 422)
        self.assertEqual(PracticeSession.objects.count(), 0)

    def test_partial_self_test_allowed_below_40(self):
        for i in range(20):
            make_mcq(self.domain, "K2", f"q{i}")
        response = self.client.get("/api/questions/?mode=mock&count=10")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["questions"]), 10)


class MockExamSubmitTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="mocksubmit", email="mocksubmit@gmail.com", password="Str0ngPass!23"
        )
        self.client.force_authenticate(user=self.user)
        self.domain = Domain.objects.create(name="Sub Domain")
        for i in range(45):
            make_mcq(self.domain, "K2", f"q{i}")

    def _start(self):
        data = self.client.get("/api/questions/?mode=mock&count=40").data
        return data["session_id"], data["questions"]

    def test_submit_withholds_correctness_until_review(self):
        session_id, questions = self._start()
        q = questions[0]
        correct_option = next(
            o for o in AnswerOption.objects.filter(question_id=q["id"]) if o.is_correct
        )
        response = self.client.post(
            "/api/questions/submit/",
            {"session_id": session_id, "question_id": q["id"], "selected_option_id": correct_option.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("is_correct", response.data)
        self.assertNotIn("correct_option_id", response.data)
        self.assertEqual(response.data, {"question_type": "mcq", "recorded": True})

    def test_submit_does_not_require_confidence(self):
        session_id, questions = self._start()
        q = questions[0]
        any_option = AnswerOption.objects.filter(question_id=q["id"]).first()
        response = self.client.post(
            "/api/questions/submit/",
            {"session_id": session_id, "question_id": q["id"], "selected_option_id": any_option.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(Attempt.objects.get(question_id=q["id"]).confidence)

    def test_mock_attempts_stay_out_of_analytics(self):
        session_id, questions = self._start()
        for q in questions[:5]:
            any_option = AnswerOption.objects.filter(question_id=q["id"]).first()
            self.client.post(
                "/api/questions/submit/",
                {"session_id": session_id, "question_id": q["id"], "selected_option_id": any_option.id},
                format="json",
            )
        self.assertEqual(PerformanceAnalytics.objects.filter(user=self.user).count(), 0)

    def test_finish_and_review_reveal_the_answer_key(self):
        session_id, questions = self._start()
        q = questions[0]
        any_option = AnswerOption.objects.filter(question_id=q["id"]).first()
        self.client.post(
            "/api/questions/submit/",
            {"session_id": session_id, "question_id": q["id"], "selected_option_id": any_option.id},
            format="json",
        )
        finish = self.client.post(f"/api/questions/sessions/{session_id}/finish/")
        self.assertEqual(finish.status_code, 200)
        review = self.client.get(f"/api/questions/sessions/{session_id}/review/")
        self.assertEqual(review.status_code, 200)
        self.assertEqual(review.data["mode"], "mock")
        first = review.data["results"][0]
        self.assertIn("is_correct", first)
        self.assertIn("correct_option_id", first)
