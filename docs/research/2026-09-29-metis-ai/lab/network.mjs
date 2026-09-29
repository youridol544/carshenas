// Which way this machine's traffic goes to each host, without recording any address: the country Cloudflare sees for
// this network, TCP connection times (DNS resolved first, so it is not counted), and how many hops answer a
// traceroute (Linux tracepath). A path that answers hop by hop, with a connection time a domestic round trip allows,
// is the ISP's own; a path whose hops never answer and whose connection completes faster than the distance allows is
// a local proxy. Nothing here needs the key.
import { spawnSync } from 'node:child_process';
import { lookup } from 'node:dns/promises';
import net from 'node:net';
import { median, writeResults } from './lib.mjs';

const HOSTS = ['api.metisai.ir', 'api.avalai.ir', 'api.gapgpt.app', 'www.cloudflare.com'];
const CONNECTS = 5;

function connectOnce(address) {
  return new Promise((resolve) => {
    const started = performance.now();
    const socket = net.connect({ host: address, port: 443 });
    socket.setTimeout(10_000);
    socket.once('connect', () => {
      resolve(Math.round((performance.now() - started) * 10) / 10);
      socket.destroy();
    });
    socket.once('timeout', () => {
      resolve(null);
      socket.destroy();
    });
    socket.once('error', () => resolve(null));
  });
}

function tracepath(host) {
  const run = spawnSync('tracepath', ['-n', '-m', '12', host], { encoding: 'utf8', timeout: 90_000 });
  if (run.error) return { error: String(run.error.message) };
  const hops = new Map();
  for (const line of run.stdout.split('\n')) {
    const match = line.match(/^\s*(\d+)\??:\s+(\S+)\s+(?:([\d.]+)ms)?/);
    if (!match) continue;
    const [, hop, first, ms] = match;
    const replied = first !== 'no' && first !== '[LOCALHOST]' && ms !== undefined;
    const previous = hops.get(hop);
    if (!previous || (replied && !previous.replied)) hops.set(hop, { replied, ms: replied ? Number(ms) : null });
  }
  const answered = [...hops.values()].filter((hop) => hop.replied);
  return {
    hopsAnswered: answered.length,
    hopsSilent: [...hops.values()].filter((hop) => !hop.replied).length,
    slowestReplyMs: answered.length ? Math.max(...answered.map((hop) => hop.ms)) : null,
  };
}

const trace = await (await fetch('https://www.cloudflare.com/cdn-cgi/trace', { signal: AbortSignal.timeout(20_000) })).text();
const field = (name) => trace.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1] ?? null;
const results = { ranAt: new Date().toISOString(), cloudflareSees: { loc: field('loc'), colo: field('colo') }, hosts: {} };
console.log(`cloudflare sees this network as loc=${results.cloudflareSees.loc} (edge ${results.cloudflareSees.colo})`);

for (const host of HOSTS) {
  const { address } = await lookup(host);
  const times = [];
  for (let attempt = 0; attempt < CONNECTS; attempt += 1) times.push(await connectOnce(address));
  const path = tracepath(host);
  results.hosts[host] = { connectMsMedian: median(times), connectMs: times, ...path };
  console.log(
    `${host.padEnd(20)} connect median ${String(median(times)).padStart(6)} ms  hops answered ${String(path.hopsAnswered ?? '-').padStart(2)}, silent ${String(path.hopsSilent ?? '-').padStart(2)}, slowest reply ${path.slowestReplyMs ?? '-'} ms`,
  );
}

console.log(`wrote ${writeResults('network', results)}`);
