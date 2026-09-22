"""
BUG-07: Study Mode answer submission must be scoped to the session's
topic -- a StudyAttempt (and the reveal payload) must not be obtainable
for an arbitrary bank question by POSTing its id to a study session.
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from questions.models import AnswerOption, Domain, Question, Topic
from study.models import StudyAttempt

User = get_user_model()


class StudyTopicScopeTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="scoped", email="scoped@gmail.com", password="Str0ngPass!23"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.domain = Domain.objects.create(name="Scope Domain")
        self.topic = Topic.objects.create(domain=self.domain, title="In-scope topic", order=0)
        self.in_topic = Question.objects.create(
            domain=self.domain, topic=self.topic, text="tagged", question_type=Question.QuestionType.MCQ
        )
        AnswerOption.objects.create(question=self.in_topic, text="A", is_correct=True)
        AnswerOption.objects.create(question=self.in_topic, text="B", is_correct=False)

        self.off_topic = Question.objects.create(
            domain=self.domain, text="untagged", question_type=Question.QuestionType.MCQ
        )
        self.off_correct = AnswerOption.objects.create(question=self.off_topic, text="A", is_correct=True)
        AnswerOption.objects.create(question=self.off_topic, text="B", is_correct=False)

        self.session_id = self.client.post(
            f"/api/study/topics/{self.topic.id}/start/"
        ).json()["session_id"]

    def test_answering_a_question_outside_the_topic_is_rejected(self):
        resp = self.client.post(
            f"/api/study/sessions/{self.session_id}/answer/",
            {"question_id": self.off_topic.id, "selected_option_id": self.off_correct.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(StudyAttempt.objects.filter(question=self.off_topic).exists())

    def test_answering_an_in_topic_question_still_works(self):
        resp = self.client.post(
            f"/api/study/sessions/{self.session_id}/answer/",
            {"question_id": self.in_topic.id, "selected_option_id": self.in_topic.options.get(is_correct=True).id},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["is_correct"])
