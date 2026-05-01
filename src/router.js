/**
 * frugal-claude — Smart Model Router
 * 
 * Two-stage routing: classify complexity with Haiku,
 * then execute with the appropriately-tiered model.
 * 
 * @author Anoop Nair × Bivin Kumar Chandrabose
 * @license MIT
 */

const MODEL_MAP = {
  simple:  "claude-haiku-4-5-20251001",
  medium:  "claude-sonnet-4-6",
  complex: "claude-opus-4-6",
};

const CLASSIFIER_PROMPT = `You are a task complexity classifier.
Analyze the user's prompt and return ONLY valid JSON. No preamble. No markdown fences.

Return exactly this structure:
{
  "complexity": "simple" | "medium" | "complex",
  "reasoning": "one sentence explanation",
  "confidence": 0-100
}

Classification rules:
- simple:  factual Q&A, yes/no, formatting, translation, basic summarization, single-step tasks
- medium:  code generation, multi-step reasoning, content creation, structured analysis
- complex: architecture decisions, deep research synthesis, cross-domain debugging, high-stakes professional advice`;

// Domains that should always route to Opus regardless of classification
const ALWAYS_COMPLEX_DOMAINS = [
  "legal advice", "medical diagnosis", "financial planning",
  "security architecture", "compliance", "gdpr", "hipaa"
];

/**
 * Classify the complexity of a prompt using Haiku.
 * @param {string} prompt - The user's input
 * @param {string} apiKey - Anthropic API key
 * @returns {Promise<{complexity: string, reasoning: string, confidence: number}>}
 */
async function classify(prompt, apiKey) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL_MAP.simple,
      max_tokens: 200,
      system: CLASSIFIER_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();

  try {
    return JSON.parse(data.content[0].text);
  } catch {
    // Safe fallback if classifier output is unparseable
    return { complexity: "medium", reasoning: "Parse error — defaulting to medium", confidence: 50 };
  }
}

/**
 * Execute a prompt against a specific model.
 * @param {string} prompt - The user's input
 * @param {string} model - Model ID to use
 * @param {string} apiKey - Anthropic API key
 * @param {number} maxTokens - Max tokens for response
 * @returns {Promise<string>} - The model's response text
 */
async function execute(prompt, model, apiKey, maxTokens = 1000) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  return data.content[0].text;
}

/**
 * Main router: classify + route + execute.
 * 
 * @param {string} prompt - The user's input
 * @param {string} apiKey - Anthropic API key
 * @param {Object} options
 * @param {string}  [options.forceModel]   - Override routing and use this model ID directly
 * @param {number}  [options.maxTokens]    - Max tokens for the response (default: 1000)
 * @param {boolean} [options.verbose]      - Log routing decisions to console (default: false)
 * @returns {Promise<{answer, modelUsed, complexity, reasoning, confidence}>}
 */
async function route(prompt, apiKey, options = {}) {
  const { forceModel = null, maxTokens = 1000, verbose = false } = options;

  // Manual override
  if (forceModel) {
    const answer = await execute(prompt, forceModel, apiKey, maxTokens);
    return { answer, modelUsed: forceModel, complexity: "override", reasoning: "Manual override", confidence: 100 };
  }

  // Very long prompts skip classification — always complex
  if (prompt.length > 16000) {
    const answer = await execute(prompt, MODEL_MAP.complex, apiKey, maxTokens);
    return { answer, modelUsed: MODEL_MAP.complex, complexity: "complex", reasoning: "Prompt length override", confidence: 100 };
  }

  // Trust-critical domain override
  const promptLower = prompt.toLowerCase();
  const isTrustCritical = ALWAYS_COMPLEX_DOMAINS.some(d => promptLower.includes(d));
  if (isTrustCritical) {
    const answer = await execute(prompt, MODEL_MAP.complex, apiKey, maxTokens);
    return { answer, modelUsed: MODEL_MAP.complex, complexity: "complex", reasoning: "Trust-critical domain override", confidence: 100 };
  }

  // Stage 1: Classify
  const classification = await classify(prompt, apiKey);

  // Stage 2: Route and execute
  const selectedModel = MODEL_MAP[classification.complexity] || MODEL_MAP.medium;
  
  let answer;
  try {
    answer = await execute(prompt, selectedModel, apiKey, maxTokens);
  } catch {
    // Fallback to Sonnet on execution error
    answer = await execute(prompt, MODEL_MAP.medium, apiKey, maxTokens);
    classification.reasoning += " (fallback to Sonnet after error)";
  }

  const result = {
    answer,
    modelUsed: selectedModel,
    complexity: classification.complexity,
    reasoning: classification.reasoning,
    confidence: classification.confidence,
  };

  if (verbose) {
    console.log("[frugal-claude] Routing decision:", {
      complexity: result.complexity,
      model: result.modelUsed,
      reasoning: result.reasoning,
      confidence: result.confidence,
      promptLength: prompt.length,
      timestamp: new Date().toISOString(),
    });
  }

  return result;
}

module.exports = { route, classify, execute, MODEL_MAP };
