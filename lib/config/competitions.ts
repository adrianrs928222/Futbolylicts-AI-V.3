import type {
  CompetitionCategory,
  Fixture,
} from "@/lib/engine/types";

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/* =========================================================
 * COMPETICIONES FEMENINAS PERMITIDAS
 *
 * Excepción explícita al filtro femenino general:
 * - UEFA Women's Champions League
 * - Liga F / Primera División Femenina (España)
 * - UEFA Women's Europa Cup / Europa Cup Femenina
 * ======================================================= */

function isWomensChampionsLeagueName(leagueName: string): boolean {
  const n = normalize(leagueName);
  return (
    /champions league/.test(n) &&
    /women|womens|woman|female|femenin/.test(n)
  );
}

function isWomensEuropaCupName(leagueName: string): boolean {
  const n = normalize(leagueName);
  return (
    /europa cup/.test(n) &&
    /women|womens|woman|female|femenin/.test(n)
  );
}

function isSpanishLigaFName(leagueName: string): boolean {
  const n = normalize(leagueName);
  return (
    /^(liga f|liga f women|primera division femenina|primera division women|primera femenina|liga femenina)$/.test(n) ||
    (/primera division/.test(n) && /women|female|femenin/.test(n))
  );
}

function isAllowedWomensCompetition(fixture: Fixture): boolean {
  const country = normalize(fixture.league.country ?? "");
  if (isWomensChampionsLeagueName(fixture.league.name)) return true;
  if (isWomensEuropaCupName(fixture.league.name)) return true;
  return (
    isSpanishLigaFName(fixture.league.name) &&
    (country === "" || /spain|espana/.test(country))
  );
}

/* =========================================================
 * SELECCIONES PERMITIDAS
 *
 * Torneos internacionales de primer nivel + Mundial Sub-20 + competiciones Sub-21 principales.
 * No abrimos juveniles genéricos ni Nations League/regionales
 * menores: sólo esta whitelist explícita.
 * ======================================================= */

function isAllowedNationalTeamsCompetition(fixture: Fixture): boolean {
  const league = normalize(fixture.league.name);

  // FIFA: absoluta y Mundial Sub-20 (masculino).
  if (/^(fifa )?world cup$/.test(league) || /world cup 20|world cup u20|u20 world cup|under 20 world cup|fifa u-?20 world cup/.test(league)) return true;

  // Sub-21: Eurocopa/European Championship y clasificación UEFA Sub-21.
  // Se mantienen fuera ligas/torneos regionales U21 pequeños.
  if (/uefa.*u-?21.*(championship|euro|qualif)|u-?21.*(uefa|european).*(championship|euro|qualif)|european.*u-?21.*(championship|qualif)/.test(league)) return true;

  // Grandes torneos continentales de selecciones absolutas.
  if (/^(uefa )?(euro|european championship)$/.test(league)) return true;
  if (/copa america/.test(league)) return true;
  if (/africa cup of nations|afcon/.test(league)) return true;
  if (/afc asian cup|asian cup/.test(league)) return true;
  if (/concacaf gold cup|gold cup/.test(league)) return true;

  // Ligas de selecciones de confederaciones grandes.
  if (/uefa nations league/.test(league) || /^nations league$/.test(league)) return true;
  if (/concacaf nations league/.test(league)) return true;

  // Clasificación al Mundial: UEFA, CONMEBOL, CONCACAF, AFC y CAF.
  // Se excluyen explícitamente OFC y competiciones regionales pequeñas.
  if (/world cup.*qualif|world cup.*qualification|wc qualification/.test(league)) {
    return !/oceania|ofc/.test(league);
  }

  return false;
}

/* =========================================================
 * LIGAS RECONOCIDAS
 * ======================================================= */

