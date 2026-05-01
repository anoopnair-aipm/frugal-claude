---
name: model-router
description: >
  Dynamically route Claude API calls between expensive and cheap models based on task complexity.
  Use this skill whenever the user wants to optimize API costs, reduce latency, build a smart
  model-switching system, or automatically select between Claude Haiku and Claude Sonnet/Opus
  based on what the task actually needs. Trigger this skill for any mention of model routing,
  cost optimization, tiered model usage, dynamic model selection, or smart API dispatching —
  even if the user just says "I want to save on API costs" or "route tasks to the right model."
---

# Model Router Skill

## What This Skill Does

This skill teaches Claude to build a **two-stage routing system** that:
1. Uses a cheap classifier (Haiku) to assess task complexity
2. Routes to the appropriate model based on that assessment

The result: maximum quality where it matters, minimum cost everywhere else.

---

## Model Tier Map

| Tier       | Model                        | Use When                                              |
|------------|------------------------------|-------------------------------------------------------|
| **Fast**   | `claude-haiku-4-5-20251001`  | Simple Q&A, formatting, translation, summarization    |
| **Smart**  | `claude-sonnet-4-6`          | Reasoning, code, analysis, multi-step tasks           |
| **Power**  | `claude-opus-4-6`            | Architecture decisions, deep synthesis, highest stakes|

---

## Core Routing Logic

### Stage 1 — Classify (always use Haiku, it's cheap)

Send the user's prompt to Haiku with this system prompt:

```
You are a task complexity classifier. Analyze the user's prompt and return ONLY valid JSON.
No preamble, no markdown fences.

Return this structure:
{
  "complexity": "simple" | "medium" | "complex",
  "reasoning": "one sentence explanation",
  "estimated_tokens": <number>
}

Classification rules:
- simple: factual Q&A, yes/no, formatting, translation, basic summarization, single-step tasks
- medium: code generation, multi-step reasoning, content creation, structured analysis
- complex: architecture decisions, deep research synthesis, cross-domain reasoning, debugging complex systems
```

### Stage 2 — Route

```
simple  → claude-haiku-4-5-20251001
medium  → claude-sonnet-4-6
complex → claude-opus-4-6
```

---

## Implementation Pattern (JavaScript / React)

```javascript
async function routeAndRun(userPrompt) {
  // Stage 1: Classify
  const classifyRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: CLASSIFIER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }]
    })
  });
  const classifyData = await classifyRes.json();
  const { complexity, reasoning } = JSON.parse(classifyData.content[0].text);

  // Stage 2: Route
  const modelMap = {
    simple:  "claude-haiku-4-5-20251001",
    medium:  "claude-sonnet-4-6",
    complex: "claude-opus-4-6"
  };
  const selectedModel = modelMap[complexity];

  // Stage 3: Execute
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: selectedModel,
      max_tokens: 1000,
      messages: [{ role: "user", content: userPrompt }]
    })
  });
  const data = await response.json();

  return {
    answer: data.content[0].text,
    model: selectedModel,
    complexity,
    reasoning
  };
}
```

---

## Cost Insight

The classifier call costs ~$0.0002 per call (Haiku, ~200 tokens).
If 70% of your traffic is simple tasks routed to Haiku instead of Sonnet,
you reduce costs by ~85% on those calls — with classifier overhead under 1%.

---

## Key Design Decisions

- **Always classify with Haiku** — never use Sonnet/Opus just to decide which model to use
- **Keep classifier prompt tight** — the output must be parseable JSON, no fluff
- **Add a fallback** — if JSON parsing fails, default to `medium` (Sonnet)
- **Log routing decisions** — track which tasks land where; use this to tune thresholds over time
- **Never route user-facing trust-critical tasks to Haiku** — legal, medical, financial decisions should default to medium/complex

---

## Edge Cases to Handle

| Scenario                        | Recommended Handling                          |
|---------------------------------|-----------------------------------------------|
| Classifier returns invalid JSON | Default to `medium`, log the failure          |
| API error on selected model     | Retry once, then fall back to Sonnet          |
| Very long prompts (>4k tokens)  | Override to `medium` or `complex` regardless  |
| User override requested         | Honor it — expose a `forceModel` param        |

---

## Testing This Skill

Run these prompts and verify correct routing:

**Should → Haiku (simple)**
- "What is the capital of France?"
- "Translate 'good morning' to Spanish"
- "Format this list alphabetically: banana, apple, cherry"

**Should → Sonnet (medium)**
- "Write a Python script to parse a CSV and compute weekly averages"
- "Explain the tradeoffs between REST and GraphQL APIs"
- "Draft a 3-paragraph product update for our stakeholders"

**Should → Opus (complex)**
- "Design a multi-tenant SaaS architecture for a fintech platform handling PII"
- "Synthesize these 5 research papers and identify contradictions"
- "Debug why our distributed system has intermittent data inconsistency under load"
