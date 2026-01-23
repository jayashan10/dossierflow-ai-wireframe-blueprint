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
outputs/            # Program data storage (created at runtime)
.gitignore
package.json        # npm workspaces root
```

Shared data (e.g. uploaded sources/templates) is stored under `packages/backend/data` and `packages/backend/templates` during development.

## Data Management

### Sample Data & Templates
The `packages/data/`, `packages/templates/`, and `packages/backend/data/` directories contain sample/test data and should **NOT** be committed to version control. These directories are excluded via `.gitignore`.

**For development/testing:**
1. Create sample PDF/DOCX files in these directories
2. Upload them through the UI to test template processing
3. These files are ignored by git and won't clutter version history

**For production deployment:**
- Configure separate storage paths via environment variables
- Use external storage services (S3, etc.) for uploaded files
- Implement proper file validation and size limits

### Program Data Storage

Programs are stored in the `outputs/` directory. Each program has its own folder with the following structure:

```
outputs/
  my-program/
    program.json          # Program metadata (id, name, sections, etc.)
    .claude/
      skills/             # Claude Agent skills for this program
      subagents/          # Subagent configurations
    sources/              # Uploaded source documents
    template/
      original.pdf        # Uploaded template file
    1-Introduction/       # Section folders (structure varies by template)
      content.md          # Section content file
      1.1-Synopsis/
        content.md
```

The `program.json` file contains:
- Program ID and name
- Section definitions with paths, status, and token usage
- Linked source documents
- Template file reference

---

## Prerequisites

- Node.js 20+
- npm 10+
- Anthropic API key (optional - SDK uses default provider if not configured)

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
ANTHROPIC_API_KEY=sk-ant-...             # optional; SDK uses default provider if not specified
ANTHROPIC_BASE_URL=https://.../          # optional; proxy / gateway endpoint (include trailing slash)
ANTHROPIC_AUTH_TOKEN=sk-proxy-...        # optional; bearer token used by a proxy service
ANTHROPIC_CUSTOM_HEADERS=X-Forwarded-For: 203.0.113.10  # optional; additional headers for compatible gateways
CLAUDE_CODE_USE_BEDROCK=0                # optional; toggle if using AWS Bedrock (credentials via AWS config)
CLAUDE_CODE_USE_VERTEX=0                 # optional; toggle if using Vertex AI (credentials via GCP config)
ENABLE_CLAUDE_AGENT=true                 # optional; defaults to true
USE_SEMTOOLS=false                       # optional; for future semantic parsing (not yet implemented)
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

To enable detailed Claude API request/response logging while avoiding port collisions, run the dev command with environment overrides:

```bash
PORT=4001 CLAUDE_DEBUG=1 VITE_API_PROXY_TARGET=http://localhost:4001 npm run dev
```

The backend moves to `http://localhost:4001`, emits `[Claude Debug]` entries for each refinement/generation call, and the Vite proxy forwards API traffic to the updated port automatically.

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

### Claude Refinement Debug Script

If you need to verify refinement output outside the UI, run the helper script from `packages/backend`:

```bash
npm run claude:refine -- "1. Introduction" "1.1 Synopsis" "2. Methods"
```

It prints the raw refinement result (including warnings) so you can confirm the Claude Agent SDK is reachable with your current environment variables. Enable `CLAUDE_DEBUG=1` to log the raw assistant output when parsing fails.

---

## Key Frontend Features

- **Setup Wizard**: Upload DOCX/PDF templates (`/api/templates/upload`) and review extracted sections + warnings inline.
- **Dashboard, Dossier View, Authoring Studio**: simulate document authoring and review flows using mock data in `packages/frontend/src/data/mockData.ts`.
- **Backend Pane**: A file explorer and editor component for working with program files.
  - Located in `packages/frontend/src/components/backend-pane/`
  - **FileTree**: Interactive file tree navigation with folder expand/collapse, file icons by type, and size display
  - **CodeMirrorEditor**: Markdown editor with syntax highlighting and save support (Cmd/Ctrl+S)
  - **BackendPane**: Main component combining file tree + editor with:
    - Breadcrumb navigation
    - Unsaved changes indicator
    - Create Structure button to generate folder hierarchy from template sections
    - Read-only mode for JSON files
- **React + Radix UI + Tailwind utilities** for layout and components.

### API client helpers

