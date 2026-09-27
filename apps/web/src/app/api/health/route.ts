import { connection } from 'next/server';
import { databaseHealthResponse } from '@/server/db/database-health';

// Health of the web app and its database (docs/runbooks/local-database.md).
export async function GET() {
  // Always at request time: a response prerendered by `next build` would describe the build machine's database.
  await connection();
  return databaseHealthResponse();
}
