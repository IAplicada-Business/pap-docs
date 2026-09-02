-- =============================================================================
-- Seed: P&A Contabilidade Digital como primeiro escritório
-- Branding: #0072CE (azul), #3A3A3A (cinza escuro), Montserrat
-- =============================================================================

UPDATE public.escritorios
SET
  nome           = 'P&A Contabilidade Digital',
  cor_primaria   = '#0072CE',
  cor_acento     = '#3A3A3A',
  logo_url       = '/logo-pa.svg',
  plano          = 'pro',
  status         = 'ativo'
WHERE id = '11111111-1111-1111-1111-111111111111';
