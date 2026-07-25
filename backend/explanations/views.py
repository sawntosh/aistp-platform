"""
explanations/views.py -- FR-04: AI Explanation (Gemini)
Checks the AIExplanation cache before calling the Gemini API.
"""
from rest_framework import permissions
from rest_framework.views import APIView


class ExplainView(APIView):
    """Rate-limited (T-08 countermeasure) -- throttle_scope='explain'."""
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "explain"

    def post(self, request):
        raise NotImplementedError
