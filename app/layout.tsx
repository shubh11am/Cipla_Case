import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CARDIO-PRIORITISER — Cipla Ascend S4",
  description:
    "An auditable prioritisation agent for the India Cardiac market. Separates price from patients, validated blind on a withheld year.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
