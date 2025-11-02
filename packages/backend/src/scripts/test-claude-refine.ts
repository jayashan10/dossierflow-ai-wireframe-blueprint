#!/usr/bin/env ts-node

import { getTemplate } from '../services/template-service';
import { refineExtractedSections } from '../services/claude-agent-service';

async function testRefinement() {
  // Load the actual template from storage
  const templateId = 'template_067ff6e5-3c9e-4f98-b871-58796be92b65';

  console.log(`Loading template: ${templateId}\n`);
  const template = await getTemplate(templateId);

  if (!template) {
    console.error('❌ Template not found!');
    process.exit(1);
  }

  const testHeadings = template.rawSections.slice(0, 10); // Test with first 10 sections to avoid truncation

  console.log('Testing Claude agent refinement with REAL template data...\n');
  console.log(`Template: ${template.name}`);
  console.log(`Total sections extracted: ${template.rawSections.length}`);
  console.log(`Testing with first ${testHeadings.length} sections:\n`);
  testHeadings.forEach((h, i) => console.log(`  ${i + 1}. ${h}`));
  console.log('\n' + '='.repeat(80) + '\n');

  try {
    const result = await refineExtractedSections(testHeadings);

    console.log('Refinement Result:');
    console.log('- Claude Used:', result.claudeUsed);
    console.log('- Sections Returned:', result.sections.length);
    console.log('- Token Usage:', result.usage);
    console.log('- Warnings:', result.warnings);
    console.log('\n' + '='.repeat(80) + '\n');

    if (result.sections.length > 0) {
      console.log('Sample refined sections (first 3):\n');
      result.sections.slice(0, 3).forEach((section, index) => {
        console.log(`${index + 1}. ${section.title}`);
        console.log(`   Original: ${section.originalHeading}`);
        console.log(`   Summary: ${section.summary}`);
        console.log('');
      });
    } else {
      console.log('❌ No sections returned!');
      if (result.warnings) {
        console.log('Warnings:', result.warnings);
      }
    }

    process.exit(result.sections.length > 0 ? 0 : 1);
  } catch (error) {
    console.error('❌ Error during refinement:', error);
    process.exit(1);
  }
}

testRefinement();
