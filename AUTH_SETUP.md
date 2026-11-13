# Configuracao do Supabase Auth

## Variaveis

Configure no desenvolvimento e na Vercel:

- `VITE_SUPABASE_URL`: URL publica do projeto Supabase, usada pelo frontend.
- `VITE_SUPABASE_ANON_KEY`: chave publica anon/publishable, usada pelo frontend.
- `SUPABASE_URL`: URL do projeto, usada pelo Express.
- `SUPABASE_ANON_KEY`: a mesma chave publica, usada pelo Express para validar JWT e consultar a allowlist com RLS.
- `APP_URL`: URL publica da aplicacao, usada nos QR Codes.

Nao configure `service_role` na aplicacao. O login de novos usuarios deve ser feito pelo painel Supabase; o frontend nao implementa cadastro.

## Administradores

1. Desative novos cadastros em **Authentication > Settings > User Signups** no Supabase.
2. Crie ou convide a conta em **Authentication > Users**.
3. Aplique `migrations/003_admin_auth_uid.sql` depois das migrations 001 e 002.
4. Autorize explicitamente a conta na tabela `public.admins`, vinculando o UUID da conta Auth:

```sql
INSERT INTO public.admins (auth_user_id, email, name, role)
SELECT id, email, 'Nome do administrador', 'admin'
FROM auth.users
WHERE id = 'UUID-DA-CONTA-AUTH';
```

Execute a insercao manualmente no SQL Editor depois de substituir os valores. A migration nao cria nem autoriza usuarios.

## Deploy

O frontend mantém a sessão Supabase no navegador. O Express valida o JWT e usa esse mesmo JWT nas operações administrativas, para que o RLS do PostgreSQL continue sendo aplicado. A persistência usa as tabelas `stores`, `vip_groups`, `access_events`, `click_events` e `distribution_settings`; não há gravação operacional em `data/vip_system.json`. A distribuição pública chama `public.route_vip_click_atomic`. O `server.ts` exporta o app Express para a função da Vercel e só abre listener quando executado localmente. O build Vite é publicado em `dist`; as rotas `/vip/*` e `/admin*` reescrevem para o `index.html`.

No ambiente remoto verificado, a chave publishable chega ao PostgreSQL, mas as consultas retornam `42501 permission denied for table ...`; isso indica falta de privilégios SQL para os papéis da aplicação, antes da avaliação das policies RLS. O arquivo `supabase/operations/grant_runtime_table_privileges.sql` contém apenas os GRANTs necessários e não foi executado. A publicação depende da autorização para aplicar esses privilégios e de validar a sessão administrativa real.
