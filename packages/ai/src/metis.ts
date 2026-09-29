// Metis AI's native routes (ADR-0019 point 2) through the AI SDK's provider packages (ADR-0021 point 1). Each provider
// is created with Metis's base URL and the one key; nothing else about the providers changes. The registry names a
// model as a ModelChoice, never as a string: the SDK sends a string model id to Vercel's AI Gateway.
import { createAnthropic, type AnthropicLanguageModelOptions } from '@ai-sdk/anthropic';
import { createDeepSeek, type DeepSeekLanguageModelChatOptions } from '@ai-sdk/deepseek';
import { createGoogleGenerativeAI, type GoogleLanguageModelOptions } from '@ai-sdk/google';
import { createOpenAI, type OpenAILanguageModelChatOptions } from '@ai-sdk/openai';
import type { LanguageModelV4, SharedV4ProviderOptions } from '@ai-sdk/provider';
import { toJsonObject } from './json.ts';

export const METIS_BASE_URL = 'https://api.metisai.ir';

export const PROVIDERS = ['openai', 'anthropic', 'google', 'deepseek'] as const;
export type Provider = (typeof PROVIDERS)[number];

/** The provider's own options for one model: reasoning effort, thinking and the like. */
export type ProviderOptionsOf = {
  readonly openai: OpenAILanguageModelChatOptions;
  readonly anthropic: AnthropicLanguageModelOptions;
  readonly google: GoogleLanguageModelOptions;
  readonly deepseek: DeepSeekLanguageModelChatOptions;
};

/**
 * A model as the registry names it: which native route, the maker's model id as Metis's route takes it
 * (`claude-haiku-4-5`, not the catalogue's `claude-haiku-4.5`), and its options. Switching a task's model is
 * replacing one of these.
 */
export type ModelChoice = {
  readonly [P in Provider]: {
    readonly provider: P;
    readonly id: string;
    readonly options: ProviderOptionsOf[P];
  };
}[Provider];

/** An OpenAI model on Chat Completions with json_schema strict (ADR-0019 point 2). */
export function openai(id: string, options: OpenAILanguageModelChatOptions = {}): ModelChoice {
  return { provider: 'openai', id, options };
}

/** A Claude model on Anthropic's Messages route with output_config.format. */
export function anthropic(id: string, options: AnthropicLanguageModelOptions = {}): ModelChoice {
  return { provider: 'anthropic', id, options };
}

/** A Gemini model on generateContent with responseJsonSchema. */
export function google(id: string, options: GoogleLanguageModelOptions = {}): ModelChoice {
  return { provider: 'google', id, options };
}

/** A DeepSeek model in JSON mode, the schema in a system message (its route refuses json_schema). */
export function deepseek(id: string, options: DeepSeekLanguageModelChatOptions = {}): ModelChoice {
  return { provider: 'deepseek', id, options };
}

/** `openai/gpt-5.6-luna`: how logs and the cache name a model. */
export function modelName(choice: ModelChoice): string {
  return `${choice.provider}/${choice.id}`;
}

export type MetisConnection = {
  readonly apiKey: string;
  /** The global fetch by default; tests replay recorded answers through a stub, scripts record timings. */
  readonly fetch?: typeof globalThis.fetch;
};

/** Turns a registry's model choice into the SDK's model object, on Metis's route for that provider. */
export type ModelResolver = (choice: ModelChoice) => LanguageModelV4;

export function metisModels({ apiKey, fetch }: MetisConnection): ModelResolver {
  const routes = {
    // `.chat()` is Chat Completions, which Metis documents; `openai(id)` would use the Responses API (CS-44).
    openai: createOpenAI({ apiKey, baseURL: `${METIS_BASE_URL}/openai/v1`, fetch }),
    anthropic: createAnthropic({ apiKey, baseURL: `${METIS_BASE_URL}/anthropic/v1`, fetch }),
    google: createGoogleGenerativeAI({ apiKey, baseURL: `${METIS_BASE_URL}/v1beta`, fetch }),
    deepseek: createDeepSeek({ apiKey, baseURL: `${METIS_BASE_URL}/deepseek/v1`, fetch }),
  };
  return (choice) => {
    switch (choice.provider) {
      case 'openai':
        return routes.openai.chat(choice.id);
      case 'anthropic':
        return routes.anthropic(choice.id);
      case 'google':
        return routes.google(choice.id);
      case 'deepseek':
        return routes.deepseek(choice.id);
    }
  };
}

/**
 * The provider options one call sends: the model's own, plus the structured-output settings the layer never leaves to
 * a default. Anthropic's package uses output_config.format only for model ids it recognises and falls back to a JSON
 * tool for the rest (CS-44), so the mode is set for every Claude model; OpenAI's and Google's strict modes are
 * already their defaults and are set anyway, so a changed default cannot switch them off.
 */
export function providerOptionsFor(choice: ModelChoice): SharedV4ProviderOptions {
  switch (choice.provider) {
    case 'openai':
      return { openai: toJsonObject({ ...choice.options, strictJsonSchema: true }) };
    case 'anthropic':
      return { anthropic: toJsonObject({ ...choice.options, structuredOutputMode: 'outputFormat' }) };
    case 'google':
      return { google: toJsonObject({ ...choice.options, structuredOutputs: true }) };
    case 'deepseek':
      return { deepseek: toJsonObject(choice.options) };
  }
}
