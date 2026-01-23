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
