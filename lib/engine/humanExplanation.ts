
import type { MarketCandidate } from "@/lib/engine/types";

/**
 * Texto visible para el usuario.
 * Mantiene el cerebro interno separado: no muestra pesos ni reglas privadas.
 */
export function humanTipsterExplanation(candidate: MarketCandidate): string {
  const label = candidate.marketLabel || candidate.market;
  if (candidate.market === "BTTS_YES") {
    return `Los datos apuntan a un partido con producción ofensiva de ambos equipos. La IA considera que ${label} ofrece una relación más equilibrada entre riesgo y cuota que un resultado fijo.`;
  }

  if (String(candidate.market).startsWith("COMBO_")) {
    return `El motor comparó mercados simples y combinados y detectó que esta combinación aporta más valor que entrar únicamente con el favorito.`;
  }

  return `La IA selecciona ${label} porque encuentra un equilibrio entre probabilidad, contexto del partido y una cuota con más sentido que las opciones demasiado bajas.`;
}

export function noValueExplanation(): string {
  return "El motor no encontró un mercado con suficiente valor dentro de las reglas actuales.";
}