const TOP_LEAGUES = [
  "premier league",
  "championship",

  "la liga",
  "laliga",
  "primera division",
  "segunda division",
  "laliga hypermotion",

  "serie a",

  "bundesliga",
  "2. bundesliga",

  "ligue 1",

  "eredivisie",
  "eerste divisie",

  "primeira liga",

  // Nuevas ligas solicitadas
  "veikkausliiga",
  "serie b",
  "first league",
  "parva liga",
  "efbet liga",
  "superliga",
  "premiership",
  "primera a",
  "categoria primera a",
  "primera division",

  "major league soccer",
  "mls",

  "liga mx",

  "liga profesional",

  "chinese super league",

  "swiss super league",

  "division profesional",
];

/* =========================================================
 * COPAS NACIONALES PERMITIDAS
 *
 * Solamente copas importantes de países cuyas ligas
 * hemos decidido aceptar.
 * ======================================================= */

const NATIONAL_CUPS = [
  // España
  "copa del rey",

  // Inglaterra
  "fa cup",
  "efl cup",
  "league cup",

  // Italia
  "coppa italia",

  // Alemania
  "dfb pokal",
  "dfb-pokal",

  // Francia
  "coupe de france",

  // Portugal
  "taca de portugal",

  // Países Bajos
  "knvb beker",

  // Brasil
  "copa do brasil",

];

/* =========================================================
 * RONDAS DE COPA QUE NO QUEREMOS
 *
 * Evita partidos tipo:
 *
 * FA Cup - 1st Round Qualifying
 * Preliminary Round
 * Qualifying Replay
 * Extra Preliminary
 *
 * Es decir: equipos regionales / semiprofesionales /
 * rondas previas de copas.
 * ======================================================= */

const NATIONAL_CUP_EXCLUDED_STAGE_PATTERNS = [
  /\bqualifying\b/i,
  /\bqualification\b/i,
  /\bqualifier\b/i,
  /\bpreliminary\b/i,
  /\bprelim\b/i,
  /\bextra preliminary\b/i,
  /\bpre-qualifying\b/i,
];

function isExcludedNationalCupStage(
  fixture: Fixture,
): boolean {
  const stage = normalize(
    `${fixture.league.name} ${fixture.round ?? ""}`,
  );

  return NATIONAL_CUP_EXCLUDED_STAGE_PATTERNS.some(
    (pattern) => pattern.test(stage),
  );
}

/* =========================================================
 * EXCLUSIONES GENERALES
 * ======================================================= */

const NON_RESERVE_EXCLUSION_PATTERNS = [
  /\bwomen\b/i,
  /\bwoman\b/i,
  /\bladies\b/i,

  /\bfemenin[oa]\b/i,
  /\bfemenino\b/i,

  /\bu-?1[6789]\b/i,
  /\bu-?2[013]\b/i,

  /\bu23\b/i,
  /\bu21\b/i,
  /\bu20\b/i,
  /\bu19\b/i,

  /\byouth\b/i,
  /\bjuvenil\b/i,
  /\bacademy\b/i,

  /\bamistos[oa]\b/i,
  /\bfriendly\b/i,
];

/* =========================================================
 * RESERVAS / FILIALES
 * ======================================================= */

const RESERVE_PATTERNS = [
  /\breserves?\b/i,
  /\breserve\b/i,

  /\bb team\b/i,
  /\bteam b\b/i,

  /^jong\b/i,

  /\bii\b/i,
];

/*
 * ÚNICA EXCEPCIÓN:
 *
 * Eerste Divisie.
 *
 * Aquí sí permitimos:
 *
 * Jong Ajax
 * Jong PSV
 * Jong AZ
 * Jong Utrecht
 * etc.
 */
const RESERVE_ALLOWED_LEAGUES = [
  "eerste divisie",
];

/* =========================================================
 * CATEGORÍAS
 * ======================================================= */

