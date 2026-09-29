// Offline: does a static output_config in client options reach the Anthropic request body? Is the schema still in the prompt?
import { b } from "./dist/index.js";
process.env.METIS_API_KEY = "sk-test";
const req = await b.request.ExtractListing("Peugeot 206, 1399", { client: "MetisClaudeNative" });
const body = req.body.json();
console.log("body keys:", Object.keys(body).join(","));
console.log("output_config:", JSON.stringify(body.output_config));
console.log("schema still in prompt:", /Answer in JSON using this schema/.test(JSON.stringify(body.messages ?? body.system ?? body)));
console.log("headers:", Object.keys(req.headers).join(","), "| anthropic-version:", req.headers["anthropic-version"]);
