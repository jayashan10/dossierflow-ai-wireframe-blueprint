# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DossierFlow is a monorepo for regulatory dossier authoring, using AI (Claude Agent SDK) to generate section content from templates and source documents. The system consists of a Vite + React frontend and an Express + TypeScript backend.

**Figma Reference**: https://www.figma.com/design/BdS1EgFl1drxiXCaqBFq7f/DossierFlow-AI-Wireframe-Blueprint

## Commands

### Development

```bash
# Run both frontend and backend concurrently (recommended)
npm run dev

# Run with custom port and Claude debug logging
PORT=4001 CLAUDE_DEBUG=1 VITE_API_PROXY_TARGET=http://localhost:4001 npm run dev

# Run individually
npm run dev --workspace frontend   # Vite dev server on :3000
npm run dev --workspace backend    # Express API on :4000
```

### Building

```bash
npm run build                      # Build both packages
npm run build --workspace frontend # Frontend only → packages/frontend/build/
npm run build --workspace backend  # Backend only → packages/backend/dist/
```

### Testing

```bash
npm run test                       # Run all backend tests (Vitest)
npm run test --workspace backend   # Explicit backend tests

# Test Claude refinement outside UI
cd packages/backend
npm run claude:refine -- "1. Introduction" "1.1 Synopsis" "2. Methods"
```

## Architecture

### Monorepo Structure

```
packages/
  frontend/       # Vite + React app
    src/
      components/ # UI components (Dashboard, AuthoringStudio, etc.)
      lib/        # API client (api.ts)
      data/       # Mock data
  backend/        # Express API
    src/
      routes/     # API endpoints (templates, sources, generate)
      services/   # Business logic layer
      scripts/    # CLI utilities
    tests/        # Vitest + Supertest integration tests
```

### Backend Architecture

**Entry Point**: [packages/backend/src/index.ts](packages/backend/src/index.ts)

**Route Structure**:
- `POST /api/templates/upload` - Upload PDF/DOCX templates, extract sections, optionally refine with Claude
- `GET /api/templates` - List templates
- `GET /api/templates/:id` - Get template details
- `POST /api/templates/:id/refine` - Manually trigger Claude refinement
- `GET /api/sources` - List sources (with optional search)
- `POST /api/sources/upload` - Upload source documents (batch, max 20 files)
- `POST /api/generate` - Generate content using Claude with source snippets

**Service Layer**:
- **claude-agent-service.ts** - Core AI integration using `@anthropic-ai/claude-agent-sdk`
  - `generateDraft()` - Generate section content with source context
  - `refineTemplateSections()` - Refine extracted template headings into structured sections
  - Supports multiple auth methods: API keys, auth tokens, AWS Bedrock, Google Vertex AI
  - Token usage tracking and debug logging
- **template-service.ts** - Template lifecycle (upload, storage, indexing, refinement)
- **source-service.ts** - Source document management (max 2000 tracked sources)
- **file-service.ts** - Secure file persistence with validation (10MB limit, PDF/DOCX only)
- **text-extraction.ts** - Extract text from PDF/DOCX
- **section-extractor.ts** - Regex-based heading detection

**Data Persistence**:
- File-based storage with JSON indices (`.templates.json`, `.sources.json`)
- Directory structure: `<ROOT>/<type>_<UUID>/<sanitized-filename>`
- Environment-configurable roots: `SOURCE_ROOT`, `TEMPLATE_ROOT`
- Auto-creates directories on startup

### Frontend Architecture

**Entry Point**: [packages/frontend/src/main.tsx](packages/frontend/src/main.tsx) → [packages/frontend/src/App.tsx](packages/frontend/src/App.tsx)

**State Management**:
- Central state container in `App.tsx` (no Redux/Zustand)
- Props drilling pattern with callback functions
- Session storage for custom programs persistence

**View System** (controlled by `currentView` state):
- `dashboard` - Program listing (ProgramCard grid)
- `setup` - Setup wizard
- `dossier` - Document structure tree navigation
- `authoring` - Rich editing environment with tabs (content, sources, comments, history)

