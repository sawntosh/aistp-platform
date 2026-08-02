"""
questions/views.py -- FR-02 (Question Delivery), FR-03 (Scoring),
FR-07 (weighted domain delivery), FR-06 (Admin CRUD).
"""
from rest_framework import permissions, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView


class QuestionListView(APIView):
    """FR-02/FR-07: serve a session's worth of questions, weighted
    towards the learner's weakest domains using analytics data."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        raise NotImplementedError


class AnswerSubmitView(APIView):
    """FR-03: score the submitted answer, write an Attempt row, and
    update PerformanceAnalytics for the relevant domain."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        raise NotImplementedError


class AdminQuestionViewSet(viewsets.ModelViewSet):
    """FR-06: admin-only CRUD on questions/answer options.
    TODO: add IsAdminRole permission class checking request.user.role.
    """
    permission_classes = [permissions.IsAuthenticated]  # replace with IsAdminRole
    queryset = None  # TODO: Question.objects.all()
    serializer_class = None  # TODO
