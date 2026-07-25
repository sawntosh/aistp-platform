"""
explanations/models.py
AI_Explanations / cache -- Report Section 4.7. Caching reduces Gemini
API calls (T-08 DoS countermeasure) and improves response latency (NFR-02).
"""
from django.db import models
from questions.models import Question


class AIExplanation(models.Model):
    question = models.OneToOneField(Question, on_delete=models.CASCADE, related_name="ai_explanation")
    explanation_text = models.TextField()
    generated_by_model = models.CharField(max_length=50, default="gemini-1.5-flash")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Explanation for Q{self.question_id}"
