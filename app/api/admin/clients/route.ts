import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function response(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !secretKey || !anonKey) {
    return response("A configuração segura do servidor está incompleta.", 500);
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return response("Sessão não encontrada. Entre novamente.", 401);

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const { data: authData, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !authData.user) {
    return response("Sua sessão é inválida ou expirou. Entre novamente.", 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const { data: callerProfile, error: callerError } = await userClient
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single();

  if (callerError || callerProfile?.role !== "admin") {
    return response("Apenas a administração da VYRA pode cadastrar empresas.", 403);
  }

  let body: { name?: unknown; serviceSummary?: unknown; welcomeMessage?: unknown };
  try {
    body = await request.json();
  } catch {
    return response("Os dados enviados são inválidos.", 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const serviceSummary = typeof body.serviceSummary === "string" ? body.serviceSummary.trim() : "";
  const welcomeMessage = typeof body.welcomeMessage === "string" ? body.welcomeMessage.trim() : "";

  if (!name || name.length > 120) {
    return response("Informe o nome da empresa (até 120 caracteres).", 400);
  }
  if (serviceSummary.length > 500) {
    return response("A descrição dos serviços deve ter até 500 caracteres.", 400);
  }
  if (welcomeMessage.length > 300) {
    return response("A mensagem de boas-vindas deve ter até 300 caracteres.", 400);
  }

  const { data: existingClients, error: lookupError } = await adminClient
    .from("clients")
    .select("id, name");

  if (lookupError) return response("Não foi possível verificar os cadastros existentes.", 500);

  const normalizedName = name.toLocaleLowerCase("pt-BR");
  const duplicate = (existingClients || []).some(
    (client) => client.name.trim().toLocaleLowerCase("pt-BR") === normalizedName,
  );

  if (duplicate) {
    return response("Já existe uma empresa cadastrada com esse nome. Confira a carteira de clientes.", 409);
  }

  const { data: createdClient, error: createError } = await adminClient
    .from("clients")
    .insert({
      name,
      service_summary: serviceSummary || null,
      welcome_message: welcomeMessage || null,
    })
    .select("id, name, service_summary, logo_url, created_at")
    .single();

  if (createError || !createdClient || !uuidPattern.test(createdClient.id)) {
    return response("Não foi possível criar o espaço da empresa. Nenhum acesso de usuário foi criado.", 500);
  }

  return NextResponse.json({ success: true, client: createdClient }, { status: 201 });
}