export function competitionCategory(
  leagueName: string,
): CompetitionCategory {
  const n = normalize(leagueName);

  if (
    /^(uefa )?champions league$/.test(n) ||
    isWomensChampionsLeagueName(leagueName)
  )
    return "champions";

  if (/^(uefa )?europa league$/.test(n))
    return "europa";

  if (
    /^(uefa )?(europa )?conference league$/.test(n)
  )
    return "conference";

  if (
    NATIONAL_CUPS.some((cup) =>
      n.includes(normalize(cup)),
    )
  )
    return "national_cup";

  if (
    TOP_LEAGUES.some((league) =>
      n.includes(normalize(league)),
    )
  )
    return "top_league";

  return "other";
}

/* =========================================================
 * REGLAS DE LIGAS PREFERIDAS
 * ======================================================= */

type PreferredRule = {
  league: RegExp;
  country: RegExp;
  score: number;
  label: string;
};

/*
 * PRIMER NIVEL
 *
 * Son las competiciones que primero debe mirar
 * Futbolylicts-AI.
 */
const CORE_PREFERRED: PreferredRule[] = [
  /* -------------------------
   * INGLATERRA
   * ---------------------- */

  {
    league: /^premier league$/,
    country: /england|inglaterra/,
    score: 100,
    label: "Premier League",
  },

  /* -------------------------
   * ESPAÑA
   * ---------------------- */

  {
    league:
      /^(la liga|laliga|laliga ea sports|primera division)$/,
    country: /spain|espana/,
    score: 100,
    label: "LaLiga",
  },

  {
    league:
      /^(segunda division|laliga hypermotion|la liga 2|segunda)$/,
    country: /spain|espana/,
    score: 98,
    label: "Segunda División",
  },

  /* -------------------------
   * ITALIA
   * ---------------------- */

  {
    league: /^serie a$/,
    country: /italy|italia/,
    score: 100,
    label: "Serie A",
  },

  /* -------------------------
   * ALEMANIA
   * ---------------------- */

  {
    league: /^bundesliga$/,
    country: /germany|alemania/,
    score: 100,
    label: "Bundesliga",
  },

  {
    league: /^2\.? bundesliga$/,
    country: /germany|alemania/,
    score: 97,
    label: "2. Bundesliga",
  },

  /* -------------------------
   * FRANCIA
   * ---------------------- */

  {
    league: /^ligue 1$/,
    country: /france|francia/,
    score: 100,
    label: "Ligue 1",
  },

  /* -------------------------
   * PAÍSES BAJOS
   * ---------------------- */

  {
    league: /^eredivisie$/,
    country: /netherlands|paises bajos/,
    score: 98,
    label: "Eredivisie",
  },

  {
    league: /^eerste divisie$/,
    country: /netherlands|paises bajos/,
    score: 96,
    label: "Eerste Divisie",
  },
];

/*
 * SEGUNDO NIVEL
 *
 * También son competiciones fiables y pueden
 * entrar normalmente en la Combinada del Día.
 */
