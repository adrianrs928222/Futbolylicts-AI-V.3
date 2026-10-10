const required = ["API_FOOTBALL_KEY"];
const optional = ["THE_ODDS_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
let failed = false;
for (const key of required) {
  const ok = Boolean(process.env[key]);
  console.log(`${ok ? "✓" : "✗"} ${key}`);
  if (!ok) failed = true;
}
for (const key of optional) console.log(`${process.env[key] ? "✓" : "·"} ${key}`);
if (failed) {
  console.error("Falta API_FOOTBALL_KEY para modo live.");
  process.exitCode = 1;
} else {
  console.log("Configuración básica correcta. THE_ODDS_API_KEY es opcional en v0.23.");
}
