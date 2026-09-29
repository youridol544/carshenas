// Mastra structuring-model retry with a validation error; stub answers streaming requests with SSE. No network.
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
  if (body.stream) {
    const chunks = [
      { id: "c", object: "chat.completion.chunk", created: 1, model: "m", choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }] },
      { id: "c", object: "chat.completion.chunk", created: 1, model: "m", choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } },
    ];
    const sse = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n";
    return new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } });
  }
  return new Response(JSON.stringify({ id: "c", object: "chat.completion", created: 1, model: "m", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }), { status: 200, headers: { "content-type": "application/json" } });
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
    const sys = msgs.filter((m) => m.role === "system").map((m) => String(m.content).slice(0, 260));
    const tail = msgs.slice(-1).map((m) => `${m.role}: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`.slice(0, 200));
    console.log(`call ${i + 1}: stream=${!!b.stream} response_format=${b.response_format?.type ?? "none"}\n  system:`, JSON.stringify(sys), "\n  last:", JSON.stringify(tail));
  });
}

await run("structuring model + maxProcessorRetries 2 (bad then good)", { maxProcessorRetries: 2 }, { structuredOutput: { schema: Listing, model } }, ["Peugeot 405 from 1398", "{\"make\":\"Peugeot\",\"year\":\"new\"}"]);
await run("direct structuredOutput, jsonPromptInjection, bad", {}, { structuredOutput: { schema: Listing, jsonPromptInjection: true } }, ["{\"make\":\"Peugeot\",\"year\":\"new\"}"]);
