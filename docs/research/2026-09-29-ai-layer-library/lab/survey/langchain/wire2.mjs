// Retry behaviour on schema violations and empty tool calls, with a stub fetch. No network.
import * as z from "zod";
import { ChatOpenAICompletions } from "@langchain/openai";
import { fakeModel } from "@langchain/core/testing";
import { AIMessage } from "@langchain/core/messages";

const Listing = z.object({ make: z.string(), year: z.number().int() });
let calls = 0;
const stub = (content, extra = {}) => async () => {
  calls++;
  return new Response(
    JSON.stringify({ id: "c", object: "chat.completion", created: 1, model: "m", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content, refusal: null, ...extra } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
};
async function run(name, fn) {
  calls = 0;
  const t0 = Date.now();
  try {
    console.log(`\n### ${name}\nresult:`, JSON.stringify(await fn()));
  } catch (e) {
    console.log(`\n### ${name}\nERROR ${e?.constructor?.name}: ${String(e?.message).slice(0, 200)}`);
  }
  console.log("http calls:", calls, "ms:", Date.now() - t0);
}
const base = "https://api.metisai.ir/openai/v1";
await run("schema violation, model maxRetries 2 (jsonSchema)", async () => {
  const m = new ChatOpenAICompletions({ model: "gpt-5.4-mini", apiKey: "x", maxRetries: 2, configuration: { baseURL: base, fetch: stub("{\"make\":\"Peugeot\",\"year\":\"new\"}") } });
  return await m.withStructuredOutput(Listing).invoke("x");
});
await run("functionCalling, reply without tool call", async () => {
  const m = new ChatOpenAICompletions({ model: "gpt-5.4-mini", apiKey: "x", maxRetries: 0, configuration: { baseURL: base, fetch: stub("sorry") } });
  return await m.withStructuredOutput(Listing, { method: "functionCalling" }).invoke("x");
});
await run("functionCalling, invalid args", async () => {
  const m = new ChatOpenAICompletions({ model: "gpt-5.4-mini", apiKey: "x", maxRetries: 0, configuration: { baseURL: base, fetch: stub(null, { tool_calls: [{ id: "t1", type: "function", function: { name: "extract", arguments: "{\"make\":\"Peugeot\",\"year\":\"new\"}" } }] }) } });
  return await m.withStructuredOutput(Listing, { method: "functionCalling" }).invoke("x");
});
await run("fakeModel with structured output", async () => {
  const m = fakeModel().respond(new AIMessage("{\"make\":\"Peugeot\",\"year\":1398}"));
  return await m.withStructuredOutput(Listing).invoke("x");
});
