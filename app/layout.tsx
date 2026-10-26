import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beat",
  description: "A voice agent that calls kirana stores, takes restock orders and payment promises, and logs them for the distributor.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Courier+Prime:wght@400;700&family=Noto+Sans+Kannada:wght@400;600&family=Noto+Sans+Devanagari:wght@400;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
