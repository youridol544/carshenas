// Offline: a fake client that fails; a custom logger is supplied. Does instructor-js still print the prompt to the console?
import Instructor from "@instructor-ai/instructor";
import { z } from "zod/v3";

const client = Instructor({
  client: {
    baseURL: "https://api.metisai.ir/openai/v1",
    chat: { completions: { create: async () => { throw new Error("HTTP 500 from gateway"); } } },
  },
  mode: "JSON",
  logger: () => {},
});
try {
  await client.chat.completions.create({
    model: "m",
    messages: [{ role: "user", content: "SELLER PHONE 0912-000-0000" }],
    response_model: { schema: z.object({ a: z.string() }), name: "X" },
  });
} catch (e) {
  console.log("threw:", e.message);
}
