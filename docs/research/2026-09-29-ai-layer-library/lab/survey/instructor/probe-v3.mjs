// Local probe: no network. A fake OpenAI-like client records requests and returns canned replies.
import Instructor from "@instructor-ai/instructor";
import { z } from "zod/v3";

const Listing = z.object({
  make: z.string(),
  modelYear: z.number().int(),
});

const requests = [];
function fakeClient(replies) {
  let i = 0;
  return {
    baseURL: "https://api.metisai.ir/openai/v1",
    chat: {
      completions: {
        create: async (params) => {
          requests.push(params);
          const content = replies[Math.min(i++, replies.length - 1)];
          return {
            id: "chatcmpl-fake",
            model: "gpt-fake",
            choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          };
        },
      },
    },
  };
}

for (const mode of ["JSON_SCHEMA", "TOOLS"]) {
  requests.length = 0;
  const client = Instructor({ client: fakeClient(['{"make":"Peugeot","modelYear":1399}']), mode });
  try {
    const out = await client.chat.completions.create({
      model: "gpt-fake",
      messages: [{ role: "user", content: "x" }],
      response_model: { schema: Listing, name: "Listing" },
    });
    console.log(mode, "result:", JSON.stringify(out));
  } catch (e) {
    console.log(mode, "threw:", e?.constructor?.name, e?.message?.slice(0, 200));
  }
  const p = requests[0];
  console.log(mode, "wire response_format:", JSON.stringify(p?.response_format));
  console.log(mode, "wire tools:", JSON.stringify(p?.tools));
}

// Validation failure with a retry: does the re-ask path work with zod 4?
requests.length = 0;
const client = Instructor({
  client: fakeClient(['{"make":"Peugeot","modelYear":"not a number"}', '{"make":"Peugeot","modelYear":1399}']),
  mode: "JSON",
});
try {
  const out = await client.chat.completions.create({
    model: "gpt-fake",
    messages: [{ role: "user", content: "x" }],
    response_model: { schema: Listing, name: "Listing" },
    max_retries: 2,
  });
  console.log("retry result:", JSON.stringify(out));
} catch (e) {
  console.log("retry threw:", e?.constructor?.name, String(e?.message).slice(0, 300));
}
console.log("requests made:", requests.length);
if (requests[1]) console.log("re-ask last message:", JSON.stringify(requests[1].messages.at(-1)));
