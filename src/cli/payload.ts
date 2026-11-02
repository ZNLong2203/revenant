/**
 * Hook payloads differ between Kiro surfaces (IDE, CLI) and other agents, so
 * collect document paths from any string under a key that mentions a path or file.
 */
export function pathsFromPayload(payload: unknown): string[] {
  const found = new Set<string>();
  const walk = (v: unknown, key = "") => {
    if (typeof v === "string") {
      if (/(path|file)/i.test(key) && /\.(md|markdown|mdx|wiki|html?)$/i.test(v)) found.add(v);
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(payload);
  return [...found];
}