const TRUSTED_SECONDARY: PreferredRule[] = [
  /* -------------------------
   * INGLATERRA
   * ---------------------- */

  {
    league: /^championship$/,
    country: /england|inglaterra/,
    score: 94,
    label: "Championship",
  },

  /* -------------------------
   * PORTUGAL
   * ---------------------- */

  {
    league: /^primeira liga$/,
    country: /portugal/,
    score: 94,
    label: "Primeira Liga",
  },

  /* -------------------------
   * FINLANDIA
   * ---------------------- */
  {
    league: /^veikkausliiga$/,
    country: /finland|finlandia/,
    score: 91,
    label: "Finlandia Veikkausliiga",
  },

  /* -------------------------
   * BRASIL SERIE B
   * ---------------------- */
  {
    league: /^(serie b|brasileirao serie b|brasileiro serie b)$/,
    country: /brazil|brasil/,
    score: 91,
    label: "Brasil Serie B",
  },

  /* -------------------------
   * BULGARIA
   * ---------------------- */
  {
    league: /^(first league|parva liga|efbet liga)$/,
    country: /bulgaria/,
    score: 89,
    label: "Bulgaria First League",
  },

  /* -------------------------
   * DINAMARCA
   * ---------------------- */
  {
    league: /^(superliga|superligaen|danish superliga)$/,
    country: /denmark|dinamarca/,
    score: 91,
    label: "Dinamarca Superliga",
  },

  /* -------------------------
   * ESCOCIA
   * ---------------------- */
  {
    league: /^(premiership|scottish premiership)$/,
    country: /scotland|escocia/,
    score: 92,
    label: "Scottish Premiership",
  },

  /* -------------------------
   * COLOMBIA
   * ---------------------- */
  {
    league: /^(primera a|categoria primera a|liga betplay dimayor)$/,
    country: /colombia/,
    score: 91,
    label: "Colombia Primera A",
  },

  /* -------------------------
   * CHILE
   * ---------------------- */
  {
    league: /^(primera division|primera division de chile|liga de primera)$/,
    country: /chile/,
    score: 91,
    label: "Chile Primera División",
  },

  /* -------------------------
   * ESTADOS UNIDOS
   * ---------------------- */

  {
    league:
      /major league soccer|^mls$/,
    country:
      /usa|united states|estados unidos/,
    score: 92,
    label: "MLS",
  },

  /* -------------------------
   * MÉXICO
   * ---------------------- */

  {
    league: /^liga mx$|liga mx/,
    country: /mexico/,
    score: 92,
    label: "Liga MX",
  },

  /* -------------------------
   * BRASIL
   * ---------------------- */

  {
    league: /^serie a$/,
    country: /brazil|brasil/,
    score: 92,
    label: "Brasil Serie A",
  },

  /* -------------------------
   * ARGENTINA
   * ---------------------- */

  {
    league:
      /^(primera division|liga profesional)$/,
    country: /argentina/,
    score: 91,
    label: "Argentina Primera",
  },

  /* -------------------------
   * CHINA
   * ---------------------- */

  {
    league:
      /^(chinese super league|super league)$/,
    country: /china/,
    score: 92,
    label: "Chinese Super League",
  },

  /* -------------------------
   * SUIZA
   * ---------------------- */

  {
    league:
      /^(swiss super league|super league)$/,
    country:
      /switzerland|suiza|suisse|schweiz/,
    score: 91,
    label: "Swiss Super League",
  },

  /* -------------------------
   * BOLIVIA
   * ---------------------- */

  {
    league:
      /^(division profesional|primera division)$/,
    country: /bolivia/,
    score: 90,
    label: "Bolivia División Profesional",
  },
];

/* =========================================================
 * BUSCAR REGLA PREFERIDA
 * ======================================================= */

function preferredRuleFor(
  fixture: Fixture,
): PreferredRule | undefined {
  const league = normalize(
    fixture.league.name,
  );

  const country = normalize(
    fixture.league.country ?? "",
  );

  return [
    ...CORE_PREFERRED,
    ...TRUSTED_SECONDARY,
  ].find(
    (item) =>
      item.league.test(league) &&
      item.country.test(country),
  );
}

/* =========================================================
 * PAÍSES CUYAS COPAS SÍ PERMITIMOS
 * ======================================================= */

const CUP_ALLOWED_COUNTRIES =
  /^(england|inglaterra|spain|espana|italy|italia|germany|alemania|france|francia|portugal|netherlands|paises bajos|usa|united states|estados unidos|mexico|brazil|brasil|argentina|china|switzerland|suiza|suisse|schweiz|bolivia)$/;

/* =========================================================
 * COPA NACIONAL PERMITIDA
 * ======================================================= */

function isAllowedNationalCup(
  fixture: Fixture,
): boolean {
  const league = normalize(
    fixture.league.name,
  );

  const country = normalize(
    fixture.league.country ?? "",
  );

  /*
   * Primero comprobamos que sea un país
   * permitido.
   */
  if (!CUP_ALLOWED_COUNTRIES.test(country))
    return false;

  /*
   * Eliminamos rondas previas / qualifying.
   */
  if (isExcludedNationalCupStage(fixture))
    return false;

  /*
   * Debe tratarse además de una copa
   * reconocida explícitamente.
   */
  return NATIONAL_CUPS.some((cup) =>
    league.includes(normalize(cup)),
  );
}

