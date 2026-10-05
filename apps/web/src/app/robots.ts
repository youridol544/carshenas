import type { MetadataRoute } from 'next';
import { connection } from 'next/server';
import { robotsRules } from '@/lib/exposure';
import { env } from '@/server/env';

// robots.txt (CS-119, ADR-0017 point 10): the whole site is closed to crawlers while it is unlisted. Read per request, so
// CARSHENAS_UNLISTED switches it without a rebuild.
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  return robotsRules(env.exposure);
}
