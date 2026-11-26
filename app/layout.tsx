
import type { Metadata } from "next";
import "../styles.css";

export const metadata: Metadata = {
  title: "VYRA HUB | VYRA Mídia",
  description: "Central de relacionamento e gestão de projetos da VYRA Mídia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
