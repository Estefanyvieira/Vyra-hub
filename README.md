# VYRA HUB — MVP inicial

Aplicação web inicial em Next.js + Supabase, com identidade visual VYRA.

## O que está incluído
- Site de entrada e login por e-mail/senha.
- Painel administrativo com listagem e cadastro de clientes.
- Área individual de cliente.
- Calendário editorial com aprovação, solicitação de alteração e comentários.
- Esquema SQL com Row Level Security (RLS) para separar os dados por cliente.

## Importante
Este projeto é um ponto de partida técnico, não uma plataforma já publicada. É necessário configurar o Supabase, executar e revisar `supabase/schema.sql`, criar os usuários/perfis e fazer deploy. Não há credenciais reais incluídas.

## Configuração
1. Crie um projeto em https://supabase.com.
2. No SQL Editor, execute `supabase/schema.sql`.
3. Copie `.env.example` para `.env.local` e preencha URL e chave anon/public do projeto.
4. Instale Node.js 20 ou superior.
5. Rode `npm install` e `npm run dev`.
6. Acesse http://localhost:3000.

## Criar administradora e cliente
Crie primeiro os usuários em Supabase Dashboard > Authentication > Users. Depois, crie o cliente e associe os perfis via SQL. Exemplo:

```sql
-- Criar um registro de cliente (anote o UUID retornado)
insert into public.clients(name, service_summary)
values ('Evilyn Buck', 'Extensão de cílios e micropigmentação')
returning id;

-- Depois de criar cada usuário em Authentication, use seu UUID:
insert into public.profiles(id, full_name, role, client_id, must_change_password)
values ('UUID-DO-USUARIO-ADMIN', 'Estefany', 'admin', null, false);

insert into public.profiles(id, full_name, role, client_id, must_change_password)
values ('UUID-DO-USUARIO-EVILYN', 'Evilyn Buck', 'client', 'UUID-DO-CLIENTE', true);
```

Para ativar troca obrigatória de senha, implemente a tela de alteração de senha no fluxo de primeiro acesso antes de liberar o dashboard. O campo `must_change_password` já está preparado no perfil, mas a tela/fluxo ainda precisa ser concluído antes de uso real.

## Segurança antes de produção
- Revise as políticas RLS com testes usando contas separadas.
- Configure recuperação de senha e confirmação de e-mail.
- Implemente fluxo de primeiro acesso e alteração obrigatória de senha.
- Configure Storage com políticas por `client_id` para arquivos privados.
- Restrinja a criação de clientes/perfis a uma função administrativa segura; não use chave `service_role` no browser.
- Adicione telas completas de briefing, apresentação, portfólio, contratos e gestão de publicações.
