// Captures what each LangChain adapter puts on the wire, using a stub fetch. No network.
import * as z from "zod";
import { ChatOpenAICompletions, ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogle } from "@langchain/google";
import { ChatDeepSeek } from "@langchain/deepseek";

const Listing = z.object({ make: z.string(), year: z.number().int(), note: z.string().optional() });
const log = [];
function stubFetch(responder) {
  return async (input, init) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const body = await req.clone().text();
    const headers = Object.fromEntries(
      [...req.headers].map(([k, v]) => [k, /key|authorization/i.test(k) ? "<redacted>" : v])
    );
    log.push({ url: req.url, headers, body: body ? JSON.parse(body) : null });
    const [status, json, extraHeaders] = responder();
    return new Response(JSON.stringify(json), {
      status,
      headers: { "content-type": "application/json", "x-request-id": "req_stub_1", "request-id": "req_stub_1", ...(extraHeaders || {}) },
    });
  };
}
async function run(name, fn) {
  log.length = 0;
  const t0 = Date.now();
  try {
    const out = await fn();
    console.log(`\n### ${name}\nresult:`, JSON.stringify(out));
  } catch (e) {
    console.log(`\n### ${name}\nERROR ${e?.constructor?.name}/${e?.name}: ${String(e?.message).slice(0, 400)}`);
  }
  for (const l of log) console.log("url:", l.url, "\nheaders:", JSON.stringify(l.headers), "\nbody:", JSON.stringify(l.body));
  console.log("calls:", log.length, "ms:", Date.now() - t0);
}
const oaOk = () => [200, { id: "chatcmpl-1", object: "chat.completion", created: 1, model: "gpt-5.4-mini-2026-01-01", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "{\"make\":\"Peugeot\",\"year\":1398}", refusal: null } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, prompt_tokens_details: { cached_tokens: 4 }, completion_tokens_details: { reasoning_tokens: 0 } } }];
const oaLength = () => [200, { id: "chatcmpl-2", object: "chat.completion", created: 1, model: "gpt-5.4-mini", choices: [{ index: 0, finish_reason: "length", message: { role: "assistant", content: "{\"make\":\"Peu", refusal: null } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }];
const oaRefusal = () => [200, { id: "chatcmpl-3", object: "chat.completion", created: 1, model: "gpt-5.4-mini", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: null, refusal: "I can't help with that." } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }];
const oaBadSchema = () => [200, { id: "chatcmpl-4", object: "chat.completion", created: 1, model: "gpt-5.4-mini", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "{\"make\":\"Peugeot\",\"year\":\"new\"}", refusal: null } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }];

const base = "https://api.metisai.ir/openai/v1";
await run("ChatOpenAICompletions jsonSchema default", async () => {
  const m = new ChatOpenAICompletions({ model: "gpt-5.4-mini", apiKey: "x", maxRetries: 0, configuration: { baseURL: base, fetch: stubFetch(oaOk) } });
  const r = await m.withStructuredOutput(Listing, { includeRaw: true }).invoke("x");
  return { parsed: r.parsed, usage: r.raw.usage_metadata, meta: r.raw.response_metadata, id: r.raw.id };
});
await run("ChatOpenAI model gpt-5.6 (auto-routing)", async () => {
  const m = new ChatOpenAI({ model: "gpt-5.6", apiKey: "x", maxRetries: 0, configuration: { baseURL: base, fetch: stubFetch(oaOk) } });
  return (await m.invoke("x")).content;
});
await run("OpenAI finish_reason length, maxRetries 2 on the call", async () => {
  const m = new ChatOpenAICompletions({ model: "gpt-5.4-mini", apiKey: "x", maxRetries: 2, configuration: { baseURL: base, fetch: stubFetch(oaLength) } });
  return await m.withStructuredOutput(Listing).invoke("x");
});
await run("OpenAI refusal", async () => {
  const m = new ChatOpenAICompletions({ model: "gpt-5.4-mini", apiKey: "x", maxRetries: 0, configuration: { baseURL: base, fetch: stubFetch(oaRefusal) } });
  return await m.withStructuredOutput(Listing).invoke("x");
});
await run("OpenAI schema violation", async () => {
  const m = new ChatOpenAICompletions({ model: "gpt-5.4-mini", apiKey: "x", maxRetries: 0, configuration: { baseURL: base, fetch: stubFetch(oaBadSchema) } });
  return await m.withStructuredOutput(Listing).invoke("x");
});

