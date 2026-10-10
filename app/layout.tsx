import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Futbolylicts-AI | El Maestro del Fútbol",
  description: "El Maestro del Fútbol: análisis probabilístico, combinadas, BTTS, ligas e inteligencia aplicada al fútbol.",
};

export const viewport: Viewport = { themeColor: "#02050a", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
