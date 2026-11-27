import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function response(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}


export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) return response("A configuração segura do servidor está incompleta.", 500);

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return response("Sessão não encontrada. Entre novamente.", 401);

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const { data: authData, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !authData.user) return response("Sua sessão é inválida ou expirou. Entre novamente.", 401);

  const { data: callerProfile, error: callerError } = await adminClient
    .from("profiles").select("role").eq("id", authData.user.id).single();
  if (callerError || callerProfile?.role !== "admin") return response("Apenas a administração da VYRA pode consultar usuários.", 403);

  const clientId = request.nextUrl.searchParams.get("clientId") || "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId)) {
    return response("A empresa selecionada é inválida.", 400);
  }

  const { data: client, error: clientError } = await adminClient
    .from("clients").select("id, name").eq("id", clientId).maybeSingle();
  if (clientError || !client) return response("A empresa selecionada não foi encontrada.", 404);

  const { data: profiles, error: profilesError } = await adminClient
    .from("profiles").select("id, full_name, created_at").eq("client_id", clientId).eq("role", "client").order("created_at", { ascending: true });
  if (profilesError) return response("Não foi possível carregar os usuários desta empresa.", 500);

  const users = await Promise.all((profiles || []).map(async (profile) => {
    const { data } = await adminClient.auth.admin.getUserById(profile.id);
    return {
      id: profile.id,
      full_name: profile.full_name || "Nome não informado",
      email: data.user?.email || "E-mail indisponível",
      created_at: profile.created_at,
    };
  }));

  return NextResponse.json({ client, users, limit: 6 });
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    return response("A configuração segura do servidor está incompleta.", 500);
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!token) return response("Sessão não encontrada. Entre novamente.", 401);

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const { data: authData, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !authData.user) {
    return response("Sua sessão é inválida ou expirou. Entre novamente.", 401);
  }

  const { data: callerProfile, error: callerError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single();

  if (callerError || callerProfile?.role !== "admin") {
    return response("Apenas a administração da VYRA pode criar usuários.", 403);
  }

  let body: { fullName?: unknown; email?: unknown; password?: unknown; clientId?: unknown };
  try {
    body = await request.json();
  } catch {
    return response("Os dados enviados são inválidos.", 400);
  }

  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const clientId = typeof body.clientId === "string" ? body.clientId : "";

  if (!fullName || fullName.length > 120) {
    return response("Informe um nome válido de até 120 caracteres.", 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return response("Informe um endereço de e-mail válido.", 400);
  }
  if (password.length < 8 || password.length > 128) {
    return response("A senha inicial deve ter entre 8 e 128 caracteres.", 400);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId)) {
    return response("A empresa selecionada é inválida.", 400);
  }

  const { data: client, error: clientError } = await adminClient
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .maybeSingle();

  if (clientError || !client) return response("A empresa selecionada não foi encontrada.", 404);

  const { count, error: countError } = await adminClient
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("role", "client");

  if (countError) return response("Não foi possível verificar o limite de usuários.", 500);
  if ((count ?? 0) >= 6) return response("Esta empresa já atingiu o limite de 6 usuários.", 409);

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !created.user) {
    return response(createError?.message || "Não foi possível criar o acesso.", 400);
  }

  const { error: profileError } = await adminClient.from("profiles").insert({
    id: created.user.id,
    full_name: fullName,
    role: "client",
    client_id: clientId,
    must_change_password: false,
  });

  if (profileError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return response("Não foi possível vincular o acesso à empresa. Nenhum usuário foi mantido.", 500);
  }

  return NextResponse.json({
    success: true,
    user: { id: created.user.id, full_name: fullName },
  });
}
