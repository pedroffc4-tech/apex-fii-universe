# HANDOVER.md — Estado atual do Apex FII Universe

> Arquivo MUTÁVEL. Atualizar sempre que uma nova semana for processada ou ao "fecha a sessão".
> As regras fixas e a arquitetura do projeto estão no `CLAUDE.md`.

---

## ⚠️ Nota sobre esta atualização (07/07/2026)

Este arquivo foi **reescrito do zero**, lendo diretamente o código-fonte do `index.html` atual — porque o dossiê original (usado na v1 deste projeto) estava desatualizado: descrevia um fluxo de geração manual de Excel/HTML que **não existe mais**. O app hoje é uma aplicação viva ligada ao Supabase (ver `CLAUDE.md`, seção 1).

Os números abaixo vieram de textos e comentários encontrados no próprio `index.html` (referências de template/última renderização), **não de uma consulta ao vivo no Supabase**. Ou seja, podem estar um pouco desatualizados em relação ao banco real. Recomendo confirmar os números atuais abrindo o site (`https://apex-fii-universe.vercel.app`) na aba **Administração** ou **Visão Geral** antes de considerar isso 100% preciso.

---

## Situação de referência encontrada no código

- **Data referenciada no cabeçalho:** 02/06/2026
- **Trackrecord:** 21 semanas
- **Ranking (Estabilidade):** "146 fundos elegíveis ao menos 1x" · período referenciado: 05/01/2026 a 02/06/2026
- Exemplo de topo do ranking encontrado no código: **AFHI11** — 21/21 semanas, 100% de consistência (isso é só um exemplo capturado no template; não assumir que é o ranking completo atual)

### ⚠️ Pontos que precisam de confirmação com o Pedro / com o Supabase ao vivo
- Quantos fundos elegíveis e não elegíveis existem **na semana mais recente de fato processada** (pode já ser mais recente que 02/06/2026 — depende de quando alguém rodou o upload pela última vez na aba Administração).
- Se a migração `ALTER TABLE semanas ADD COLUMN IF NOT EXISTS deleted_at ...` já foi aplicada no Supabase (o próprio Admin do app avisa que ela é pré-requisito pra exclusão de semanas funcionar).
- Se os índices de performance documentados no `CLAUDE.md` (seção 9) já foram criados ou ainda são só documentação.
- Se há semanas ocultas (soft-deleted) atualmente.

---

## Pendências conhecidas

- ⏳ **Fase 2** (dados complementares CVM + Yahoo Finance completo + link de relatório gerencial via Status Invest) — ainda não implementada na tabela de Fundos Elegíveis. Disclaimer permanece visível no app.
- ⏳ Confirmar aplicação das migrações de RLS e índices no Supabase (documentadas mas não confirmadas como aplicadas).
- 🔧 Setup em andamento: Pedro está migrando o fluxo de trabalho para o **Claude Code** local (Git + Supabase MCP em modo somente-leitura), saindo do modelo "gerar arquivo no chat" para "editar o repositório direto".

---

## Ambiente do Pedro (para contexto de suporte)

- Sistema: **Windows**
- Ferramentas já instaladas e confirmadas funcionando: **Git** (2.53.0), **Claude Code** (2.1.202)
- Repositório já clonado localmente em: `C:\Users\PedroFerraçoFittipal\Documents\apex-fii-universe`
- Perfil não-técnico — sempre confirmar comandos passo a passo, um por vez, e usar linguagem simples.

---

## Histórico de segmentos e critérios (não muda — ver CLAUDE.md)

Critérios, mapeamento de colunas do BTG Guide, paleta de cores e os 16 segmentos estão documentados no `CLAUDE.md` e permanecem os mesmos confirmados no código atual do `index.html`.
