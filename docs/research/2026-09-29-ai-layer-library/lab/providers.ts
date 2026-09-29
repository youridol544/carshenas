// The AI SDK's provider packages pointed at Metis's native routes (ADR-0019 point 2). Only the base URL and the key
// change; `fetch` is injectable so the wire check can stub it and the live run can time and record it.
import { createAnthropic } from '@ai-sdk/anthropic';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelV4 } from '@ai-sdk/provider';
import type { generateText } from 'ai';

type ProviderOptions = NonNullable<Parameters<typeof generateText>[0]['providerOptions']>;

export const METIS = 'https://api.metisai.ir';

export interface MetisRoute {
  id: string;
  /** Metis's route as ADR-0019 names it. */
  route: string;
  model: LanguageModelV4;
  modelId: string;
  maxOutputTokens: number;
  providerOptions?: ProviderOptions;
}

export function metisRoutes(apiKey: string, fetch: typeof globalThis.fetch): MetisRoute[] {
  const openai = createOpenAI({ apiKey, baseURL: `${METIS}/openai/v1`, fetch });
  const anthropic = createAnthropic({ apiKey, baseURL: `${METIS}/anthropic/v1`, fetch });
  const google = createGoogleGenerativeAI({ apiKey, baseURL: `${METIS}/v1beta`, fetch });
  const deepseek = createDeepSeek({ apiKey, baseURL: `${METIS}/deepseek/v1`, fetch });
  return [
    {
      id: 'openai-chat',
      route: '/openai/v1 Chat Completions',
      // `openai(id)` would use the Responses API; `.chat(id)` is Chat Completions, which Metis documents.
      model: openai.chat('gpt-5.6-luna'),
      modelId: 'gpt-5.6-luna',
      maxOutputTokens: 4096,
      providerOptions: { openai: { reasoningEffort: 'low' } },
    },
    {
      id: 'anthropic',
      route: '/anthropic Messages',
      model: anthropic('claude-haiku-4-5'),
      modelId: 'claude-haiku-4-5',
      maxOutputTokens: 1024,
    },
    {
      id: 'gemini',
      route: 'Gemini generateContent',
      model: google('gemini-3.1-flash-lite'),
      modelId: 'gemini-3.1-flash-lite',
      maxOutputTokens: 2048,
    },
    {
      id: 'deepseek',
      route: '/deepseek/v1 Chat Completions, JSON mode',
      model: deepseek('deepseek-v4-flash'),
      modelId: 'deepseek-v4-flash',
      maxOutputTokens: 4096,
    },
  ];
}

/** The model on OpenAI's route through the provider's default, which is the Responses API. */
export function openaiResponsesModel(apiKey: string, fetch: typeof globalThis.fetch): LanguageModelV4 {
  return createOpenAI({ apiKey, baseURL: `${METIS}/openai/v1`, fetch })('gpt-5.6-luna');
}

const AUTH_HEADERS = ['authorization', 'x-api-key', 'x-goog-api-key'];

/**
 * What a request puts on the wire, without the key or the listing text: the path, which header carries the key,
 * the other header names, and the parts of the body that decide structured output and the output budget.
 */
export function summariseRequest(input: string | URL | Request, init: RequestInit | undefined) {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const headers = new Headers(init?.headers);
  const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
  const messages = (body.messages ?? body.contents) as Array<{ role?: string; content?: unknown }> | undefined;
  const system = messages?.find((message) => message.role === 'system');
  const generationConfig = body.generationConfig as Record<string, unknown> | undefined;
  return {
    url: `${url.origin}${url.pathname}`,
    keyIn: AUTH_HEADERS.filter((name) => headers.has(name)),
    keyInQuery: url.searchParams.has('key'),
    otherHeaders: [...headers.keys()].filter((name) => !AUTH_HEADERS.includes(name)).sort(),
    betaHeader: headers.get('anthropic-beta'),
    bodyKeys: Object.keys(body).sort(),
    messageRoles: messages?.map((message) => message.role ?? 'user'),
    structuredOutput: {
      response_format: body.response_format,
      output_config: body.output_config,
      tools: body.tools,
      tool_choice: body.tool_choice,
      text: body.text,
      responseMimeType: generationConfig?.responseMimeType,
      responseJsonSchema: generationConfig?.responseJsonSchema,
      responseSchema: generationConfig?.responseSchema,
      schemaInSystemMessage:
        typeof system?.content === 'string' && system.content.includes('"paint_evidence"')
          ? system.content.slice(0, 60)
          : undefined,
    },
    outputBudget: {
      max_tokens: body.max_tokens,
      max_completion_tokens: body.max_completion_tokens,
      max_output_tokens: body.max_output_tokens,
      maxOutputTokens: generationConfig?.maxOutputTokens,
      reasoning_effort: body.reasoning_effort,
      reasoning: body.reasoning,
      thinking: body.thinking ?? generationConfig?.thinkingConfig,
    },
  };
}
