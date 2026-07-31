'use strict';

// ══════════════════════════════════════════════════════════════
// VISÃO GERAL — KPIs (Fase 4 da modularização)
// ══════════════════════════════════════════════════════════════
// Depende de `analyses`/PRE_ANALISE (globais via window) — os KPI cards
// que abrem modal usam js/modals/generic-list-modal.js (openModal).

export const SCORE_APROVADO = 6.0;
export const SCORE_EM_AVAL = 4.0;

export function getKpiData(){
 const analisados = Object.values(analyses).filter(a=>a.finalizado);
 const aprovados = analisados.filter(a=>a.scoreTotal>=SCORE_APROVADO);
 const emAval = analisados.filter(a=>a.scoreTotal>=SCORE_EM_AVAL&&a.scoreTotal<SCORE_APROVADO);
 const reprovados = analisados.filter(a=>a.scoreTotal<SCORE_EM_AVAL);
 const tickersAnalisados = new Set(analisados.map(a=>a.ticker));
 // Elegíveis: pegar da tabela de fundos (fund-body)
 const elegiveis=[];
 document.querySelectorAll('#fund-body tr').forEach(r=>{
 const t=r.querySelector('strong')?.textContent?.trim();
 if(t) elegiveis.push(t);
 });
 const pendentes = elegiveis.filter(t=>!tickersAnalisados.has(t));
 return {analisados,aprovados,emAval,reprovados,pendentes,elegiveis};
}

export function updateKpiRow(){
 const d=getKpiData();
 const set=function(id,val){const el=document.getElementById(id);if(el)el.textContent=val;};
 set('kpi-n-elegiveis', d.elegiveis.length||127);
 set('kpi-n-analisados',d.analisados.length);
 set('kpi-n-aprovados', d.aprovados.length);
 set('kpi-n-em-aval', d.emAval.length);
 set('kpi-n-reprovados',d.reprovados.length);
 set('kpi-n-pendentes', d.pendentes.length);
 set('kpi-n-pre', PRE_ANALISE?.length||0);
}

window.SCORE_APROVADO = SCORE_APROVADO;
window.SCORE_EM_AVAL = SCORE_EM_AVAL;
window.getKpiData = getKpiData;
window.updateKpiRow = updateKpiRow;
