const HEADING_REGEX = /^(\d+(?:\.\d+)*|[A-Z](?:\.[A-Z])+|[A-Z])\.?\s+.+$/;
const MAX_SECTIONS = 200;

interface SectionExtractionOptions {
  maxSections?: number;
}

export interface SectionExtractionResult {
  sections: string[];
  warnings?: string[];
}

export function extractSectionsFromText(
  text: string,
  options: SectionExtractionOptions = {}
): SectionExtractionResult {
  const warnings: string[] = [];
  const maxSections = options.maxSections ?? MAX_SECTIONS;

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const candidates = new Set<string>();

  for (const line of lines) {
    if (line.length < 5) continue;
    if (HEADING_REGEX.test(line)) {
      candidates.add(normalizeHeading(line));
    }
  }

  const sections = Array.from(candidates).slice(0, maxSections);

  if (!sections.length) {
    warnings.push('No structured headings detected; generated generic sections.');
    const genericCount = Math.min(10, Math.max(3, Math.floor(lines.length / 20))); // rough heuristic
    for (let index = 1; index <= genericCount; index += 1) {
      sections.push(`Section ${index}`);
    }
  }

  return {
    sections,
    warnings: warnings.length ? warnings : undefined
  };
}

function normalizeHeading(heading: string): string {
  return heading.replace(/\s+/g, ' ').trim();
}

