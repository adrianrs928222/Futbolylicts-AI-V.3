const required = ["API_FOOTBALL_KEY", "THE_ODDS_API_KEY"];
const recommended = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

console.log("\nFutbolylicts-AI v0.12 · comprobación de configuración\n");

for (const key of required) {
  console.log(
    `${process.env[key] ? "✓" : "✗"} ${key}${
      process.env[key]
        ? ""
        : key === "THE_ODDS_API_KEY"
          ? " — falta; habrá datos reales pero no combinada oficial con cuotas reales"
          : " — falta; la web usará modo demo"
    }`,
  );
}

for (const key of recommended) {
  console.log(
    `${process.env[key] ? "✓" : "!"} ${key}${
      process.env[key] ? "" : " — recomendado para caché persistente y control de consumo"
    }`,
  );
}

console.log("\nRoles: API-Football = datos · The Odds API = cuotas · Supabase = caché/histórico.\n");
