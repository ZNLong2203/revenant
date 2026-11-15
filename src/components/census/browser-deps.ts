/**
 * The census engine's network calls, made from the browser through the same
 * API routes the scan page uses. A busy server or a dropped connection pauses
 * the run; nothing is lost, and the person can resume.
 */
import { CensusPaused, type CensusDeps } from "@/core/census/run";
import type { Examination, ExamineRequest, SourceDocument } from "@/core/types";

async function post<T>(url: string, body: unknown, signal: AbortSignal): Promise<{ status: number; data: T & { error?: string } }> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  } catch {
    throw new CensusPaused(signal.aborted ? "Stopped." : "The network is not reachable.");
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (res.status === 429) throw new CensusPaused("The public demo's hourly limit was reached. Your progress is saved; resume later, or run the CLI for large censuses.");
  return { status: res.status, data };
}

export function browserDeps(lang: string, signal: AbortSignal): Pick<CensusDeps, "load" | "examine"> {
  return {
    async load(title) {
      const { status, data } = await post<SourceDocument>("/api/census/article", { lang, title }, signal);
      if (status === 503) throw new CensusPaused(data.error ?? "Wikipedia is busy.");
      if (status !== 200) throw new Error(data.error ?? `The server answered ${status}`);
      return data;
    },
    async examine(req: ExamineRequest) {
      const { status, data } = await post<Examination>("/api/examine", req, signal);
      // anything else (a timeout on one slow site, a rejected request) makes this one link "unknown"
      if (status !== 200) throw new Error(data.error ?? `examination failed (${status})`);
      return data;
    },
  };
}
