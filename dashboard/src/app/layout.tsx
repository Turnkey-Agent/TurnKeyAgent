import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Turnkey Agent — Lemon Property",
  description: "AI-powered property maintenance operations dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
