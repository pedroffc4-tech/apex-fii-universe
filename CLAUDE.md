# CLAUDE.md — Projeto Apex FII Universe

> Lido automaticamente pelo Claude Code ao abrir esta pasta.
> Contém as regras e a arquitetura PERMANENTES do projeto.
> O estado mutável (última semana, pendências) fica no `HANDOVER.md`.
> **Nunca** altere critérios de elegibilidade, paleta de cores ou estrutura de abas sem aprovação explícita do usuário (Pedro).

---

## 0. Contexto e forma de trabalhar

- Especialista em FIIs (Fundos de Investimento Imobiliário) e desenvolvimento do dashboard interno **Apex FII Universe**, para a Apex Partners (gestora brasileira).
- Time de 5 analistas: **João V.**, **Lucas S.**, **Pedro C.**, **Pedro F.**, **Rafael P.**
- Pedro (o usuário) **não tem perfil técnico**:
  - Explicar sempre em português simples o que está sendo feito.
  - Entregar sempre resultado pronto pra uso (arquivo, ou app já funcionando), nunca só trecho de código solto.
  - Perguntar antes de decisões que não estão claras.
  - Mudanças devem ser **cirúrgicas** — não tocar em lógica de critérios ou visual sem pedido explícito.
- Ao final da sessão ("fecha a sessão"), atualizar o `HANDOVER.md`.

---

## 1. O que é o projeto — ARQUITETURA ATUAL (⚠️ mudou desde a v1)

**Importante:** a versão inicial deste projeto previa gerar, toda semana, um Excel de 22 abas + um HTML estático, entregues pelo Claude. **Isso foi superado.** Hoje o projeto é:

> **Um único arquivo `index.html`** (aplicação web self-contained, ~8.700+ linhas) que funciona como painel **vivo**, lendo e escrevendo diretamente no **Supabase**. Hospedado no **Vercel**, publicado automaticamente a cada `git push` no GitHub.

Ou seja:
- **Não se gera mais Excel semanal.** O universo de fundos, elegibilidade, histórico e ranking vivem nas tabelas do Supabase e são consultados ao vivo pelo JavaScript do `index.html`.
- **O upload do BTG FII Guide agora é feito dentro do próprio site**, na aba **Administração** — o usuário sobe o `.xlsx`, o próprio app valida, calcula elegibilidade e grava no banco. Claude não precisa mais gerar esse arquivo manualmente todas as semanas.
- O papel do Claude (aqui ou via Claude Code) passou a ser **desenvolver e manter o app**: novas funcionalidades, correções de bugs, ajustes de design, migrações de banco, revisões de código — não mais "rodar o pipeline semanal e entregar 2 arquivos".

---

## 2. Critérios de elegibilidade (IMUTÁVEIS — confirmados no código)

```js
const CRIT_VOL=400000, CRIT_YIELD=0.08, CRIT_PVP=1.15, CRIT_MKT=200000000;
// elegivel = vol3m > CRIT_VOL && dyAnual > CRIT_YIELD && pvpAtual < CRIT_PVP && mktcap > CRIT_MKT
```

| Critério | Regra |
|---|---|
| Volume médio 90d | > R$ 400.000 |
| Yield anualizado | > 8% (> 0,08 decimal) |
| P/VP | < 1,15 |
| Valor de Mercado | > R$ 200.000.000 |

---

## 3. Formato do BTG FII Guide (validação automática no Admin)

- Aba obrigatória: **`Stock Guide`**. Se não existir, upload é bloqueado.
- Dados começam na **linha 5** (índice 5, 0-based).
- Validação automática (`validarBTGGuide`) checa:
  - Aba "Stock Guide" existe
  - Pelo menos 10 linhas no arquivo
  - Colunas-chave no cabeçalho da linha 4 (Ticker, Nome, Segmento, Volume, Valor de Mercado, P/VPA, DY) — tolera pequenas variações, bloqueia se mais de 3 colunas críticas estiverem fora do lugar
  - Pelo menos 50 tickers válidos (regex `^[A-Z]{4}[0-9]{2}$`)
