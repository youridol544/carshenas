import 'server-only';
import { headers } from 'next/headers';
import { clientAddress } from '@/server/auth/client-address';

/** The address of the request being served, coarsened (client-address.ts); `unknown` outside a request. */
export async function currentClientAddress(): Promise<string> {
  try {
    return clientAddress(await headers());
  } catch {
    return 'unknown';
  }
}
