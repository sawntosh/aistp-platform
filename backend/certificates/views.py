from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from questions.models import PracticeSession

from .models import Certificate
from .pdf import render_certificate_pdf
from .serializers import CertificateClaimSerializer, CertificateSerializer
from .services import session_is_certifiable, session_score_percent


class MyCertificatesView(APIView):
    """Every certificate the signed-in learner has earned."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        certificates = Certificate.objects.filter(user=request.user)
        return Response(CertificateSerializer(certificates, many=True).data)


class ClaimCertificateView(APIView):
    """Turn a passing Real Exam session into a certificate. Idempotent --
    a session that already has one just returns it. The certificate name is
    always the account's username."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=CertificateClaimSerializer, responses=CertificateSerializer)
    def post(self, request):
        serializer = CertificateClaimSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        session = get_object_or_404(
            PracticeSession,
            id=serializer.validated_data["session_id"],
            user=request.user,
        )

        existing = Certificate.objects.filter(session=session).first()
        if existing:
            return Response(CertificateSerializer(existing).data)

        if not session_is_certifiable(session):
            return Response(
                {"detail": "This exam doesn't qualify for a certificate."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        certificate = Certificate.objects.create(
            user=request.user,
            session=session,
            recipient_name=request.user.username,
            score_percent=session_score_percent(session),
        )
        return Response(
            CertificateSerializer(certificate).data, status=status.HTTP_201_CREATED
        )


class CertificatePdfView(APIView):
    """Public: the downloadable/printable PDF, keyed by certificate id.
    ``?download=1`` forces a save dialog instead of inline display."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, certificate_id):
        certificate = get_object_or_404(Certificate, certificate_id=certificate_id)
        if certificate.revoked:
            return Response(
                {"detail": "This certificate has been revoked."},
                status=status.HTTP_404_NOT_FOUND,
            )

        pdf_bytes = render_certificate_pdf(certificate)
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        disposition = "attachment" if request.query_params.get("download") else "inline"
        response["Content-Disposition"] = (
            f'{disposition}; filename="{certificate.certificate_id}.pdf"'
        )
        return response
