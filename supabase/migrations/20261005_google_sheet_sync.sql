-- Extension additive : aucune donnée existante n'est réécrite, aucune policy RLS modifiée.
begin;
alter table public.prospects
  add column if not exists sheet_external_id text,
  add column if not exists sheet_payload_hash text;
create unique index if not exists prospects_user_sheet_external_id_key
  on public.prospects (user_id, sheet_external_id);

-- Seule la clé serveur peut appeler cette RPC. Invoker conserve les permissions de l'appelant.
create or replace function public.sync_google_sheet_prospects(
  p_user_id uuid, p_rows jsonb, p_dry_run boolean default true
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  item jsonb;
  target_id uuid;
  existing public.prospects%rowtype;
  exists_already boolean;
  changed boolean;
  payload_hash text;
  affected uuid;
  created_count integer := 0;
  updated_count integer := 0;
  unchanged_count integer := 0;
begin
  if p_user_id is null or p_dry_run is null or jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'invalid_sync_payload' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 200 then
    raise exception 'invalid_batch_size' using errcode = '22023';
  end if;
  -- Sérialise les lots d'un même propriétaire, y compris deux déclencheurs simultanés.
  perform pg_advisory_xact_lock(hashtextextended('prospectflow.sheet:' || p_user_id::text, 0));
  if (select count(distinct lower(value->>'externalId')) from jsonb_array_elements(p_rows)) <> jsonb_array_length(p_rows) then
    raise exception 'duplicate_external_id' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(item) is distinct from 'object'
      or coalesce(item->>'externalId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(length(btrim(item->>'entreprise')), 0) not between 1 and 120
      or coalesce(length(btrim(item->>'secteur')), 0) not between 1 and 120
      or coalesce(length(btrim(item->>'ville')), 0) not between 1 and 120
      or coalesce(item->>'statut', '') not in ('Nouveau', 'À vérifier', 'Brouillon prêt', 'Envoyé', 'Réponse reçue')
      or coalesce(length(item->>'email'), 0) > 254
      or coalesce(length(item->>'site_internet'), 0) > 2048
      or coalesce(length(item->>'prochaine_action'), 0) > 300 then
      raise exception 'invalid_sync_row' using errcode = '22023';
    end if;
    target_id := (item->>'externalId')::uuid;
    select * into existing from public.prospects where id = target_id;
    exists_already := found;
    if exists_already and (existing.user_id <> p_user_id
      or (existing.sheet_external_id is not null and existing.sheet_external_id <> target_id::text)) then
      raise exception 'identity_conflict' using errcode = 'P0001';
    end if;
    -- Ne pas dupliquer les 1 200+ prospects importés avant l'intégration.
    -- Aucune association approximative : renseigner leur ID existant dans le Sheet.
    if not exists_already and exists (
      select 1 from public.prospects p where p.user_id = p_user_id and (
        (nullif(item->>'email', '') is not null and lower(btrim(p.email)) = lower(item->>'email'))
        or (lower(regexp_replace(btrim(p.entreprise), '\s+', ' ', 'g')) = lower(item->>'entreprise')
          and lower(regexp_replace(btrim(p.ville), '\s+', ' ', 'g')) = lower(item->>'ville'))
      )
    ) then raise exception 'link_existing_prospect_id' using errcode = 'P0001'; end if;
    payload_hash := encode(sha256(convert_to(jsonb_build_array(item->>'entreprise', item->>'secteur', item->>'ville',
      item->>'email', item->>'site_internet', item->>'statut', item->>'prochaine_action')::text, 'UTF8')), 'hex');
    -- Comparer au dernier contenu du Sheet, pas aux modifications ultérieures faites dans le SaaS.
    changed := not exists_already or existing.sheet_external_id is null or existing.sheet_payload_hash is distinct from payload_hash;
    if not exists_already then created_count := created_count + 1;
    elsif changed then updated_count := updated_count + 1;
    else unchanged_count := unchanged_count + 1;
    end if;
    if not p_dry_run and changed then
      -- Seuls les sept champs du Sheet sont écrits ; notes, échéance et is_client sont préservés.
      insert into public.prospects as p
        (id, user_id, sheet_external_id, sheet_payload_hash, entreprise, secteur, ville, email, site_internet, statut, prochaine_action, created_at, updated_at)
      values (target_id, p_user_id, target_id::text, payload_hash, item->>'entreprise', item->>'secteur', item->>'ville',
        item->>'email', item->>'site_internet', item->>'statut', item->>'prochaine_action', now(), now())
      on conflict (id) do update set
        sheet_external_id = excluded.sheet_external_id,
        sheet_payload_hash = excluded.sheet_payload_hash,
        entreprise = excluded.entreprise, secteur = excluded.secteur, ville = excluded.ville,
        email = excluded.email, site_internet = excluded.site_internet, statut = excluded.statut,
        prochaine_action = excluded.prochaine_action, updated_at = excluded.updated_at
      where p.user_id = p_user_id and (p.sheet_external_id is null or p.sheet_external_id = excluded.sheet_external_id)
      returning id into affected;
      if affected is null then raise exception 'identity_conflict' using errcode = 'P0001'; end if;
    end if;
  end loop;
  return jsonb_build_object('created', created_count, 'updated', updated_count, 'unchanged', unchanged_count, 'dryRun', p_dry_run);
end;
$$;
revoke all on function public.sync_google_sheet_prospects(uuid, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.sync_google_sheet_prospects(uuid, jsonb, boolean) to service_role;
notify pgrst, 'reload schema';
commit;
