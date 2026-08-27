from django.urls import path

from .views import (
    StudyAnswerView,
    StudyDomainListView,
    StudySessionCompleteView,
    StudyTopicListView,
    StudyTopicStartView,
)

urlpatterns = [
    path("domains/", StudyDomainListView.as_view(), name="study-domain-list"),
    path("domains/<int:domain_id>/topics/", StudyTopicListView.as_view(), name="study-topic-list"),
    path("topics/<int:topic_id>/start/", StudyTopicStartView.as_view(), name="study-topic-start"),
    path("sessions/<int:session_id>/answer/", StudyAnswerView.as_view(), name="study-answer"),
    path("sessions/<int:session_id>/complete/", StudySessionCompleteView.as_view(), name="study-complete"),
]
