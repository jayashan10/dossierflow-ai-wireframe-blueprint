#!/usr/bin/env ts-node
/**
 * Test script for agent-based template processing
 *
 * Usage:
 *   ts-node src/scripts/test-agent-template.ts <templateId>
 *
 * Or from package.json:
 *   npm run test:agent-template -- <templateId>
 */

import { refineTemplateRecordWithAgent, listTemplates } from '../services/template-service';
import { appConfig } from '../config';

async function main() {
  const templateId = process.argv[2];

  if (!templateId) {
    console.error('Usage: ts-node src/scripts/test-agent-template.ts <templateId>');
    console.error('\nAvailable templates:');
    const templates = await listTemplates();
    if (templates.length === 0) {
      console.error('  No templates found. Upload a template first.');
    } else {
      templates.forEach((t) => {
        console.error(`  ${t.id} - ${t.name} (${t.sectionCount} sections)`);
      });
    }
    process.exit(1);
  }

  console.log('='.repeat(80));
  console.log('Agent-Based Template Refinement Test');
  console.log('='.repeat(80));
  console.log();
  console.log('Configuration:');
  console.log(`  Template Root: ${appConfig.templateRoot}`);
  console.log(`  Claude Agent Enabled: ${appConfig.enableClaudeAgent}`);
  console.log(`  Agent Tools Enabled: ${appConfig.agentEnableTools}`);
  console.log(`  Agent Max Turns: ${appConfig.agentMaxTurns}`);
  console.log(`  Use Semtools: ${appConfig.useSemtools}`);
  console.log(`  Semtools Workspace: ${appConfig.semtoolsWorkspace}`);
  console.log();

  if (!appConfig.enableClaudeAgent) {
    console.error('❌ Error: ENABLE_CLAUDE_AGENT is false. Set it to true in .env');
    process.exit(1);
  }

  if (!appConfig.anthropicApiKey) {
    console.error('❌ Error: ANTHROPIC_API_KEY is not set. Configure it in .env');
    process.exit(1);
  }

  console.log(`Processing template: ${templateId}`);
  console.log('This may take a few minutes as the agent parses and analyzes the template...');
  console.log();

  const startTime = Date.now();

  try {
    const result = await refineTemplateRecordWithAgent(templateId);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('='.repeat(80));
    console.log('✅ Agent Refinement Completed');
    console.log('='.repeat(80));
    console.log();
    console.log('Results:');
    console.log(`  Template: ${result.name}`);
    console.log(`  Sections Extracted: ${result.refinedSections.length}`);
    console.log(`  Claude Used: ${result.claudeUsed}`);
    console.log(`  Duration: ${duration}s`);
    console.log();

    if (result.claudeUsage) {
      console.log('Token Usage:');
      console.log(`  Prompt Tokens: ${result.claudeUsage.promptTokens.toLocaleString()}`);
      console.log(`  Completion Tokens: ${result.claudeUsage.completionTokens.toLocaleString()}`);
      console.log(`  Total Tokens: ${result.claudeUsage.totalTokens.toLocaleString()}`);
      console.log();
    }

    if (result.warnings && result.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      result.warnings.forEach((w) => console.log(`  - ${w}`));
      console.log();
    }

    if (result.refinedSections.length > 0) {
      console.log('Extracted Sections (first 10):');
      result.refinedSections.slice(0, 10).forEach((section, index) => {
        console.log(`\n  ${index + 1}. ${section.title}`);
        console.log(`     Summary: ${section.summary.substring(0, 100)}${section.summary.length > 100 ? '...' : ''}`);
        console.log(`     Original: ${section.originalHeading}`);
      });

      if (result.refinedSections.length > 10) {
        console.log(`\n  ... and ${result.refinedSections.length - 10} more sections`);
      }
    }

    console.log();
    console.log('='.repeat(80));
    console.log('✅ Test completed successfully');
    console.log('='.repeat(80));
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error();
    console.error('='.repeat(80));
    console.error('❌ Agent Refinement Failed');
    console.error('='.repeat(80));
    console.error();
    console.error(`Duration: ${duration}s`);
    console.error();
    console.error('Error:', error instanceof Error ? error.message : String(error));

    if (error instanceof Error && error.stack) {
      console.error();
      console.error('Stack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
