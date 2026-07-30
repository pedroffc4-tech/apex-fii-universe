'use strict';

// Estado compartilhado entre abas (Fase 3 do plano de refatoração). Continua
// exposto em window para o script legado (ainda não modularizado) enxergar
// como globais, exatamente como antes da extração — os nomes e o
// comportamento não mudam, só passam a viver num arquivo próprio.

export let analyses = JSON.parse(localStorage.getItem('apex_fii_analyses')||'{}');
export let _currentFundos = [];
export let _currentSemana = null;
export const fundDataMap = {}; // nunca reatribuído, só mutado (fundDataMap[ticker]=...)

window.analyses = analyses;
window._currentFundos = _currentFundos;
window._currentSemana = _currentSemana;
window.fundDataMap = fundDataMap;

// Cache do ranking de estabilidade. O valor é REATRIBUÍDO (não só mutado) tanto
// por quem escreve o ranking quanto por quem invalida o cache — por isso ele
// vive direto em `window._rankingCache`, e não numa variável `let` deste
// módulo, para as duas pontas nunca lerem/escreverem cópias dessincronizadas.
// invalidateRankingCache() é o único jeito correto de limpar o cache — ver
// CLAUDE.md §11 e o bug já visto uma vez no index.html (um `_rankingCache=null`
// direto, fora desta função, que não usava esse ponto único de invalidação).
window._rankingCache = null;
export function invalidateRankingCache(){ window._rankingCache = null; }
window.invalidateRankingCache = invalidateRankingCache;
