# Semtools Real-World Examples

This file contains actual usage patterns from the semtools repository examples directory.
These demonstrate proven workflows for bulk document processing and iterative search.

## Source

These examples are adapted from:
- https://github.com/run-llama/semtools/tree/main/examples
- Specifically: `use_with_mcp.md` - processing 900+ PDF conference papers

## Example 1: Conference Paper Analysis (ACL 2023)

### Context
- 900+ PDF files from ACL 2023 conference
- Goal: Summarize findings about LLMs and evaluations
- Approach: Parse all PDFs, then iteratively search with refined queries

### Step 1: Bulk Parsing
```bash
# Parse all PDF files in the papers directory
parse ./papers

# Or with find for explicit paths
find ./papers -name "*.pdf" | xargs parse

# Result: All PDFs cached at ~/.parse/<filename>.md
```

### Step 2: Initial Broad Search
```bash
find ~/.parse -name "*.md" | xargs search \
  "large language model, LLM, evaluation, benchmark" \
  --top-k 10 --n-lines 5
```

**What this does:**
- Searches across ALL parsed markdown files
- Uses semantic similarity to find relevant passages
- Returns top 10 matches with 5 lines of context
- Broad query terms cast a wide net

### Step 3: Refine Search - Instruction Tuning Focus
```bash
find ~/.parse -name "*.md" | xargs search \
  "GPT, ChatGPT, instruction tuning, evaluation benchmark, model evaluation" \
  --top-k 15 --n-lines 4
```

**Why this works:**
- More specific terms narrow results
- Increased top-k (15) captures more papers
- Reduced context (4 lines) for efficiency
- Targets specific research areas

### Step 4: Evaluation Methodology Search
```bash
find ~/.parse -name "*.md" | xargs search \
  "human evaluation, automatic evaluation, BLEU, ROUGE, BERTScore, evaluation metric" \
  --top-k 10 --n-lines 4
```

**Pattern:**
- Focuses on evaluation methods and metrics
- Combines human and automatic approaches
- Lists specific metric names for precision

### Step 5: Capabilities and Phenomena
```bash
find ~/.parse -name "*.md" | xargs search \
  "scaling laws, emergent abilities, few-shot learning, in-context learning, prompt engineering" \
  --top-k 10 --n-lines 4
```

**Observations:**
- Targets specific LLM phenomena
- Groups related concepts together
- Discovers trends across papers

### Step 6: Extract Key Sections
```bash
find ~/.parse -name "*.md" | xargs search \
  "title, abstract" \
  --top-k 5 --n-lines 10 | head -50
```

**Final step:**
- Extracts structured sections (title, abstract)
- Higher context (10 lines) captures complete abstracts
- Pipes to `head -50` to limit output
- Provides overview of most relevant papers

## Key Patterns from This Example

### Pattern 1: Broad → Narrow Search Funnel
```
1. Parse all documents once
2. Start with broad semantic search
3. Iteratively refine with specific terms
4. Extract structured sections last
```

### Pattern 2: Parameter Tuning
```
- Initial search: --top-k 10, --n-lines 5
- Refined search: --top-k 15, --n-lines 4
- Final extraction: --top-k 5, --n-lines 10
```

### Pattern 3: Query Composition
```
- Group related terms: "LLM, large language model, evaluation"
- Mix broad and specific: "evaluation" + "BLEU, ROUGE"
- Use domain terminology: "instruction tuning", "emergent abilities"
```

## Example 2: Regulatory Template Processing (Adapted)

### Context
- Single ICH regulatory template PDF
- Goal: Extract all section headings and hierarchies
- Approach: Parse, search semantically, extract with grep

### Step 1: Parse Template
```bash
parse "./templates/template_abc123/ICH-Module-2.5.pdf"
# Output: ~/.parse/ICH-Module-2.5.md
```

### Step 2: Discover Structure
```bash
# Semantic search for table of contents
search "table of contents sections modules" \
  ~/.parse/ICH-Module-2.5.md \
  --n-lines 20 --top-k 10

# Search for major modules
search "module 2 quality nonclinical clinical overview" \
  ~/.parse/ICH-Module-2.5.md \
  --n-lines 15 --top-k 8
```

### Step 3: Target Specific Sections
```bash
# Pharmacology sections
search "pharmacology pharmacodynamics pharmacokinetics" \
  ~/.parse/ICH-Module-2.5.md \
  --n-lines 12 --top-k 10

# Safety sections
search "toxicology safety adverse events" \
  ~/.parse/ICH-Module-2.5.md \
  --n-lines 12 --top-k 8
```

### Step 4: Extract Exact Headings
```bash
# Use grep for precise numbered sections
grep -E '^\s*[0-9]+\.[0-9]+\s+' ~/.parse/ICH-Module-2.5.md

# Deep hierarchy extraction
grep -E '^\s*[0-9]+\.[0-9]+\.[0-9]+\s+' ~/.parse/ICH-Module-2.5.md

# ICH-specific patterns
grep -E '^Module\s+[0-9]' ~/.parse/ICH-Module-2.5.md
```

