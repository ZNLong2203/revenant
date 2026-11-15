/**
 * Regression: a census stopped for good on http://www.zeusnews.com/index.php3?ar=stampa&cod=923.
 * The site redirects to zeusnews.it, answers 200, and then never finishes the body. The abort
 * signal given to fetch did not end that read, so one link held a whole scan for ever.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { observeLive, safeFetch } from "../../src/core/net/fetch";

/** A server that sends headers and a first chunk, then goes quiet, and ignores the abort signal. */
function stalledBody() {
  return vi.stubGlobal("fetch", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("<html><title>half a page"));
      },
    });
    return new Response(body, { status: 200, headers: { "content-type": "text/html" } });
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("response bodies have a deadline", () => {
  it("gives up on a body that stalls, even when the abort signal is ignored", async () => {
    stalledBody();
    const started = Date.now();
    await expect(safeFetch("http://example.org/page", { trusted: true, timeoutMs: 300 })).rejects.toMatchObject({ kind: "timeout" });
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it("reports the link as a timeout, which examination treats as unknown", async () => {
    stalledBody();
    const obs = await observeLive("http://example.org/page", { trusted: true, timeoutMs: 300 });
    expect(obs).toMatchObject({ ok: false, errorKind: "timeout" });
  });

  it("still reads a normal body", async () => {
    vi.stubGlobal("fetch", async () => new Response("<html><title>fine</title>", { status: 200, headers: { "content-type": "text/html" } }));
    const r = await safeFetch("http://example.org/page", { trusted: true, timeoutMs: 300 });
    expect(r.body).toContain("fine");
  });
});
