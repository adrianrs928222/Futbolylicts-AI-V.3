export default function Loading() {
  return (
    <main className="shell">
      <header className="hero">
        <div>
          <div className="brand">⚽ Futbolylicts-AI <span>★</span></div>
          <p>EL MAESTRO DEL FÚTBOL</p>
        </div>
      </header>
      <section className="panel" style={{ minHeight: 300, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div><h2>Cargando Futbolylicts-AI…</h2><p>Preparando el motor de análisis.</p></div>
      </section>
    </main>
  );
}
