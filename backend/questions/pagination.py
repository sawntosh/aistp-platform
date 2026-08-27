"""Pagination classes for the questions app."""
from rest_framework.pagination import PageNumberPagination


class QuestionPagination(PageNumberPagination):
    """Page-number pagination for the admin question list.

    Scoped to AdminQuestionViewSet rather than set globally so the other
    list endpoints (DomainListView, generation jobs) keep returning bare
    arrays. Clients pass ?page=N and optionally ?page_size=N (capped).
    """

    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100
