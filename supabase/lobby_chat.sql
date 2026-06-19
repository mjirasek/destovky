-- Destovky lobby chat setup.
-- Paste this file into Supabase SQL Editor and run it for the project used by
-- VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.

create table if not exists public.lobby_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.lobby_messages enable row level security;

drop policy if exists "signed-in users can read lobby messages" on public.lobby_messages;
drop policy if exists "public can read lobby messages" on public.lobby_messages;
create policy "public can read lobby messages"
on public.lobby_messages for select
to anon, authenticated
using (true);

drop policy if exists "signed-in users can create lobby messages" on public.lobby_messages;
create policy "signed-in users can create lobby messages"
on public.lobby_messages for insert
to authenticated
with check ((select auth.uid()) = user_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'lobby_messages'
  ) then
    alter publication supabase_realtime add table public.lobby_messages;
  end if;
end $$;
