# PRINCIPIO.md — Fonte de Verdade do Produto (P&A Contabilidade Digital)

> ATUALIZACAO (set/2026): o sistema deixou de ser uma plataforma multi-empresa com painel administrativo.
> Agora e o sistema de contabilidade de UMA empresa ja cadastrada — a P&A Contabilidade Digital.
> O login cai direto nos modulos (`/dashboard`, `/clientes`, `/documentos`, ...); a empresa e resolvida
> pelo `profiles.org_id` do usuario logado, nunca pela URL. Nao existem mais `/empresas`, `/empresas/nova`
> nem "Trocar de empresa". Marca, cores e modulos ficam em `/empresa` ("Minha empresa", so admins).
> As secoes abaixo que descrevem "Painel ConcilIA" e `/empresas/:id/*` sao HISTORICO do modelo anterior.

> PARE. Leia este documento inteiro antes de escrever qualquer codigo.
> Ele e a fonte de verdade do produto e substitui qualquer instrucao anterior que conflite.

---

## CONTEXTO — o que ja foi feito (nao refazer)

- PR #9 (merged): design system CSS moderno (card-section, glass-card, stat-card, modern-table etc.) aplicado a todas as telas autenticadas. PRESERVAR integralmente.
- PR #10 (merged): botao de recolher sidebar movido para o header. PRESERVAR.
- Clientes de teste ("Igreja Batista Central" e "Igreja Vida Nova") ja deletados do Supabase.
- Branch de trabalho: `claude/multi-client-platform-refactor-odhye3` (resetada em cima de origin/main).
- CORRECAO IMPORTANTE: em instrucao anterior foi dito que o primeiro cliente real seria "BA" — isso estava ERRADO. A empresa real e "P&A Contabilidade Digital" (azul #0072CE, grafite #3A3A3A, fonte Montserrat). Nenhuma referencia a "BA" deve existir.
- PR #18 (merged): glass morphism aplicado a todo o design system. PRESERVAR.
- Refatoracao single-tenant: camada `/empresas` removida; modulos movidos para rotas de topo; login rebrandado P&A.

---

## MODELO DE DOMINIO DEFINITIVO

Existem DUAS entidades diferentes que vinham sendo chamadas de "cliente". A partir de agora a nomenclatura e fixa:

1. **EMPRESA** (tenant / white label) — uma contabilidade que contrata a ConcilIA. Ex.: P&A Consultoria. Tem: nome, CNPJ, logo, cor primaria, cor de acento, status (ativa/suspensa/trial). Cada empresa e um ambiente isolado com a marca dela.

2. **CLIENTE** (cliente final) — uma organizacao atendida POR uma empresa (igreja, comercio etc.). Vive DENTRO do ambiente de uma empresa. Tem: razao social, nome fantasia, CNPJ, contato, origens de documentos, link de upload proprio (token, sem login). Todo cliente pertence a exatamente uma empresa (`empresa_id`).

**Quem usa o sistema NESTA FASE:** apenas a administradora da plataforma (super admin). Nao existe login para equipes das empresas ainda — isso e fase futura (manter `empresa_id` em todas as tabelas e RLS preparada, mas NAO construir telas de equipe, convites ou permissoes agora; se ja existirem, mante-las funcionais porem fora da navegacao principal).

**Clientes finais NUNCA logam** — so acessam a pagina publica `/upload/:token` (e futuramente `/painel/:token`, ainda nao construir).

---

## O FLUXO QUE O SISTEMA DEVE TER

1. Admin loga → cai no **Painel ConcilIA** (marca ConcilIA: verde #16A34A, cinzas, Sora/Inter): lista das empresas com cards de resumo, botao "Nova Empresa" (fluxo de primeira classe: dados + upload de logo + cores com preview ao vivo), acoes de suspender/reativar.

2. Admin clica numa empresa → **ENTRA no ambiente dela como sistema completo**, nao como pagina de resumo. O app-shell troca de contexto: sidebar e header assumem logo e cores da empresa, e a navegacao passa a ser a do sistema contabil daquela empresa: Dashboard · Clientes · Documentos · Competencias · Configuracoes. Um botao discreto "← Voltar a ConcilIA" retorna ao painel admin.

3. Dentro do ambiente da empresa, "Clientes" sao os clientes finais dela: CRUD completo, e cada um com aba/tela de Link de Upload (link publico com token, copiar, rotacionar com confirmacao).

4. `/upload/:token` (pagina publica, mobile-first): marca da EMPRESA dona do cliente, saudacao com nome do cliente, multi-arquivo (PDF/OFX/XLSX/CSV/JPG/PNG, 20MB), tipo de documento + mes de referencia (padrao mes anterior), progresso por arquivo, duplicado bloqueado por hash, token invalido = pagina de erro amigavel.

---

## REFATORACAO — implementacao tecnica

### Etapa A — Dominio e nomenclatura
Separar as entidades Empresa e Cliente no banco e no codigo (migration com preservacao de dados; a tabela hoje chamada `clientes` no nivel raiz representa empresas — renomear/estruturar conforme necessario). Criar a empresa real "P&A Consultoria". Garantir `empresa_id` em todas as tabelas operacionais + RLS.

### Etapa B — Ambiente da empresa como sistema
Converter a rota de detalhe da empresa em rota-layout (`route.tsx` com `<Outlet />`) com rotas-filhas: `index` (dashboard da empresa), `clientes` (lista + detalhe do cliente final), `documentos`, `competencias`, `configuracoes`. NAO criar rotas de `lancamentos`, `conciliacao` ou `relatorios` ainda — sao modulos futuros; a navegacao pode exibi-los como itens desabilitados "Em breve", nada alem disso.

### Etapa C — App-shell com contexto
Dentro de `/empresas/:id/*` o shell aplica branding da empresa (tokens CSS carregados do banco: logo, cor primaria, acento) e navegacao do sistema contabil; fora dele, marca e navegacao ConcilIA. Transicao limpa, sem flash de tema errado.

### Etapa D — Fluxo Nova Empresa
Tela de primeira classe (nao enterrada em aba): dados, upload de logo para o Storage, cores com preview ao vivo do sidebar/botoes.

### Etapa E — Upload publico
Implementar/ajustar `/upload/:token` conforme o fluxo acima, via Edge Function com service role (a pagina publica nunca consulta tabelas com anon key).

---

## METODO DE TRABALHO (obrigatorio)

1. **Auditoria primeiro** (somente leitura): liste rotas, tabelas e telas atuais e aponte em 1 pagina o delta em relacao a este documento. Apresente e AGUARDE OK.
2. **Uma etapa (A→E) por vez.** Ao fim de cada uma: build + lint + teste manual do fluxo afetado, commit descritivo, e diga em 3 linhas o que mudou e como testar.
3. **Git sempre, Lovable nunca.** Todo trabalho via git com PR. Antes de abrir PR, verifique se o anterior esta fechado/merged — nunca sobrepor PRs abertos. Trabalhe na branch `claude/multi-client-platform-refactor-odhye3`.
4. **Checklist de aceite final:**
   - [ ] Login do admin cai no Painel ConcilIA com a lista de empresas e "Nova Empresa" funcional (logo + cores com preview)
   - [ ] Entrar na P&A muda todo o shell para a marca dela e mostra navegacao de sistema completa
   - [ ] "← Voltar a ConcilIA" retorna ao painel admin com a marca ConcilIA
   - [ ] CRUD de clientes finais dentro da P&A, cada um com link de upload copiavel e rotacionavel
   - [ ] `/upload/:token` funciona sem login, com a marca da P&A; duplicado bloqueado; token invalido tratado
   - [ ] Nenhuma referencia a "BA" ou aos clientes de teste; empresa real = P&A Consultoria
   - [ ] Design system dos PRs #9/#10 preservado em todas as telas
   - [ ] Zero telas novas de equipe/convites/permissoes; modulos futuros no maximo como "Em breve" desabilitado

---

## REGRAS PERMANENTES

- Sempre leia o arquivo antes de editar; edicao pontual > reescrita.
- Preserve abas, sub-abas, rotas e funcionalidades existentes conformes — nunca remova sem instrucao explicita.
- Ambiguidade ou conflito com este documento → PERGUNTE antes de implementar. Nao invente escopo.
- Interface 100% pt-BR, datas dd/mm/aaaa, estados vazios orientativos, loading states e toasts.
