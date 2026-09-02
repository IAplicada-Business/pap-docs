-- Helpers ---------------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and papel = 'super_admin' and deleted_at is null
  );
$$;

create or replace function public.current_papel()
returns text
language sql stable security definer
set search_path = ''
as $$
  select papel from public.profiles where id = auth.uid();
$$;

grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.current_papel() to authenticated;

-- organizations: until now only SELECT was allowed (org_self_select), so every
-- UPDATE/INSERT from the app was silently dropped by RLS.
alter table public.organizations enable row level security;

drop policy if exists org_super_admin_select on public.organizations;
create policy org_super_admin_select on public.organizations
  for select to authenticated
  using ((select public.is_super_admin()));

drop policy if exists org_super_admin_insert on public.organizations;
create policy org_super_admin_insert on public.organizations
  for insert to authenticated
  with check ((select public.is_super_admin()));

drop policy if exists org_admin_update on public.organizations;
create policy org_admin_update on public.organizations
  for update to authenticated
  using (
    (select public.is_super_admin())
    or (id = (select public.current_org_id()) and (select public.current_papel()) in ('admin','super_admin'))
  )
  with check (
    (select public.is_super_admin())
    or (id = (select public.current_org_id()) and (select public.current_papel()) in ('admin','super_admin'))
  );

-- Platform owner account manages all empresas.
update public.profiles
set papel = 'super_admin'
where email = 'projetos@iaplicada.com' and papel = 'admin';
