create table if not exists trip_sync (
  id integer primary key,
  revision bigint not null default 0,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint trip_sync_singleton check (id = 1)
);

insert into trip_sync (id, revision, payload)
values (1, 0, '{}'::jsonb)
on conflict (id) do nothing;
