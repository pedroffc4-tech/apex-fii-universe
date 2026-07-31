'use strict';

// ══════════════════════════════════════════════════════════════
// AUTO-SAVE — Rascunho por fundo por analista no Supabase
// (Fase 4 da modularização)
// ══════════════════════════════════════════════════════════════
// Depende de currentTicker (js/tabs/analise.js) e de getDB/analyses/
// toast (globais via window).
//
// _draftRascunho é um caso à parte: js/tabs/analise.js REATRIBUI essa
// variável (`_draftRascunho=null`, ao trocar de fundo) mesmo sem ela
// pertencer àquele módulo — como analise.js não declara sua própria
// cópia, essa atribuição já cai direto em window._draftRascunho. Por
// isso, aqui ela vive SÓ em window (nunca como `let` deste módulo):
// se guardássemos uma cópia interna, o reset feito por analise.js
// nunca seria visto por este arquivo, e o rascunho "resetado" continuaria
// sendo salvo/recarregado como se nada tivesse mudado.

window._draftRascunho = null; // rascunho carregado do banco -- ver nota acima: fica só em window, nunca em let de módulo
export let _draftAutoSaveId = null; // timer do setInterval (30s)
export let _draftBlurTimer = null; // timer do blur debounce

// ── Coletar estado atual da análise ──────────────────────────
export function coletarEstadoAnalise(){
 const ticker = currentTicker;
 const analista = document.getElementById('sel-analista')?.value||'';
 const tipo = document.getElementById('sel-tipo')?.value||'';
 if(!ticker||!analista) return null;

 const qs={}, qj={}, ns={}, nj={};
 QUALI_CRITERIA.forEach(c=>{
 const v=document.getElementById('quali-note-'+c.id)?.value;
 const j=document.getElementById('quali-just-'+c.id)?.value||'';
 if(v!==undefined&&v!=='') qs[c.id]=parseFloat(v);
 if(j) qj[c.id]=j;
 });
 QUANTI_CRITERIA.forEach(c=>{
 const v=document.getElementById('quanti-note-'+c.id)?.value;
 const j=document.getElementById('quanti-just-'+c.id)?.value||'';
 if(v!==undefined&&v!=='') ns[c.id]=parseFloat(v);
 if(j) nj[c.id]=j;
 });

 const temDados=Object.keys(qs).length>0||Object.keys(ns).length>0||
 Object.keys(qj).length>0||Object.keys(nj).length>0;
 if(!temDados) return null;

 return {ticker,analista,tipo,
 quali_scores:qs,quali_just:qj,
 quanti_scores:ns,quanti_just:nj,
 updated_at:new Date().toISOString()};
}

// ── Mostrar status do rascunho ────────────────────────────────
export function setDraftStatus(msg, tipo=''){
 ['draft-status','draft-status-bottom'].forEach(id=>{
 const el=document.getElementById(id);
 if(!el)return;
 el.textContent=msg;
 el.className='draft-status'+(tipo?' '+tipo:'');
 });
}

// ── Salvar rascunho no Supabase ───────────────────────────────
/**
 * Salva no Supabase o rascunho da análise em andamento (notas/justificativas
 * ainda não finalizadas) para o ticker + analista correntes, atualizando o
 * indicador de status do auto-save.
 * @returns {Promise<void>}
 */
export async function salvarRascunho(){
 const estado=coletarEstadoAnalise();
 if(!estado) return;
 const db=getDB();if(!db)return;
 setDraftStatus('⟳ Salvando rascunho...','saving');
 try{
 const {error}=await db.from('analysis_drafts').upsert(estado,{onConflict:'ticker,analista'});
 if(error) throw error;
 const agora=new Date();
 const hora=String(agora.getHours()).padStart(2,'0')+':'+String(agora.getMinutes()).padStart(2,'0');
 setDraftStatus('✓ Rascunho salvo às '+hora,'saved');
 // Mostrar botão descartar
 const btn=document.getElementById('btn-discard-draft');
 if(btn)btn.style.display='block';
 // Esconder banners de rascunho (já carregou)
 ['draft-banner','draft-banner-top'].forEach(id=>{
 const el=document.getElementById(id);if(el)el.style.display='none';
 });
 }catch(e){
 setDraftStatus('⚠ Erro ao salvar rascunho','error');
 console.warn('Draft save error:',e.message);
 }
}

// ── Trigger ao sair de um campo (blur) ───────────────────────
export function autoSaveDraft(){
 // Pequeno delay para garantir que o valor foi capturado
 clearTimeout(_draftBlurTimer);
 _draftBlurTimer=setTimeout(()=>salvarRascunho(),300);
}

