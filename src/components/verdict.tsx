import type { Verdict } from "@/core/types";

export const VERDICT_META: Record<
  Verdict,
  { label: string; glyph: string; text: string; bg: string; ring: string; fill: string; status: string; blurb: string }
> = {
  possessed: {
    label: "Possessed",
    glyph: "☠",
    text: "text-possessed",
    bg: "bg-possessed/12",
    ring: "ring-possessed/40",
    fill: "var(--v-possessed)",
    status: "usurped",
    blurb: "The domain died and someone else moved in: parked, for sale, or full of gambling spam. It still answers 200 OK.",
  },
  changeling: {
    label: "Changeling",
    glyph: "◐",
    text: "text-changeling",
    bg: "bg-changeling/12",
    ring: "ring-changeling/40",
    fill: "var(--v-changeling)",
    status: "deviated",
    blurb: "Same site, different page. The content that was cited has been replaced and no longer supports the sentence.",
  },
  ghost: {
    label: "Ghost",
    glyph: "◌",
    text: "text-ghost",
    bg: "bg-ghost/12",
    ring: "ring-ghost/40",
    fill: "var(--v-ghost)",
    status: "dead",
    blurb: "A soft 404. The server says 200 OK, but shows an error page or quietly sends you to the home page.",
  },
  buried: {
    label: "Buried",
    glyph: "✝",
    text: "text-buried",
    bg: "bg-buried/12",
    ring: "ring-buried/40",
    fill: "var(--v-buried)",
    status: "dead",
    blurb: "Plainly gone: 404, 410, or a domain that no longer resolves. Existing bots handle these well.",
  },
  unknown: {
    label: "Unknown",
    glyph: "?",
    text: "text-unknown",
    bg: "bg-unknown/12",
    ring: "ring-unknown/40",
    fill: "var(--v-unknown)",
    status: "",
    blurb: "The site blocked automated visitors or timed out. A person should look.",
  },
  alive: {
    label: "Alive",
    glyph: "✓",
    text: "text-alive",
    bg: "bg-alive/12",
    ring: "ring-alive/40",
    fill: "var(--v-alive)",
    status: "live",
    blurb: "The page is there and still looks like what was cited.",
  },
};

export function VerdictBadge({ verdict, size = "sm" }: { verdict: Verdict; size?: "sm" | "md" }) {
  const m = VERDICT_META[verdict];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ${m.bg} ${m.text} ring-1 ${m.ring} font-medium ${
        size === "md" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"
      }`}
    >
      <span aria-hidden="true">{m.glyph}</span>
      {m.label}
    </span>
  );
}

/** A small tombstone, coloured by verdict. Pending stones pulse. */
export function Tombstone({ verdict, pending, size = 22 }: { verdict?: Verdict; pending?: boolean; size?: number }) {
  const fill = verdict ? VERDICT_META[verdict].fill : "var(--seam-strong)";
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 20 23" aria-hidden="true" className={pending ? "pending" : "rise"}>
      <path d="M3 22V9a7 7 0 0 1 14 0v13z" fill={fill} fillOpacity={verdict === "alive" ? 0.35 : verdict ? 0.9 : 0.5} />
      <path d="M1 22h18" stroke={fill} strokeOpacity={0.6} strokeWidth="1.5" />
      {verdict === "possessed" && <path d="M7.5 10.5h5M10 8v6" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" />}
      {verdict === "buried" && <path d="M10 8v7M7.5 10.5h5" stroke="var(--ink)" strokeWidth="1.4" strokeLinecap="round" />}
      {verdict === "ghost" && <circle cx="10" cy="11.5" r="2.6" fill="none" stroke="var(--ink)" strokeWidth="1.4" />}
      {verdict === "changeling" && <path d="M10 8.8a2.8 2.8 0 0 1 0 5.6z" fill="var(--ink)" />}
    </svg>
  );
}
