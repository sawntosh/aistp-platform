from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AdminQuestionViewSet, AnswerSubmitView, QuestionListView

router = DefaultRouter()
router.register("admin/questions", AdminQuestionViewSet, basename="admin-question")

urlpatterns = [
    path("", QuestionListView.as_view(), name="question-list"),
    path("submit/", AnswerSubmitView.as_view(), name="answer-submit"),
    path("", include(router.urls)),
]
