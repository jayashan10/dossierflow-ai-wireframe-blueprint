---
name: regulatory-document-parser
description: |
  Parse regulatory document templates (PDF/DOCX) into structured markdown and extract section hierarchies
  using semtools. Use when analyzing regulatory templates, extracting document structure, parsing ICH/eCTD
  documents, identifying section hierarchies, preparing templates for content generation, or working with
  pharmaceutical/biotech dossier templates.
---

# Regulatory Document Parser Skill

You have specialized capability to parse regulatory documents (PDF, DOCX) using semtools and extract structured section hierarchies commonly found in pharmaceutical/biotech regulatory dossiers.

## When to Use This Skill

Invoke this skill when:
- Analyzing regulatory document templates (ICH modules, eCTD sections, FDA submissions)
- Extracting table of contents or section hierarchies
- Parsing PDF/DOCX files to structured markdown
- Identifying numbered sections (1.1, 2.6.2, A.3.1, 3.2.S.1)
- Preparing templates for content generation workflows
- Understanding document structure and organization

## Available Tools

When using this skill, you have access to:
- **Bash**: Execute semtools commands and shell operations
- **Read**: Read file contents from the filesystem
- **Glob**: Find files matching patterns

## Semtools Command Reference

### Primary Command: `parse`

**Syntax:**
```bash
parse "<file-path>"
```

**Behavior:**
- Converts PDF or DOCX to clean, structured markdown
- Output cached at `~/.parse/<filename>.md`
- Returns the path to the parsed markdown file
- Handles regulatory document formatting (tables, hierarchies, page breaks)
- Preserves section numbering and heading structure

**Example:**
```bash
# Parse a regulatory template
parse "/path/to/ICH-M4-template.pdf"

# Output example:
# Parsing: /path/to/ICH-M4-template.pdf
# Output: /Users/username/.parse/ICH-M4-template.md
```

**Error Handling:**
- If parse times out or fails, check if file exists with `ls -la "<path>"`
- Verify file format is PDF or DOCX
- For large files (>50MB), semtools may take 5-15 seconds
- If parse fails, fall back to direct file reading with Read tool

### Alternative: `search` (Semantic Search)

**Syntax:**
```bash
search "query terms" <file-or-pattern> --n-lines N --top-k K
```

**Use cases:**
- Find specific sections semantically
- Locate regulatory terminology
- Extract requirements from parsed content

**Recommended Options:**
- `--n-lines 10-20`: Context lines for regulatory docs
- `--top-k 5-10`: Number of results
- `--max-distance 0.3`: Similarity threshold (lower = stricter)

## Multi-Turn Workflow for Template Parsing

Use this systematic 4-5 turn pattern:

### Turn 1: Parse the Template

```bash
# Execute semtools parse command
parse "<template-path>"
```

**Expected output:** Path to parsed markdown (e.g., `~/.parse/template.md`)

**If parse fails:**
```bash
# Check file exists
ls -la "<template-path>"

# Try reading directly if it's a text-based format
read_file "<template-path>"
```

### Turn 2: Read Parsed Content

```bash
# Read the parsed markdown to examine structure
read_file ~/.parse/template.md
```

**What to look for:**
- Section numbering patterns (numbered, lettered, nested)
- Hierarchy depth (how many levels: 1.1.1.1 vs just 1.1)
- Table of contents structure
- Heading formatting and consistency
- Special regulatory section patterns (Module 2.5.x, 3.2.S.x, etc.)

### Turn 3: Extract Section Headings

**Common Regulatory Section Patterns:**

**Numbered Sections (Most Common):**
- Level 1: `1.` `2.` `3.` (Major modules)
- Level 2: `1.1` `2.5` `3.2` (Sub-modules)
- Level 3: `1.1.1` `2.5.3` `3.2.1` (Sections)
- Level 4: `1.1.1.1` `2.5.3.2` `3.2.S.1.1` (Subsections)

**Lettered Sections:**
- `A.` `B.` `C.` (Appendix style)
- `A.1` `B.2.3` (Numbered sub-sections within letters)

