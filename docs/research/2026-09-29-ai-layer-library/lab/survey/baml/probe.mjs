// Offline: BAML modular API renders the HTTP request without sending it, and parses text without a model call.
import { b } from "./dist/index.js";

process.env.METIS_API_KEY = "sk-test";

for (const client of ["MetisOpenAI", "MetisClaude", "MetisGemini"]) {
  const req = await b.request.ExtractListing("Peugeot 206, 1399, CNG", { client });
  const body = req.body.json();
  console.log(client, "url:", req.url);
  console.log(client, "auth headers:", Object.keys(req.headers).filter((h) => /auth|key/i.test(h)).join(","));
  console.log(client, "body keys:", Object.keys(body).join(","));
  const text = JSON.stringify(body).slice(0, 4000);
  console.log(client, "schema in prompt:", /Answer in JSON using this schema/.test(text), "| response_format:", "response_format" in body, "| output_config:", "output_config" in body, "| generationConfig:", JSON.stringify(body.generationConfig ?? null));
}

// Schema-aligned parsing of sloppy output: prose around it, unquoted keys, trailing comma, wrong enum case.
const sloppy = 'Sure! Here you go:\n```json\n{ make: "Peugeot", modelYear: "1399", fuel: "cng", }\n```';
console.log("parse sloppy:", JSON.stringify(b.parse.ExtractListing(sloppy)));

// A failing @assert.
try {
  b.parse.ExtractListing('{"make":"Peugeot","modelYear":2020}');
} catch (e) {
  console.log("assert failure:", e.constructor.name, "|", String(e.message).split("\n").slice(0, 3).join(" / "));
}

// Truncated output (cut mid-object).
try {
  console.log("parse truncated:", JSON.stringify(b.parse.ExtractListing('{"make":"Peugeot","modelYear":1399,"fu')));
} catch (e) {
  console.log("truncated failure:", e.constructor.name, "|", String(e.message).split("\n")[0]);
}
