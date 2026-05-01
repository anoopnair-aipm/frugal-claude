import { useState, useRef } from "react";

const CLASSIFIER_PROMPT = `You are a task complexity classifier. Analyze the user's prompt and return ONLY valid JSON with no preamble or markdown.

Return exactly this structure:
{
  "complexity": "simple" | "medium" | "complex",
  "reasoning": "one sentence explanation",
  "confidence": 0-100
}

Classification rules:
- simple: factual Q&A, yes/no, formatting, translation, basic summarization, single-step tasks
- medium: code generation, multi-step reasoning, content creation, structured analysis, explanations with examples
- complex: architecture decisions, deep research synthesis, cross-domain reasoning, debugging complex systems, high-stakes professional advice`;

const MODEL_MAP = {
  simple:  { id: "claude-haiku-4-5-20251001",  label: "Haiku",  color: "#10b981", badge: "⚡ Fast",    cost: "$0.25/MTok" },
  medium:  { id: "claude-sonnet-4-6",           label: "Sonnet", color: "#3b82f6", badge: "🎯 Smart",   cost: "$3/MTok" },
  complex: { id: "claude-opus-4-6",             label: "Opus",   color: "#8b5cf6", badge: "🧠 Power",   cost: "$15/MTok" },
};

const EXAMPLE_PROMPTS = [
  { label: "Simple", text: "What is the capital of Japan?" },
  { label: "Medium", text: "Write a Python function to parse CSV files and compute weekly revenue averages." },
  { label: "Complex", text: "Design a multi-tenant SaaS architecture for a fintech platform handling PII data across 3 cloud regions." },
];

