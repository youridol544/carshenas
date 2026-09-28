// A tiny worker for tracing.test.ts: with OTEL_EXPORTER_OTLP_ENDPOINT set by the test, one span reaches the
// collector through the standard variables alone, with no endpoint in the code.
import { otlpExporter, registerTracing, withSpan } from '../tracing.ts';

const tracing = registerTracing({
  service: 'carshenas-worker',
  version: 'test',
  environment: 'test',
  exporter: otlpExporter(),
});
await withSpan('crawl divar page', () => Promise.resolve(), { 'crawl.page': 3 });
await tracing?.shutdown();
