import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function fail(message: string, status: number) { return NextResponse.json({ error: message }, { status }); }
function makeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("A configuração segura do servidor está incompleta.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
async function authorize(request: NextRequest) {
  const supabase = makeClient();
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/, "") || "";
  if (!token) return { error: fail("Sessão não encontrada. Entre novamente.", 401) };
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { error: fail("Sua sessão expirou. Entre novamente.", 401) };
  const { data: profile, error: profileError } = await supabase.from("profiles").select("id, role, client_id, is_primary").eq("id", data.user.id).maybeSingle();
  if (profileError || profile?.role !== "client" || profile.is_primary !== true || !profile.client_id) return { error: fail("Somente o usuário principal pode gerenciar os acessos da empresa.", 403) };
  return { supabase, clientId: profile.client_id };
}
async function details(supabase: ReturnType<typeof makeClient>, profile: { id: string; full_name: string | null; created_at: string }) {
  const { data } = await supabase.auth.admin.getUserById(profile.id);
  return { id: profile.id, full_name: profile.full_name || "Nome não informado", email: data.user?.email || "E-mail indisponível", active: !data.user?.banned_until || Date.parse(data.user.banned_until) <= Date.now(), created_at: profile.created_at };
}

export async function GET(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof authorize>>;
  try { auth = await authorize(request); } catch (e) { return fail(e instanceof Error ? e.message : "Erro de configuração.", 500); }
  if ("error" in auth) return auth.error;
  const { data: company } = await auth.supabase.from("clients").select("id, name").eq("id", auth.clientId).maybeSingle();
  if (!company) return fail("Não foi possível localizar a empresa vinculada.", 404);
  const { data: profiles, error } = await auth.supabase.from("profiles").select("id, full_name, created_at").eq("client_id", auth.clientId).eq("role", "client").eq("is_primary", false).order("created_at", { ascending: true });
  if (error) return fail("Não foi possível carregar os usuários adicionais.", 500);
  const users = await Promise.all((profiles || []).map(p => details(auth.supabase, p)));
  return NextResponse.json({ company, users, limit: 6, total: users.length + 1 });
}

export async function POST(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof authorize>>;
  try { auth = await authorize(request); } catch (e) { return fail(e instanceof Error ? e.message : "Erro de configuração.", 500); }
  if ("error" in auth) return auth.error;
  let body: { fullName?: unknown; email?: unknown; password?: unknown };
  try { body = await request.json(); } catch { return fail("Os dados enviados são inválidos.", 400); }
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!fullName || fullName.length > 120) return fail("Informe um nome válido de até 120 caracteres.", 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return fail("Informe um e-mail válido.", 400);
  if (password.length < 8 || password.length > 128) return fail("A senha inicial deve ter entre 8 e 128 caracteres.", 400);
  const { count, error: countError } = await auth.supabase.from("profiles").select("id", { count: "exact", head: true }).eq("client_id", auth.clientId).eq("role", "client");
  if (countError) return fail("Não foi possível verificar o limite de acessos.", 500);
  if ((count ?? 0) >= 6) return fail("Sua empresa já atingiu o limite de 6 logins.", 409);
  const { data: created, error: createError } = await auth.supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
  if (createError || !created.user) return fail(createError?.message || "Não foi possível criar o acesso.", 400);
  const { error: profileError } = await auth.supabase.from("profiles").insert({ id: created.user.id, full_name: fullName, role: "client", client_id: auth.clientId, must_change_password: false, is_primary: false });
  if (profileError) { await auth.supabase.auth.admin.deleteUser(created.user.id); return fail("Não foi possível vincular o acesso à empresa. Nenhum usuário foi mantido.", 500); }
  return NextResponse.json({ success: true, message: "Novo acesso criado com sucesso." });
}

export async function PATCH(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof authorize>>;
  try { auth = await authorize(request); } catch (e) { return fail(e instanceof Error ? e.message : "Erro de configuração.", 500); }
  if ("error" in auth) return auth.error;
  let body: { action?: unknown; userId?: unknown; fullName?: unknown; email?: unknown; password?: unknown; active?: unknown };
  try { body = await request.json(); } catch { return fail("Os dados enviados são inválidos.", 400); }
  const action = typeof body.action === "string" ? body.action : "";
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!uuidPattern.test(userId)) return fail("Usuário inválido.", 400);
  const { data: target, error } = await auth.supabase.from("profiles").select("id").eq("id", userId).eq("client_id", auth.clientId).eq("role", "client").eq("is_primary", false).maybeSingle();
  if (error || !target) return fail("Este usuário adicional não pertence à sua empresa.", 404);
  if (action === "edit") {
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!fullName || fullName.length > 120) return fail("Informe um nome válido de até 120 caracteres.", 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return fail("Informe um e-mail válido.", 400);
    const { error: authError } = await auth.supabase.auth.admin.updateUserById(userId, { email, email_confirm: true, user_metadata: { full_name: fullName } });
    if (authError) return fail(authError.message, 400);
    const { error: updateError } = await auth.supabase.from("profiles").update({ full_name: fullName }).eq("id", userId).eq("client_id", auth.clientId);
    if (updateError) return fail("O e-mail foi atualizado, mas não foi possível atualizar o nome.", 500);
    return NextResponse.json({ success: true, message: "Dados atualizados." });
  }
  if (action === "status") {
    if (typeof body.active !== "boolean") return fail("Informe o status desejado.", 400);
    const { error: statusError } = await auth.supabase.auth.admin.updateUserById(userId, { ban_duration: body.active ? "none" : "876000h" });
    if (statusError) return fail(statusError.message, 400);
    return NextResponse.json({ success: true, message: body.active ? "Acesso reativado." : "Acesso desativado." });
  }
  if (action === "password") {
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 8 || password.length > 128) return fail("A nova senha deve ter entre 8 e 128 caracteres.", 400);
    const { error: passwordError } = await auth.supabase.auth.admin.updateUserById(userId, { password });
    if (passwordError) return fail(passwordError.message, 400);
    return NextResponse.json({ success: true, message: "Senha redefinida com sucesso." });
  }
  return fail("Ação de gerenciamento desconhecida.", 400);
}