/* =========================================================
 * FILTRO OFICIAL
 *
 * ESTA FUNCIÓN DECIDE QUÉ COMPETICIONES PUEDEN
 * ENTRAR EN LA COMBINADA DEL DÍA.
 * ======================================================= */

export function isPreferredOfficialCompetition(
  fixture: Fixture,
): boolean {
  // Excepciones oficiales añadidas: femenino seleccionado + grandes torneos de selecciones.
  if (isAllowedWomensCompetition(fixture) || isAllowedNationalTeamsCompetition(fixture)) return true;

  const category = competitionCategory(
    fixture.league.name,
  );

  /*
   * UEFA
   */
  if (
    category === "champions" ||
    category === "europa" ||
    category === "conference"
  ) {
    return true;
  }

  /*
   * Ligas permitidas.
   */
  if (preferredRuleFor(fixture))
    return true;

  /*
   * Copas nacionales.
   *
   * Solamente:
   *
   * - países permitidos
   * - copas reconocidas
   * - sin qualifying / preliminary
   */
  if (category === "national_cup") {
    return isAllowedNationalCup(fixture);
  }

  /*
   * Cualquier liga desconocida queda fuera.
   */
  return false;
}

/* =========================================================
 * PRIORIDAD DEL ANÁLISIS
 * ======================================================= */

export function fixturePriorityScore(
  fixture: Fixture,
): number {
  if (isWomensChampionsLeagueName(fixture.league.name)) return 114;
  if (isSpanishLigaFName(fixture.league.name)) return 99;
  if (isAllowedNationalTeamsCompetition(fixture)) {
    const n = normalize(fixture.league.name);
    if (/world cup u20|u20 world cup|under 20 world cup|fifa u-?20 world cup|world cup 20/.test(n)) return 104;
    if (/u-?21|under 21/.test(n)) return 103;
    if (/world cup/.test(n) && !/qualif/.test(n)) return 116;
    if (/euro|copa america/.test(n)) return 112;
    if (/nations league/.test(n)) return 106;
    return 102;
  }

  const category = competitionCategory(
    fixture.league.name,
  );

  /*
   * Europa
   */
  if (category === "champions")
    return 115;

  if (category === "europa")
    return 111;

  if (category === "conference")
    return 107;

  /*
   * Ligas seleccionadas.
   */
  const preferred =
    preferredRuleFor(fixture);

  if (preferred)
    return preferred.score;

  /*
   * Copas importantes.
   */
  if (
    category === "national_cup" &&
    isPreferredOfficialCompetition(fixture)
  ) {
    return 88;
  }

  /*
   * Liga rara.
   */
  return 20;
}

/* =========================================================
 * PRIORIDAD POR CATEGORÍA
 * ======================================================= */

export function categoryPriority(
  category: CompetitionCategory,
): number {
  return {
    champions: 100,
    europa: 95,
    conference: 90,

    national_cup: 85,

    top_league: 80,

    other: 40,
  }[category];
}

/* =========================================================
 * RESERVAS PERMITIDAS
 * ======================================================= */

export function reservesAllowedInCompetition(
  fixture: Fixture,
): boolean {
  const league = normalize(
    fixture.league.name,
  );

  const country = normalize(
    fixture.league.country ?? "",
  );

  /*
   * Únicamente Eerste Divisie.
   */
  return (
    RESERVE_ALLOWED_LEAGUES.some(
      (name) => league.includes(name),
    ) &&
    (
      country.includes("netherlands") ||
      country.includes("paises bajos") ||
      country === ""
    )
  );
}

/* =========================================================
 * DETECTOR DE EQUIPOS RESERVA
 * ======================================================= */

