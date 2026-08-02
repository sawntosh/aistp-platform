"""
analytics/views.py -- FR-05: Domain Analytics Dashboard
"""
from rest_framework import permissions
from rest_framework.views import APIView


class DashboardView(APIView):
    """Returns overall accuracy, per-domain accuracy (6 CTFL domains),
    weakest domains ranked, and session history for the logged-in user."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        raise NotImplementedError
