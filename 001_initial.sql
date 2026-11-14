create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('admin','secretaria','instrutor');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.student_status as enum ('aguardando_agendamento','prova_marcada','prova_realizada','aprovado','reprovado','reagendar');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.exam_category as enum ('A','B','AB');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.session_category as enum ('carro','moto');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.appointment_status as enum ('agendada','realizada','reagendada','cancelada','ausente');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.exam_result as enum ('aprovado','reprovado');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.user_roles(
  user_id uuid references auth.users(id) on delete cascade,
  role public.app_role not null,
  primary key(user_id,role)
);
create table if not exists public.students(
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  renach text not null unique,
  category public.exam_category not null,
  instructor_name text,
  registered_on date not null default current_date,
  notes text,
  status public.student_status not null default 'aguardando_agendamento',
  created_at timestamptz not null default now()
);
create table if not exists public.exam_sessions(
  id uuid primary key default gen_random_uuid(),
  scheduled_at timestamptz not null,
  category public.session_category not null,
  location text not null,
  notes text,
  created_at timestamptz not null default now()
);
create table if not exists public.exam_appointments(
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  session_id uuid references public.exam_sessions(id) on delete set null,
  scheduled_at timestamptz not null,
  location text not null,
  status public.appointment_status not null default 'agendada',
  result public.exam_result,
  created_at timestamptz not null default now()
);
create unique index if not exists one_student_per_session on public.exam_appointments(session_id,student_id) where session_id is not null and status <> 'cancelada';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,full_name,email)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),coalesce(new.email,''))
  on conflict(id) do update set email=excluded.email;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.has_role(_uid uuid,_role public.app_role)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.user_roles where user_id=_uid and role=_role)
$$;
create or replace function public.is_operator(_uid uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.has_role(_uid,'admin') or public.has_role(_uid,'secretaria')
$$;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.students enable row level security;
alter table public.exam_sessions enable row level security;
alter table public.exam_appointments enable row level security;

create policy "authenticated read profiles" on public.profiles for select to authenticated using (true);
create policy "self update profile" on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy "read own role or admin" on public.user_roles for select to authenticated using(user_id=auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "staff read students" on public.students for select to authenticated using(true);
create policy "operator insert students" on public.students for insert to authenticated with check(public.is_operator(auth.uid()) or public.has_role(auth.uid(),'instrutor'));
create policy "operator update students" on public.students for update to authenticated using(public.is_operator(auth.uid()) or public.has_role(auth.uid(),'instrutor')) with check(public.is_operator(auth.uid()) or public.has_role(auth.uid(),'instrutor'));
create policy "staff read sessions" on public.exam_sessions for select to authenticated using(true);
create policy "operator manage sessions" on public.exam_sessions for all to authenticated using(public.is_operator(auth.uid())) with check(public.is_operator(auth.uid()));
create policy "staff read appointments" on public.exam_appointments for select to authenticated using(true);
create policy "operator manage appointments" on public.exam_appointments for all to authenticated using(public.is_operator(auth.uid())) with check(public.is_operator(auth.uid()));

grant usage on schema public to authenticated;
grant select,insert,update on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select,insert,update on public.students to authenticated;
grant select,insert,update,delete on public.exam_sessions to authenticated;
grant select,insert,update,delete on public.exam_appointments to authenticated;
