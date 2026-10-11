import type { CompetitionCategory } from "@/lib/engine/types";

/**
 * Preferencias externas de la Combinada del Día.
 *
 * IMPORTANTE: esta capa NO cambia probabilidades, scores, cuotas EST. ni reglas
 * del motor. Solo desempata/prioriza entre candidatos que YA han superado los
 * filtros ALTA/MUY ALTA del motor.
 */
export const DAILY_COMBO_PREFERENCES = {
  preferAllChampionsWhenTargetPossible: true,
  preferEredivisieWhenNoChampionsCombo: true,
  diversityAcrossMajorLeagues: true,
  categoryBonus: {
    champions: 7.0,
    europa: 3.2,
    conference: 2.2,
    national_cup: 1.5,
    top_league: 1.0,
    other: 0,
  } satisfies Record<CompetitionCategory, number>,
} as const;

export function comboCategoryBonus(category: CompetitionCategory): number {
  return DAILY_COMBO_PREFERENCES.categoryBonus[category] ?? 0;
}


const MAJOR_LEAGUE_PATTERNS = [
  "premier league", "laliga", "la liga", "serie a", "bundesliga", "ligue 1",
  "primeira liga", "eredivisie", "championship", "segunda", "2. bundesliga",
  "eerstedivisie", "eerste divisie", "mls", "liga mx", "brasil", "argentina",
  "chinese super league", "swiss super league", "bolivia",
  "veikkausliiga", "serie b", "parva liga", "efbet liga", "first league",
  "superliga", "superligaen", "premiership", "primera a", "categoria primera a",
  "liga betplay", "primera division de chile", "liga de primera"
] as const;

export function normalizedLeagueName(name?: string): string {
  return (name ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function isEredivisieLeague(name?: string): boolean {
  const n = normalizedLeagueName(name);
  return n.includes("eredivisie") && !n.includes("eerste");
}

export function comboLeagueBonus(name?: string): number {
  const n = normalizedLeagueName(name);
  if (isEredivisieLeague(name)) return 4.5;
  if (MAJOR_LEAGUE_PATTERNS.some((pattern) => n.includes(pattern))) return 1.25;
  return 0;
}
