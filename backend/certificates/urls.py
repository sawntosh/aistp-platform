from django.urls import path

from .views import CertificatePdfView, ClaimCertificateView, MyCertificatesView

urlpatterns = [
    path("", MyCertificatesView.as_view(), name="my-certificates"),
    path("claim/", ClaimCertificateView.as_view(), name="claim-certificate"),
    path("<str:certificate_id>/pdf/", CertificatePdfView.as_view(), name="certificate-pdf"),
]
