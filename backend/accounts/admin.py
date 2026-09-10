from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import EmailOTP, User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = UserAdmin.list_display + ("role", "email_verified")
    fieldsets = UserAdmin.fieldsets + (
        ("Role", {"fields": ("role", "email_verified")}),
    )


@admin.register(EmailOTP)
class EmailOTPAdmin(admin.ModelAdmin):
    list_display = ("user", "purpose", "created_at", "attempts", "consumed_at")
    list_filter = ("purpose",)
    search_fields = ("user__username", "user__email")
    readonly_fields = ("code_hash", "created_at")