**API Integration**: [packages/frontend/src/lib/api.ts](packages/frontend/src/lib/api.ts)
- REST client using fetch API
- Functions: `fetchSources()`, `generateContent()`, `uploadTemplate()`, `listTemplates()`, `refineTemplate()`
- Dev proxy: `localhost:3000` → `localhost:4000`

**UI Stack**:
- Radix UI (40+ headless components)
- Tailwind CSS (utility-first styling)
- Class Variance Authority (component variants)
- Lucide React (icons)
- React Hook Form (forms)
- Sonner (toasts)

## Environment Configuration

### Backend `.env` ([packages/backend/.env.example](packages/backend/.env.example))

```bash
PORT=4000                                    # API server port
SOURCE_ROOT=/absolute/path/to/data          # Optional, defaults to packages/backend/data
TEMPLATE_ROOT=/absolute/path/to/templates   # Optional, defaults to packages/backend/templates

# Claude Authentication (pick one method)
ANTHROPIC_API_KEY=sk-ant-...                # Direct API authentication
ANTHROPIC_AUTH_TOKEN=sk-proxy-...           # Proxy/custom endpoint auth
CLAUDE_CODE_USE_BEDROCK=0                   # AWS Bedrock (credentials via AWS config)
CLAUDE_CODE_USE_VERTEX=0                    # Google Vertex AI (credentials via GCP config)

# Optional Claude configuration
ANTHROPIC_BASE_URL=https://.../             # Custom endpoint (include trailing slash)
ANTHROPIC_CUSTOM_HEADERS=X-Header: value    # Additional headers for proxies

# Feature flags
ENABLE_CLAUDE_AGENT=true                    # Toggle AI features (default: true)
CLAUDE_DEBUG=1                              # Enable detailed API request/response logging
USE_SEMTOOLS=false                          # Future semantic parsing (not implemented)
```

### Frontend `.env`

```bash
VITE_API_BASE_URL=http://localhost:4000     # Backend API endpoint
```

## Key Implementation Details

### Claude Agent SDK Integration

The project uses the Claude Agent SDK to build autonomous agents capable of understanding codebases, reading files, and executing complex workflows.

**Phase 1 (Completed):**
Initial implementation used simple single-turn text generation with pre-extracted snippets. This has been replaced with the full agentic workflow described below.

**Current Implementation (Full Agentic Workflow):**
- **SDK**: `@anthropic-ai/claude-agent-sdk` v0.1.28+
- **Mode**: Autonomous multi-turn agent with file access and tool usage
- **Configuration**:
  - Uses `query()` function with streaming response handling
  - Multi-turn conversations (configurable via `AGENT_MAX_TURNS`, default: 5)
  - Tools enabled: `Read`, `Glob`, `Bash` for file operations and semtools
  - Model automatically selected by SDK (uses latest available)
  - Extracts token usage: input, cached input, output tokens
- **Graceful Fallback**: Returns diagnostic messages when Claude unavailable
- **Authentication Priority**: API key → auth token → cloud integrations → fallback

**Agentic Capabilities:**
- **Content Generation** (`generateDraft()`): Multi-turn drafting with source document access
- **Template Refinement** (`refineTemplateSections()`): Direct file parsing using semtools to extract and refine sections
- **Section Analysis** (`refineExtractedSections()`): Contextual summarization of already-extracted headings
- **File operations**: Reads source documents and templates directly via `Read` tool
- **Bash execution**: Runs semtools commands for PDF/DOCX parsing and semantic search
- **Permission management**: Safe file system access via `cwd` and `additionalDirectories`
- **Observability**: Tool usage tracking and turn completion monitoring

See [packages/backend/src/services/claude-agent-service.ts](packages/backend/src/services/claude-agent-service.ts) for current implementation.

#### Agent Skills Integration

DossierFlow uses the Claude Agent SDK Skills framework to provide domain-specific expertise for regulatory document processing. Skills are modular capabilities that encapsulate specialized knowledge and workflows.

**Available Skills:**