function isReserveTeamName(
  name: string,
): boolean {
  const clean = name.trim();

  return (
    /(?:\s|[-_])(ii|b|reserves?|u-?2[13]|u-?19)$/i.test(
      clean,
    ) ||

    /\b(b team|team b|reserve team)\b/i.test(
      clean,
    ) ||

    /^jong\b/i.test(clean) ||

    RESERVE_PATTERNS.some(
      (pattern) =>
        pattern.test(clean),
    )
  );
}

/* =========================================================
 * EXCLUSIONES DEL PARTIDO
 * ======================================================= */

export function isExcludedFixture(
  fixture: Fixture,
): boolean {
  const haystack = [
    fixture.league.name,
    fixture.home.name,
    fixture.away.name,
    fixture.league.country ?? "",
    fixture.round ?? "",
  ].join(" ");

  /*
   * Amistosos.
   */
  if (
    /\bfriendly\b/i.test(haystack) ||
    /\bamistos[oa]\b/i.test(haystack)
  ) {
    return true;
  }

  /*
   * Femenino / juvenil / academia.
   * Excepciones: Champions femenina, Europa Cup femenina, Liga F, Mundial Sub-20 y competiciones UEFA Sub-21 principales.
   */
  if (
    !isAllowedWomensCompetition(fixture) &&
    !isAllowedNationalTeamsCompetition(fixture) &&
    NON_RESERVE_EXCLUSION_PATTERNS.some(
      (pattern) =>
        pattern.test(haystack),
    )
  ) {
    return true;
  }

  /*
   * Reservas / B teams / Jong.
   */
  const hasReserveTeam =
    isReserveTeamName(
      fixture.home.name,
    ) ||
    isReserveTeamName(
      fixture.away.name,
    );

  if (
    hasReserveTeam &&
    !reservesAllowedInCompetition(fixture)
  ) {
    return true;
  }

  /*
   * Eliminamos también automáticamente
   * cualquier ronda qualifying/preliminary
   * de copa nacional.
   */
  if (
    competitionCategory(
      fixture.league.name,
    ) === "national_cup" &&
    isExcludedNationalCupStage(fixture)
  ) {
    return true;
  }

  return false;
}

/* =========================================================
 * ETIQUETAS DE LA INTERFAZ
 * ======================================================= */

export const CATEGORY_LABELS: Record<
  CompetitionCategory,
  string
> = {
  champions:
    "Champions League",

  europa:
    "Europa League",

  conference:
    "Conference League",

  national_cup:
    "Copas nacionales",

  top_league:
    "Ligas principales",

  other:
    "Otras ligas",
};

/* =========================================================
 * LIGAS QUE QUEREMOS MOSTRAR COMO PREFERIDAS
 * ======================================================= */

export const PREFERRED_LEAGUE_LABELS = [
  "LaLiga",

  "Segunda División",

  "Premier League",

  "Championship",

  "Serie A",

  "Bundesliga",

  "2. Bundesliga",

  "Ligue 1",

  "Primeira Liga",

  "Eredivisie",

  "Eerste Divisie",

  "Finlandia Veikkausliiga",

  "Brasil Serie B",

  "Bulgaria First League",

  "Dinamarca Superliga",

  "Scottish Premiership",

  "Colombia Primera A",

  "Chile Primera División",

  "MLS",

  "Liga MX",

  "Brasil Serie A",

  "Argentina Primera",

  "Chinese Super League",

  "Swiss Super League",

  "Bolivia División Profesional",

  "Liga F (Femenina)",

  "Champions League Femenina",
  "UEFA Women's Europa Cup",
  "Europa Cup Femenina",

  "FIFA World Cup",
  "FIFA U-20 World Cup",
  "UEFA Nations League",
  "CONCACAF Nations League",
  "UEFA Euro",
  "Copa América",
  "Africa Cup of Nations",
  "AFC Asian Cup",
  "CONCACAF Gold Cup",
  "World Cup Qualification (principales confederaciones)",

  "Champions League",

  "Europa League",

  "Conference League",
] as const;