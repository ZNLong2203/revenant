import type { Metadata } from "next";
import { Suspense } from "react";
import { ScanView } from "@/components/scan/scan-view";

export const metadata: Metadata = { title: "Exhumation" };

export default function ScanPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-6 py-16 font-display text-3xl text-bone-dim pending">Digging…</div>}>
      <ScanView />
    </Suspense>
  );
}