**regulatory-document-parser** ([.claude/skills/regulatory-document-parser/](.claude/skills/regulatory-document-parser/))
- Parses PDF/DOCX regulatory templates using semtools
- Extracts section hierarchies (ICH modules, numbered/lettered sections)
- Converts documents to structured markdown
- Provides comprehensive regulatory domain knowledge
- Auto-invoked when analyzing templates or extracting document structure

**How Skills Work:**

1. **Filesystem-based**: Skills are defined as `SKILL.md` files in `.claude/skills/`
2. **Progressive loading**:
   - Metadata (name, description) always loaded for skill discovery
   - Full instructions loaded only when relevant to the task
   - Minimizes token usage while providing deep expertise
3. **Auto-invoked**: Claude automatically uses Skills based on task descriptions matching the Skill's description
4. **Tool orchestration**: Skills contain detailed workflows for Read, Glob, Bash tool usage
5. **Domain expertise**: Skills encapsulate regulatory terminology, ICH patterns, error handling strategies

**Benefits Over Direct Prompting:**
- **Token efficiency**: ~40-60% reduction in prompt tokens (detailed instructions in Skill, not prompt)
- **Maintainability**: Centralized domain knowledge in `.claude/skills/`, not scattered in code
- **Reusability**: Same Skill used across template refinement, content generation, validation
- **Version control**: Skills are git-tracked, shareable across team
- **Progressive disclosure**: Full documentation available to agent without bloating every query

**Configuration:**
- Skills enabled when `AGENT_ENABLE_TOOLS=true` in `.env`
- `settingSources: ['project']` in agent options loads project Skills
- Tools (`Read`, `Glob`, `Bash`) remain in `allowedTools` for Skill execution

**Creating Custom Skills:**
See [Agent Skills documentation](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview) for:
- Skill authoring guidelines
- YAML frontmatter requirements (name, description)
- Best practices for progressive disclosure
- Bundling code and resources

### File Processing Pipeline

1. Upload via multer (10MB limit, PDF/DOCX only)
2. Text extraction using mammoth (DOCX) or pdf-parse (PDF)
3. Section extraction using regex patterns (1.1, A.B, single letters)
4. Optional Claude refinement to structure sections
5. Persistence to file storage with JSON index update
6. Metadata tracking (warnings, token usage, timestamps)

### Template Refinement Process

Templates can be refined in two ways:
1. **Automatic** - During upload via `refine=true` query parameter
2. **Manual** - Via `POST /api/templates/:id/refine` endpoint

Refinement uses Claude to transform raw extracted headings into structured sections with titles, descriptions, and placeholders. Results stored in `claudeMetadata` with token usage stats.

### Data Safety & Validation

- Path traversal prevention in file operations
- Filename sanitization (removes dangerous characters)
- Zod schema validation for API requests and environment config
- MIME type validation (application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document)
- Centralized error handling middleware

## Testing Patterns

- **Framework**: Vitest + Supertest for backend integration tests
- **Test Location**: [packages/backend/tests/](packages/backend/tests/)
- **Coverage**: Template upload, source upload, Claude generation flows
- **Mocking**: Mock implementations for file operations and Claude SDK

## Common Development Workflows

### Adding a New API Endpoint

1. Define route in [packages/backend/src/routes/](packages/backend/src/routes/)
2. Implement service logic in [packages/backend/src/services/](packages/backend/src/services/)
3. Add types/interfaces as needed
4. Update frontend API client in [packages/frontend/src/lib/api.ts](packages/frontend/src/lib/api.ts)
5. Add integration test in [packages/backend/tests/](packages/backend/tests/)

### Debugging Claude Integration

1. Set `CLAUDE_DEBUG=1` in backend `.env`
2. Use `npm run claude:refine` script to test refinement standalone
3. Check console for `[Claude Debug]` entries showing raw API responses
4. Review token usage in response metadata

### Working with Templates

- Templates are stored in `packages/backend/templates/` during development
- Each template has a UUID-prefixed directory: `template_<UUID>/`
- Metadata stored in `.templates.json` index file
- Both raw and refined sections are preserved
- Refinement can be re-run to update sections