- Se inválido, a interface mostra os erros específicos e **bloqueia o processamento** — nunca deixa subir dado errado.

### Mapeamento de colunas (0-based, confirmado em `onBTGUpload`)

```
Col 1  = Ticker
Col 3  = Nome
Col 6  = Segmento
Col 8  = Vol. Médio 3 Meses (R$)   ← CRITÉRIO VOLUME
Col 9  = Preço de Fechamento
Col 12 = Valor de Mercado (R$)     ← CRITÉRIO MKTCAP
Col 13 = Valor Patrimonial (R$)
Col 14 = P/VP Atual                ← CRITÉRIO P/VP
Col 16 = DY LTM
Col 17 = DY Anualizado             ← CRITÉRIO YIELD
Col 20 = Retorno no Mês
Col 21 = Retorno no Ano
Col 22 = Retorno LTM
```

---

## 4. Fluxo semanal ATUAL (via app, não mais via Claude)

1. Analista entra na aba **Administração** do dashboard.
2. Preenche a data e o número da semana (o app sugere automaticamente).
3. Sobe o `.xlsx` do BTG FII Guide → validação automática.
4. App calcula elegibilidade dos ~200+ fundos e monta um **preview** (sem salvar ainda) com contagem de elegíveis/não elegíveis e movimentações vs. semana anterior.
5. Analista clica **"Confirmar e Salvar"** → grava em `semanas` + `fund_data` no Supabase, e sobe o arquivo original `.xlsx` para o Storage (bucket `fii-guides`) para download histórico.
6. Dashboard todo (Visão Geral, Segmentos, Ranking, Fundos Elegíveis) atualiza sozinho, lendo do Supabase.

**Papel do Claude nesse fluxo:** hoje é só suporte/dev — corrigir bug se a validação falhar, ajustar cálculo, adicionar campo. Claude não roda mais esse processo manualmente.

---

## 5. Estrutura de navegação do app (9 abas principais)

```
[Visão Geral] [Por Segmento] [Ranking] [Fundos Elegíveis]
[Carteira APX] [Atividade] [Análise] [Pré-Análise] [Administração]
```

### 5.1 Visão Geral
KPIs gerais, movimentações vs. semana anterior, resumo de atividade recente.

### 5.2 Por Segmento (4 sub-abas)
`Visão Geral` (heatmap) · `Comparar Segmentos` (até 3 segmentos, gráfico de barras) · `Drill-down` (tabela por segmento selecionado) · `Carteira APX` (composição da carteira por segmento vs. universo).

### 5.3 Ranking (2 sub-abas)
- **Estabilidade**: Ticker, Nome, Segmento, Semanas ✓ (ex.: 21/21), Consecutivas, Consistência (barra colorida: verde 100%, âmbar ≥80%, vermelho <80%), Yield Atual.
- **Score de Análise**: ranking dos fundos com análise qualitativa/quantitativa finalizada (ver seção 5.6).

### 5.4 Fundos Elegíveis
Busca por ticker/nome, filtro por segmento, filtro por status de análise (Pendente/Analisado), contador de resultados, export CSV. Coluna "Status Invest" com link para `https://statusinvest.com.br/fundos-imobiliarios/{ticker minúsculo}`. Disclaimer visível sobre dados complementares (CVM/Yahoo) ainda pendentes (ver seção 8).

### 5.5 Carteira APX (5 sub-abas)
Rastreamento da carteira real da Apex: `Posições` (CRUD de fundos + peso) · `Composição` (por segmento) · `Visão Geral` · `Benchmarks` (retorno mensal ponderado vs. IFIX/CDI/IPCA, cálculo via fechamento semanal do próprio Supabase — não depende de API externa) · `Alertas`.
Botão "Atualizar Preços" mescla dados do **Yahoo Finance** (preço, volume, DY) com os dados do **BTG Guide** já no Supabase (P/VP, DY anual, retornos).

