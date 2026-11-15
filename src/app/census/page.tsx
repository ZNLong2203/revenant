import type { Metadata } from "next";
import { CensusView } from "@/components/census/census-view";

export const metadata: Metadata = {
  title: "Graveyard census",
  description: "Scan a Wikipedia category, a domain or a list of articles and get a worklist of possessed citations that nobody has tagged yet.",
};

export default function CensusPage() {
  return <CensusView />;
}
