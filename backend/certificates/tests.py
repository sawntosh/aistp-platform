"""
Certificate issuance: only a finished Real Exam passed at >= 65% earns
one, it's issued at most once per session, its name is always the
account's username, and the PDF is fetched by certificate id.
"""
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from questions.models import PracticeSession

from .models import Certificate

User = get_user_model()


class CertificateTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="grad", email="grad@gmail.com", password="Str0ngPass!23"
        )
        self.other = User.objects.create_user(
            username="other", email="other@gmail.com", password="Str0ngPass!23"
        )
        self.client.force_authenticate(user=self.user)

    def _session(self, *, score, count=10, mode=PracticeSession.Mode.TEST, finished=True, user=None):
        session = PracticeSession.objects.create(
            user=user or self.user, question_count=count, mode=mode
        )
        session.score = score
        session.finished_at = timezone.now() if finished else None
        session.save()
        return session

    def _claim(self, session):
        return self.client.post("/api/certificates/claim/", {"session_id": session.id})

    # -- issuance --------------------------------------------------------
    def test_passing_real_exam_issues_a_certificate_named_for_the_user(self):
        resp = self._claim(self._session(score=8))
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["score_percent"], 80)
        self.assertEqual(resp.data["recipient_name"], "grad")
        self.assertEqual(resp.data["exam_label"], "AISTP Software Testing Certification")
        self.assertRegex(resp.data["certificate_id"], r"^AISTP-\d{4}-[A-HJ-NP-Z2-9]{6}$")

    def test_exactly_65_percent_passes(self):
        resp = self._claim(self._session(score=13, count=20))  # 65%
        self.assertEqual(resp.status_code, 201)

    def test_below_threshold_is_rejected(self):
        resp = self._claim(self._session(score=6))  # 60%
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(Certificate.objects.count(), 0)

    def test_practice_session_cannot_be_certified(self):
        resp = self._claim(self._session(score=10, mode=PracticeSession.Mode.PRACTICE))
        self.assertEqual(resp.status_code, 400)

    def test_mock_session_cannot_be_certified(self):
        resp = self._claim(self._session(score=10, mode=PracticeSession.Mode.MOCK))
        self.assertEqual(resp.status_code, 400)

    def test_unfinished_session_cannot_be_certified(self):
        resp = self._claim(self._session(score=10, finished=False))
        self.assertEqual(resp.status_code, 400)

    def test_claim_is_idempotent_per_session(self):
        session = self._session(score=9)
        first = self._claim(session)
        second = self._claim(session)
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.data["certificate_id"], second.data["certificate_id"])
        self.assertEqual(Certificate.objects.count(), 1)

    def test_cannot_claim_another_users_session(self):
        theirs = self._session(score=10, user=self.other)
        resp = self._claim(theirs)
        self.assertEqual(resp.status_code, 404)

    # -- pdf ----------------------------------------------------------
    def test_pdf_is_public_and_returns_a_pdf(self):
        cert_id = self._claim(self._session(score=8)).data["certificate_id"]
        self.client.force_authenticate(user=None)
        resp = self.client.get(f"/api/certificates/{cert_id}/pdf/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Content-Type"], "application/pdf")
        self.assertTrue(resp.content.startswith(b"%PDF"))

    def test_pdf_download_flag_sets_attachment(self):
        cert_id = self._claim(self._session(score=8)).data["certificate_id"]
        resp = self.client.get(f"/api/certificates/{cert_id}/pdf/?download=1")
        self.assertIn("attachment", resp["Content-Disposition"])

    def test_revoked_certificate_has_no_pdf(self):
        cert_id = self._claim(self._session(score=8)).data["certificate_id"]
        Certificate.objects.filter(certificate_id=cert_id).update(revoked=True)
        resp = self.client.get(f"/api/certificates/{cert_id}/pdf/")
        self.assertEqual(resp.status_code, 404)

    def test_unknown_pdf_id_is_404(self):
        resp = self.client.get("/api/certificates/AISTP-2025-ZZZZZZ/pdf/")
        self.assertEqual(resp.status_code, 404)

    # -- listing ----------------------------------------------------
    def test_my_certificates_lists_only_mine(self):
        self._claim(self._session(score=8))
        Certificate.objects.create(
            user=self.other,
            session=self._session(score=8, user=self.other),
            recipient_name="other",
            score_percent=80,
        )
        resp = self.client.get("/api/certificates/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["recipient_name"], "grad")
