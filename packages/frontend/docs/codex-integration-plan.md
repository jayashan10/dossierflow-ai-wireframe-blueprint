## Overview

This document captures the agreed approach for introducing Codex-driven authoring within DossierFlow by splitting the system into a React frontend and a dedicated backend service.

## Architecture Summary

- **Frontend**: Existing Vite React application under `/src` remains responsible for user interaction.
- **Backend**: New Node.js TypeScript service in `/server` exposes REST endpoints, mediates Codex SDK calls, and manages access to source files.
- **Communication**: The frontend calls `/api/generate` for content generation and `/api/sources` to discover available reference material.

## Backend Responsibilities

1. Load configuration from environment variables (e.g., `CODEX_API_KEY`, `SOURCE_ROOT`).
2. Expose routes:
   - `GET /api/sources` returns metadata about allowed source files.
   - `POST /api/generate` validates the request, reads source snippets, builds prompts, and calls the Codex SDK.
3. Wrap Codex SDK access in a service that handles retries, error normalization, and output formatting.
4. Enforce safety: restrict file reads to whitelisted directories, cap payload sizes, and sanitize inputs.

## Frontend Responsibilities

1. Replace the current mock generation handler with real requests to `/api/generate`.
2. Gather payload details from the UI (section, prompt, selected sources) and display backend responses.
3. Fetch source metadata from `/api/sources` and sync it with the existing selector UI.
4. Surface loading and error states with the existing `isGenerating` controls.

## Implementation Steps

1. Scaffold the backend service with Express or Fastify, TypeScript tooling, and nodemon-based development scripts.
2. Implement environment validation, routing, Codex service wrapper, and centralized error handling.
3. Update the frontend generate flow to call the backend endpoints and render generated content.
4. Wire a root-level dev script (e.g., using `concurrently`) to run frontend and backend together.
5. Add automated tests: backend unit tests mocking the Codex client and frontend integration/unit tests if feasible.

## Testing & Verification

- Backend: run unit tests, linting, and manual endpoint smoke tests.
- Frontend: ensure `npm run build` passes and manually validate the generate workflow.
- Confirm environment variables are documented here without committing secrets.
