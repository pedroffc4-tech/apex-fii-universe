'use strict';

// Único lugar para formatar % e R$ — antes duplicado em ~13 pontos diferentes
// do index.html (Carteira APX, Por Segmento, Administração). Ver CLAUDE.md §11
// ("Funções de render independentes não compartilham estado — replicar fix de
// estilo em cada uma") e o plano de refatoração (Fase 2).

/** Formata uma fração (0.08 = 8%) como percentual com N casas decimais. */
export function fmtPercent(v, decimals=2){
 return (v*100).toFixed(decimals)+'%';
}

/** Como fmtPercent, mas retorna um traço quando o valor é null/undefined. */
export function fmtPercentOrDash(v, decimals=2, dash='—'){
 return v!=null ? fmtPercent(v, decimals) : dash;
}

/** Percentual já em escala 0–100 (não fração), com sinal (+/-) e traço para null. */
export function fmtPercentSigned(v, dash='-'){
 return v!=null ? (v>0?'+':'')+v.toFixed(2)+'%' : dash;
}

/** Wrapper fino sobre toLocaleString('pt-BR', ...) para valores monetários — o
 * prefixo "R$"/"R$ " e sufixos como "M" continuam sendo texto de cada chamador,
 * pra não mudar nenhuma formatação visível já existente. */
export function fmtCurrency(v, opts={maximumFractionDigits:0}){
 return (v).toLocaleString('pt-BR', opts);
}

/** Valor em reais absolutos formatado em milhões com 1 casa decimal (sem "R$"). */
export function fmtMillions(v){
 return (v/1e6).toFixed(1)+'M';
}

// O script legado (index.html) ainda não é um módulo — ele enxerga essas
// funções como globais via `window`, exatamente como antes da extração.
window.fmtPercent = fmtPercent;
window.fmtPercentOrDash = fmtPercentOrDash;
window.fmtPercentSigned = fmtPercentSigned;
window.fmtCurrency = fmtCurrency;
window.fmtMillions = fmtMillions;
