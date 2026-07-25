from django.urls import path
from .views import QuestionListView, AnswerSubmitView

urlpatterns = [
    path("", QuestionListView.as_view(), name="question-list"),
    path("submit/", AnswerSubmitView.as_view(), name="answer-submit"),
]
