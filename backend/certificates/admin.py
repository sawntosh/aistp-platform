from django.contrib import admin

from .models import Certificate


@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    list_display = ("certificate_id", "recipient_name", "user", "score_percent", "issued_at", "revoked")
    list_filter = ("revoked", "issued_at")
    search_fields = ("certificate_id", "recipient_name", "user__username", "user__email")
    readonly_fields = ("certificate_id", "issued_at")
