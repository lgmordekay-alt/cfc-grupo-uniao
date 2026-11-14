# CFC GRUPO UNIÃO — Sistema de controle de provas

Versão reconstruída e independente do Lovable, feita com React + Vite + Supabase.

## O que está incluído
- Login por e-mail e senha via Supabase Auth.
- Painel com indicadores de alunos.
- Cadastro, edição e pesquisa de alunos.
- Agenda com datas/sessões de prova.
- Inclusão de alunos em uma data de prova.
- Registro individual de situação: agendado, compareceu, aprovado, reprovado ou ausente.
- Edição manual de dados e situação pelo sistema.
- Interface responsiva em azul e branco.

## Executar
1. Instale Node.js 20 ou superior.
2. Copie `.env.example` para `.env`.
3. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com as credenciais públicas do seu projeto Supabase.
4. No terminal, dentro da pasta:
   ```bash
   npm install
   npm run dev
   ```
5. Abra o endereço local mostrado pelo Vite.

## Banco de dados
Execute o arquivo `supabase/migrations/001_initial.sql` no SQL Editor de um projeto Supabase novo.

Depois, crie o primeiro usuário em Supabase > Authentication > Users (Add user). O perfil será criado automaticamente. Para conceder papel de administrador, execute no SQL Editor:
```sql
insert into public.user_roles(user_id, role)
select id, 'admin' from auth.users
where email = 'SEU_EMAIL_DE_ADMIN'
on conflict do nothing;
```

Convide/cadastre os demais usuários pelo painel de autenticação do Supabase e atribua o papel adequado em `user_roles` (`secretaria` ou `instrutor`).

## Importante sobre a migração do sistema antigo
Este pacote é uma reconstrução funcional do código da aplicação, não uma cópia byte a byte do repositório Lovable. O banco de dados, contas de usuários, senhas, arquivos e histórico que existiam no sistema anterior não são transferidos automaticamente. Não apague nem desconecte o projeto antigo até exportar e conferir esses dados.

Nunca publique o arquivo `.env` ou compartilhe a chave `service_role`. Apenas a chave pública/anon deve ficar no frontend. As permissões reais devem permanecer protegidas por RLS no Supabase.
