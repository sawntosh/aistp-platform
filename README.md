<div align="center">

# 🧠 AISTP Platform

**AI-Assisted Software Testing Practice Platform**

An ISTQB CTFL v4.0 exam-prep platform with Gemini-powered explanations and domain-level performance analytics.

[![Django](https://img.shields.io/badge/Django-6.0-092E20?style=for-the-badge&logo=django&logoColor=white)](https://www.djangoproject.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Gemini](https://img.shields.io/badge/Gemini_API-AI_Explanations-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white)](https://ai.google.dev/)

[Report Bug](https://github.com/sawntosh/aistp-platform/issues) · [Request Feature](https://github.com/sawntosh/aistp-platform/issues)

</div>

---

## ✨ Features

- 🔐 **Secure auth** — JWT-based login/registration with bcrypt password hashing
- 📚 **Domain-organized question bank** covering the ISTQB CTFL v4.0 syllabus
- ✅ **Instant scoring** on every practice attempt
- 🤖 **AI explanations** for wrong answers, generated on-demand via Gemini
- 📊 **Analytics dashboard** — accuracy broken down per syllabus domain
- 🛠️ **Admin CRUD** for managing questions and domains

## 🧱 Tech Stack

| Layer      | Technology                                              |
|------------|----------------------------------------------------------|
| Frontend   | React, Next.js, Tailwind CSS                             |
| Backend    | Django, Django REST Framework                             |
| Auth       | djangorestframework-simplejwt, bcrypt                      |
| Database   | PostgreSQL (Supabase free tier)                            |
| AI         | Google Gemini API (`gemini-1.5-flash`)                     |

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- A [Gemini API key](https://ai.google.dev/)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

Create `backend/.env`:
```env
SECRET_KEY=your-django-secret-key
DATABASE_URL=your-postgres-connection-string
GEMINI_API_KEY=your-gemini-api-key
```

Run it:
```bash
python manage.py migrate
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:3000` · API at `http://127.0.0.1:8000/api/` · Admin at `http://127.0.0.1:8000/admin/`

## 📁 Project Structure

```
aistp-platform/
├── backend/
│   ├── aistp/           # settings, urls, wsgi/asgi
│   ├── accounts/        # user model, register/login
│   ├── questions/       # domains, questions, attempts, sessions
│   ├── explanations/    # Gemini-powered AI explanations
│   ├── analytics/       # performance dashboard
│   └── services/        # gemini_service, scoring_service, analytics_service
└── frontend/
    └── src/
        ├── components/
        ├── pages/
        ├── hooks/
        ├── services/     # API client wrappers
        └── styles/
```

## 🌿 Branching Strategy

| Branch       | Purpose                                      |
|--------------|-----------------------------------------------|
| `main`       | Production, protected, 2 approvals required    |
| `dev`        | Integration branch, 1 approval required        |
| `feature/*`  | Individual working branches                     |

## 🗺️ Roadmap

- [x] JWT authentication
- [x] Question delivery & scoring
- [x] Admin CRUD
- [ ] AI explanation caching
- [ ] Analytics dashboard polish
- [ ] CI/CD deployment pipeline

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.

## 📬 Contact
Project: [github.com/sawntosh/aistp-platform](https://github.com/sawntosh/aistp-platform)