**ICH-Specific Patterns:**
- `Module 1.x` `Module 2.5.x` (Module references)
- `3.2.S.1` `3.2.P.4` (CMC drug substance/product sections)

**Extraction Strategy:**

**Option 1: Use grep for pattern matching**
```bash
# Find all numbered sections (Level 2+)
grep -E '^\s*[0-9]+\.[0-9]+' ~/.parse/template.md

# Find all top-level sections
grep -E '^\s*[0-9]+\.\s+[A-Z]' ~/.parse/template.md

# Find lettered sections
grep -E '^\s*[A-Z]\.[0-9]+' ~/.parse/template.md
```

**Option 2: Use semantic search for specific content**
```bash
# Find table of contents
search "table of contents sections" ~/.parse/template.md --n-lines 15 --top-k 10

# Find specific regulatory sections
search "clinical overview nonclinical summary quality" ~/.parse/template.md --n-lines 10
```

**Extraction Requirements:**
- Preserve exact numbering (don't renumber or skip)
- Capture full heading text after the number
- Maintain hierarchy relationships
- Include ALL sections, even brief ones

### Turn 4: Format Output as JSON

For each extracted section, create structured metadata:

```json
{
  "sections": [
    {
      "title": "1.1 Synopsis",
      "summary": "Provides a high-level overview of the study including objectives, design, patient population, primary endpoints, and key statistical methods. Serves as a concise summary for regulatory reviewers to quickly understand the trial's purpose and design.",
      "originalHeading": "1.1 Synopsis"
    },
    {
      "title": "2.6.2 Pharmacodynamics",
      "summary": "Describes the pharmacodynamic properties of the investigational product including mechanism of action, dose-response relationships, therapeutic effects in target populations, and relevant biomarkers. Demonstrates the drug's biological activity and supports the proposed dosing regimen.",
      "originalHeading": "2.6.2 Pharmacodynamics"
    },
    {
      "title": "3.2.S.1 General Information",
      "summary": "Provides general information about the drug substance including nomenclature, structure, physicochemical properties, and basic characterization. Establishes the identity and fundamental properties of the active pharmaceutical ingredient.",
      "originalHeading": "3.2.S.1 General Information"
    }
  ]
}
```

**Summary Writing Guidelines:**
- **Length**: 2-3 sentences per section
- **Content**: Describe expected section content, required evidence, and regulatory purpose
- **Terminology**: Use domain-appropriate language:
  - Clinical: endpoints, patient population, efficacy, safety, statistical methods
  - Nonclinical: pharmacology, toxicology, ADME, pharmacokinetics
  - Quality/CMC: manufacturing, specifications, stability, process controls
- **Regulatory Context**: Reference ICH/FDA/EMA guidance concepts when relevant
- **Clarity**: Be specific about what evidence or data should be included

**Common Section Types and Their Summaries:**

**Clinical Sections:**
- Synopsis: Overview of study objectives, design, endpoints, results
- Study Design: Detailed methodology, randomization, blinding, controls
- Patient Demographics: Population characteristics, eligibility criteria
- Efficacy Results: Primary/secondary endpoint analyses, statistical significance
- Safety Results: Adverse events, serious adverse events, deaths, discontinuations

**Nonclinical Sections:**
- Pharmacology: Mechanism of action, primary/secondary pharmacodynamics
- Pharmacokinetics: ADME studies, drug interactions, metabolite profiling
- Toxicology: Repeat-dose, genotoxicity, carcinogenicity, reproductive studies

**Quality/CMC Sections:**
- Drug Substance: Manufacture, characterization, specifications
- Drug Product: Formulation, manufacturing process, container closure
- Stability: Storage conditions, degradation studies, shelf life

### Turn 5: Validate and Return

**Pre-flight Validation Checklist:**
- [ ] All sections have non-empty `title`, `summary`, `originalHeading`
- [ ] JSON is syntactically valid (no trailing commas, proper escaping)
- [ ] Section hierarchy preserved from template (numbering matches original)
- [ ] Summaries are 2-3 sentences each
- [ ] No markdown code fences in output (```json should NOT be included)
- [ ] No explanatory text before or after the JSON
- [ ] All regulatory terminology is spelled correctly

**Final Output Format:**
```json
{
  "sections": [
    /* array of section objects */
  ]
}
```

**CRITICAL RULES:**
1. Return ONLY the JSON - no markdown fences, no preamble, no commentary
2. Do not wrap in ```json ``` code blocks
3. Do not add text like "Here is the output:" or "The sections are:"
4. If unable to extract any sections, return: `{"sections": []}`

## Error Recovery Strategies

### Parse Command Failed

```bash
# Strategy 1: Verify file exists and check permissions
ls -la "<template-path>"

# Strategy 2: Check if already parsed (cached)
ls -la ~/.parse/*.md

# Strategy 3: Try reading raw file with Read tool
read_file "<template-path>"

# Strategy 4: Use glob to find similar files
glob "*.pdf"
glob "template_*/*.pdf"
```

### No Sections Found in Parsed Output

```bash
# Strategy 1: Re-read with focus on structure
head -n 100 ~/.parse/template.md

# Strategy 2: Try different regex patterns
grep -E '^\s*\d+\s+[A-Z]' ~/.parse/template.md  # Loose pattern
grep -E '(Module|Section|Part)\s+\d+' ~/.parse/template.md  # Alternative patterns

# Strategy 3: Use semantic search
search "numbered sections headings" ~/.parse/template.md --n-lines 20 --top-k 15

# Strategy 4: Return empty sections array
# {"sections": []}
```

### JSON Validation Failed

Common JSON errors and fixes:

**Trailing commas:**
```json
// Wrong
{"sections": [{"title": "1.1"},]}

// Correct
{"sections": [{"title": "1.1"}]}
```

**Smart quotes:**
```json
// Wrong (curly quotes from PDF)
{"title": "Synopsis"}

// Correct (straight quotes)
{"title": "Synopsis"}
```

**Unquoted keys:**
```json
// Wrong
{title: "1.1"}

// Correct
{"title": "1.1"}
```

**Backslashes in strings:**
```json
// Wrong
{"summary": "Uses \\ method"}

// Correct
{"summary": "Uses \\\\ method"}
```

**Fix before returning:**
1. Remove markdown code fences: ```json and ```
2. Convert smart quotes to straight quotes
3. Add quotes around unquoted keys
4. Remove trailing commas before } or ]
5. Escape backslashes in strings

### Empty or Malformed Output

If Claude returns incomplete JSON:
1. Ensure you waited for parse command to complete
2. Check that ~/.parse/ file actually contains content
3. Verify grep patterns match the document's numbering style
4. Try broader search patterns
5. Fall back to returning empty array if truly no sections exist

## Path Handling

**Working Directory Context:**
- Current directory (cwd): Configured to template root
- Template paths may be relative or absolute
- Parsed output: Always at `~/.parse/<filename>.md` (absolute path)

**Path Examples:**
```bash
# Relative path (when cwd is template root)
parse "template_abc123/ICH-template.pdf"
# → Parses to: ~/.parse/ICH-template.md

# Absolute path
parse "/Users/user/dossierflow/templates/template_xyz789/document.pdf"
# → Parses to: ~/.parse/document.md

# Reading parsed output (always absolute path)
read_file ~/.parse/ICH-template.md
read_file ~/.parse/document.md
```

## Best Practices

1. **Always parse first**: Don't try to read raw PDF/DOCX directly - use semtools parse
2. **Be patient**: Large regulatory documents can take 5-15 seconds to parse
3. **Use adequate context**: For semantic search, use `--n-lines 10-20` for better understanding
4. **Preserve exact numbering**: Maintain exact section numbers from template (1.1, not 1.1.)
5. **Domain terminology**: Use regulatory language (CSR, nonclinical, CMC, endpoints)
6. **Validate before returning**: Always check JSON structure is valid
7. **Handle failures gracefully**: Provide fallback strategies for parse errors
8. **Cache awareness**: Check ~/.parse/ for existing parsed files before re-parsing
9. **Consistent formatting**: All JSON output should be clean and properly formatted
10. **No explanations**: Only return the requested JSON, nothing else

## Common ICH M4 Regulatory Patterns

Understanding these helps write better summaries:

**Module 1: Regional Administrative Information**
- Cover letters, application forms, regional requirements
- Varies by region (US, EU, Japan, etc.)

**Module 2: Common Technical Document Summaries**
- 2.3: Quality Overall Summary (CMC overview)
- 2.4: Nonclinical Overview (safety pharmacology, toxicology)
- 2.5: Clinical Overview (comprehensive clinical data analysis)
- 2.6: Nonclinical Written and Tabulated Summaries
- 2.7: Clinical Summary (detailed tabular data)

**Module 3: Quality (CMC)**
- 3.2.S: Drug Substance (active ingredient)
  - 3.2.S.1: General Information
  - 3.2.S.2: Manufacture
  - 3.2.S.3: Characterization
  - 3.2.S.4: Control of Drug Substance
  - 3.2.S.7: Stability
- 3.2.P: Drug Product (final formulation)
  - 3.2.P.1: Description and Composition
  - 3.2.P.2: Pharmaceutical Development
  - 3.2.P.3: Manufacture
  - 3.2.P.4: Control of Excipients
  - 3.2.P.5: Control of Drug Product
  - 3.2.P.8: Stability

**Module 4: Nonclinical Study Reports**
- Pharmacology studies
- Pharmacokinetic studies
- Toxicology studies

**Module 5: Clinical Study Reports**
- Individual study reports following ICH E3 guidelines
- Tabulated data, patient narratives, case report forms

## Examples

Common template patterns you may encounter:

**Example 1: ICH M4 Module 2.5 Clinical Overview**
```
2.5 Clinical Overview
2.5.1 Product Development Rationale
2.5.2 Overview of Biopharmaceutics
2.5.3 Overview of Clinical Pharmacology
2.5.4 Overview of Efficacy
2.5.5 Overview of Safety
2.5.6 Benefits and Risks Conclusions
```

**Example 2: Module 3 CMC Sections**
```
3.2.S Drug Substance
3.2.S.1 General Information
3.2.S.1.1 Nomenclature
3.2.S.1.2 Structure
3.2.S.1.3 General Properties
```

**Example 3: Clinical Study Report**
```
1. Synopsis
2. Introduction
3. Objectives
4. Investigational Plan
5. Study Patients
6. Efficacy Evaluation
7. Safety Evaluation
8. Discussion and Overall Conclusions
```

See `examples/` directory for sample parsed outputs and extraction results.

## Debugging Tips

**Enable verbose output:**
```bash
# Check what semtools is doing
parse "<file>" 2>&1 | tee parse-debug.log

# Verify parsed content
cat ~/.parse/template.md | head -n 50

# Test grep patterns
grep -n -E '^\s*[0-9]+\.[0-9]+' ~/.parse/template.md
```

**Common issues:**
- **Parse hangs**: Large file, be patient or check file size with `ls -lh`
- **No sections found**: Template uses non-standard numbering, try looser patterns
- **Garbled text**: PDF encoding issues, inspect parsed markdown carefully
- **JSON syntax error**: Use a JSON validator, check for trailing commas and quotes

**Validation commands:**
```bash
# Validate JSON output (if python available)
echo '<json>' | python3 -m json.tool

# Count extracted sections
echo '<json>' | grep -c '"title"'
```

---

## Quick Reference

**Standard Workflow:**
1. `parse "<template-path>"` → Get parsed markdown path
2. `read_file ~/.parse/template.md` → Examine structure
3. `grep -E '^\s*[0-9]+\.[0-9]+' ~/.parse/template.md` → Extract sections
4. Create JSON with title, summary, originalHeading for each section
5. Validate JSON (no fences, no extra text)
6. Return JSON only

**Fallback if parse fails:**
1. Check cache: `ls ~/.parse/`
2. Try direct read: `read_file "<path>"`
3. Return empty: `{"sections": []}`

**Remember:**
- Be systematic: parse → read → extract → format → validate → return
- Be precise: exact numbering, proper JSON, domain terminology
- Be concise: 2-3 sentence summaries, no explanatory text outside JSON
- Be resilient: handle errors gracefully with fallback strategies
