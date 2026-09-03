-- Nome curto da empresa para sidebar e cabeçalhos (ex.: "P&A" em vez de "P&A Contabilidade Digital")
alter table public.organizations add column if not exists nome_curto text;
comment on column public.organizations.nome_curto is 'Nome curto exibido na sidebar e cabeçalhos (ex.: P&A)';

-- Seed P&A: nome curto e logo do repositório (substituível pelo upload em /empresas/:id/gerenciar)
update public.organizations
set nome_curto = coalesce(nome_curto, 'P&A'),
    logo_url = coalesce(logo_url, '/logo-pa-icon.svg')
where id = '11111111-1111-1111-1111-111111111111';
