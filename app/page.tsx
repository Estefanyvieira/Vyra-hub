
import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b0713",
        color: "#ffffff",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* MENU SUPERIOR */}
      <header
        style={{
          height: "80px",
          padding: "0 7%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #24182f",
        }}
      >
        <div style={{ fontSize: "25px", fontWeight: "bold" }}>
          VYRA<span style={{ color: "#a855f7" }}>.</span>
          <span style={{ fontSize: "12px", color: "#a855f7", marginLeft: "10px" }}>
            HUB
          </span>
        </div>

        <Link
          href="/login"
          style={{
            color: "#ffffff",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            border: "1px solid #593477",
            padding: "12px 20px",
            borderRadius: "10px",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
          </svg>
          Entrar
        </Link>
      </header>

      {/* PÁGINA INICIAL */}
      <section
        style={{
          minHeight: "calc(100vh - 80px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div
          style={{
            color: "#a855f7",
            fontSize: "14px",
            letterSpacing: "5px",
          }}
        >
          ✦ VYRA MÍDIA
        </div>

        <h1 style={{ fontSize: "58px", margin: "24px 0 12px" }}>
          VYRA <span style={{ color: "#a855f7" }}>HUB</span>
        </h1>

        <p style={{ color: "#c4b5d4", fontSize: "20px" }}>
          Menos do mesmo. Mais impacto.
        </p>

        <p style={{ color: "#888", marginTop: "25px" }}>
          Plataforma de gestão de clientes e conteúdos.
        </p>

        <Link
          href="/login"
          style={{
            marginTop: "35px",
            background: "#a855f7",
            color: "#ffffff",
            padding: "16px 32px",
            borderRadius: "10px",
            textDecoration: "none",
            fontWeight: "bold",
          }}
        >
          Acessar plataforma
        </Link>
      </section>
    </main>
  );
}
