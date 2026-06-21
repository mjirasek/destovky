-- game_logs table: stores completed game records with full replay data
-- Run this in the Supabase SQL editor

create table if not exists public.game_logs (
  id            uuid default gen_random_uuid() primary key,
  game_id       text unique,                    -- nullable for local games; prevents duplicate saves for same game
  mode          text not null,                  -- 'multiplayer' | 'computer' | 'local'
  white_user_id uuid references auth.users(id) on delete set null,
  black_user_id uuid references auth.users(id) on delete set null,
  white_username text,
  black_username text,
  white_is_human boolean not null default true,
  black_is_human boolean not null default true,
  winner        text,                           -- 'white' | 'black' | null (draw/ongoing)
  status        text not null default 'finished', -- 'finished' | 'draw' | 'ongoing'
  engine_version text,                          -- e.g. 'Gen6', 'Gen6+Minimax', 'random'
  snapshots     jsonb not null default '[]',    -- full replay: array of serialized GameState
  notations     jsonb not null default '[]',    -- move notation strings
  move_count    int not null default 0,
  created_at    timestamptz not null default now()
);

-- Indexes
create index if not exists game_logs_created_at_idx on public.game_logs (created_at desc);
create index if not exists game_logs_white_user_idx on public.game_logs (white_user_id);
create index if not exists game_logs_black_user_idx on public.game_logs (black_user_id);
create index if not exists game_logs_mode_idx       on public.game_logs (mode);

-- RLS: everyone can view (public replay archive), anyone can insert (anon computer games included)
alter table public.game_logs enable row level security;

create policy "game_logs_select_all" on public.game_logs
  for select using (true);

create policy "game_logs_insert_all" on public.game_logs
  for insert with check (true);

-- Only the owning user (white player) can update their own game
create policy "game_logs_update_owner" on public.game_logs
  for update using (
    auth.uid() = white_user_id
    or auth.uid() = black_user_id
  );
