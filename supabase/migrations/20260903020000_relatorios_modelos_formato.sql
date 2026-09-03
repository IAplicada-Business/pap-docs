-- Relatórios: catálogo de modelos ampliado, formato de saída e parâmetros de emissão
alter table public.relatorios drop constraint if exists relatorios_tipo_check;
alter table public.relatorios add constraint relatorios_tipo_check
  check (tipo = any (array[
    'balancete','dre','balanco','dfc','razao','diario',
    'livro_caixa','conciliacao','pendencias','extrato_lancamentos'
  ]));

alter table public.relatorios add column if not exists formato text not null default 'pdf';
alter table public.relatorios add column if not exists parametros jsonb;
alter table public.relatorios drop constraint if exists relatorios_formato_check;
alter table public.relatorios add constraint relatorios_formato_check check (formato in ('pdf','xlsx'));

comment on column public.relatorios.formato is 'Formato de saída da emissão: pdf ou xlsx';
comment on column public.relatorios.parametros is 'Opções da emissão (período, enviar por e-mail, observações etc.)';
