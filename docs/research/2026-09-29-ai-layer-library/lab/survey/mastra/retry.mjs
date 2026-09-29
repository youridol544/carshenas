// Does Mastra re-ask with the validation error? Stubbed global fetch, no network.
import * as z from "zod";
process.env.MASTRA_TELEMETRY_DISABLED = "1";
const { Agent } = await import("@mastra/core/agent");

const Listing = z.object({ make: z.string(), year: z.number().int() });
const log = [];
let replies = [];
globalThis.fetch = async (input, init) => {
  const req = input instanceof Request ? input : new Request(input, init);
  const body = JSON.parse(await req.clone().text());
  log.push(body);
  const content = replies.shift() ?? "{\"make\":\"Peugeot\",\"year\":1398}";
  return new Response(JSON.stringify({ id: "c" + log.length, object: "chat.completion", created: 1, model: "m", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }), { status: 200, headers: { "content-type": "application/json" } });
};
const model = { id: "openai/gpt-5.4-mini", url: "https://api.metisai.ir/openai/v1", apiKey: "x" };

async function run(name, agentOpts, genOpts, seq) {
  log.length = 0;
  replies = [...seq];
  const agent = new Agent({ id: "a", name: "a", instructions: "Extract.", model, ...agentOpts });
  try {
    const r = await agent.generate("Peugeot 405, model year 1398", genOpts);
    console.log(`\n### ${name}\nobject:`, JSON.stringify(r.object), "error:", r.error?.message?.slice(0, 200));
  } catch (e) {
    console.log(`\n### ${name}\nTHROWN ${e?.id ?? e?.constructor?.name}: ${String(e?.message).slice(0, 300)}`);
  }
  log.forEach((b, i) => {
    const msgs = b.messages ?? [];
    const last = msgs.slice(-2).map((m) => `${m.role}: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`.slice(0, 400));
    console.log(`call ${i + 1}: response_format=${b.response_format?.type ?? "none"} last messages:`, JSON.stringify(last));
  });
}

await run("direct structuredOutput + maxProcessorRetries 2 (bad then good)", { maxProcessorRetries: 2 }, { structuredOutput: { schema: Listing } }, ["{\"make\":\"Peugeot\",\"year\":\"new\"}"]);
await run("structuring model + maxProcessorRetries 2 (bad then good)", { maxProcessorRetries: 2 }, { structuredOutput: { schema: Listing, model } }, ["Peugeot 405 from 1398", "{\"make\":\"Peugeot\",\"year\":\"new\"}"]);
await run("structuring model, no maxProcessorRetries (bad)", {}, { structuredOutput: { schema: Listing, model } }, ["Peugeot 405 from 1398", "{\"make\":\"Peugeot\",\"year\":\"new\"}"]);
