import type { Metadata } from "next";
import { Instrument_Sans, Roboto_Mono } from "next/font/google";
import "./globals.css";

const sans = Instrument_Sans({ variable: "--font-instrument", subsets: ["latin"] });
const mono = Roboto_Mono({ variable: "--font-roboto-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Cached input counted twice: SuperPlane #9049 fix (unofficial demo)",
  description:
    "OpenAI cached input tokens are billed twice in SuperPlane usage. A small fix that matches text_prompt.go. Unofficial demo by Cheryl Aurelia.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