### Frontend Component Development

- UI primitives in [packages/frontend/src/components/ui/](packages/frontend/src/components/ui/)
- Page components in [packages/frontend/src/components/](packages/frontend/src/components/)
- State mutations through callback props from `App.tsx`
- Use Tailwind utilities for styling, Radix UI for accessible primitives

## Product Context

### End-to-End Workflow

1. Create a program and choose a document type or upload a template
2. Upload the template so the system extracts suggested sections
3. Upload reference sources to the data vault for grounding
4. In Authoring Studio, select a section, adjust the prompt, and choose sources
5. Generate a draft with Claude, review the sourced content, and iterate as needed
6. Submit the draft for review; reviewers comment, approve, or request changes
7. Finalize approved sections and export dossier artifacts when complete

### Guardrails for Users

- Maintain traceability: drafts surface which sources were used
- Protect confidentiality: drafting stays within approved workspace sources
- Keep human oversight: authors and reviewers remain accountable for final text quality

## Semtools CLI for Document Processing

When working with regulatory templates and source documents, you have access to **semtools** - a semantic document parsing and search tool.

### Available Commands

**Parse Documents:**
```bash
parse <file.pdf>           # Parse PDF to markdown
parse <file.docx>          # Parse DOCX to markdown
parse *.pdf                # Parse multiple files

# Parsed output cached at ~/.parse/
# Returns filepath to parsed markdown
```

**Semantic Search:**
```bash
search "query" <files>     # Search for semantically similar content

# Options:
--n-lines N                # Context lines before/after match (default: 3, recommend: 10-20)
--top-k K                  # Number of results to return (default: 3)
--max-distance D           # Distance threshold (0.0 = perfect match)
--ignore-case              # Case-insensitive search
```

**Workspace Management:**
```bash
workspace use <name>       # Create/switch workspace (for repeated searches)
workspace status           # Show workspace stats
workspace prune            # Remove stale entries
```

### Common Patterns for Template Processing

**1. Parse Template Document:**
```bash
# Parse a regulatory template PDF
parse /path/to/template.pdf

# View the parsed markdown
cat ~/.parse/template.md

# This gives you clean, structured content for section extraction
```

**2. Extract Section Headings:**
```bash
# After parsing, search for section patterns
search "section headings" ~/.parse/template.md --n-lines 15

# Find numbered sections
search "1.1 1.2 2.1" ~/.parse/template.md --n-lines 10

# Look for specific regulatory sections
search "pharmacodynamics synopsis methods" ~/.parse/template.md --top-k 10
```

**3. Find Specific Content:**
```bash
# Search for regulatory terminology
search "clinical endpoints" ~/.parse/template.md --n-lines 20 --max-distance 0.3

# Find requirements or instructions
search "required information evidence" ~/.parse/template.md
```

### Best Practices for Agents

1. **Always parse first**: Use `parse` to convert PDFs to clean markdown before analysis
2. **Use adequate context**: Set `--n-lines 10-20` for regulatory documents (more context = better understanding)
3. **Leverage workspaces**: For repeated searches on same templates, use workspaces to cache embeddings
4. **Combine with grep**: Use pipelines like `search "query" | grep "pattern"` for filtering

### Example Agent Workflow

```bash
# 1. Parse the template
parse /absolute/path/to/template.pdf

# 2. Review structure
cat ~/.parse/template.md | head -100

# 3. Extract sections systematically
search "table of contents sections" ~/.parse/template.md --n-lines 20

# 4. Find specific requirements
search "required data points" ~/.parse/template.md --top-k 5
```

### Important Notes

- Semtools requires `LLAMA_CLOUD_API_KEY` environment variable for parsing
- Parsed files are cached at `~/.parse/` directory
- The search command uses semantic similarity (cosine distance)
- Lower distance scores = better matches (0.0 is perfect)

## Migration Notes

**v0.2.0** - The backend migrated from OpenAI Codex SDK to Anthropic Claude Agent SDK. Legacy "codex" references in metadata fields are maintained for backward compatibility.
