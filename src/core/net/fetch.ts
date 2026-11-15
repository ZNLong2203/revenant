/**
 * The one way Revenant talks to the outside web: SSRF-checked on every
 * redirect hop, size- and time-bounded, and honest about why a fetch failed.
 */
import type { LiveObservation } from "../types";
import { htmlTitle, htmlToText } from "../text";
import { hostOf } from "../url";
import { assertPublicUrl, BlockedAddressError } from "./guard";
import { withHostLimit } from "./limiter";

export const USER_AGENT =
  process.env.REVENANT_USER_AGENT ||
  "Mozilla/5.0 (compatible; RevenantBot/0.1; +https://github.com/ZNLong2203/revenant; link-rot research)";

export interface FetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
  /** Skip the SSRF check (only for fixed, known hosts like the Wayback API). */
  trusted?: boolean;
}

export interface RawResponse {
  status: number;
  finalUrl: string;
  redirects: string[];
  headers: Headers;
  body: string;
}

export class FetchFailure extends Error {
  constructor(
    public kind: "dns" | "timeout" | "refused" | "tls" | "blocked" | "too-large" | "other",
    message: string,
  ) {
    super(message);
  }
}

function classify(error: unknown): FetchFailure {
  if (error instanceof FetchFailure) return error;
  if (error instanceof BlockedAddressError) return new FetchFailure("blocked", error.message);
  const e = error as { name?: string; code?: string; cause?: { code?: string; message?: string }; message?: string };
  const code = e?.cause?.code ?? e?.code ?? "";
  if (e?.name === "AbortError" || e?.name === "TimeoutError" || /TIMEOUT/i.test(code)) return new FetchFailure("timeout", "timed out");
  if (/ENOTFOUND|EAI_AGAIN|EAI_NONAME|ENODATA/.test(code)) return new FetchFailure("dns", "domain does not resolve");
  if (/ECONNREFUSED|EHOSTUNREACH|ENETUNREACH/.test(code)) return new FetchFailure("refused", "connection refused");
  if (/CERT|SSL|TLS|SELF_SIGNED|ALTNAME/i.test(code) || /certificate|ssl|tls/i.test(e?.cause?.message ?? "")) {
    return new FetchFailure("tls", "TLS certificate problem");
  }
  return new FetchFailure("other", e?.cause?.message ?? e?.message ?? "fetch failed");
}

function charsetOf(contentType: string | null): string {
  const m = contentType?.match(/charset=([\w-]+)/i);
  return m ? m[1].toLowerCase() : "utf-8";
}

/**
 * Reject when `promise` has not settled by `deadline` (epoch ms). The abort
 * signal given to fetch is supposed to end a stalled body too, but a server that
 * answers 200 and then goes quiet has been seen to leave `read()` waiting for
 * ever (zeusnews.it, found by a census), so every read also races a timer.
 */
function before<T>(promise: Promise<T>, deadline: number, onTimeout: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const give = () => {
      onTimeout();
      reject(new FetchFailure("timeout", "timed out"));
    };
    const left = deadline - Date.now();
    if (left <= 0) return give();
    const timer = setTimeout(give, left);
    promise.then(
      (v) => (clearTimeout(timer), resolve(v)),
      (e) => (clearTimeout(timer), reject(e)),
    );
  });
}

async function readBounded(res: Response, maxBytes: number, deadline: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const stop = () => void reader.cancel().catch(() => {});
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await before(reader.read(), deadline, stop);
    if (done) break;
    size += value.byteLength;
    chunks.push(value);
    if (size >= maxBytes) {
      stop();
      break;
    }
  }
  const buf = new Uint8Array(Math.min(size, maxBytes));
  let off = 0;
  for (const c of chunks) {
    const take = Math.min(c.byteLength, buf.length - off);
    buf.set(c.subarray(0, take), off);
    off += take;
    if (off >= buf.length) break;
  }
  let charset = charsetOf(res.headers.get("content-type"));
  if (charset === "utf-8") {
    const head = new TextDecoder("latin1").decode(buf.subarray(0, 2048));
    const meta = head.match(/<meta[^>]+charset=["']?([\w-]+)/i);
    if (meta) charset = meta[1].toLowerCase();
  }
  try {
    return new TextDecoder(charset, { fatal: false }).decode(buf);
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}

export async function safeFetch(url: string, opts: FetchOptions = {}): Promise<RawResponse> {
  const { timeoutMs = 12_000, maxBytes = 1_500_000, maxRedirects = 6, headers = {}, trusted = false } = opts;
  const redirects: string[] = [];
  let current = url;
  try {
    for (let hop = 0; hop <= maxRedirects; hop++) {
      if (!trusted) await assertPublicUrl(current);
      // the clock starts once this hop holds a host slot, not while it waits in
      // the per-host queue (waiting used to time requests out before they ran)
      let deadline = 0;
      const res = await withHostLimit(hostOf(current), () => {
        deadline = Date.now() + timeoutMs;
        return fetch(current, {
          redirect: "manual",
          signal: AbortSignal.timeout(timeoutMs),
          headers: {
            "user-agent": USER_AGENT,
            accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "accept-language": "en;q=0.9,*;q=0.5",
            ...headers,
          },
        });
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        const next = new URL(res.headers.get("location")!, current).toString();
        void res.body?.cancel().catch(() => {});
        redirects.push(next);
        current = next;
        continue;
      }
      const type = res.headers.get("content-type") ?? "";
      const textual = !type || /text|html|xml|json|javascript/i.test(type);
      if (!textual) void res.body?.cancel().catch(() => {});
      const body = textual ? await readBounded(res, maxBytes, deadline) : "";
      return { status: res.status, finalUrl: current, redirects, headers: res.headers, body };
    }
    throw new FetchFailure("other", "too many redirects");
  } catch (error) {
    throw classify(error);
  }
}

/** Fetch a page and summarise what a reader would see. Never throws. */
export async function observeLive(url: string, opts: FetchOptions = {}): Promise<LiveObservation> {
  const fetchedAt = new Date().toISOString();
  try {
    const r = await safeFetch(url, opts);
    const type = r.headers.get("content-type") ?? undefined;
    const isHtml = !type || /html|xml/i.test(type);
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      finalUrl: r.finalUrl,
      redirects: r.redirects,
      title: isHtml ? htmlTitle(r.body) : undefined,
      text: isHtml ? htmlToText(r.body, 6000) : r.body.slice(0, 6000),
      contentType: type,
      fetchedAt,
    };
  } catch (error) {
    const f = classify(error);
    return { ok: false, redirects: [], error: f.message, errorKind: f.kind, fetchedAt };
  }
}
