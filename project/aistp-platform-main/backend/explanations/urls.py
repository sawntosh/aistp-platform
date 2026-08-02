from django.urls import path
from .views import ExplainView

urlpatterns = [
    path("", ExplainView.as_view(), name="explain"),
]
