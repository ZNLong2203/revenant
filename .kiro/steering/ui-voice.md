---
inclusion: fileMatch
fileMatchPattern: ["src/app/**/*.tsx", "src/components/**/*.tsx", "src/app/globals.css"]
---

# Interface and voice

The theme is a graveyard at night: ink, bone, candlelight. The theme carries meaning (dead, ghost, possessed, changeling *are* the categories), so it never gets in the way of reading evidence.

## Rules

- **Verdicts are never colour alone.** Always glyph + word (`VerdictBadge`, `Tombstone` + label/aria-label).
- Colours come from tokens in `globals.css` (`text-possessed`, `bg-crypt`, `border-seam`…). No raw hex in components.
- Display font (`font-display`, IM Fell English) for headings and quotes only; body text is Geist; URLs and code are Geist Mono.
- Motion is decorative only and disabled under `prefers-reduced-motion`.
- Every interactive element is reachable by keyboard and has a visible focus ring (candle).
- Mobile first: the autopsy becomes a full-screen panel under `lg`.

## Voice

- Plain English first, theme second. "The page answers 200 OK but its title says 'Page not found'." Not "The spirit lingers…".
- Name concrete things: dates, hosts, phrases, HTTP codes.
- Say what Revenant will *not* do: it never edits for you; nothing is saved until you paste it.
- Never invent numbers or example output. Use measured values from `src/data/*` or real CLI output.
