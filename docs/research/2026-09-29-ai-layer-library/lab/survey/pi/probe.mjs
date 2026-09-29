// Offline probe: every HTTP call goes to an injected fetch that returns canned SSE. No network.
import { createModels, createProvider, fauxProvider, fauxAssistantMessage, fauxText } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { anthropicMessagesApi } from "@earendil-works/pi-ai/api/anthropic-messages.lazy";

const seen = [];
function sse(events) {
  return events.map((e) => (e.event ? `event: ${e.event}\n` : "") + `data: ${typeof e.data === "string" ? e.data : JSON.stringify(e.data)}\n\n`).join("");
}
function fakeFetch(bodyFor) {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    const headers = Object.fromEntries(new Headers(init?.headers ?? input.headers).entries());
    const body = JSON.parse(init?.body ?? "{}");
    seen.push({ url, headers, body });
    return new Response(bodyFor(url), {
      status: 200,
      headers: { "content-type": "text/event-stream", "x-request-id": "req_fake_123", "request-id": "req_fake_456" },
    });
  };
}

const metisOpenAI = {
  id: "gpt-5-mini", name: "gpt-5-mini via Metis", api: "openai-completions", provider: "metis-openai",
  baseUrl: "https://api.metisai.ir/openai/v1", reasoning: false, input: ["text"],
  cost: { input: 0.25, output: 2, cacheRead: 0.025, cacheWrite: 0 }, contextWindow: 400000, maxTokens: 16000,
};
const metisAnthropic = {
  id: "claude-x", name: "Claude via Metis", api: "anthropic-messages", provider: "metis-anthropic",
  baseUrl: "https://api.metisai.ir/anthropic", reasoning: false, input: ["text"],
  cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 }, contextWindow: 200000, maxTokens: 8000,
};
const keyAuth = { apiKey: { name: "Metis", resolve: async () => ({ auth: { apiKey: "sk-test" } }) } };
const models = createModels();
models.setProvider(createProvider({ id: "metis-openai", auth: keyAuth, models: [metisOpenAI], api: openAICompletionsApi() }));
models.setProvider(createProvider({ id: "metis-anthropic", auth: keyAuth, models: [metisAnthropic], api: anthropicMessagesApi() }));

const ctx = { systemPrompt: "Extract.", messages: [{ role: "user", content: "Peugeot 206, 1399", timestamp: Date.now() }] };

// 1) OpenAI Chat Completions route; onPayload adds a strict json_schema response_format.
const oaiBody = sse([
  { data: { id: "chatcmpl-1", object: "chat.completion.chunk", model: "gpt-5-mini-2026-01-01", choices: [{ index: 0, delta: { role: "assistant", content: "{\"make\":\"Peugeot\"}" }, finish_reason: null }] } },
  { data: { id: "chatcmpl-1", object: "chat.completion.chunk", model: "gpt-5-mini-2026-01-01", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] } },
  { data: { id: "chatcmpl-1", object: "chat.completion.chunk", model: "gpt-5-mini-2026-01-01", choices: [], usage: { prompt_tokens: 1000, completion_tokens: 200, total_tokens: 1200, prompt_tokens_details: { cached_tokens: 400 }, completion_tokens_details: { reasoning_tokens: 50 } } } },
  { data: "[DONE]" },
]);
const m1 = await models.complete(models.getModel("metis-openai", "gpt-5-mini"), ctx, {
  fetch: fakeFetch(() => oaiBody),
  onPayload: (p) => ({ ...p, response_format: { type: "json_schema", json_schema: { name: "Listing", strict: true, schema: { type: "object", properties: { make: { type: "string" } }, required: ["make"], additionalProperties: false } } } }),
  onResponse: (r) => console.log("onResponse headers x-request-id:", r.headers["x-request-id"]),
});
console.log("OAI url:", seen[0].url, "| auth:", seen[0].headers.authorization?.slice(0, 13), "| stream:", seen[0].body.stream, "| response_format.type:", seen[0].body.response_format?.type);
console.log("OAI msg:", JSON.stringify({ text: m1.content.map((c) => c.text).join(""), model: m1.model, responseModel: m1.responseModel, responseId: m1.responseId, stopReason: m1.stopReason, rawStopReason: m1.rawStopReason, usage: m1.usage }));

// 2) Anthropic Messages route; the reply is a refusal.
const antBody = sse([
  { event: "message_start", data: { type: "message_start", message: { id: "msg_1", type: "message", role: "assistant", model: "claude-x-20260101", content: [], stop_reason: null, usage: { input_tokens: 500, output_tokens: 1, cache_read_input_tokens: 100, cache_creation_input_tokens: 50 } } } },
  { event: "message_delta", data: { type: "message_delta", delta: { stop_reason: "refusal", stop_details: null }, usage: { output_tokens: 3 } } },
  { event: "message_stop", data: { type: "message_stop" } },
]);
const m2 = await models.complete(models.getModel("metis-anthropic", "claude-x"), ctx, { fetch: fakeFetch(() => antBody) });
console.log("ANT url:", seen[1].url, "| x-api-key:", seen[1].headers["x-api-key"], "| anthropic-beta:", seen[1].headers["anthropic-beta"] ?? "(none)", "| stream:", seen[1].body.stream);
console.log("ANT msg:", JSON.stringify({ stopReason: m2.stopReason, rawStopReason: m2.rawStopReason, errorMessage: m2.errorMessage, responseModel: m2.responseModel, responseId: m2.responseId, usage: m2.usage }));

// 3) Faux provider.
const faux = fauxProvider();
models.setProvider(faux.provider);
faux.setResponses([fauxAssistantMessage([fauxText("{\"make\":\"Saipa\"}")])]);
const m3 = await models.complete(faux.getModel(), ctx);
console.log("FAUX:", JSON.stringify({ text: m3.content[0].text, stopReason: m3.stopReason, usage: m3.usage.input + "/" + m3.usage.output }));
const m4 = await models.complete(faux.getModel(), ctx);
console.log("FAUX empty queue:", m4.stopReason, m4.errorMessage);
