-- AGENDA DE CITAS - ELEVEN CE STUDIOS
-- Pegar completo en Supabase > SQL Editor del proyecto que usa la app de Eleven CE.
-- Se puede correr más de una vez sin duplicar nada. Usa tablas nuevas con prefijo eleven_.

-- 1) Tablas
create table if not exists eleven_servicios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  duracion_min integer not null default 30,
  precio integer not null default 0,
  activo boolean default true
);

create table if not exists eleven_barberos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  activo boolean default true
);

create table if not exists eleven_citas (
  id uuid primary key default gen_random_uuid(),
  barbero_id uuid references eleven_barberos(id) on delete cascade,
  servicio_id uuid references eleven_servicios(id) on delete set null,
  cliente_nombre text not null,
  cliente_telefono text not null,
  fecha date not null,
  hora time not null,
  duracion_min integer not null,
  estado text not null default 'confirmada' check (estado in ('confirmada','cancelada')),
  created_at timestamptz default now()
);

-- Evita que dos personas reserven el mismo barbero a la misma hora
create unique index if not exists eleven_citas_unica on eleven_citas (barbero_id, fecha, hora) where estado = 'confirmada';
create index if not exists eleven_citas_fecha on eleven_citas (fecha);

-- 2) Vista pública SIN datos personales: solo horarios ocupados (para calcular disponibilidad)
create or replace view eleven_citas_ocupadas as
  select barbero_id, fecha, hora, duracion_min
  from eleven_citas
  where estado = 'confirmada';
grant select on eleven_citas_ocupadas to anon, authenticated;

-- 3) Quién es admin: usa la misma tabla administradores de la app
create or replace function eleven_es_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from administradores where email = (auth.jwt() ->> 'email'));
$$;

-- 4) Seguridad (RLS)
alter table eleven_servicios enable row level security;
alter table eleven_barberos enable row level security;
alter table eleven_citas enable row level security;

drop policy if exists "eleven leer servicios" on eleven_servicios;
drop policy if exists "eleven admin servicios" on eleven_servicios;
drop policy if exists "eleven leer barberos" on eleven_barberos;
drop policy if exists "eleven admin barberos" on eleven_barberos;
drop policy if exists "eleven crear citas" on eleven_citas;
drop policy if exists "eleven admin lee citas" on eleven_citas;
drop policy if exists "eleven admin actualiza citas" on eleven_citas;

create policy "eleven leer servicios" on eleven_servicios for select using (true);
create policy "eleven admin servicios" on eleven_servicios for all using (eleven_es_admin()) with check (eleven_es_admin());
create policy "eleven leer barberos" on eleven_barberos for select using (true);
create policy "eleven admin barberos" on eleven_barberos for all using (eleven_es_admin()) with check (eleven_es_admin());

-- Clientes: pueden crear citas, pero no leerlas
create policy "eleven crear citas" on eleven_citas for insert with check (estado = 'confirmada' and fecha >= current_date);
create policy "eleven admin lee citas" on eleven_citas for select using (eleven_es_admin());
create policy "eleven admin actualiza citas" on eleven_citas for update using (eleven_es_admin());

-- 5) Datos de ejemplo (solo si las tablas están vacías). EDITA nombres, duraciones y precios en Table Editor.
insert into eleven_servicios (nombre, duracion_min, precio)
select * from (values
  ('Corte', 30, 150),
  ('Corte + barba', 60, 250),
  ('Barba', 30, 100)
) as v(nombre, duracion_min, precio)
where not exists (select 1 from eleven_servicios);

insert into eleven_barberos (nombre)
select * from (values ('Barbero 1'), ('Barbero 2')) as v(nombre)
where not exists (select 1 from eleven_barberos);
