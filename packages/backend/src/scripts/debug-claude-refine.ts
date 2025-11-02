#!/usr/bin/env ts-node

import process from 'node:process';
import { refineExtractedSections } from '../services/claude-agent-service';

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: ts-node src/scripts/debug-claude-refine.ts "Heading 1" "Heading 2" ...');
    process.exitCode = 1;
    return;
  }

  try {
    const result = await refineExtractedSections(args);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Refinement script encountered an error:', error);
    process.exitCode = 1;
  }
}

main();