async function callClaude(model, systemPrompt, userPrompt, maxTokens = 1000) {
  const body = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: userPrompt }],
  };
  if (systemPrompt) body.system = systemPrompt;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export default function ModelRouter() {
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | classifying | routing | responding | done | error
  const [classification, setClassification] = useState(null);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const textareaRef = useRef(null);

  const reset = () => {
    setPhase("idle");
    setClassification(null);
    setAnswer("");
    setError("");
  };

  const run = async () => {
    if (!prompt.trim()) return;
    reset();

    try {
      // Stage 1: Classify
      setPhase("classifying");
      const classifyData = await callClaude(
        "claude-haiku-4-5-20251001",
        CLASSIFIER_PROMPT,
        prompt,
        200
      );

      const rawText = classifyData?.content?.[0]?.text || "";
      let parsed;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = { complexity: "medium", reasoning: "Could not parse classifier output — defaulting to medium.", confidence: 50 };
      }

      setClassification(parsed);
      setPhase("routing");

      await new Promise(r => setTimeout(r, 600));

      // Stage 2: Route & Execute
      setPhase("responding");
      const model = MODEL_MAP[parsed.complexity] || MODEL_MAP.medium;
      const responseData = await callClaude(model.id, null, prompt, 1000);
      const answerText = responseData?.content?.[0]?.text || "No response received.";

      setAnswer(answerText);
      setPhase("done");

      setHistory(prev => [{
        prompt,
        complexity: parsed.complexity,
        reasoning: parsed.reasoning,
        confidence: parsed.confidence,
        model: model.label,
        answer: answerText,
        timestamp: new Date().toLocaleTimeString(),
      }, ...prev].slice(0, 5));

    } catch (err) {
      setError(err.message || "Something went wrong.");
      setPhase("error");
    }
  };

  const currentModel = classification ? MODEL_MAP[classification.complexity] : null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0f",
      color: "#e2e8f0",
      fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
      padding: "0",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');

        * { box-sizing: border-box; }

        .header-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(28px, 5vw, 48px);
          font-weight: 800;
          letter-spacing: -1px;
          background: linear-gradient(135deg, #e2e8f0 30%, #64748b);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          line-height: 1.1;
        }

        .tier-card {
          border: 1px solid #1e2535;
          border-radius: 8px;
          padding: 12px 16px;
          background: #0f1117;
          transition: all 0.3s ease;
          cursor: default;
        }

        .tier-card.active {
          border-color: var(--model-color);
          background: color-mix(in srgb, var(--model-color) 8%, #0f1117);
          box-shadow: 0 0 20px color-mix(in srgb, var(--model-color) 20%, transparent);
        }

        .prompt-textarea {
          width: 100%;
          background: #0f1117;
          border: 1px solid #1e2535;
          border-radius: 8px;
          padding: 16px;
          color: #e2e8f0;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 14px;
          resize: vertical;
          min-height: 100px;
          outline: none;
          transition: border-color 0.2s;
          line-height: 1.6;
        }

        .prompt-textarea:focus {
          border-color: #3b82f6;
        }

        .run-button {
          background: #3b82f6;
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 12px 28px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 0.5px;
        }

        .run-button:hover:not(:disabled) {
          background: #2563eb;
          transform: translateY(-1px);
        }

        .run-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .phase-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          border: 1px solid currentColor;
        }

        .pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: currentColor;
          animation: pulse 1s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }

        .answer-block {
          background: #0f1117;
          border: 1px solid #1e2535;
          border-radius: 8px;
          padding: 20px;
          font-size: 13px;
          line-height: 1.8;
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 400px;
          overflow-y: auto;
          color: #cbd5e1;
        }

        .answer-block::-webkit-scrollbar { width: 4px; }
        .answer-block::-webkit-scrollbar-track { background: transparent; }
        .answer-block::-webkit-scrollbar-thumb { background: #2d3748; border-radius: 2px; }

        .example-chip {
          background: #0f1117;
          border: 1px solid #1e2535;
          border-radius: 20px;
          padding: 5px 14px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
          color: #94a3b8;
        }

        .example-chip:hover {
          border-color: #3b82f6;
          color: #e2e8f0;
        }

        .history-item {
          border: 1px solid #1e2535;
          border-radius: 8px;
          padding: 12px 16px;
          background: #0a0a0f;
          transition: border-color 0.2s;
        }

        .history-item:hover {
          border-color: #2d3748;
        }

        .separator {
          height: 1px;
          background: linear-gradient(90deg, transparent, #1e2535, transparent);
          margin: 32px 0;
        }

        .stat-box {
          background: #0f1117;
          border: 1px solid #1e2535;
          border-radius: 8px;
          padding: 12px 16px;
          text-align: center;
        }

        .routing-arrow {
          animation: slide 0.5s ease-out;
        }

        @keyframes slide {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }

        .fade-in {
          animation: fadeIn 0.4s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px" }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "#0f1117", border: "1px solid #1e2535",
            borderRadius: 20, padding: "4px 14px", fontSize: 11,
            color: "#64748b", marginBottom: 16, letterSpacing: 1,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
            CLAUDE SKILL · MODEL ROUTER
          </div>
          <div className="header-title">Smart Model<br />Switching</div>
          <p style={{ color: "#64748b", fontSize: 13, marginTop: 12, lineHeight: 1.7, maxWidth: 500 }}>
            Two-stage routing: a cheap classifier decides which model your task actually needs.
            Pay for power only when it matters.
          </p>
        </div>

        {/* Model Tiers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 32 }}>
          {Object.entries(MODEL_MAP).map(([key, m]) => (
            <div
              key={key}
              className={`tier-card ${classification?.complexity === key ? "active" : ""}`}
              style={{ "--model-color": m.color }}
            >
              <div style={{ fontSize: 11, color: m.color, marginBottom: 4 }}>{m.badge}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>{m.label}</div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{m.cost}</div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#475569", alignSelf: "center" }}>TRY:</span>
            {EXAMPLE_PROMPTS.map(e => (
              <button key={e.label} className="example-chip" onClick={() => setPrompt(e.text)}>
                {e.label}
              </button>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            className="prompt-textarea"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Enter any task or question. The router will classify it and pick the right model..."
            onKeyDown={e => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
            <span style={{ fontSize: 11, color: "#334155" }}>⌘ + Enter to run</span>
            <button
              className="run-button"
              disabled={!prompt.trim() || (phase !== "idle" && phase !== "done" && phase !== "error")}
              onClick={run}
            >
              {phase === "idle" || phase === "done" || phase === "error" ? "Route & Run →" : "Running..."}
            </button>
          </div>
        </div>

        {/* Phase Indicators */}
        {phase !== "idle" && (
          <div className="fade-in" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
              {[
                { key: "classifying", label: "Classifying with Haiku", icon: "⚡" },
                { key: "routing",     label: "Selecting model",        icon: "🔀" },
                { key: "responding",  label: "Generating response",    icon: "💬" },
              ].map(step => {
                const phaseOrder = ["classifying", "routing", "responding", "done"];
                const stepIdx = phaseOrder.indexOf(step.key);
                const currIdx = phaseOrder.indexOf(phase);
                const isActive = phase === step.key;
                const isDone = currIdx > stepIdx || phase === "done";

                return (
                  <div
                    key={step.key}
                    className="phase-badge"
                    style={{
                      color: isDone ? "#10b981" : isActive ? "#3b82f6" : "#334155",
                      borderColor: isDone ? "#10b981" : isActive ? "#3b82f6" : "#1e2535",
                      background: isActive
                        ? "rgba(59,130,246,0.08)"
                        : isDone
                        ? "rgba(16,185,129,0.06)"
                        : "transparent",
                    }}
                  >
                    {isActive && <div className="pulse-dot" />}
                    {isDone && <span>✓</span>}
                    {step.icon} {step.label}
                  </div>
                );
              })}
            </div>

            {/* Classification Result */}
            {classification && (
              <div className="routing-arrow" style={{
                background: "#0f1117",
                border: `1px solid ${currentModel?.color || "#1e2535"}`,
                borderRadius: 8,
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
                marginBottom: 16,
              }}>
                <div>
                  <div style={{ fontSize: 11, color: "#475569", marginBottom: 3 }}>ROUTED TO</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: currentModel?.color, fontFamily: "'Syne', sans-serif" }}>
                    Claude {currentModel?.label}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 11, color: "#475569", marginBottom: 3 }}>CLASSIFIER REASONING</div>
                  <div style={{ fontSize: 13, color: "#94a3b8" }}>{classification.reasoning}</div>
                </div>
                <div style={{
                  background: color_for(classification.complexity),
                  color: "#fff",
                  borderRadius: 4,
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 1,
                }}>
                  {classification.complexity?.toUpperCase()}
                </div>
              </div>
            )}

            {/* Answer */}
            {answer && (
              <div className="fade-in">
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 8 }}>RESPONSE</div>
                <div className="answer-block">{answer}</div>
              </div>
            )}

            {/* Error */}
            {phase === "error" && (
              <div style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 8,
                padding: "12px 16px",
                fontSize: 13,
                color: "#f87171",
              }}>
                ⚠️ {error}
              </div>
            )}
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <>
            <div className="separator" />
            <div>
              <div style={{ fontSize: 11, color: "#475569", marginBottom: 14, letterSpacing: 1 }}>
                ROUTING HISTORY
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {history.map((h, i) => (
                  <div key={i} className="history-item">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ fontSize: 13, color: "#94a3b8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {h.prompt}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <span style={{
                          fontSize: 11,
                          color: MODEL_MAP[h.complexity]?.color || "#475569",
                          background: color_bg(h.complexity),
                          padding: "2px 8px",
                          borderRadius: 3,
                          fontWeight: 600,
                        }}>
                          {h.model}
                        </span>
                        <span style={{ fontSize: 11, color: "#334155" }}>{h.timestamp}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Stats */}
              {history.length >= 2 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 16 }}>
                  {["simple", "medium", "complex"].map(c => {
                    const count = history.filter(h => h.complexity === c).length;
                    const pct = Math.round((count / history.length) * 100);
                    return (
                      <div key={c} className="stat-box">
                        <div style={{ fontSize: 20, fontWeight: 700, color: MODEL_MAP[c].color, fontFamily: "'Syne', sans-serif" }}>{pct}%</div>
                        <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{c}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function color_for(complexity) {
  return { simple: "#10b981", medium: "#3b82f6", complex: "#8b5cf6" }[complexity] || "#475569";
}

function color_bg(complexity) {
  return {
    simple:  "rgba(16,185,129,0.1)",
    medium:  "rgba(59,130,246,0.1)",
    complex: "rgba(139,92,246,0.1)",
  }[complexity] || "transparent";
}
