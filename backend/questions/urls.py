from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminQuestionViewSet,
    AnswerSubmitView,
    DomainListView,
    QuestionListView,
    SessionFinishView,
)

router = DefaultRouter()
router.register("admin/questions", AdminQuestionViewSet, basename="admin-question")

urlpatterns = [
    path("", QuestionListView.as_view(), name="question-list"),
    path("submit/", AnswerSubmitView.as_view(), name="answer-submit"),
    path("sessions/<int:session_id>/finish/", SessionFinishView.as_view(), name="session-finish"),
    path("domains/", DomainListView.as_view(), name="domain-list"),
    path("", include(router.urls)),
]
