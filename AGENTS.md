## Purpose

This file summarizes operating guidelines for agents collaborating on the DossierFlow Claude Agent integration project.

## Workflow Expectations

1. Start in spec mode when planning substantial features; share the spec and wait for approval before editing files.
2. Track work with the task list tool (`TodoWrite`) for any multi-step effort and keep statuses current.
3. Prefer the provided factory tools (`Read`, `LS`, `Grep`, `ApplyPatch`, etc.) over shell commands for exploration and editing.
4. Use the `tmp/` folder in the root directory for any summary or misc markdown docs for progress or summary.

## Coding Practices

- Match existing TypeScript/React conventions and keep comments minimal.
- Verify libraries are already present before introducing new dependencies.
- Store backend code in `/packages/backend` (Node.js + TypeScript) and frontend code under `/packages/frontend` (Vite React).

## Claude Agent SDK Integration Notes

- Backend endpoints:
  - `GET /api/sources` - List available source documents
  - `POST /api/generate` - Generate draft content with Claude
  - `POST /api/programs` - Create a new program
  - `GET /api/programs` - List all programs
  - `GET /api/programs/:programId` - Get program metadata
  - `DELETE /api/programs/:programId` - Delete a program
  - `GET /api/programs/:programId/files` - List program files (recursive tree)
  - `GET/PUT/POST/DELETE /api/programs/:programId/files/*` - File CRUD operations
  - `POST /api/programs/:programId/sources` - Upload source to program
  - `POST /api/programs/:programId/template` - Upload template to program
  - `POST /api/programs/:programId/structure` - Create folder structure using Claude Agent
- Gather context by reading allowed files on the backend; never request arbitrary paths from the client.
- The Claude Agent SDK uses its default authentication provider. Configure custom providers via environment variables:
  - `ANTHROPIC_API_KEY` for direct API access
  - `ANTHROPIC_AUTH_TOKEN` for proxy authentication
  - `CLAUDE_CODE_USE_BEDROCK` for AWS Bedrock
  - `CLAUDE_CODE_USE_VERTEX` for Google Vertex AI
- Keep `ANTHROPIC_API_KEY` support as a fallback only; avoid storing raw keys in repo files or logs.
- Manage sensitive configuration via environment variables (e.g., `ANTHROPIC_API_KEY`, `SOURCE_ROOT`).

## Testing Requirements

- Run backend unit tests and lint checks before completion.
- Ensure `npm run build` succeeds for the frontend and manually verify the generate flow when changes touch the UI.

## Security & Compliance

- Avoid logging secrets or returning sensitive data in responses.
- Sanitize user inputs, enforce file access restrictions, and cap payload sizes when invoking Claude Agent.

## Product Overview

- DossierFlow helps biotech teams draft, review, and finalize regulated dossier sections faster and with consistent quality.
- The platform combines user-curated reference sources with Claude-assisted drafting while keeping humans in the loop for compliance.

### Who Uses It

- Admin sets up programs and manages workspace access.
- Author drafts sections using templates and uploaded sources.
- Reviewer provides feedback, requests changes, and approves final drafts.

### Core Concepts

- Program: container for a product's regulatory dossiers, stored in `outputs/` folder with `program.json` metadata.
- Template: uploaded PDF/DOCX used to derive the document's sections.
- Section: individual authoring unit (e.g., "2.6.2.2 Primary Pharmacodynamics").
- Source: reference document (PDF/DOCX) providing grounded context for drafts.
- Draft: Claude-assisted section output that authors refine before submission.
- Review: structured feedback cycle with approvals or change requests.

### End-to-End Workflow

1. Create a program and choose a document type or upload a template.
2. Upload the template so the system extracts suggested sections.
3. Upload reference sources to the data vault for grounding.
4. In Authoring Studio, select a section, adjust the prompt, and choose sources.
5. Generate a draft with Claude, review the sourced content, and iterate as needed.
6. Use the Backend Pane to browse program files, edit markdown content, and create folder structures.
7. Submit the draft for review; reviewers comment, approve, or request changes.
8. Finalize approved sections and export dossier artifacts when complete.

