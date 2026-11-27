"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../../supabase";

type Service = { id: string; name: string; description: string | null; category: string; price: number | null; price_label: string | null };

export default function ClientPortfolioPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error } = await supabaseBrowser().from("services")
        .select("id,name,description,category,price,price_label")
        .eq("active", true).eq("is_portfolio_visible", true).order("display_order");
      if (!active) return;
      if (error) setError("Não foi possível carregar o portfólio neste momento.");
      else setServices(data ?? []);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);
  const message = encodeURIComponent("Olá, VYRA! Tenho interesse em conhecer melhor um dos serviços do Portfólio VYRA.");
  return (
    <main className="client-module-page">
      <div className="client-module-content">
        <p className="client-module-kicker">POSSIBILIDADES PARA SUA MARCA</p>
        <h1>Portfólio <em>VYRA.</em></h1>
        <p className="client-module-intro">Conheça serviços que podem complementar sua presença e fortalecer os resultados da sua marca. Para contratar, fale diretamente com a nossa equipe.</p>
        {loading ? <p className="client-module-muted">Carregando serviços...</p> : error ? <p className="client-module-error">{error}</p> : services.length === 0 ? (
          <div className="client-module-empty"><span>✦</span><h2>Novas possibilidades em breve.</h2><p>Estamos preparando nosso portfólio de serviços complementares.</p></div>
        ) : (
          <div className="client-service-grid">
            {services.map((service) => (
              <article className="client-service-card" key={service.id}>
                <span className="client-service-category">{service.category}</span>
                <h2>{service.name}</h2>
                <p>{service.description || "Uma solução VYRA pensada para fortalecer a presença da sua marca."}</p>
                {service.price_label ? <strong className="client-service-price">{service.price_label}</strong> : service.price !== null ? <strong className="client-service-price">A partir de R$ {Number(service.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> : <strong className="client-service-price">Consulte condições</strong>}
                <a className="client-service-cta" href={`https://wa.me/?text=${message}`} target="_blank" rel="noreferrer">TENHO INTERESSE ↗</a>
              </article>
            ))}
          </div>
        )}
        <p className="client-module-footnote">A contratação é feita diretamente com a VYRA. Nenhum serviço é ativado automaticamente pelo aplicativo.</p>
      </div>
    </main>
  );
}
