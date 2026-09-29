// path: src/features/lint-selftest/server/lint-selftest-ai.ts
// expect: no-restricted-imports
// expect-message: Language models are called only through @carshenas/ai
import 'server-only';
// @ts-expect-error the web app does not depend on the AI SDK, which is the point: the editor must not report it
import { generateText } from 'ai';
// @ts-expect-error the same for a provider package
import { createOpenAI } from '@ai-sdk/openai';

export const direct: unknown[] = [generateText, createOpenAI];
