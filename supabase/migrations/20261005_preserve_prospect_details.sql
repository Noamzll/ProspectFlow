-- Nécessaire uniquement pour conserver les trois fonctionnalités déjà présentes.
-- Ne recrée pas la table, ne modifie ni les sept colonnes métier ni les policies RLS.
begin;
alter table public.prospects
  add column if not exists notes text,
  add column if not exists prochaine_action_date date,
  add column if not exists is_client boolean not null default false;
notify pgrst, 'reload schema';
commit;