Located in `packages/frontend/src/lib/api.ts`:
- `uploadTemplate()` - multipart upload for templates
- `listTemplates()` - fetch stored templates
- `fetchSources()` / `generateContent()` - call backend source discovery and Claude generation endpoints
- `listPrograms()` - fetch all programs
- `createProgram(name)` - create a new program
- `getProgram(programId)` - get program metadata
- `deleteProgram(programId)` - delete a program
- `fetchProgramFiles(programId)` - list program files as recursive tree
- `fetchFileContent(programId, path)` - read file content
- `saveFileContent(programId, path, content)` - save file content
- `uploadProgramTemplate(programId, file)` - upload template to program
- `uploadProgramSource(programId, file)` - upload source to program
- `createProgramStructure(programId, sections)` - create folder structure using Claude Agent

---

## Backend Highlights

- Express routes under `packages/backend/src/routes`:
  - `POST /api/templates/upload`
  - `GET /api/templates`
  - `POST /api/sources/upload`
  - `GET /api/sources`
  - `POST /api/generate`
  - Programs API (see below)
- Services in `src/services` handle file storage, text extraction (`mammoth`, `pdf-parse`), section extraction, and Claude AI prompting.
- Tests in `packages/backend/tests` (Vitest + Supertest) cover upload flows and Claude integration.

---

## Programs API

The Programs API provides CRUD operations for managing regulatory dossier programs and their files.

### Program Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/programs` | Create a new program |
| `GET` | `/api/programs` | List all programs |
| `GET` | `/api/programs/:programId` | Get program metadata |
| `DELETE` | `/api/programs/:programId` | Delete a program and all its files |

### File Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/programs/:programId/files` | List all files (recursive tree) |
| `GET` | `/api/programs/:programId/files/*` | Read file content |
| `PUT` | `/api/programs/:programId/files/*` | Update file content (creates if missing) |
| `POST` | `/api/programs/:programId/files/*` | Create new file (fails if exists) |
| `DELETE` | `/api/programs/:programId/files/*` | Delete file or folder |

### Template and Source Upload

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/programs/:programId/template` | Upload template to program |
| `POST` | `/api/programs/:programId/sources` | Upload source document to program |

### Structure Creation

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/programs/:programId/structure` | Create folder structure from sections using Claude Agent |

**Request body:**
```json
{
  "sections": [
    { "title": "1.1 Synopsis", "summary": "...", "originalHeading": "1.1 Synopsis" }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "filesCreated": [
    { "path": "1-Introduction/1.1-Synopsis/content.md", "section": "1.1 Synopsis" }
  ],
  "sectionRoot": "1-Introduction",
  "usage": { "promptTokens": 1234, "completionTokens": 567, "totalTokens": 1801 }
}
```

---

## Claude Agent SDK Integration

- **Model**: Automatically selected by SDK (uses latest available Claude model)
- **Authentication**: Uses default SDK provider (optionally configure `ANTHROPIC_API_KEY` for direct API access, or proxy/cloud integrations)
- **Features**:
  - Agentic draft generation with multi-turn conversations and source document access
  - Template section refinement with file parsing and structured JSON output
  - Program structure creation with automatic folder hierarchy
  - Multi-turn workflows (configurable via `AGENT_MAX_TURNS`, default: 15)
  - File operations (`Read`, `Write`, `Bash`, `Glob`) for accessing templates, sources, and writing program files
  - Token usage tracking (input/cached/output tokens)
  - Graceful error handling when SDK encounters issues
  - Note: Large templates with 100+ sections may require increasing `AGENT_MAX_TURNS` to 20-25
- **API Documentation**: https://docs.anthropic.com/claude/reference/
- **Security**: API key loaded from environment only; no secrets in logs or code

---

## Useful Scripts

```bash
npm run build --workspace backend   # TypeScript -> dist
npm run test  --workspace backend   # Backend tests
npm run build --workspace frontend  # Vite production build
```

---

## Questions?

Feel free to open an issue or reach out if you need help extending the frontend, adding new API endpoints, or enhancing the Claude Agent SDK integration.

---

## Migration Notes

**v0.2.0 - Claude Agent SDK Migration**: The backend has been migrated from OpenAI Codex SDK to Anthropic Claude Agent SDK. See `tmp/claude-migration-summary.md` for full migration details and `tmp/claude-agent-integration-plan.md` for the integration roadmap.
