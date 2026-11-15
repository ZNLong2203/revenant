import Link from "next/link";

export const REPO_URL = "https://github.com/ZNLong2203/revenant";

export function Sigil({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M8 29V13a8 8 0 0 1 16 0v16z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M16 6.5c-1.6 1.7-2 3.3-1 4.6 1 1.3 3 .8 3-1.2 0-1.3-.8-2.4-2-3.4z" fill="var(--candle)" className="candle-flicker" />
      <path d="M13 18h6M16 15v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 29h24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-seam/70 bg-ink/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:gap-6 sm:px-6" aria-label="Main">
        <Link href="/" className="flex items-center gap-2 text-bone">
          <Sigil className="h-6 w-6 text-bone sm:h-7 sm:w-7" />
          <span className="font-display text-xl leading-none tracking-wide sm:text-2xl">Revenant</span>
        </Link>
        <div className="ml-auto flex items-center whitespace-nowrap text-[13px] text-bone-dim sm:gap-2 sm:text-sm">
          <Link className="rounded px-1.5 py-1 hover:text-bone sm:px-2" href="/method">
            Method
          </Link>
          <Link className="rounded px-1.5 py-1 hover:text-bone sm:px-2" href="/census">
            Census
          </Link>
          <Link className="rounded px-1.5 py-1 hover:text-bone sm:px-2" href="/agents">
            For agents
          </Link>
          <a className="hidden rounded px-2 py-1 hover:text-bone sm:inline-block" href={REPO_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-seam/70 py-8 text-sm text-ash">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Revenant reads the{" "}
          <a className="underline decoration-seam-strong underline-offset-4 hover:text-bone" href="https://web.archive.org/" target="_blank" rel="noreferrer">
            Internet Archive
          </a>
          , RDAP and the live web. It never edits anything for you.
        </p>
        <p>
          MIT licensed · built for Kiroween 2026 ·{" "}
          <a className="underline decoration-seam-strong underline-offset-4 hover:text-bone" href={REPO_URL} target="_blank" rel="noreferrer">
            source
          </a>
        </p>
      </div>
    </footer>
  );
}
