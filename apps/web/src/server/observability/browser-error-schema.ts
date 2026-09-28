import 'server-only';
import * as z from 'zod';

// The body a browser posts to /api/client-errors: the BrowserErrorReport of @carshenas/observability/browser. It
// arrives from the open internet, so every field is bounded and anything else is dropped.

const MAX_MESSAGE = 4_000;
const MAX_STACK = 16_000;

type ReportedError = {
  type: string;
  message: string;
  stack?: string | undefined;
  code?: string | number | undefined;
  digest?: string | undefined;
  cause?: ReportedError | undefined;
  errors?: ReportedError[] | undefined;
};

const reportedErrorSchema: z.ZodType<ReportedError> = z.object({
  type: z.string().max(200),
  message: z.string().max(MAX_MESSAGE),
  stack: z.string().max(MAX_STACK).optional(),
  code: z.union([z.string().max(200), z.number()]).optional(),
  digest: z.string().max(200).optional(),
  get cause() {
    return reportedErrorSchema.optional();
  },
  get errors() {
    return z.array(reportedErrorSchema).max(10).optional();
  },
});

export const browserErrorReportSchema = z.object({
  kind: z.enum(['uncaught', 'unhandledrejection', 'boundary']),
  reference: z.string().regex(/^\d{10}$/),
  path: z.string().max(2_000).startsWith('/'),
  error: reportedErrorSchema,
});

export type BrowserErrorReportBody = z.infer<typeof browserErrorReportSchema>;
