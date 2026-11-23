-- Golf Scorer: run this once in Supabase (SQL Editor > New query > Run).
-- Every piece of a round (setup, players, scores, stats, Wolf picks) is one row.

create table if not exists public.entries (
  code text not null,
  k text not null,
  v jsonb,
  updated_at timestamptz not null default now(),
  primary key (code, k)
);

create index if not exists entries_player_idx on public.entries (k) where k like 'p|%';

alter table public.entries enable row level security;

-- Version 1: anyone with the app can read and write rounds; a round is found by its 6-letter code.
drop policy if exists "app read" on public.entries;
drop policy if exists "app insert" on public.entries;
drop policy if exists "app update" on public.entries;
create policy "app read" on public.entries for select to anon, authenticated using (true);
create policy "app insert" on public.entries for insert to anon, authenticated with check (true);
create policy "app update" on public.entries for update to anon, authenticated using (true) with check (true);

-- Send changes to every phone in the round as they happen.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'entries'
  ) then
    alter publication supabase_realtime add table public.entries;
  end if;
end $$;
