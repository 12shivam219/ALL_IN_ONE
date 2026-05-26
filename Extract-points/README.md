# Point Reorg - Decoupled React & FastAPI SaaS Application

This is the production-ready migration of the Structured Text & Resume Automation application, split into a React (Vite + TypeScript + Tailwind) frontend client and a FastAPI Python backend server.

---

## Project Structure

```
Extract-points/
├── backend/               # Python FastAPI backend server
│   ├── app/
│   │   ├── core/          # App security, config, and settings
│   │   ├── database/      # SQLAlchemy connections
│   │   ├── models/        # Database models (users, applications, profiles)
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── routers/       # REST APIRouters (auth, generator, processor, email, storage, automation)
│   │   ├── services/      # Core logic engines (cycle parsers, injectors, email sender, Groq wrappers)
│   │   └── utils/         # Security helpers
│   ├── main.py            # Backend entry point
│   ├── requirements.txt   # Python dependency list
│   └── .env.example       # Backend environmental configuration template
│
├── frontend/              # React TS client application
│   ├── src/
│   │   ├── api/           # Axios HTTP client connection layer
│   │   ├── assets/        # Visual design assets
│   │   ├── components/    # Reusable UI elements (custom toasts, skeletal loaders)
│   │   ├── layouts/       # Collapsible side nav layout
│   │   ├── store/         # Zustand state stores (auth, settings, processor, toasts)
│   │   ├── pages/         # Page components (dashboard, single/batch injectors, generator, campaign, login)
│   │   ├── App.tsx        # React routes mapping
│   │   ├── main.tsx       # Scaffolding root
│   │   └── index.css      # Core Tailwind CSS directives
│   ├── package.json       # Node package manager configuration
│   ├── tailwind.config.js # Tailwind CSS theme variables
│   └── index.html         # Scaffolding HTML page
```

---

## 1. Backend Setup (FastAPI)

### Requirements
- Python 3.11+
- Virtual environment (recommended)

### Installation
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On MacOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file from the template and fill in your keys (e.g. `GROQ_API_KEY`, email SMTP credentials, JWT keys):
   ```bash
   cp .env.example .env
   ```

### Running Backend
Start the backend server on port `8000` via Uvicorn:
```bash
python main.py
```
API Documentation will be available locally at `http://127.0.0.1:8000/docs`.

---

## 2. Frontend Setup (React)

### Requirements
- Node.js v18+
- npm v9+

### Installation
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```

### Running Frontend
Launch the local Vite development server:
```bash
npm run dev
```
Open your browser to `http://localhost:5173`.

---

## Features

- **Dashboard**: Track resume catalogs, technologies, and email campaign logs.
- **Single & Batch Processor**: Reorganize texts by cycle points and export to DOCX, PDF, or ZIP bundles.
- **Resume Bookmark Injector**: Map cycle paragraphs directly to Microsoft Word bookmarks.
- **AI Points Generator**: Parse job details and generate customized experiences.
- **Email Campaigns**: Draft emails and broadcast attachments via SMTP or SendGrid API.
- **Complete Automation**: Trigger match-generate-inject-dispatch pipelines in a single step.
