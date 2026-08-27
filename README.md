<a name="readme-top"></a>

<div align="center">

# 🧠 AISTP Platform

**AI-Assisted Software Testing Practice Platform**

An ISTQB CTFL v4.0 exam-prep platform with two learning modes (Study & Test),
Groq-powered explanations, RAG-based question generation, self-rated confidence
tracking, and domain-level performance analytics.

[![Django](https://img.shields.io/badge/Django-6.0-092E20?style=for-the-badge&logo=django&logoColor=white)](https://www.djangoproject.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Groq](https://img.shields.io/badge/Groq_API-AI_Explanations-F55036?style=for-the-badge&logo=groq&logoColor=white)](https://groq.com/)

[Report Bug](https://github.com/sawntosh/aistp-platform/issues) · [Request Feature](https://github.com/sawntosh/aistp-platform/issues)

</div>

---

## ✨ Features

- 🔐 **Secure auth** — JWT login/registration, bcrypt hashing, role-gated (student / admin) sign-in
- 📚 **Study Mode** — unscored, no pass/fail: pick a domain → read a topic → reinforce with related questions. Isolated from all Test Mode metrics
- 📝 **Test Mode** — exam simulation: answers, explanations, and resource links are withheld until you finish, then revealed in a full session review
- 🎯 **Confidence tracking** *(Test Mode)* — rate how sure you are (1–5) on every answer. Never affects marks; surfaces **high-confidence mistakes** (sure but wrong) and low-confidence-correct insights
- 🧩 **Five question types** — multiple choice, true/false, multiple-answer, fill-in-the-blank, and matching, all rule-based scored
- 🤖 **AI explanations** — on-demand, structured into sections (correct answer, why, concept, per-option breakdown, key concept, exam tip) via Groq
- 🏗️ **RAG question generation** — admins upload a PDF/DOCX syllabus and generate questions per domain in the background
- 📊 **Analytics dashboard** — per-domain accuracy, weakest domains, session history & streak, plus Test Mode confidence insights (average confidence, accuracy by confidence level, high-confidence mistakes)
- 🛠️ **Admin CRUD** — manage questions and domains, with a paginated, domain-filtered question list and bulk JSON import
- 🧭 **Redesigned UI** — shared design system, left sidebar navigation for signed-in users, session customization (mode, domain filter, length), paged practice sessions with a question navigator
- 📖 **Interactive API docs** — Swagger UI & ReDoc auto-generated from the code (drf-spectacular)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## 🧱 Tech Stack

| Layer      | Technology                                                    |
|------------|--------------------------------------------------------------- |
| Frontend   | React 18, Next.js 14 (Pages Router), Tailwind CSS             |
| Backend    | Django 6.0, Django REST Framework                             |
| Auth       | djangorestframework-simplejwt, bcrypt                         |
| API docs   | drf-spectacular (Swagger UI + ReDoc)                          |
| Database   | PostgreSQL (Supabase free tier); SQLite fallback for local dev |
| AI         | Groq API (`llama-3.3-70b-versatile`)                          |

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- A [Groq API key](https://console.groq.com/keys) (free)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows  (source venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
```

Create `backend/.env`:
```env
SECRET_KEY=your-django-secret-key
DATABASE_URL=your-postgres-connection-string   # omit to use local sqlite
GROQ_API_KEY=your-groq-api-key
```

Run it:
```bash
python manage.py migrate
python manage.py seed_questions        # bundled ISTQB CTFL v4.0 question bank
python manage.py seed_study_content    # Study Mode topics + reading content
python manage.py runserver
```

> **`seed_questions`** loads `backend/questions/fixtures/seed_questions.json` (the full question bank, versioned in git) into whatever database `DATABASE_URL` points to. Run it once per fresh database so every clone/teammate ends up with the same questions instead of relying on a local `db.sqlite3` (gitignored, never shared). Pass `--force` to re-import on top of existing data.
>
> **`seed_study_content`** populates the `study` app's topics and reading material. Run it once per fresh database; Study Mode shows "no topics yet" until it does.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
```

App runs at `http://localhost:3000` · API at `http://127.0.0.1:8000/api/` · Django admin at `http://127.0.0.1:8000/admin/`

### Tests

```bash
cd backend
python manage.py test questions analytics study --noinput
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## 📖 API Documentation

Interactive OpenAPI docs are generated with [`drf-spectacular`](https://drf-spectacular.readthedocs.io/).
Start the backend (`python manage.py runserver`) and open:

| URL | What it is |
|-----|------------|
| `http://127.0.0.1:8000/api/docs/`   | **Swagger UI** — browse and try every endpoint |
| `http://127.0.0.1:8000/api/redoc/`  | **ReDoc** — reference-style rendering |
| `http://127.0.0.1:8000/api/schema/` | Raw OpenAPI 3 schema |

### Endpoint groups

| Prefix              | Purpose                                                        |
|---------------------|---------------------------------------------------------------- |
| `/api/auth/`        | Register, login, token refresh, current user                   |
| `/api/questions/`   | Session delivery, answer + confidence submission, finish/review, admin CRUD + import, RAG generation |
| `/api/explain/`     | On-demand AI explanation for a question                        |
| `/api/analytics/`   | Dashboard: accuracy, weakest domains, session history, confidence insights |
| `/api/study/`       | Study Mode: domains, topics, start topic, answer, complete     |

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## 📁 Project Structure

```
aistp-platform/
├── backend/
│   ├── aistp/           # settings, urls, wsgi/asgi
│   ├── accounts/        # user model, register/login, JWT
│   ├── questions/       # domains, topics, questions (5 types), attempts,
│   │                    #   practice sessions, confidence, admin CRUD, RAG jobs
│   ├── study/           # Study Mode: study sessions, progress, reading content
│   ├── explanations/    # Groq-powered structured AI explanations
│   ├── analytics/       # performance + confidence dashboard aggregates
│   └── services/        # scoring, answer_reveal, explanation, question_generation,
│                        #   analytics_service (accuracy + confidence diagnostics)
└── frontend/
    └── src/
        ├── components/  # QuestionCard, ConfidenceSelector, Sidebar, Study*, …
        │   └── ui/      # design-system primitives (Button, Card, Progress, …)
        ├── pages/       # index, login, register, dashboard, practice, study/*, admin
        ├── context/     # AuthContext, PracticeSessionContext
        ├── services/    # API client wrappers
        ├── lib/         # cn, fonts, confidence helpers
        └── styles/
```

## 🌿 Branching Strategy

| Branch       | Purpose                                       |
|--------------|--------------------------------------------- |
| `main`       | Production, protected, 2 approvals required   |
| `dev`        | Integration branch, 1 approval required       |
| `feature/*`  | Individual working branches                   |

## 🗺️ Roadmap

- [x] JWT authentication (role-gated)
- [x] Question delivery & rule-based scoring (5 question types)
- [x] Study Mode & Test Mode (isolated flows)
- [x] Structured AI explanations
- [x] RAG question generation from syllabus documents
- [x] Analytics dashboard (per-domain accuracy, streak, session history)
- [x] Test Mode confidence tracking & high-confidence-mistake diagnostics
- [x] Admin CRUD with paginated question list
- [x] Interactive API docs (Swagger / ReDoc via drf-spectacular)
- [ ] AI explanation caching
- [ ] Frontend test suite
- [ ] CI/CD deployment pipeline

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## 👥 Top Contributors

<a href="https://github.com/sawntosh/aistp-platform/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=sawntosh/aistp-platform" alt="contrib.rocks image" />
</a>

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.

## 📬 Contact
Project: [github.com/sawntosh/aistp-platform](https://github.com/sawntosh/aistp-platform)

<p align="right">(<a href="#readme-top">back to top</a>)</p>