### 5.6 Análise
Formulário de avaliação por fundo com dois blocos de critérios ponderados (0–10 cada):
- **QUALI_CRITERIA**: critérios qualitativos (governança, gestora, etc.)
- **QUANTI_CRITERIA**: critérios quantitativos, ex.: Qtd. de Cotistas (peso 5,0), P/VP (peso 5,0), Tempo de Constituição (peso 5,0), Vacância Física (peso 5,0), Volatilidade 12m vs. IFIX (peso 5,0), LTV (peso 5,0, só aplicável a fundos de tijolo)

Cada análise tem: analista responsável, tipo de fundo (`papel-ipca` etc.), score final, status finalizado/pendente, **auto-save de rascunho** (a cada 30s + no blur, gravado em `analysis_drafts`), export em PDF, e um **fórum de discussão** por fundo (comentários, questionamentos, aprovações, discordâncias — tabela `analysis_comments`).

### 5.7 Pré-Análise
Registro qualitativo de fundos **reprovados ou em monitoramento** antes/fora do ciclo formal de Análise — geralmente por risco estrutural (ex.: conflito de interesse entre fundos da mesma gestora). Cada item tem: ticker, gestora, segmento, mktcap, status (`Reprovado`/`Monitorar`), observação curta, detalhamento (`det`), analista, data de revisão. Aparece como badge (● vermelho/amarelo) na tabela de Fundos Elegíveis.

### 5.8 Atividade
Feed cronológico (timeline agrupada por mês) de: análises finalizadas, pré-análises, revisões, comentários de fórum. Filtros por analista e segmento.

### 5.9 Administração
- Upload/validação/preview/confirmação do BTG Guide semanal (seção 4).
- Gestão de semanas: **editar** (data/número), **excluir** (soft delete via `deleted_at`, não perde dado), **restaurar**.
- Upload retroativo de arquivos originais do BTG Guide para o Storage (reconhece a data pelo padrão de nome `BTGSGF_D_M_AAAA`).
- Aviso de migração SQL pendente (rodar manualmente no Supabase se ainda não rodou):
  ```sql
  ALTER TABLE semanas ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
  ```

---

## 6. Segmentos reconhecidos (16)

Recebível, Galpão Logístico, Shopping Center, Laje Corporativa, Fundo de Fundos, Hedge Fund, Renda Urbana, Híbrido, FI-Infra, FIAgro - FII, Agronegócio, Desenvolvimento, Agência Bancária, Hotel, Educacional, Outros.

### Cores dos chips (variáveis CSS `--seg-*-bg` / `--seg-*-c`)

```
Recebível        → bg:#D2E5FF  color:#1a6fa8
Galpão Log.      → bg:#EAF3DE  color:#3B6D11
Shopping         → bg:#FAEEDA  color:#854F0B
Laje Corp.       → bg:#EEEDFE  color:#3C3489
Fundo de Fundos  → bg:#E1F5EE  color:#085041
FI-Infra         → bg:#f5e1f7  color:#7a1a6b
FIAgro - FII     → bg:#fff3cd  color:#5e3a00
Hedge Fund       → bg:#FCEBEB  color:#8B0000
Renda Urbana     → bg:#e1f5fb  color:#0a5f7a
Híbrido          → bg:#fffff0  color:#4a4a00
Agronegócio      → bg:#e8f5e1  color:#2d5a00
Desenvolvimento  → bg:#e1eaf5  color:#003366
Agência Bancária → bg:#f5f5dc  color:#333300
Hotel            → bg:#f5ebe1  color:#552200
Educacional      → bg:#e1e8f5  color:#002244
Outros           → bg:#f0f0f0  color:#444444
```

---

## 7. Paleta de cores e identidade visual

