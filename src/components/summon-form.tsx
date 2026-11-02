"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const EXAMPLES = [
  { label: "wiki:PHP", value: "https://en.wikipedia.org/wiki/PHP" },
  { label: "wiki:Superman", value: "https://en.wikipedia.org/wiki/Superman" },
  { label: "a GitHub README", value: "https://github.com/sindresorhus/awesome" },
];

export function SummonForm({ initial = "", compact = false }: { initial?: string; compact?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [pasteMode, setPasteMode] = useState(false);
  const [text, setText] = useState("");

  function go(q: string) {
    const v = q.trim();
    if (!v) return;
    if (v.length > 1800 || v.includes("\n")) {
      // long pasted text does not fit in a URL: hand it over through session storage
      try {
        sessionStorage.setItem("revenant:paste", v);
      } catch {
        // storage blocked; fall through with a truncated query
      }
      router.push("/scan?paste=1");
      return;
    }
    router.push(`/scan?q=${encodeURIComponent(v)}`);
  }

  return (
    <div className="w-full">
      {!pasteMode ? (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            go(value);
          }}
        >
          <label htmlFor="summon" className="sr-only">
            Wikipedia article, GitHub file or web page to scan
          </label>
          <input
            id="summon"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Wikipedia article, GitHub repo or file, any web page…"
            className={`min-w-0 flex-1 rounded-xl border border-seam-strong bg-crypt/90 px-4 font-mono text-sm text-bone placeholder:text-ash focus:border-candle focus:outline-none ${
              compact ? "py-2.5" : "py-4"
            }`}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            className={`rounded-xl bg-candle px-6 font-semibold text-ink shadow-[0_0_30px_-8px_var(--candle)] transition hover:bg-[#f6c66b] ${
              compact ? "py-2.5" : "py-4"
            }`}
          >
            Exhume
          </button>
        </form>
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            go(text);
          }}
        >
          <label htmlFor="paste" className="text-sm text-bone-dim">
            Paste wikitext, Markdown, HTML or plain text
          </label>
          <textarea
            id="paste"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="rounded-xl border border-seam-strong bg-crypt/90 p-4 font-mono text-xs text-bone placeholder:text-ash focus:border-candle focus:outline-none"
            placeholder={"== References ==\n<ref>{{cite web |url=http://... |title=... |access-date=2014-03-06}}</ref>"}
          />
          <button type="submit" className="self-start rounded-xl bg-candle px-6 py-3 font-semibold text-ink hover:bg-[#f6c66b]">
            Exhume
          </button>
        </form>
      )}
      {!compact && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ash">
          <span>Try</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => go(ex.value)}
              className="rounded-full border border-seam-strong px-3 py-1 font-mono text-xs text-bone-dim transition hover:border-candle hover:text-bone"
            >
              {ex.label}
            </button>
          ))}
          <button type="button" onClick={() => setPasteMode((p) => !p)} className="ml-auto text-xs underline decoration-seam-strong underline-offset-4 hover:text-bone">
            {pasteMode ? "Scan a URL instead" : "Paste text instead"}
          </button>
        </div>
      )}
    </div>
  );
}
