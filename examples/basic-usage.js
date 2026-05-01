/**
 * frugal-claude — Usage Examples
 * 
 * Run with: node examples/basic-usage.js
 * Requires: ANTHROPIC_API_KEY environment variable
 */

const { route } = require("../src/router");

const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY environment variable.");
  process.exit(1);
}

async function runExamples() {
  const prompts = [
    // Should route to Haiku
    "What is the capital of Japan?",

    // Should route to Sonnet
    "Write a Python function to parse a CSV and compute weekly revenue averages.",

    // Should route to Opus
    "Design a multi-tenant SaaS architecture for a fintech platform handling PII across three cloud regions.",
  ];

  console.log("frugal-claude — Routing Examples\n" + "=".repeat(50));

  for (const prompt of prompts) {
    console.log(`\nPrompt: "${prompt}"`);
    console.log("-".repeat(40));

    const result = await route(prompt, API_KEY, { verbose: true, maxTokens: 300 });

    console.log(`Complexity : ${result.complexity}`);
    console.log(`Model used : ${result.modelUsed}`);
    console.log(`Reasoning  : ${result.reasoning}`);
    console.log(`Answer     : ${result.answer.slice(0, 150)}...`);
  }
}

runExamples().catch(console.error);
