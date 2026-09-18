import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Editor Vertical IA — Reels 9:16",
  description: "Edición automática de video vertical con prompts en lenguaje natural.",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-ink text-white antialiased">{children}</body>
    </html>
  );
}
