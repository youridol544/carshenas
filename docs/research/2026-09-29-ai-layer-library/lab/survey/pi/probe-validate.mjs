// Offline: pi-ai tool-argument validation with a plain JSON Schema produced by zod 4, and a forced strict tool on the wire.
import { validateToolArguments, createModels, createProvider } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { z } from "zod";

const Listing = z.object({ make: z.string(), modelYear: z.number().int().min(1300).max(1500), fuel: z.enum(["PETROL", "CNG"]).optional() });
const tool = { name: "record_listing", description: "Record the listing", parameters: z.toJSONSchema(Listing), constrainedSampling: { type: "json_schema", strict: "require" } };

for (const args of [{ make: "Peugeot", modelYear: "1399" }, { make: "Peugeot", modelYear: 2020, fuel: "cng" }]) {
  try {
    console.log("valid ->", JSON.stringify(validateToolArguments(tool, { type: "toolCall", id: "c1", name: tool.name, arguments: args })));
  } catch (e) {
    console.log("invalid ->", JSON.stringify(e.message));
  }
}

// What goes on the wire for a forced strict tool on a custom Chat Completions model?
let wire;
const model = {
  id: "gpt-5-mini", name: "m", api: "openai-completions", provider: "metis-openai", baseUrl: "https://api.metisai.ir/openai/v1",
  reasoning: false, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 1000, maxTokens: 100,
  compat: { supportsStrictMode: true },
};
const models = createModels();
models.setProvider(createProvider({ id: "metis-openai", auth: { apiKey: { name: "k", resolve: async () => ({ auth: { apiKey: "sk" } }) } }, models: [model], api: openAICompletionsApi() }));
const fetchStub = async (_url, init) => { wire = JSON.parse(init.body); return new Response("data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } }); };
const res = await models.complete(models.getModel("metis-openai", "gpt-5-mini"), { messages: [{ role: "user", content: "x", timestamp: Date.now() }], tools: [tool] }, { fetch: fetchStub, toolChoice: { type: "function", function: { name: tool.name } } });
console.log("wire tool:", JSON.stringify(wire.tools?.[0]).slice(0, 400));
console.log("wire tool tail:", JSON.stringify(wire.tools?.[0]).slice(-120));
console.log("wire tool_choice:", JSON.stringify(wire.tool_choice));
console.log("empty stream result:", res.stopReason, res.errorMessage ?? "");
