import type { Metadata } from "next";
import FinanceApp from "./FinanceApp";
import "./finance.css";
export const metadata: Metadata = {
  title: "FinanceLab · Radar de inversión",
  description: "Panel privado de mercados y declaraciones políticas.",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <FinanceApp />;
}