```css
--apex-dark:  #05132A  /* Header/fundo escuro */
--apex-navy:  #0B2859  /* Títulos e nav */
--apex-blue1: #10408D
--apex-blue2: #195AB4
--apex-blue3: #307AE0  /* Azul principal */
--apex-blue4: #549CFF
--apex-blue5: #6BAAFF
--apex-blue6: #87BAFF
--apex-blue7: #B1D2FF
--apex-blue8: #D2E5FF  /* Backgrounds suaves */
--apex-white: #FFFFFF
```

- Fonte: **Manrope**.
- Logo Apex embutida em base64 (fundo preto), dentro de container branco: `background:rgba(255,255,255,0.95); border-radius:6px; padding:5px 14px`, altura 30px.
- Responsividade: `.two-col` vira 1 coluna <700px; padding/fontes reduzidos <640px; nav com scroll horizontal sem scrollbar visível.
- **Guardrail de design (aprovado por Pedro):** nada de refresh visual agressivo — sem títulos em maiúsculas, sem remover fundo dos KPI cards, sem border-radius 3px generalizado. Toque aceito: botões 5px, cards 8px, bordas de input levemente mais escuras. Não reintroduzir sem aprovação explícita.

---

## 8. Fase 2 — Dados complementares (ainda PENDENTE, disclaimer visível no app)

| Campo | Fonte | Status |
|---|---|---|
| PL do Fundo | CVM (INFORME_MENSAL) | ⏳ Pendente |
| Índice de Alavancagem | CVM | ⏳ Pendente |
| Qtd. de Cotistas | CVM | ⏳ Pendente |
| Vacância | CVM | ⏳ Pendente |
| DY 12 meses | Yahoo Finance (ticker.SA) | ⏳ Pendente (parcialmente usado só na Carteira) |
| ADTV 3 meses | Yahoo Finance | ⏳ Pendente |
| Volatilidade 12m | Yahoo Finance (calculada) | ⏳ Pendente |
| Link Relatório Gerencial | Status Invest (scraping) | ⏳ Pendente |

**Regras CVM:** defasagem de 30–45 dias → exibir com nota do mês de referência. Só fonte oficial (`dados.cvm.gov.br`).
**Nota:** a aba Carteira APX já usa Yahoo Finance (`averageDailyVolume3Month`, `trailingAnnualDividendYield`, `priceToBook`, `regularMarketPrice`) via proxy CORS — isso é diferente da Fase 2 "oficial" da tabela de Fundos Elegíveis, que continua pendente.

---

## 9. Banco de dados (Supabase)

- **Project ref:** `ystjnkvodohjcruixiqv`
- **URL:** `https://ystjnkvodohjcruixiqv.supabase.co`

### Tabelas principais
| Tabela | Uso |
|---|---|
| `semanas` | Uma linha por semana processada: `semana_data`, `num_semana`, `n_total`, `n_elegiveis`, `n_nao_elegiveis`, `entraram` (JSON), `sairam` (JSON), `deleted_at` (soft delete) |
| `fund_data` | Uma linha por fundo por semana: ticker, nome, segmento, elegivel, vol3m, mktcap, pvp_atual, dy_anual, dy_ltm, ret_mes/ano/ltm, fechamento, flags `fail_vol`/`fail_yield`/`fail_pvp`/`fail_mktcap` |
| `analyses` | Análises finalizadas (qualitativo + quantitativo, score, analista, tipo) |
| `analysis_comments` | Fórum por fundo (`tipo`: comentário/questionamento/aprovação/discordância; campo `resposta` p/ identificar pendentes) |
| `analysis_drafts` | Rascunhos de análise em andamento (`onConflict: ticker,analista`) |

### Storage
- Bucket `fii-guides`: arquivos originais do BTG Guide por semana, nome padrão `BTGGuide_DDMMAAAA.xlsx`.

