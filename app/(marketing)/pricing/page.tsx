import type { Metadata } from "next";
import { PricingClient } from "./pricing-client";

export const metadata: Metadata = {
  title: "Pricing — Qaera",
  description: "Start free with your own Claude key. Upgrade to Team or Enterprise as your QA pipeline grows.",
  openGraph: {
    title: "Pricing — Qaera",
    description: "Start free with your own Claude key. Upgrade to Team or Enterprise as your QA pipeline grows.",
    type: "website",
  },
};

export default function PricingPage() {
  return <PricingClient />;
}
