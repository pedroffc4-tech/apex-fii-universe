# apex-fii-universe
# Apex FII Universe

> Dashboard interativo de Fundos de Investimento Imobiliário (FIIs) com rastreamento semanal de elegibilidade — desenvolvido pela equipe de análise da **Apex Partners**.

🔗 **[apex-fii-universe.vercel.app](https://apex-fii-universe.vercel.app)**

---

## O que é

O **Apex FII Universe** é um painel de monitoramento semanal do universo de FIIs do mercado brasileiro. A partir dos dados do BTG Pactual FII Guide, o pipeline aplica 4 critérios quantitativos de elegibilidade e gera:

- Um **dashboard interativo** (este site) com visão geral, ranking de estabilidade e análise por segmento
- Um **arquivo Excel (.xlsx)** com 22 abas de análise completa, entregue internamente para a equipe

---

## Critérios de Elegibilidade

Um fundo só aparece como **elegível** se atender os 4 critérios simultaneamente:

| Critério | Regra |
|---|---|
| Volume Médio 90d | > R$ 400.000 |
| Yield Anualizado | > 8% ao ano |
| P/VP Atual | < 1,15× |
| Valor de Mercado | > R$ 200.000.000 |

---

## Estrutura do Dashboard

| Aba | Conteúdo |
|---|---|
| **Visão Geral** | KPIs da semana, critérios mais restritivos, entradas e saídas vs. semana anterior |
| **Por Segmento** | Distribuição de elegíveis, médias de DY, P/VP e retornos por segmento |
| **Ranking de Estabilidade** | Fundos ordenados por consecutividade e consistência histórica |
| **Fundos Elegíveis** | Tabela completa com busca, filtro por segmento e links para análise |

---

## Histórico

O projeto rastreia elegibilidade semana a semana desde **fevereiro de 2026**. Cada semana adiciona uma nova coluna ao trackrecord histórico, permitindo visualizar a consistência de cada fundo ao longo do tempo.

- **Semanas monitoradas:** 14
- **Fundos já elegíveis (ao menos 1×):** 144
- **Fundos 100% consistentes:** 95

---

## Atualização Semanal

O site é atualizado toda semana em três passos:

1. O pipeline processa o novo BTG FII Guide e gera o `index.html` atualizado
2. O arquivo é enviado para este repositório (branch `main`)
3. O **Vercel detecta o commit automaticamente** e republica o site em segundos

Não é necessário nenhum comando ou configuração adicional — o deploy é totalmente automático.

---

## Stack

- **Frontend:** HTML + CSS + JavaScript vanilla (arquivo único `index.html`, sem dependências externas)
- **Dados:** BTG Pactual FII Guide (Excel semanal) processado via Python/pandas
- **Hospedagem:** Vercel (deploy automático via GitHub)
- **Versionamento:** GitHub

---

## Fonte dos Dados

Os dados exibidos são extraídos semanalmente do **BTG Pactual FII Guide**, relatório público da corretora BTG Pactual com cobertura de todos os FIIs listados na B3.

> **Aviso:** As informações deste dashboard têm caráter exclusivamente informativo e analítico, voltado ao uso interno da equipe Apex Partners. Não constituem recomendação de investimento.

---

## Equipe

Projeto desenvolvido pela equipe de análise da **[Apex Partners](https://apexpartners.com.br)**.

---

*Última atualização: semana 14 — 11/05/2026*