### Guardrails for Users

- Maintain traceability: drafts surface which sources were used.
- Protect confidentiality: drafting stays within approved workspace sources.
- Keep human oversight: authors and reviewers remain accountable for final text quality.

### MVP Success Criteria

- Teams can upload templates, view extracted sections, upload sources, and generate grounded drafts.
- Reviewers can deliver feedback and authors can address it quickly.
- Finalized documents reflect accurate, traceable use of uploaded source materials.

## Cursor Cloud specific instructions

### Branch

Work on the `new-claude-system` branch. This is the active development branch.

### Prerequisites (already installed in snapshot)

| Dependency | Version | How to verify |
|---|---|---|
| Node.js | 22+ | `node --version` |
| npm | 10+ | `npm --version` |
| `@anthropic-ai/claude-agent-sdk` | 0.1.28 | `npm ls @anthropic-ai/claude-agent-sdk --workspace backend` |
| `@anthropic-ai/sdk` | 0.68.0 | `npm ls @anthropic-ai/sdk --workspace backend` |
| semtools (global) | 2.0.0 | `parse --version` |

If semtools is missing, reinstall with `npm install -g @llamaindex/semtools`.

### Required environment variables (injected as secrets)

| Variable | Purpose | Verify |
|---|---|---|
| `ANTHROPIC_AUTH_TOKEN` | Claude Agent SDK proxy auth | `echo ${ANTHROPIC_AUTH_TOKEN:+SET}` |
| `LLAMA_CLOUD_API_KEY` | Semtools PDF parsing (LlamaIndex Cloud) | `echo ${LLAMA_CLOUD_API_KEY:+SET}` |

These are inherited by the backend process from the shell environment. You do NOT need to put them in `packages/backend/.env` -- the Zod config in `packages/backend/src/config.ts` reads `process.env` which includes both `.env` values and shell env vars.

### Backend .env setup

```bash
cp packages/backend/.env.example packages/backend/.env
# Then set USE_SEMTOOLS=true in the .env if you want semtools-based parsing
```

Key `.env` flags:
- `ENABLE_CLAUDE_AGENT=true` -- enables all Claude Agent SDK features (default)
- `USE_SEMTOOLS=true` -- enables semtools `parse`/`search` commands in agent workflows
- `AGENT_MAX_TURNS=15` -- max conversation turns for agent (increase to 20-25 for large templates with 100+ sections)
- `AGENT_ENABLE_TOOLS=true` -- enables Read/Bash/Glob/Skill tools for the agent

### Services

| Service | Port | Start command |
|---|---|---|
| Frontend (Vite + React) | 3000 | `npm run dev --workspace frontend` |
| Backend (Express API) | 4000 | `npm run dev --workspace backend` |
| Both (recommended) | 3000 + 4000 | `npm run dev` |

The Vite dev server proxies `/api` requests to the backend (configured in `packages/frontend/vite.config.ts`).

### Quick reference

```bash
npm install                # install all deps (from repo root)
npm run dev                # start both frontend + backend
npm run test               # backend tests (Vitest + Supertest, 8 tests / 4 suites)
npm run build              # frontend Vite build + backend tsc
```

### Storage layout

- **Programs**: `outputs/<folder-name>/program.json` + nested section folders with `content.md`
- **Templates** (legacy): `packages/backend/templates/`
- **Sources** (legacy): `packages/backend/data/`
- All three directories are auto-created on backend startup via `config.ts`.
- The `outputs/example/` folder is a committed reference program with 141 sections from an ICH clinical protocol template. Its template PDF lives at `outputs/example/template/original.pdf` (gitignored binary, pulled from branch).

### Claude Agent SDK -- how it works

The SDK is used in `packages/backend/src/services/claude-agent-service.ts`. Key exports:

