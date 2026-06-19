# APX FII Universe 🏢

**Plataforma interna de screening e gestão semanal de Fundos de Investimento Imobiliário (FIIs) da Apex Partners.**

🔗 **Ao vivo:** [apex-fii-universe.vercel.app](https://apex-fii-universe.vercel.app)
📦 **Repositório:** `pedroffc4-tech/apex-fii-universe`
👥 **Uso interno** · Equipe de análise (João V., Lucas S., Pedro C., Pedro F., Rafael P.)

---

## 📌 O que é

Ferramenta web que, toda semana, filtra **todo o universo de FIIs do mercado brasileiro** (a partir do *FII Guide* do BTG Pactual) contra 4 critérios fixos de elegibilidade e entrega um dashboard interativo com análise completa: ranking de estabilidade, médias por segmento, movimentações da semana, carteira da casa e benchmarks de rentabilidade.

Tudo roda em **um único arquivo** (`index.html`), sem servidor próprio, com custo **zero** de infraestrutura.

---

## 🎯 Critérios de elegibilidade (imutáveis)

Um fundo só é **elegível** se atender aos **4 critérios simultaneamente**:

| Critério | Regra | Coluna no BTG Guide |
|---|---|---|
| Volume médio (90 dias) | > R$ 400.000 | Média - 3 Meses (R$) |
| Yield anualizado | > 8% (0,08) | Dividend Yield (% a.a.) Anualizado |
| P/VP | < 1,15 | P/VPA Atual |
| Valor de mercado | > R$ 200.000.000 | Valor de Mercado (R$) |

> ⚠️ Esses critérios **não podem ser alterados** sem aprovação explícita. Yield vem em **decimal** no BTG (ex.: `0,1356` = 13,56%); MktCap e Volume vêm em **reais absolutos**.

---

## 🧱 Stack & arquitetura

| Camada | Tecnologia |
|---|---|
| Frontend | HTML/CSS/JS puro (vanilla), arquivo único `index.html` |
| Backend / dados | [Supabase](https://supabase.com) (PostgreSQL + Storage) |
| Processamento de Excel | [SheetJS](https://sheetjs.com) |
| Export PDF | jsPDF + jsPDF-AutoTable |
| Benchmarks macro | API do Banco Central (BCB/SGS) — CDI, IPCA, SELIC |
| Índices de mercado | brapi.dev (BOVA11 → IBOV, XFIX11 → IFIX) |
| Hospedagem | GitHub → **Vercel** (deploy automático no push) |
| Tipografia | Manrope (Google Fonts) |

**Princípio de design:** preferir estender o que já existe (Supabase + Vercel + GitHub) a adicionar serviços/dependências novas.

---

## 🗂️ Abas do dashboard

1. **Visão Geral** — KPIs do universo, critérios mais restritivos, movimentações vs. semana anterior.
2. **Por Segmento** — barras de elegíveis por segmento + médias (DY, P/VP, retornos, volume, MktCap).
3. **Ranking** — estabilidade dos fundos (consecutividade + consistência), com badges 🥇🥈🥉.
4. **Fundos Elegíveis** — busca, filtro por segmento e link para Status Invest.
5. **📊 Carteira APX** — carteira da casa, alertas, feed de atividade e **benchmarks de rentabilidade**.
6. **◉ Atividade** — feed de ações na plataforma.
7. **✦ Análise** — scoring quantitativo/qualitativo dos fundos.
8. **⚠ Pré-Análise** — histórico de gestão e fundos reprovados/monitorados.
9. **⚙ Admin** — administração da plataforma.

---

## 📈 Como a rentabilidade é calculada (importante)

A rentabilidade da **Carteira APX** e dos **ativos individuais** usa o **retorno total mensal** (`ret_mes` do BTG, que **já inclui os dividendos**), ponderado pelo peso de cada fundo na carteira. Os dados de preço/retorno vêm da tabela `fund_data` no Supabase, mês a mês.

> 💡 Para FIIs, usar só a variação da cota **subestima muito** o retorno, porque o rendimento mensal é a maior parte do ganho. Por isso o cálculo é sempre sobre **retorno total**, nunca só preço.

Os benchmarks **CDI / IPCA / SELIC** vêm do Banco Central (séries SGS `4391`, `433` e `4390`), buscados **um de cada vez com novas tentativas** — a API do BCB bloqueia chamadas simultâneas.

---

## 🗄️ Tabelas do Supabase

| Tabela | Função |
|---|---|
| `analyses` | Análises de fundos |
| `fund_data` | Dados semanais por fundo (fechamento, `ret_mes`, P/VP, DY, volume…) |
| `semanas` | Semanas processadas (soft delete via `deleted_at`) |
| `analysis_comments` | Fórum de discussão dos analistas |
| `analysis_drafts` | Rascunhos de análise |

Projeto Supabase: `https://ystjnkvodohjcruixiqv.supabase.co`

> 🔐 Após criar um bucket no Storage, é preciso adicionar políticas `INSERT` e `UPDATE` explícitas para o papel `anon` via SQL Editor — a criação do bucket só libera download público.

---

## 🔄 Pipeline semanal

1. Subir o **FII Guide do BTG** (.xlsx). A aba lida é **`Stock Guide`**, com cabeçalho nas linhas 0–4 e **dados a partir da linha 5**.
2. A plataforma aplica os 4 critérios, calcula movimentações vs. semana anterior, atualiza o trackrecord e recalcula o ranking de estabilidade.
3. Os elegíveis e suas métricas são gravados no Supabase.
4. O dashboard se atualiza automaticamente.

> A cada nova semana, o histórico **incrementa em 1**.

---

## 🚀 Como publicar uma atualização (GitHub → Vercel)

O Vercel está conectado ao GitHub: **qualquer commit no `main` atualiza o site em segundos**, sem precisar logar no Vercel.

1. Baixe o `index.html` novo (gerado nesta plataforma/sessão).
2. Acesse `github.com/pedroffc4-tech/apex-fii-universe`.
3. Clique no arquivo **`index.html`** existente → ícone de **lápis** (editar).
4. Use **"Upload file"** / cole o conteúdo novo, substituindo o antigo.
5. **Commit changes** → o Vercel publica automaticamente.

> O arquivo entregue **sempre** deve se chamar `index.html`.

---

## 🎨 Identidade visual

- Header escuro (`--apex-dark: #000123`), navy (`--apex-navy: #002060`), azul principal (`--apex-blue: #0076D2`).
- Cada **segmento** tem cor própria (chips) — não alterar sem aprovação.
- Logo da Apex em **SVG vetorial** embutido (não depende de imagem externa).
- Responsivo: `< 700px` colapsa colunas; `< 640px` ajusta paddings e fontes.

---

## 🛣️ Roadmap — Fase 2 (dados complementares, pendente)

Integração de dados adicionais na tabela de elegíveis:

| Campo | Fonte |
|---|---|
| PL, Alavancagem, Cotistas, Vacância | CVM oficial (`dados.cvm.gov.br`, INFORME_MENSAL) |
| DY 12m, Performance 12m, ADTV, Volatilidade | Yahoo Finance |
| Link do Relatório Gerencial | Status Invest (scraping) |

> Dados da CVM têm defasagem de 30–45 dias — exibir sempre com nota de referência do mês (ex.: *"ref. mar/2026"*). Buscar **apenas na CVM oficial**.

---

## 🧠 Convenção de sessão

- `Claude.md` — regras permanentes do projeto.
- `HANDOVER.md` — estado mutável da sessão atual.
- Comando **`fecha a sessão`** → gera o handover.
- Vault Obsidian: `apex-fii/`.

---

## 📝 Changelog

### [não versionado] — jun/2026
- **Fix:** rentabilidade da Carteira APX agora usa **retorno total** (`ret_mes`, com dividendos) em vez de só a variação da cota. Corrige valores subestimados e o desalinhamento do início do gráfico.
- **Fix:** **ativos individuais** da carteira agora aparecem no gráfico de benchmarks (a série por fundo, antes nunca preenchida, passou a ser calculada).
- **Fix:** **IPCA** voltou a carregar — séries do BCB agora são buscadas sequencialmente, com até 3 tentativas cada (a API bloqueava chamadas simultâneas).
- **UI:** repaginação estética (fonte Manrope, logo em SVG, cards com profundidade) via Claude Design.

---

<sub>Projeto interno da **Apex Partners** · Não distribuir externamente.</sub>