### Segurança (RLS) — migrações documentadas dentro do próprio `index.html`
- A **anon key é pública por design** — a proteção real precisa vir de RLS (Row Level Security) no Supabase.
- Índices recomendados já documentados no HTML (não confundir com "já aplicados" — confirmar antes de assumir):
  ```sql
  CREATE INDEX IF NOT EXISTS idx_fund_data_semana_ticker ON fund_data (semana_data, ticker);
  CREATE INDEX IF NOT EXISTS idx_fund_data_semana_elegivel ON fund_data (semana_data, elegivel);
  CREATE INDEX IF NOT EXISTS idx_fund_data_ticker ON fund_data (ticker);
  CREATE INDEX IF NOT EXISTS idx_comments_ticker_created ON analysis_comments (ticker, created_at);
  CREATE INDEX IF NOT EXISTS idx_comments_pendentes ON analysis_comments (tipo) WHERE resposta IS NULL;
  CREATE INDEX IF NOT EXISTS idx_semanas_ativas ON semanas (created_at) WHERE deleted_at IS NULL;
  ```
- ⚠️ Operações de escrita administrativa privilegiada devem usar a `service_role` key (nunca vai pro front-end). O app hoje grava com a `anon` key sem login — cuidado ao aplicar RLS restritiva, pode quebrar upload/criação de análises pelo front.
- **Regra de trabalho:** ao conectar um MCP do Supabase para consultas via Claude Code, usar **modo somente-leitura** (`read_only=true`) e escopado ao `project_ref` acima — é banco de produção.

---

## 10. Infraestrutura de publicação

- **GitHub:** `pedroffc4-tech/apex-fii-universe` (público) · branch `main` · arquivo `index.html`.
- **Vercel:** `https://apex-fii-universe.vercel.app` — publica automaticamente a cada `git push` no `main`.
- **Fluxo local (Claude Code):** editar `index.html` → `git add . && git commit -m "..." && git push` (sempre com confirmação do usuário antes do `push`, nunca automático).

---

## 11. Boas práticas técnicas (bugs recorrentes a não reintroduzir)

- `div_mes` **não existe** em `fund_data` — retornos com dividendo usam `ret_mes`.
- brapi.dev: nunca usar `fundamental=false` (dá HTTP 400); `range=5y` não existe no free tier, usar `range=1y`.
- Cache de ranking (`_rankingCache` se existir) deve invalidar por `num_semana`, não persistir indefinidamente.
- Funções de render independentes (`makeTagHTML`, `renderAtividade`, `renderScoreRanking`, etc.) não compartilham estado — replicar fix de estilo em cada uma.
- Função global sem `function` ou sem chave de fechamento trava o script inteiro **silenciosamente**.
- Em `onclick` HTML (aspas duplas): usar só aspas simples dentro; nunca `\"` escapado.
- BCB/SGS (CDI, IPCA, SELIC): chamadas sequenciais com retry — simultâneas derrubam o IPCA por rate limit.
- Ações destrutivas (excluir análise, ocultar semana) exigem confirmação digitando uma palavra-chave (ticker ou data) — padrão já implementado via `openConfirmModal`; manter esse padrão em novas ações destrutivas.
- Validar sintaxe JS após edição grande: extrair `<script>` e testar com `new Function()`.
- `str_replace` exige correspondência exata caractere a caractere, incluindo espaços.

---

## 12. Arquivos do projeto

| Arquivo | Descrição |
|---|---|
| `index.html` | O app inteiro — front-end + lógica + conexão Supabase. É o que está no GitHub/Vercel. |
| `HANDOVER.md` | Estado mutável: última sessão, pendências, próximos passos. |
| `CLAUDE.md` | Este arquivo — regras fixas. |
| `.gitignore` | Deve conter `.mcp.json` e `.env` — nunca subir tokens/credenciais. |

O estado detalhado da última sessão de trabalho está sempre no **`HANDOVER.md`**.