| Function | What it does | Tools used |
|---|---|---|
| `generateDraft()` | Generate section content from sources | Read, Bash, Skill |
| `generateDraftStream()` | Streaming version of above (SSE) | Read, Bash, Glob, Write, Skill |
| `refineExtractedSections()` | Refine raw headings into structured JSON | Skill |
| `refineTemplateSections()` | Parse PDF/DOCX directly to extract sections | Read, Bash, Glob, Skill |
| `createProgramStructure()` | Create nested folder hierarchy from sections | Bash |

All functions call `query()` from `@anthropic-ai/claude-agent-sdk` with `permissionMode: 'bypassPermissions'`.

Authentication priority: `ANTHROPIC_API_KEY` > `ANTHROPIC_AUTH_TOKEN` > cloud integrations > SDK default.

**Verified working** (2026-02-27): A test call to `query()` with `ANTHROPIC_AUTH_TOKEN` returned a valid response with token usage. The full pipeline (create program -> upload template -> Claude creates folder structure) works end-to-end.

### Program creation flow (end-to-end)

This is the core flow tested and confirmed working:

```bash
# 1. Create program
curl -X POST http://localhost:4000/api/programs \
  -H "Content-Type: application/json" \
  -d '{"name": "My Program"}'
# Returns: { program: { folderName: "my-program", ... } }

# 2. Upload template PDF to program
curl -X POST http://localhost:4000/api/programs/my-program/template \
  -F "file=@outputs/example/template/original.pdf"
# Returns: { success: true, path: "template/original.pdf" }

# 3. Extract sections from template (legacy endpoint, no Claude)
curl -X POST "http://localhost:4000/api/templates/upload?refine=false" \
  -F "file=@outputs/example/template/original.pdf"
# Returns: { template: { rawSections: [...], sectionCount: N } }
# NOTE: without refine=false this calls Claude and takes 30-60s

# 4. Create folder structure using Claude Agent
curl -X POST http://localhost:4000/api/programs/my-program/structure \
  -H "Content-Type: application/json" \
  -d '{"sections": [{"title": "1. Protocol Summary", "summary": "...", "originalHeading": "..."}]}'
# Claude uses Bash tool to mkdir -p + write content.md files
# Returns: { success: true, filesCreated: [...], usage: { totalTokens: N } }
```

The UI wizard (`CreateProgramWizard.tsx`) drives this same flow: Steps 1-5 = Details -> Doc Type -> Template Upload -> Team -> Review & Create.

### Frontend architecture

- State lives in `App.tsx` (no Redux/Zustand), passed via props
- Views: `dashboard` | `setup` | `dossier` | `authoring` (controlled by `currentView` state)
- API client: `packages/frontend/src/lib/api.ts` -- REST calls using fetch
- Section tree logic: `packages/frontend/src/lib/section-tree.ts`
- UI stack: Radix UI + Tailwind CSS v4 + TipTap editor + CodeMirror + Lucide icons

### Backend architecture

- Entry: `packages/backend/src/index.ts` -> `server.ts`
- Routes: `packages/backend/src/routes/{programs,templates,sources,generate}.ts`
- Services: `packages/backend/src/services/{claude-agent-service,program-service,template-service,source-service,file-service,text-extraction,section-extractor}.ts`
- Config: `packages/backend/src/config.ts` (Zod-validated env parsing)
- Tests: `packages/backend/tests/` (Vitest + Supertest)

### Non-obvious caveats

- There is no ESLint or Prettier configured in this repo.
- The backend uses file-based JSON storage (no database). Data dirs are auto-created on startup.
- The Vite CJS Node API deprecation warning during test runs is harmless -- ignore it.
- The frontend build emits a chunk-size warning for `index.js` (>500 kB) -- expected, non-blocking.
- `nodemon` watches `packages/backend/src/` and hot-reloads on changes; dependency changes (`npm install`) require restarting the backend process.
- Template upload without `?refine=false` triggers Claude refinement which takes 30-60s and requires a working `ANTHROPIC_AUTH_TOKEN`.
- The `outputs/example/` folder is the only committed program. All other programs created at runtime are gitignored under `outputs/`.
- `createProgramStructure` has `maxTurns: 6` (hardcoded), lower than the configurable `AGENT_MAX_TURNS`. This is intentional since structure creation is a simpler task.
