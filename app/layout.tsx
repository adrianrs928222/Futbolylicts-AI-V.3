import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "La Mente del Gol | Futbolylicts-AI",
  description: "Motor probabilístico de análisis de fútbol y combinadas filtradas por confianza.",
};

export const viewport: Viewport = {
  themeColor: "#02050a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
