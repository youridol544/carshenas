// Localhost-only mock of OpenAI Chat Completions and Anthropic Messages, to observe BAML v0 runtime behaviour.
import http from "node:http";

const hits = [];
let scenario = "";
const server = http.createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  hits.push({ scenario, url: req.url, body: raw ? JSON.parse(raw) : null });
  res.setHeader("content-type", "application/json");
  res.setHeader("x-request-id", "req_local_1");
  if (req.url.endsWith("/chat/completions")) {
    // Always an answer that violates the @assert (modelYear out of range).
    res.end(JSON.stringify({
      id: "chatcmpl-local", object: "chat.completion", model: "gpt-5-mini-2026-01-01",
      choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: '{"make":"Peugeot","modelYear":2020}' } }],
      usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110, prompt_tokens_details: { cached_tokens: 40 }, completion_tokens_details: { reasoning_tokens: 5 } },
    }));
    return;
  }
  if (req.url.endsWith("/v1/messages")) {
    const replies = {
      refusal_empty: { content: [], stop_reason: "refusal" },
      refusal_text: { content: [{ type: "text", text: "I can't help with that." }], stop_reason: "refusal" },
      truncated: { content: [{ type: "text", text: '{"make":"Peugeot","modelYear":1399,"fu' }], stop_reason: "max_tokens" },
    };
    const r = replies[scenario.replace(/_strict$/, "")];
    res.end(JSON.stringify({
      id: "msg_local", type: "message", role: "assistant", model: "claude-x-20260101", stop_sequence: null,
      usage: { input_tokens: 50, output_tokens: 7, cache_read_input_tokens: 20, cache_creation_input_tokens: 30 },
      ...r,
    }));
    return;
  }
  res.statusCode = 404;
  res.end("{}");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
process.env.LOCAL_OPENAI_BASE = `http://127.0.0.1:${port}/v1`;
process.env.LOCAL_ANTHROPIC_BASE = `http://127.0.0.1:${port}`;
process.env.METIS_API_KEY = "sk-test";

const { b } = await import("./dist/index.js");
const { Collector } = await import("@boundaryml/baml");

async function run(name, client) {
  scenario = name;
  const collector = new Collector(name);
  const before = hits.length;
  try {
    const out = await b.ExtractListing("Peugeot 206, 1399", { client, collector });
    console.log(`[${name}] OK:`, JSON.stringify(out));
  } catch (e) {
    console.log(`[${name}] THREW ${e.constructor.name}:`, String(e.message).split("\n")[0].slice(0, 160));
  }
  console.log(`[${name}] HTTP requests: ${hits.length - before}`);
  const log = collector.last;
  if (log) {
    const u = log.usage;
    const call = log.calls[0];
    let answeredModel, reqId;
    try { answeredModel = call?.httpResponse?.body?.json()?.model; reqId = call?.httpResponse?.headers?.["x-request-id"]; } catch {}
    console.log(`[${name}] usage: input=${u?.inputTokens} output=${u?.outputTokens} cachedInput=${u?.cachedInputTokens}`,
      "| usage keys:", Object.getOwnPropertyNames(Object.getPrototypeOf(u ?? {})).join(","),
      "| calls:", log.calls.length, "| provider:", call?.provider, "| answered model (raw body):", answeredModel, "| x-request-id (raw headers):", reqId);
  }
}

await run("assert_fail_with_retry_policy", "LocalOpenAI");
const retryBodies = hits.filter((h) => h.scenario === "assert_fail_with_retry_policy").map((h) => JSON.stringify(h.body.messages));
console.log("[assert_fail_with_retry_policy] all request bodies identical:", new Set(retryBodies).size === 1);
await run("refusal_empty", "LocalClaude");
await run("refusal_text", "LocalClaude");
await run("truncated", "LocalClaude");
await run("truncated_strict", "LocalClaudeStrict");
server.close();
