#!/usr/bin/env ts-node

import { refineTemplateRecordWithAgent } from '../services/template-service';

async function testAgentRefinement() {
  const templateId = 'template_067ff6e5-3c9e-4f98-b871-58796be92b65';

  console.log(`\nTesting FULL AGENTIC REFINEMENT with tools...`);
  console.log(`Template ID: ${templateId}\n`);
  console.log('='.repeat(80) + '\n');

  try {
    const result = await refineTemplateRecordWithAgent(templateId);

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ SUCCESS!');
    console.log(`\nTemplate: ${result.name}`);
    console.log(`Sections extracted: ${result.sectionCount}`);
    console.log(`Claude used: ${result.claudeUsed}`);
    console.log(`Token usage: ${JSON.stringify(result.claudeUsage)}`);
    console.log(`Warnings: ${result.warnings ? result.warnings.join(', ') : 'none'}`);

    if (result.refinedSections.length > 0) {
      console.log('\nFirst 3 refined sections:');
      result.refinedSections.slice(0, 3).forEach((section, i) => {
        console.log(`\n${i + 1}. ${section.title}`);
        console.log(`   Summary: ${section.summary}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  }
}

testAgentRefinement();
