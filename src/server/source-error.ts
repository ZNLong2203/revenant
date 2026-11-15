import { isBusy } from "@/core/census/targets";
import { FetchFailure } from "@/core/net/fetch";
import { SourceError } from "@/core/sources";

/**
 * Turn a failure while loading Wikipedia into a response the census page
 * understands: 422 means "this input is wrong, skip it", 503 means "Wikipedia
 * is busy, pause and try again", 500 is our own fault.
 */
export function sourceErrorResponse(error: unknown): Response {
  if (error instanceof SourceError) return Response.json({ error: error.message }, { status: isBusy(error) ? 503 : 422 });
  if (error instanceof FetchFailure) {
    return Response.json(
      { error: `Could not fetch that source (${error.kind === "blocked" ? "it points at a private network" : error.message}).` },
      { status: error.kind === "blocked" ? 422 : 503 },
    );
  }
  return Response.json({ error: "Something went wrong while loading that source." }, { status: 500 });
}
