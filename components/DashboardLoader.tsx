"use client";

import { useEffect, useState } from "react";
import Dashboard from "@/components/Dashboard";
import type { DailyAnalysis } from "@/lib/engine/types";

export default function DashboardLoader() {
  const [analysis, setAnalysis] = useState<DailyAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 60000);

    async function load() {
      try {
        const response = await fetch("/api/daily", {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(body?.error ?? `Error ${response.status} cargando el análisis`);
        }
        setAnalysis(body as DailyAnalysis);
      } catch (cause) {
        if (controller.signal.aborted) {
          setError("El análisis está tardando demasiado. El servidor sí está activo, pero la fuente de datos no respondió a tiempo.");
        } else {
          setError(cause instanceof Error ? cause.message : "No se pudo cargar el análisis diario.");
        }
      } finally {
        window.clearTimeout(timer);
      }
    }

    void load();
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);

  if (analysis) return <Dashboard analysis={analysis} />;

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <div className="brand">⚽ Futbolylicts-AI <span>★</span></div>
          <p>EL MAESTRO DEL FÚTBOL</p>
        </div>
      </header>

      <section className="panel" style={{ minHeight: 320, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div>
          <div style={{ fontSize: 42, marginBottom: 14 }}>⚽</div>
          <h2>{error ? "La web está activa" : "Analizando la jornada…"}</h2>
          <p style={{ maxWidth: 720, margin: "12px auto" }}>
            {error ?? "La interfaz ya está cargada. Estamos preparando la Combinada del Día, BTTS y las combinadas por liga con los datos actuales."}
          </p>
          {error ? (
            <button className="refresh-button" type="button" onClick={() => window.location.reload()}>
              Reintentar análisis
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}
