## DossierFlow Monorepo

This workspace contains the DossierFlow MVP frontend (Vite + React) and backend (Express + TypeScript).

The original wireframe reference lives at:
https://www.figma.com/design/BdS1EgFl1drxiXCaqBFq7f/DossierFlow-AI-Wireframe-Blueprint

---

## Repository Layout

```
packages/
  frontend/         # Vite application (src/, docs/, build/)
  backend/          # Express service (src/, tests/, templates/, data/)
.gitignore
package.json        # npm workspaces root
```

Shared data (e.g. uploaded sources/templates) is stored under `packages/backend/data` and `packages/backend/templates` during development.

---

## Prerequisites

- Node.js 20+
- npm 10+
- Optional: Codex CLI (`npm install -g @openai/codex-cli`) if you want to authenticate without a raw API key

---

## Installation

Install dependencies once from the repository root:

```bash
npm install
```

This pulls dependencies for both `packages/frontend` and `packages/backend` using npm workspaces.

---

## Environment Configuration

### Backend (`packages/backend/.env`)

```bash
PORT=4000
SOURCE_ROOT=/absolute/path/to/data       # optional; defaults to packages/backend/data
TEMPLATE_ROOT=/absolute/path/to/templates # optional; defaults to packages/backend/templates
CODEX_API_KEY=your_codex_key             # optional; prefer `codex login`
```

The backend creates the source/template directories automatically if they are missing.

### Frontend (`packages/frontend/.env`)

```bash
VITE_API_BASE_URL=http://localhost:4000
```

Point this at your running backend when the frontend and backend are not served from the same origin.

---

## Development Workflow

Run both servers together from the repository root:

```bash
npm run dev
```

This launches:
- Vite dev server (defaults to `http://localhost:3000`, auto-bumps if the port is taken)
- Express API on `http://localhost:4000`

You can also run them individually:

```bash
npm run dev --workspace frontend   # Vite only
npm run dev --workspace backend    # API only
```

---

## Building & Testing

```bash
npm run build        # builds frontend and backend
npm run test         # runs backend unit tests (Vitest)
```

Backend build output lives in `packages/backend/dist/`. Frontend production assets are emitted to `packages/frontend/build/`.

---

## Key Frontend Features

- **Setup Wizard**: Upload DOCX/PDF templates (`/api/templates/upload`) and review extracted sections + warnings inline.
- **Dashboard, Dossier View, Authoring Studio**: simulate document authoring and review flows using mock data in `packages/frontend/src/data/mockData.ts`.
- **React + Radix UI + Tailwind utilities** for layout and components.

### API client helpers

Located in `packages/frontend/src/lib/api.ts`:
- `uploadTemplate()` – multipart upload for templates
- `listTemplates()` – fetch stored templates
- `fetchSources()` / `generateContent()` – call backend source discovery and Codex generation endpoints

---

## Backend Highlights

- Express routes under `packages/backend/src/routes`:
  - `POST /api/templates/upload`
  - `GET /api/templates`
  - `POST /api/sources/upload`
  - `GET /api/sources`
  - `POST /api/generate`
- Services in `src/services` handle file storage, text extraction (`mammoth`, `pdf-parse`), section extraction, and Codex prompting.
- Tests in `packages/backend/tests` (Vitest + Supertest) cover upload flows and Codex fallbacks.

---

## Codex Integration Notes

- Preferred authentication is via `codex login`; the backend will use the Codex SDK if credentials are available and fall back to a helpful message otherwise.
- The API never logs prompt contents or secrets. Uploaded files stay inside the configured `SOURCE_ROOT`/`TEMPLATE_ROOT`.
- Requests are validated with `zod`, and file paths are sandboxed to prevent traversal.

---

## Useful Scripts

```bash
npm run build --workspace backend   # TypeScript → dist
npm run test  --workspace backend   # Backend tests
npm run build --workspace frontend  # Vite production build
```

---

## Questions?

Feel free to open an issue or reach out if you need help extending the frontend, adding new API endpoints, or tightening the integration with Codex.