# P&A Connect

Prompt Lovable 01 — Fundação + Módulo de Clientes (P&A Consultoria)

Cole o bloco abaixo no Lovable como primeiro prompt do projeto. Ele cria a fundação (auth, layout, schema, RLS) e o Módulo 01 completo — o escopo do MVP de 19/08.

Crie um sistema web de contabilidade inteligente para um escritório contábil chamado P&A Consultoria, conectado ao Supabase. Este é o primeiro prompt de um projeto maior — construa uma fundação sólida e extensível.

Contexto do negócio

A P&A é um escritório contábil de Brasília cuja carteira é majoritariamente de organizações do terceiro setor (igrejas). Hoje os clientes enviam documentos contábeis por e-mail, a equipe baixa manualmente e concilia no software IOB. O sistema vai centralizar a recepção de documentos, processá-los com IA e automatizar a conciliação contábil. Nesta primeira fase, construa apenas a fundação e o Módulo de Gestão de Clientes e Recepção de Documentos.

Usuários

Equipe do escritório (admin e operador): faz login com e-mail/senha via Supabase Auth. Vê tudo.

Cliente final (igreja/organização): NUNCA faz login. Acessa apenas uma página pública de upload via link com token seguro.

Schema do banco (Supabase)

Crie estas tabelas com migrations. Todas com id uuid default gen_random_uuid(), created_at, updated_at, e soft delete via deleted_at (nunca deletar fisicamente). Todas as tabelas de dados carregam org_id (multi-tenant desde o dia 1, mesmo com um único tenant agora).

organizations — org_id raiz do tenant: nome, logo_url, cor_primaria

profiles — vinculada a auth.users: org_id, nome, email, papel ('admin' | 'operador')

clientes — os clientes do escritório: org_id, razao_social, nome_fantasia, cnpj, email_contato, telefone, origem_documentos (array de texto: 'conta_azul', 'aprisco', 'email', 'extrato', 'folha_externa'), upload_token (uuid único, para o link público), painel_token (uuid único, reservado para fase futura), ativo (boolean), deleted_at

competencias — período contábil por cliente: org_id, cliente_id, mes_ano (date, dia 1 do mês), status ('aberta' | 'em_conciliacao' | 'fechada'), fechada_em, fechada_por. Única por (cliente_id, mes_ano).

documentos — arquivos recebidos: org_id, cliente_id, competencia_id (nullable), tipo ('extrato' | 'conta_azul' | 'aprisco' | 'folha' | 'nota_fiscal' | 'outro'), origem ('upload_link' | 'email' | 'manual'), arquivo_path (Supabase Storage), nome_original, tamanho_bytes, hash_sha256 (para bloquear duplicados), status_processamento ('recebido' | 'processando' | 'processado' | 'erro'), erro_motivo (nullable), enviado_em

plano_contas — plano de contas por cliente: org_id, cliente_id, codigo, descricao, tipo_conta, ativo. (Só a tabela e o CRUD simples — a importação do layout IOB vem em prompt futuro.)

Regras de segurança (obrigatórias)

RLS habilitado em TODAS as tabelas: usuário autenticado só acessa linhas do seu org_id (via profile).

A página pública de upload NÃO usa a anon key para ler tabelas diretamente: crie uma Edge Function que recebe o token, valida contra clientes.upload_token, e faz o upload/insert com service role. O token nunca expõe dados do cliente além do nome fantasia.

Bucket privado documentos no Storage, organizado em org_id/cliente_id/ano-mes/arquivo.

Documentos com hash_sha256 já existente para o mesmo cliente são rejeitados com aviso amigável de duplicado.

Telas e fluxos

Área da equipe (autenticada)

Layout: sidebar fixa à esquerda com navegação: Dashboard, Clientes, Documentos, Competências, Configurações. Header com nome do usuário e logout.

Dashboard: cards de resumo (total de clientes ativos, documentos recebidos no mês, documentos com erro, competências abertas) e lista dos últimos 10 documentos recebidos.

Clientes: listagem com busca e filtro por ativo/inativo. Botão "Novo cliente" abre formulário (razão social, nome fantasia, CNPJ com máscara e validação, e-mail, telefone, origens de documentos como multi-select). Na página de detalhe do cliente, abas: Dados, Documentos, Competências, Link de Upload. Na aba Link de Upload: exibir o link público completo, botão copiar, botão "Gerar novo link" (rotaciona o token e invalida o anterior, com confirmação).

Documentos: tabela com filtros por cliente, tipo, status e período. Colunas: cliente, nome do arquivo, tipo, origem, status (badge colorido), data. Ação de baixar o arquivo e de reprocessar (por ora apenas volta o status para 'recebido'). Upload manual pela equipe também possível aqui (selecionando cliente e tipo).

Competências: visão por cliente e mês com status. Ação de criar competência do mês e de fechar competência (com confirmação — fechada fica somente leitura).

Página pública de upload — /upload/:token

Mobile-first, sem login. Valida o token via Edge Function; token inválido mostra página de erro amigável.

Mostra saudação com o nome fantasia do cliente e instrução simples.

Área de arrastar/soltar + botão de selecionar arquivos. Aceita PDF, OFX, XLSX, CSV, JPG, PNG. Múltiplos arquivos. Limite 20MB por arquivo.

O remetente escolhe o tipo do documento (extrato, relatório Conta Azul, relatório Aprisco, folha, nota fiscal, outro) e o mês de referência (padrão: mês anterior).

Barra de progresso por arquivo, confirmação visual de sucesso e mensagem clara em caso de duplicado ou erro.

Linguagem simples, em português, pensada para tesoureiro de igreja sem familiaridade com tecnologia.

Design

Interface em português (pt-BR), limpa e profissional.

Paleta provisória: primária azul-petróleo escuro (#1B4B5A), acento dourado (#C9A227), fundos claros neutros. Tipografia sans-serif moderna. (A identidade definitiva da P&A será aplicada depois — use tokens/variáveis CSS para as cores para facilitar a troca.)

Estados vazios com orientação ("Nenhum cliente ainda — cadastre o primeiro"), loading states e toasts de feedback em todas as ações.

Instruções técnicas obrigatórias

Use Supabase Auth, Database, Storage e Edge Functions.

Multi-tenant: TODA query filtra por org_id; crie um seed com uma organization "P&A Consultoria", um usuário admin e 2 clientes de exemplo.

Datas e números em formato brasileiro (dd/mm/aaaa).

Código organizado para crescer: este sistema receberá módulos de leitura de documentos com IA, conciliação contábil e relatórios nos próximos prompts.

IMPORTANTE: em qualquer atualização futura, preserve todas as abas, sub-abas, rotas e funcionalidades existentes. Nunca remova ou simplifique telas já criadas sem instrução explícita.

Não implemente nada de conciliação, leitura por IA ou relatórios ainda — apenas o descrito acima.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://pap-docs.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b9d35ae2-0325-4723-bd12-9f2f3754c9dc).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
