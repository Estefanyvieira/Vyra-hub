export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b0713",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        fontFamily: "Arial, sans-serif",
        textAlign: "center",
        padding: "24px",
      }}
    >
      <div style={{ color: "#a855f7", fontSize: "14px", letterSpacing: "5px" }}>
        ✦ VYRA MÍDIA
      </div>

      <h1 style={{ fontSize: "48px", margin: "24px 0 12px" }}>
        VYRA <span style={{ color: "#a855f7" }}>HUB</span>
      </h1>

      <p style={{ color: "#c4b5d4", fontSize: "18px" }}>
        Menos do mesmo. Mais impacto.
      </p>

      <p style={{ color: "#888", marginTop: "40px" }}>
        Plataforma de gestão de clientes e conteúdos.
      </p>
    </main>
  );
}