const anOk = () => [200, { id: "msg_1", type: "message", role: "assistant", model: "claude-sonnet-4-6", stop_reason: "end_turn", stop_sequence: null, content: [{ type: "text", text: "{\"make\":\"Peugeot\",\"year\":1398}" }], usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 3, cache_creation_input_tokens: 2 } }];
const anRefusal = () => [200, { id: "msg_2", type: "message", role: "assistant", model: "claude-sonnet-4-6", stop_reason: "refusal", stop_sequence: null, content: [], usage: { input_tokens: 10, output_tokens: 0 } }];
await run("ChatAnthropic jsonSchema", async () => {
  const m = new ChatAnthropic({ model: "claude-sonnet-4-6", apiKey: "x", maxRetries: 0, anthropicApiUrl: "https://api.metisai.ir/anthropic", clientOptions: { fetch: stubFetch(anOk) } });
  const r = await m.withStructuredOutput(Listing, { method: "jsonSchema", includeRaw: true }).invoke("x");
  return { parsed: r.parsed, usage: r.raw.usage_metadata, meta: r.raw.response_metadata };
});
await run("ChatAnthropic default (functionCalling)", async () => {
  const m = new ChatAnthropic({ model: "claude-sonnet-4-6", apiKey: "x", maxRetries: 0, anthropicApiUrl: "https://api.metisai.ir/anthropic", clientOptions: { fetch: stubFetch(anOk) } });
  return await m.withStructuredOutput(Listing).invoke("x");
});
await run("ChatAnthropic refusal jsonSchema includeRaw", async () => {
  const m = new ChatAnthropic({ model: "claude-sonnet-4-6", apiKey: "x", maxRetries: 0, anthropicApiUrl: "https://api.metisai.ir/anthropic", clientOptions: { fetch: stubFetch(anRefusal) } });
  const r = await m.withStructuredOutput(Listing, { method: "jsonSchema", includeRaw: true }).invoke("x");
  return { parsed: r.parsed, stop: r.raw.response_metadata.stop_reason };
});
await run("ChatAnthropic refusal jsonSchema (throws?)", async () => {
  const m = new ChatAnthropic({ model: "claude-sonnet-4-6", apiKey: "x", maxRetries: 0, anthropicApiUrl: "https://api.metisai.ir/anthropic", clientOptions: { fetch: stubFetch(anRefusal) } });
  return await m.withStructuredOutput(Listing, { method: "jsonSchema" }).invoke("x");
});

const gOk = () => [200, { candidates: [{ content: { role: "model", parts: [{ text: "{\"make\":\"Peugeot\",\"year\":1398}" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15, cachedContentTokenCount: 2, thoughtsTokenCount: 1 }, modelVersion: "gemini-3-flash", responseId: "resp_1" }];
await run("ChatGoogle jsonSchema", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = stubFetch(gOk);
  try {
    const m = new ChatGoogle({ model: "gemini-3-flash", apiKey: "x", maxRetries: 0, endpoint: "https://api.metisai.ir" });
    const r = await m.withStructuredOutput(Listing, { method: "jsonSchema", includeRaw: true }).invoke("x");
    return { parsed: r.parsed, usage: r.raw.usage_metadata, meta: r.raw.response_metadata };
  } finally {
    globalThis.fetch = origFetch;
  }
});

await run("ChatDeepSeek default structured", async () => {
  const m = new ChatDeepSeek({ model: "deepseek-chat", apiKey: "x", maxRetries: 0, configuration: { baseURL: "https://api.metisai.ir/deepseek/v1", fetch: stubFetch(oaOk) } });
  return await m.withStructuredOutput(Listing).invoke("x");
});
await run("ChatDeepSeek jsonMode", async () => {
  const m = new ChatDeepSeek({ model: "deepseek-chat", apiKey: "x", maxRetries: 0, configuration: { baseURL: "https://api.metisai.ir/deepseek/v1", fetch: stubFetch(oaOk) } });
  return await m.withStructuredOutput(Listing, { method: "jsonMode" }).invoke("x");
});
