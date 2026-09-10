from rest_framework import serializers

from .models import Certificate


class CertificateSerializer(serializers.ModelSerializer):
    session = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Certificate
        fields = [
            "certificate_id",
            "session",
            "recipient_name",
            "exam_label",
            "score_percent",
            "issued_at",
            "revoked",
        ]
        read_only_fields = fields


class CertificateClaimSerializer(serializers.Serializer):
    # The name printed on the certificate is always the account's username;
    # only the session id is supplied.
    session_id = serializers.IntegerField()
