"""
analytics/views.py -- FR-05: Domain Analytics Dashboard
"""
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from questions.models import PracticeSession
from services.analytics_service import (
    get_confidence_summary,
    get_domain_accuracy,
    get_domain_confidence,
)


class DashboardView(APIView):
    """Returns overall accuracy, per-domain accuracy (6 CTFL domains),
    weakest domains ranked, session history, and -- as an additional
    diagnostic that does not affect any accuracy number -- Test Mode
    confidence insights for the logged-in user."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        domains = get_domain_accuracy(request.user)

        total_correct = sum(d["correct_count"] for d in domains)
        total_answered = sum(d["total_count"] for d in domains)
        overall_accuracy = round((total_correct / total_answered) * 100, 1) if total_answered else 0

        # Merge per-domain confidence onto the accuracy rows by name --
        # additive only; accuracy_percent / correct_count / total_count
        # are left exactly as get_domain_accuracy returned them.
        domain_confidence = get_domain_confidence(request.user)
        for row in domains:
            row.update(
                domain_confidence.get(
                    row["domain"],
                    {"average_confidence": None, "high_confidence_mistakes": 0, "low_confidence_correct": 0},
                )
            )

        sessions = PracticeSession.objects.filter(user=request.user).order_by("-started_at")
        session_data = [
            {
                "id": session.id,
                "started_at": session.started_at,
                "finished_at": session.finished_at,
                "question_count": session.question_count,
                "score": session.score,
                "accuracy_percent": (
                    round((session.score / session.question_count) * 100, 1)
                    if session.finished_at and session.question_count
                    else None
                ),
            }
            for session in sessions
        ]

        return Response(
            {
                "overall_accuracy": overall_accuracy,
                "domains": domains,
                "sessions": session_data,
                "confidence": get_confidence_summary(request.user),
            }
        )
