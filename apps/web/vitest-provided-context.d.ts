// Values vitest.db.config.mts hands to the integration tests through `inject(...)`, so no test reads process.env.
import 'vitest';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseMigrateUrl: string;
  }
}