### Step 5: Combine Search + Grep
```bash
# Find sections semantically, then extract exact text
search "synopsis study design" ~/.parse/ICH-Module-2.5.md \
  --n-lines 15 --top-k 5 | \
  grep -E '^\s*[0-9]+\.[0-9]+\s+'
```

## Example 3: Multi-Template Comparison

### Context
- Compare section structures across multiple templates
- Find common patterns and variations

### Bulk Parse and Compare
```bash
# Parse all templates
find ./templates -name "*.pdf" | xargs parse

# Search for specific sections across all templates
find ~/.parse -name "ICH*.md" | xargs search \
  "clinical study reports efficacy endpoints" \
  --top-k 20 --n-lines 10

# Extract hierarchies from all templates
for template in ~/.parse/ICH*.md; do
  echo "=== $(basename $template .md) ==="
  grep -E '^\s*[0-9]+\.[0-9]+\s+' "$template" | head -30
  echo ""
done
```

## Example 4: Workspace for Repeated Searches

### When to Use Workspaces
- Processing same templates multiple times
- Iterative development/testing
- Batch analysis operations

### Workspace Workflow
```bash
# Create workspace
export SEMTOOLS_WORKSPACE=dossierflow-templates
workspace use dossierflow-templates

# Initial search (generates embeddings)
search "clinical pharmacology" ./templates/*.pdf \
  --n-lines 10 --top-k 10

# Subsequent searches use cached embeddings (10x faster)
search "safety toxicology" ./templates/*.pdf \
  --n-lines 10 --top-k 10

search "efficacy endpoints" ./templates/*.pdf \
  --n-lines 10 --top-k 10

# Check workspace stats
workspace status
# Output:
# Active workspace: dossierflow-templates
# Root: ~/.semtools/workspaces/dossierflow-templates
# Documents: 45
# Index: Yes (IVF_PQ)

# Clean stale files
workspace prune
```

## Command Cheat Sheet (From Examples)

### Parsing
```bash
# Single file
parse "file.pdf"

# Multiple files
parse *.pdf

# With find
find . -name "*.pdf" | xargs parse

# Specific directory
parse ./templates/*.pdf
```

### Searching
```bash
# Basic semantic search
search "query terms" file.md

# With parameters
search "query" file.md --n-lines 10 --top-k 5 --max-distance 0.3

# Across multiple files
find ~/.parse -name "*.md" | xargs search "query" --top-k 10

# Piped to other tools
search "query" file.md | grep "pattern"
search "query" file.md | head -50
```

### Combining Tools
```bash
# Parse then search
parse file.pdf && search "query" ~/.parse/file.md

# Find, parse, search pipeline
find . -name "*.pdf" | xargs parse
find ~/.parse -name "*.md" | xargs search "query" --top-k 10

# Search with grep filtering
find ~/.parse -name "*.md" | \
  xargs search "broad query" | \
  grep "specific pattern"

# Multiple searches in sequence
search "query1" file.md --top-k 10
search "query2" file.md --top-k 10
search "query3" file.md --top-k 10
```

## Lessons from Real-World Usage

### 1. Parsing is Cheap, Cache is Free
- Parse all documents upfront
- Parsed markdown cached permanently at `~/.parse/`
- No need to re-parse unless file changes

### 2. Iterative Search is Powerful
- Start with broad, high-level queries
- Progressively refine with domain-specific terms
- Each iteration builds on previous insights

### 3. Combine Semantic + Exact
- Use search for discovery (semantic similarity)
- Use grep for precision (exact patterns)
- Best of both worlds

### 4. Parameter Tuning Matters
- More context lines (`--n-lines`) = better understanding
- More results (`--top-k`) = broader coverage
- Lower distance (`--max-distance`) = higher precision

### 5. Workspaces for Production
- Use workspaces for repeated operations
- Dramatically speeds up subsequent searches
- Essential for batch processing workflows

## Integration with DossierFlow

### Recommended Usage Pattern
```bash
# Template upload → parse immediately
parse "templates/template_xyz/document.pdf"

# Iterative section discovery
search "table of contents" ~/.parse/document.md --n-lines 20 --top-k 10
search "module sections" ~/.parse/document.md --n-lines 15 --top-k 15

# Exact extraction
grep -E '^\s*[0-9]+\.[0-9]+\s+' ~/.parse/document.md

# Format as JSON for storage
# (validated structure with title, summary, originalHeading)
```

### Multi-Turn Agent Pattern
```
Turn 1: parse template.pdf
Turn 2: search "sections" ~/.parse/template.md --top-k 10
Turn 3: grep -E '^\s*[0-9]+\.[0-9]+' ~/.parse/template.md
Turn 4: Format as JSON
Turn 5: Validate and return
```

---

**Source:** Adapted from semtools repository examples
**Reference:** https://github.com/run-llama/semtools/tree/main/examples
**Use Case:** Bulk document processing, iterative semantic search, section extraction
