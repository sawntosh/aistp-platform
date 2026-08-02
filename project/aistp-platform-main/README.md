# AI-Assisted Software Testing Practice Platform

ISTQB CTFL v4.0 practice platform with Gemini-powered AI explanations and
domain-level performance analytics.

## Stack
- **Frontend:** React + Next.js, Tailwind CSS
- **Backend:** Django + Django REST Framework
- **Database:** PostgreSQL (Supabase free tier)
- **AI:** Google Gemini API (gemini-1.5-flash)
- **Auth:** JWT (djangorestframework-simplejwt) + bcrypt password hashing

## Folder Structure
```
aistp-platform/
├── backend/
│   ├── aistp/           # Django project (settings, urls, wsgi/asgi)
│   ├── accounts/        # User model, register/login views (FR-01)
│   ├── questions/        # Domain, Question, AnswerOption, Attempt,
│   │                      PracticeSession models + views (FR-02/03/06/07)
│   ├── explanations/     # AIExplanation model + Gemini explain view (FR-04)
│   ├── analytics/        # PerformanceAnalytics model + dashboard view (FR-05)
│   ├── services/         # gemini_service, scoring_service, analytics_service
│   ├── manage.py
│   └── requirements.txt
├── frontend/            # React + Next.js SPA
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       ├── services/     # API client wrappers
│       └── styles/
├── .github/workflows/    # CI pipeline
└── docs/                 # design diagrams, wireframes, ERD, etc.
```

Each Django app maps 1:1 to an ERD entity group in report Section 4.7 /
Figure 8, and each view maps to a functional requirement in Section 4.1.1.

## Branching
- `main` — production only, protected, 2 approvals required
- `dev` — integration branch, all PRs merge here, 1 approval required
- `feature/xxx` — individual working branches

## Getting Started
See `backend/README.md` and `frontend/README.md` for setup instructions.
