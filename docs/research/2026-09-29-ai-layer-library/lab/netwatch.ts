// Records every HTTP request this process starts, through Node's diagnostics channels (undici backs the built-in
// fetch; node:http backs the rest). Import it first, so it is listening before any library loads.
import { subscribe } from 'node:diagnostics_channel';

export const networkSeen: string[] = [];

subscribe('undici:request:create', (message) => {
  const { request } = message as { request: { origin?: string; path?: string } };
  networkSeen.push(`undici ${request.origin ?? ''}${request.path ?? ''}`);
});
subscribe('http.client.request.start', (message) => {
  const { request } = message as { request: { host?: string; path?: string } };
  networkSeen.push(`http ${request.host ?? ''}${request.path ?? ''}`);
});