// ── Verificar e oferecer rascunho ao selecionar fundo ─────────
export async function verificarRascunho(ticker, analista){
 if(!ticker||!analista) return;
 const db=getDB();if(!db)return;
 try{
 const {data,error}=await db.from('analysis_drafts')
 .select('*').eq('ticker',ticker).eq('analista',analista).single();
 if(error||!data) return; // sem rascunho
 // Rascunho encontrado — guardar e mostrar banner
 window._draftRascunho=data;
 const quando=new Date(data.updated_at);
 const fmt=quando.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
 const msg='Salvo em '+fmt+' com '+(Object.keys(data.quali_scores||{}).length+Object.keys(data.quanti_scores||{}).length)+' campos preenchidos.';
 ['draft-banner-sub','draft-banner-top-sub'].forEach(id=>{
 const el=document.getElementById(id);if(el)el.textContent=msg;
 });
 ['draft-banner','draft-banner-top'].forEach(id=>{
 const el=document.getElementById(id);if(el)el.style.display='block';
 });
 }catch(e){
 console.warn('verificarRascunho:',e.message);
 }
}

// ── Carregar rascunho nos campos ──────────────────────────────
export function carregarRascunho(){
 if(!window._draftRascunho) return;
 const d=window._draftRascunho;
 // Preencher qualitativo
 QUALI_CRITERIA.forEach(c=>{
 const v=d.quali_scores?.[c.id];
 const j=d.quali_just?.[c.id];
 if(v!=null){const el=document.getElementById('quali-note-'+c.id);if(el)el.value=v;}
 if(j){const el=document.getElementById('quali-just-'+c.id);if(el){el.value=j;el.classList.add('suggested');}}
 });
 // Preencher quantitativo
 QUANTI_CRITERIA.forEach(c=>{
 const v=d.quanti_scores?.[c.id];
 const j=d.quanti_just?.[c.id];
 if(v!=null){const el=document.getElementById('quanti-note-'+c.id);if(el&&!el.disabled)el.value=v;}
 if(j){const el=document.getElementById('quanti-just-'+c.id);if(el)el.value=j;}
 });
 updateScore();
 // Esconder banners e mostrar status
 ['draft-banner','draft-banner-top'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
 setDraftStatus('↩ Rascunho carregado','saved');
 const btn=document.getElementById('btn-discard-draft');if(btn)btn.style.display='block';
 window._draftRascunho=null;
}

// ── Ignorar rascunho (começar do zero, mas manter no banco) ───
export function ignorarRascunho(){
 ['draft-banner','draft-banner-top'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
 setDraftStatus('','');
 window._draftRascunho=null;
}

// ── Descartar rascunho permanentemente ───────────────────────
export async function descartarRascunho(){
 if(!confirm('Descartar o rascunho de '+currentTicker+'? Esta ação não pode ser desfeita.')) return;
 const analista=document.getElementById('sel-analista')?.value||'';
 const db=getDB();if(!db)return;
 try{
 await db.from('analysis_drafts').delete()
 .eq('ticker',currentTicker).eq('analista',analista);
 setDraftStatus('Rascunho descartado','');
 const btn=document.getElementById('btn-discard-draft');if(btn)btn.style.display='none';
 window._draftRascunho=null;
 }catch(e){setDraftStatus('Erro ao descartar','error');}
}

// ── Limpar rascunho ao finalizar ──────────────────────────────
export async function limparRascunhoAoFinalizar(ticker, analista){
 const db=getDB();if(!db)return;
 try{
 await db.from('analysis_drafts').delete()
 .eq('ticker',ticker).eq('analista',analista);
 setDraftStatus('','');
 const btn=document.getElementById('btn-discard-draft');if(btn)btn.style.display='none';
 }catch(e){console.warn('Erro ao limpar rascunho:',e.message);}
}

// ── Iniciar/parar timer de 30s ────────────────────────────────
export function iniciarAutoSaveTimer(){
 pararAutoSaveTimer();
 _draftAutoSaveId=setInterval(()=>{
 if(currentTicker&&document.getElementById('sel-analista')?.value){
 salvarRascunho();
 }
 },30000);
}
export function pararAutoSaveTimer(){
 if(_draftAutoSaveId){clearInterval(_draftAutoSaveId);_draftAutoSaveId=null;}
}

window.coletarEstadoAnalise = coletarEstadoAnalise;
window.setDraftStatus = setDraftStatus;
window.salvarRascunho = salvarRascunho;
window.autoSaveDraft = autoSaveDraft;
window.verificarRascunho = verificarRascunho;
window.carregarRascunho = carregarRascunho;
window.ignorarRascunho = ignorarRascunho;
window.descartarRascunho = descartarRascunho;
window.limparRascunhoAoFinalizar = limparRascunhoAoFinalizar;
window.iniciarAutoSaveTimer = iniciarAutoSaveTimer;
window.pararAutoSaveTimer = pararAutoSaveTimer;
window._draftAutoSaveId = _draftAutoSaveId;
window._draftBlurTimer = _draftBlurTimer;
