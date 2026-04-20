// Quick test for concatenated name matching
import { fuzzyMatcher } from './fuzzyNameMatcher.js';

const testCases = [
  // Test case: [input, candidate, expected_match]
  ['chrissmith', 'Chris Smith', true],
  ['mikejohnson', 'Michael Johnson', true], // Nickname + last name
  ['mikej', 'Michael Johnson', true], // Nickname + last initial
  ['mjohnson', 'Michael Johnson', true], // First initial + last name
  ['alexwilson', 'Alexandra Wilson', true], // Alex could match Alexandra
  ['alexwilson', 'Alexander Wilson', true], // Alex could match Alexander
  ['bobsmith', 'Robert Smith', true], // Bob is nickname for Robert
  ['richj', 'Richard Johnson', true], // Rich + initial
  ['davew', 'David Wilson', true], // Dave + initial
  ['tomsmith', 'Thomas Smith', true], // Tom is nickname for Thomas
];

console.log('Testing Concatenated Name Matching:\n');

for (const [input, candidate, expected] of testCases) {
  const result = fuzzyMatcher.matchSingle(input, candidate);
  const matched = result.score >= 0.8;
  const status = matched === expected ? '✅' : '❌';

  console.log(`${status} "${input}" → "${candidate}"`);
  console.log(`   Score: ${(result.score * 100).toFixed(1)}%, Confidence: ${result.confidence}`);
  console.log(`   Reason: ${result.reason}\n`);
}

export {};