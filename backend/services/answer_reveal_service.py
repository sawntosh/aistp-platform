"""
Shared "what is the correct answer" payload builder, shaped by
question_type. Used by Test Mode (questions.views: the immediate Practice
Mode submit response, and the deferred Test Mode session review) and by
Study Mode (study.views: immediate per-question educational feedback).
Read-only and side-effect-free -- moving it here doesn't change any
existing response shape.
"""


def build_reveal_payload(question):
    from questions.models import Question

    qtype = question.question_type
    payload = {}
    if qtype in (Question.QuestionType.MCQ, Question.QuestionType.TRUE_FALSE):
        correct_option = question.options.filter(is_correct=True).first()
        payload["correct_option_id"] = correct_option.id if correct_option else None
        payload["correct_option_text"] = correct_option.text if correct_option else None
    elif qtype == Question.QuestionType.MULTI_SELECT:
        correct_options = question.options.filter(is_correct=True)
        payload["correct_option_ids"] = [opt.id for opt in correct_options]
        payload["correct_option_texts"] = [opt.text for opt in correct_options]
    elif qtype == Question.QuestionType.FILL_BLANK:
        first_answer = question.blank_answers.first()
        payload["correct_answer"] = first_answer.answer_text if first_answer else None
    elif qtype == Question.QuestionType.MATCHING:
        payload["correct_pairing"] = {
            str(pair.id): pair.match_text for pair in question.matching_pairs.all()
        }
    return payload
