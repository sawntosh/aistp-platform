from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminGenerationJobViewSet,
    AdminQuestionViewSet,
    AnswerSubmitView,
    DomainListView,
    QuestionListView,
    ResumableSessionsView,
    SessionFinishView,
    SessionResumeView,
    SessionReviewView,
)

router = DefaultRouter()
router.register("admin/questions", AdminQuestionViewSet, basename="admin-question")
router.register("admin/generate", AdminGenerationJobViewSet, basename="admin-generation-job")

urlpatterns = [
    path("", QuestionListView.as_view(), name="question-list"),
    path("submit/", AnswerSubmitView.as_view(), name="answer-submit"),
    path("sessions/resumable/", ResumableSessionsView.as_view(), name="session-resumable"),
    path("sessions/<int:session_id>/finish/", SessionFinishView.as_view(), name="session-finish"),
    path("sessions/<int:session_id>/review/", SessionReviewView.as_view(), name="session-review"),
    path("sessions/<int:session_id>/resume/", SessionResumeView.as_view(), name="session-resume"),
    path("domains/", DomainListView.as_view(), name="domain-list"),
    path("", include(router.urls)),
]
