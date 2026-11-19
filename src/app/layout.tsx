import type { Metadata } from "next";
import { Geist, Instrument_Serif } from "next/font/google";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-serif" });

export const metadata: Metadata = {
  title: { default: "Growth Engine", template: "%s · Growth Engine" },
  description: "Operate acquisition, lifecycle, support, and affiliates on data you actually connect.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable} antialiased`}>
        <div className="bg-ink px-4 py-2 text-center text-[12px] leading-5 text-paper">
          Metrics are counted from data you connect or from labeled test traffic. Nothing spends money, sends a message, or pays anyone until you connect that provider and approve the action.
        </div>
        {children}
      </body>
    </html>
  );
}
