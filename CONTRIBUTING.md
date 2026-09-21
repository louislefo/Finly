# Contributing to Finly

Thank you for your interest in contributing to Finly. This guide outlines the development standards, code guidelines, and submission workflow to ensure an efficient and consistent development process.

---

## Table of Contents

- [Core Principles](#core-principles)
- [Development Environment Setup](#development-environment-setup)
  - [FastAPI Backend](#fastapi-backend)
  - [Next.js Frontend](#nextjs-frontend)
  - [Docker Environment](#docker-environment)
- [Git Workflow and Conventions](#git-workflow-and-conventions)
  - [Branch Management](#branch-management)
  - [Commit Conventions](#commit-conventions)
- [Coding Standards and Quality](#coding-standards-and-quality)
  - [Frontend (Next.js, TypeScript, Tailwind)](#frontend-nextjs-typescript-tailwind)
  - [UI/UX and Design Guidelines](#uiux-and-design-guidelines)
  - [Backend (FastAPI, Python, SQLAlchemy)](#backend-fastapi-python-sqlalchemy)
- [Testing and Validation](#testing-and-validation)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues and Vulnerabilities](#reporting-issues-and-vulnerabilities)

---

## Core Principles

1. **Privacy and Sovereignty:** Finly is 100% self-hosted. No telemetry, third-party trackers, or paid cloud aggregation services should ever be introduced.
2. **Data Security:** Banking credentials and sensitive access tokens must be encrypted using AES-256 (Fernet) before storage in the database.
3. **Restraint and Minimalism:** The user interface is clean, focused, and centered on key metrics. Avoid verbose explanatory text or visual clutter.
4. **Quality and Robustness:** All new contributions must include unit or integration tests and maintain strict typing.

---

## Development Environment Setup

### FastAPI Backend

1. **Prerequisites:** Python 3.11 or higher.
2. **Virtual environment setup:**
   ```bash
   cd backend
   python -m venv .venv

   # On Linux / macOS
   source .venv/bin/activate

   # On Windows (PowerShell)
   .\.venv\Scripts\Activate.ps1
   ```
3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
4. **Local configuration:**
   ```bash
   cp .env.example .env
   ```
5. **Start development server:**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   The REST API is available at `http://localhost:8000` with Swagger documentation at `http://localhost:8000/docs`.

---

### Next.js Frontend

1. **Prerequisites:** Node.js 20+ and npm.
2. **Install dependencies:**
   ```bash
   cd finly-app
   npm install
   ```
3. **Start Next.js development server:**
   ```bash
   npm run dev
   ```
   The application is accessible at `http://localhost:3000`.

---

### Docker Environment

To run the complete containerized stack locally:
```bash
docker compose up -d --build
```
To inspect container logs:
```bash
docker compose logs -f
```

---

## Git Workflow and Conventions

### Branch Management

- The main branch is `main`.
- Create a feature or fix branch from `main`:
  - `feature/feature-name`: New functionality.
  - `fix/bug-description`: Bug fixes.
  - `refactor/refactor-name`: Code refactoring without behavior change.
  - `docs/doc-topic`: Documentation updates.
  - `test/test-topic`: Test additions or enhancements.

Example:
```bash
git checkout -b feature/add-csv-export
```

### Commit Conventions

We adhere to the Conventional Commits specification:

```text
<type>(<optional scope>): <short imperative description>
```

Allowed types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style/formatting changes with no logic alteration
- `refactor`: Refactoring without bug fixes or feature additions
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks, build configuration, dependency updates

Examples:
- `feat(export): add dynamic PDF summary generator`
- `fix(sync): resolve token expiration handling in woob runner`
- `refactor(auth): simplify session token validation middleware`
- `docs(readme): update screenshots and visual guide`

---

## Coding Standards and Quality

### Frontend (Next.js, TypeScript, Tailwind)

- **Strict TypeScript:** Avoid unjustified `any` types. All API data models must have explicit types and interfaces located in `lib/` or `types/`.
- **Server and Client Components:** Only add `'use client'` to components that require React hooks (`useState`, `useEffect`) or DOM event handlers.
- **Component Organization:** Place shared UI components in `components/ui/` and business domain components in feature-specific subdirectories.
- **Shadcn UI:** Leverage standard Shadcn UI components (Button, Card, Dialog, Sheet, Tabs, Badge, Progress, Select, Table).

### UI/UX and Design Guidelines

- **Dark Mode Only:** Finly uses a strict dark theme. Build upon the dark Zinc palette:
  - Base background: `bg-zinc-950` (`#09090B`)
  - Cards and surfaces: `bg-zinc-900` (`#18181B`)
  - Subtle borders: `border-white/10` or `border-zinc-800`
  - Primary text: `text-zinc-100`, secondary text: `text-zinc-400`
- **Simplicity:** Remove verbose descriptions, helper subtitles, and redundant labels. Let charts and metrics convey information directly.
- **Mobile First:** Systematically verify narrow screen layouts (bottom bar navigation, sheet drawers for details).

### Backend (FastAPI, Python, SQLAlchemy)

- **PEP 8 and Type Hints:** Follow PEP 8 guidelines and use Pydantic v2 models for request/response schemas.
- **Layered Architecture:**
  - `app/api/endpoints/`: HTTP routes, input validation, and responses.
  - `app/services/`: Business logic, bank aggregation, export processing.
  - `app/models/`: SQLAlchemy ORM models.
  - `app/core/`: Application settings, security utilities, database setup.
- **Error Handling:** Return descriptive HTTP errors via `HTTPException(status_code=..., detail=...)`.
- **Security:** Never log or store raw banking credentials in plaintext.

---

## Testing and Validation

Ensure the full test suite passes prior to submitting any pull request.

### Backend Tests
```bash
cd backend
pytest -v
```

To run a specific test file:
```bash
pytest tests/test_transactions_and_accounts.py -v
```

### Frontend Tests and Lints
```bash
cd finly-app
npm test
npm run lint
npm run build
```

---

## Pull Request Process

1. **Rebase against main:**
   ```bash
   git fetch origin
   git rebase origin/main
   ```
2. **Execute all test suites** across both frontend and backend.
3. **Push the branch:**
   ```bash
   git push origin feature/your-branch
   ```
4. **Open a Pull Request:**
   - Use a clear title adhering to Conventional Commits.
   - Describe the changes, motivation, and test coverage in detail.
   - Include screenshots or recordings for any UI changes.
5. **Code Review:** Address feedback from maintainers and make necessary revisions.

---

## Reporting Issues and Vulnerabilities

- **Bug Reports and Feature Requests:** Open a GitHub Issue with reproduction steps, environment details (OS, browser, Finly version), and expected behavior.
- **Security Vulnerabilities:** Do not submit public issues for sensitive security flaws. Contact the maintainers directly for responsible disclosure.
