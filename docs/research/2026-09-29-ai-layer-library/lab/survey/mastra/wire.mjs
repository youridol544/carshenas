// Captures what Mastra's model layer puts on the wire, using a stubbed global fetch. No network.
import * as z from "zod";

process.env.MASTRA_TELEMETRY_DISABLED = "1";
process.env.ANTHROPIC_API_KEY = "x";
process.env.ANTHROPIC_BASE_URL = "https://api.metisai.ir/anthropic/v1";
process.env.GOOGLE_GENERATIVE_AI_API_KEY = "x";
process.env.GOOGLE_BASE_URL = "https://api.metisai.ir/v1beta";
process.env.OPENAI_API_KEY = "x";
process.env.OPENAI_BASE_URL = "https://api.metisai.ir/openai/v1";
process.env.DEEPSEEK_API_KEY = "x";
process.env.DEEPSEEK_BASE_URL = "https://api.metisai.ir/deepseek/v1";

const { Agent } = await import("@mastra/core/agent");

const Listing = z.object({ make: z.string(), year: z.number().int() });
const log = [];
let responder = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const req = input instanceof Request ? input : new Request(input, init);
  const body = await req.clone().text();
  const headers = Object.fromEntries([...req.headers].map(([k, v]) => [k, /key|authorization/i.test(k) ? "<redacted>" : v]));
  log.push({ url: req.url, headers, body: body ? JSON.parse(body) : null });
  const [status, json] = responder(req.url);
  return new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json", "request-id": "req_stub_1", "x-request-id": "req_stub_1" } });
};

async function run(name, model, respond, opts = {}) {
  log.length = 0;
  responder = respond;
  const agent = new Agent({ id: "a", name: "a", instructions: "Extract.", model });
  try {
    const r = await agent.generate("x", { structuredOutput: { schema: Listing, ...(opts.so || {}) }, ...(opts.gen || {}) });
    console.log(`\n### ${name}\nobject:`, JSON.stringify(r.object), "\nfinishReason:", r.finishReason, "\nusage:", JSON.stringify(r.usage),
      "\nresponse:", JSON.stringify({ id: r.response?.id, modelId: r.response?.modelId, headers: r.response?.headers }),
      "\nproviderMetadata:", JSON.stringify(r.providerMetadata), "\nerror:", r.error ? `${r.error.id ?? r.error.name}: ${String(r.error.message).slice(0, 300)}` : undefined,
      "\ntripwire:", JSON.stringify(r.tripwire), "\nusedFallbackValue:", r.usedFallbackValue);
  } catch (e) {
    console.log(`\n### ${name}\nTHROWN ${e?.constructor?.name} ${e?.id ?? ""}: ${String(e?.message).slice(0, 400)}`);
  }
  for (const l of log) console.log("url:", l.url, "\nheaders:", JSON.stringify(l.headers), "\nbody:", JSON.stringify(l.body).slice(0, 1800));
  console.log("calls:", log.length);
}

const anthropicReply = (text, stop = "end_turn") => () => [200, { id: "msg_1", type: "message", role: "assistant", model: "claude-sonnet-4-6-20260101", stop_reason: stop, stop_sequence: null, content: text === null ? [] : [{ type: "text", text }], usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 3, cache_creation_input_tokens: 2 } }];
const anthropicToolReply = (input) => () => [200, { id: "msg_1", type: "message", role: "assistant", model: "claude-sonnet-4-6-20260101", stop_reason: "tool_use", stop_sequence: null, content: [{ type: "tool_use", id: "t1", name: "json", input }], usage: { input_tokens: 10, output_tokens: 5 } }];
const chatReply = (content, finish = "stop") => () => [200, { id: "chatcmpl-1", object: "chat.completion", created: 1, model: "answered-model-2026", choices: [{ index: 0, finish_reason: finish, message: { role: "assistant", content } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, prompt_tokens_details: { cached_tokens: 4 }, completion_tokens_details: { reasoning_tokens: 1 } } }];
const geminiReply = (text) => () => [200, { candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 16, cachedContentTokenCount: 2, thoughtsTokenCount: 1 }, modelVersion: "gemini-3-flash-preview", responseId: "resp_1" }];
const responsesReply = (text) => () => [200, { id: "resp_1", object: "response", created_at: 1, status: "completed", model: "gpt-5.4-mini-2026", output: [{ type: "message", id: "m1", status: "completed", role: "assistant", content: [{ type: "output_text", text, annotations: [] }] }], usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15, input_tokens_details: { cached_tokens: 4 }, output_tokens_details: { reasoning_tokens: 1 } } }];

const good = "{\"make\":\"Peugeot\",\"year\":1398}";
const bad = "{\"make\":\"Peugeot\",\"year\":\"new\"}";

await run("router anthropic/ via ANTHROPIC_BASE_URL", "anthropic/claude-sonnet-4-6", (url) => (url.includes("messages") ? anthropicReply(good)() : [404, {}]));
await run("router anthropic/ with {url} (openai-compatible)", { id: "anthropic/claude-sonnet-4-6", url: "https://api.metisai.ir/anthropic", apiKey: "x" }, chatReply(good));
await run("router google/ via GOOGLE_BASE_URL", "google/gemini-3-flash-preview", geminiReply(good));
await run("router openai/ via OPENAI_BASE_URL", "openai/gpt-5.4-mini", responsesReply(good));
await run("router openai/ {url, api:chat}", { id: "openai/gpt-5.4-mini", url: "https://api.metisai.ir/openai/v1", apiKey: "x" }, chatReply(good));
await run("router deepseek/ via DEEPSEEK_BASE_URL", "deepseek/deepseek-v4-flash", chatReply(good));
await run("validation failure, default errorStrategy", { id: "openai/gpt-5.4-mini", url: "https://api.metisai.ir/openai/v1", apiKey: "x" }, chatReply(bad));
await run("validation failure, errorStrategy fallback", { id: "openai/gpt-5.4-mini", url: "https://api.metisai.ir/openai/v1", apiKey: "x" }, chatReply(bad), { so: { errorStrategy: "fallback", fallbackValue: { make: "?", year: 0 } } });
await run("truncated (finish_reason length)", { id: "openai/gpt-5.4-mini", url: "https://api.metisai.ir/openai/v1", apiKey: "x" }, chatReply("{\"make\":\"Peu", "length"));
await run("anthropic refusal", "anthropic/claude-sonnet-4-6", anthropicReply(null, "refusal"));
await run("empty answer", { id: "openai/gpt-5.4-mini", url: "https://api.metisai.ir/openai/v1", apiKey: "x" }, chatReply(""));
