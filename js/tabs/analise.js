'use strict';

// ══════════════════════════════════════════════════════════════
// ANÁLISE — Formulário de avaliação por fundo (Fase 4 da modularização)
// ══════════════════════════════════════════════════════════════
// Depende de globais ainda no script legado (analyses, QUALI_CRITERIA/
// QUANTI_CRITERIA, ELIGIBLE_FUNDS, getDB, supaLoad, toast, openForum,
// invalidateRankingCache, renderScoreRanking, injectAnalyseTags,
// updateKpiRow, renderAtvVisaoGeral, openConfirmModal, coletarEstadoAnalise/
// verificarRascunho/setDraftStatus de js/modals/analise-draft-autosave.js)
// — acessíveis via window.
//
// `currentTicker` é REATRIBUÍDO aqui (onFundoSelect/resetAnaliseFundo) e
// LIDO por js/tabs/analise-draft-autosave.js — por isso, assim como
// _carteira na Fase 4 (8/10), sincronizamos window.currentTicker logo
// após cada reatribuição.

export let currentTicker = '';
window.currentTicker = currentTicker;

export function openAnalise(ticker){
 document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
 document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
 document.getElementById('tab-analise')?.classList.add('active');
 const at=document.querySelectorAll('.nav-tab')[4];if(at)at.classList.add('active');
 initAnaliseFundoDropdown();
 setTimeout(()=>{document.getElementById('sel-fundo').value=ticker;onFundoSelect();},100);
}
export async function initAnaliseFundoDropdown(){
 const sel=document.getElementById('sel-fundo');
 if(sel.options.length>1)return;
 // Tentar carregar TODOS os fundos do Supabase (elegíveis + não elegíveis)
 const db=getDB();
 let todos=[];
 if(db){
 try{
 // Pegar semana mais recente
 const {data:sems}=await db.from('semanas').select('semana_data').order('created_at',{ascending:false}).limit(1);
 if(sems&&sems.length>0){
 const {data:fds}=await db.from('fund_data').select('ticker,nome,segmento,elegivel').eq('semana_data',sems[0].semana_data).order('ticker');
 if(fds&&fds.length>0) todos=fds;
 }
 }catch(e){console.warn('Erro ao carregar fundos do Supabase:',e.message);}
 }
 if(todos.length>0){
 // Separar elegíveis e não elegíveis com optgroup
 const elegiveis=todos.filter(f=>f.elegivel);
 const outros=todos.filter(f=>!f.elegivel);
 if(elegiveis.length>0){
 const grp=document.createElement('optgroup');
 grp.label='✓ Elegíveis ('+elegiveis.length+')';
 elegiveis.forEach(f=>{
 const o=document.createElement('option');
 o.value=f.ticker;o.text=f.ticker+' · '+(f.nome||'');grp.appendChild(o);
 });
 sel.appendChild(grp);
 }
 if(outros.length>0){
 const grp2=document.createElement('optgroup');
 grp2.label='— Outros fundos ('+outros.length+')';
 outros.forEach(f=>{
 const o=document.createElement('option');
 o.value=f.ticker;o.text=f.ticker+' · '+(f.nome||'');grp2.appendChild(o);
 });
 sel.appendChild(grp2);
 }
 }else{
 // Fallback: usar apenas ELIGIBLE_FUNDS hardcoded
 const grp=document.createElement('optgroup');
 grp.label='✓ Elegíveis';
 ELIGIBLE_FUNDS.forEach(f=>{
 const o=document.createElement('option');
 o.value=f.ticker;o.text=f.ticker+' · '+f.nome;grp.appendChild(o);
 });
 sel.appendChild(grp);
 }
}
export function onFundoSelect(){
 const ticker=document.getElementById('sel-fundo').value;
 const tipo=document.getElementById('sel-tipo').value||'papel-ipca';
 currentTicker=ticker;
 window.currentTicker = currentTicker;
 if(!ticker){
 pararAutoSaveTimer();
 setDraftStatus('','');
 ['draft-banner','draft-banner-top'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
 ['card-quali','card-quanti','card-summary','pa-alert','fundo-status-banner'].forEach(id=>{
 const el=document.getElementById(id);if(el)el.style.display='none';
 });
 return;
 }
 // Alerta de pré-análise
 const pa=PRE_ANALISE_MAP[ticker];
 const paAlertEl=document.getElementById('pa-alert');
 if(paAlertEl){
 if(pa){
 const cor=pa.status==='Reprovado'?'var(--danger-bg)':'var(--warning-bg)';
 const borda=pa.status==='Reprovado'?'#f5c6c6':'#fde68a';
 const icone=pa.status==='Reprovado'?'●':'●';
 paAlertEl.style.display='block';
 paAlertEl.innerHTML=`<div style="background:${cor};border:1.5px solid ${borda};border-radius:8px;padding:12px 16px;">
 <div style="font-size:11px;font-weight:700;color:var(--apex-navy);margin-bottom:4px">${icone} Pré-Análise: <strong>${pa.status}</strong> — ${pa.obs}</div>
 <div style="font-size:10px;color:#5a6e8a;line-height:1.5">${pa.det.substring(0,300)}${pa.det.length>300?'…':''}</div>
 <div style="font-size:9px;color:#6b7a9a;margin-top:4px">Analista: ${pa.analista||'—'} · Revisão: ${pa.data_rev||'—'}</div>
 </div>`;
 }else{paAlertEl.style.display='none';}
 }
 // Banner de análise existente
 const banner=document.getElementById('fundo-status-banner');
 const a=analyses[ticker];
 if(a?.finalizado){
 if(banner){banner.style.display='block';
 banner.innerHTML=`<div style="background:var(--success-bg);border:1px solid #a7f3d0;border-radius:8px;padding:10px 14px;font-size:12px;color:#155a34;font-weight:600">✓ Analisado em ${a.data} por ${a.analista} · Score: ${a.scoreTotal?.toFixed(1)||'—'}/10 &nbsp;<span style="cursor:pointer;text-decoration:underline" onclick="reloadAnalise('${ticker}')">Reabrir</span></div>`;}
 }else{if(banner)banner.style.display='none';}
 // ── MOSTRAR BLOCOS DE AVALIAÇÃO ──
 ['card-quali','card-quanti','card-summary'].forEach(id=>{
 const el=document.getElementById(id);if(el)el.style.display='block';
 });
 // Esconder banners e status de rascunho
 ['draft-banner','draft-banner-top'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
 setDraftStatus('','');
 const btnD=document.getElementById('btn-discard-draft');if(btnD)btnD.style.display='none';
 _draftRascunho=null;

 if(a?.finalizado){
 reloadAnalise(ticker);
 }else{
 renderQuantiBlocks(tipo);
 renderQualiBlocksPlaceholder();
 setTimeout(()=>preencherDadosBTG(ticker,tipo),50);
 // Verificar rascunho após renderizar os blocos
 const analista=document.getElementById('sel-analista')?.value||'';
 if(analista) setTimeout(()=>verificarRascunho(ticker,analista),200);
 }
 // Iniciar timer de auto-save
 iniciarAutoSaveTimer();
}
export function renderQualiBlocksPlaceholder(){
 const cont=document.getElementById('quali-blocks');if(!cont)return;
 cont.innerHTML=QUALI_CRITERIA.map(c=>`<div class="score-block" id="block-${c.id}">
 <div class="score-block-header">
 <div style="flex:1">
 <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
 <div class="score-block-title">${c.nome} <span style="font-size:10px;color:#6b7a9a;font-weight:500">· ${c.peso}%</span></div>
 <label class="applicable-check"><input type="checkbox" id="aplic-${c.id}" checked onchange="toggleAplic('${c.id}','quali')">Aplicável</label>
 </div>
 <div class="score-block-desc">${c.desc}</div>
 <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">
 <span class="range-pill r-low">0–3: ${c.ranges[0].substring(0,55)}${c.ranges[0].length>55?'…':''}</span>
 <span class="range-pill r-mid">4–6: ${c.ranges[1].substring(0,55)}${c.ranges[1].length>55?'…':''}</span>
 <span class="range-pill r-high">7–10: ${c.ranges[2].substring(0,55)}${c.ranges[2].length>55?'…':''}</span>
 </div></div>
 <div class="score-block-right">
 <div class="score-input-wrap"><div class="score-input-label">Nota</div>
 <input type="number" class="score-num" id="quali-note-${c.id}" min="0" max="10" step="0.5" placeholder="—" oninput="updateScore()" onblur="autoSaveDraft()"></div>
 <div id="quali-sug-${c.id}" class="score-suggested"></div>
 </div></div>
 <textarea class="form-textarea" id="quali-just-${c.id}" placeholder="Justificativa do analista..." onblur="autoSaveDraft()"></textarea>
 </div>`).join('');
}
export function renderQuantiBlocks(tipo){
 const cont=document.getElementById('quanti-blocks');if(!cont)return;
 cont.innerHTML=QUANTI_CRITERIA.map(c=>{
 const ranges=c.getRange?c.getRange(tipo):c.ranges;
 return`<div class="score-block" id="block-${c.id}">
 <div class="score-block-header">
 <div style="flex:1">
 <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;flex-wrap:wrap">
 <div class="score-block-title">${c.nome} <span style="font-size:10px;color:#6b7a9a;font-weight:500">· ${c.peso}%</span></div>
 <label class="applicable-check"><input type="checkbox" id="aplic-${c.id}" checked onchange="toggleAplic('${c.id}','quanti')">Aplicável</label>
 <span id="quanti-sug-${c.id}"></span>
 </div>
 <div id="quanti-val-${c.id}" style="font-size:10px;color:var(--apex-blue);font-weight:600;margin-bottom:4px"></div>
 <div class="score-block-desc">${c.desc}</div>
 <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">
 ${ranges.map((r,i)=>`<span class="range-pill ${i===0?'r-low':i===1?'r-mid':'r-high'}">${r.label}: ${r.txt}</span>`).join('')}
 </div></div>
 <div class="score-block-right"><div class="score-input-wrap"><div class="score-input-label">Nota</div>
 <input type="number" class="score-num" id="quanti-note-${c.id}" min="0" max="10" step="0.5" placeholder="—" oninput="updateScore()" onblur="autoSaveDraft()"></div>
 </div></div>
 <textarea class="form-textarea" id="quanti-just-${c.id}" placeholder="Justificativa do analista..." onblur="autoSaveDraft()"></textarea>
 </div>`;
 }).join('');
}
export function toggleAplic(id, type){
 const cb=document.getElementById('aplic-'+id);
 const block=document.getElementById('block-'+id);
 const noteEl=document.getElementById((type==='quali'?'quali-note-':'quanti-note-')+id);
 const justEl=document.getElementById((type==='quali'?'quali-just-':'quanti-just-')+id);
 const isOff=!cb.checked;
 if(noteEl){noteEl.disabled=isOff;if(isOff)noteEl.value='';}
 if(block) block.style.opacity=isOff?'0.45':'1';
 if(justEl){justEl.style.opacity=isOff?'0.4':'1';}
 updateScore();
}
export function updateScore(){
 let qs=0,qc=0;
 QUALI_CRITERIA.forEach(c=>{
 const cb=document.getElementById('aplic-'+c.id);
 if(cb&&!cb.checked) return;
 const v=parseFloat(document.getElementById('quali-note-'+c.id)?.value);if(!isNaN(v)){qs+=v;qc++;}
 });
 const qualiScore=qc>0?qs/qc:null;
 let qws=0,qwv=0;
 QUANTI_CRITERIA.forEach(c=>{
 const cb=document.getElementById('aplic-'+c.id);
 if(cb&&!cb.checked) return;
 const v=parseFloat(document.getElementById('quanti-note-'+c.id)?.value);if(!isNaN(v)){qws+=c.peso;qwv+=v*c.peso;}
 });
 const quantiScore=qws>0?qwv/qws:null;
 const qb=document.getElementById('badge-quali');if(qb)qb.textContent=qualiScore!==null?qualiScore.toFixed(1)+'/10':'—';
 const nb=document.getElementById('badge-quanti');if(nb)nb.textContent=quantiScore!==null?quantiScore.toFixed(1)+'/10':'—';
 const sq=document.getElementById('sum-quali');if(sq)sq.textContent=qualiScore!==null?qualiScore.toFixed(1):'—';
 const sn=document.getElementById('sum-quanti');if(sn)sn.textContent=quantiScore!==null?quantiScore.toFixed(1):'—';
 if(qualiScore!==null&&quantiScore!==null){
 const total=qualiScore*0.4+quantiScore*0.6;
 const st=document.getElementById('sum-total');if(st)st.textContent=total.toFixed(1);
 const pct=(total/10)*100;
 const sb=document.getElementById('sum-bar');if(sb)sb.style.width=pct+'%';
 const sp=document.getElementById('sum-pct');if(sp)sp.textContent=pct.toFixed(0)+'%';
 }
}
/**
 * Finaliza a análise do fundo selecionado: valida campos, calcula os scores
 * (qualitativo 40% + quantitativo 60%), persiste no Supabase e atualiza a UI.
 * @returns {Promise<void>}
 */
export async function finalizarAnalise(){
 const ticker=currentTicker,analista=document.getElementById('sel-analista').value,tipo=document.getElementById('sel-tipo').value;
 if(!ticker||!analista){toast('Selecione o fundo e o analista antes de finalizar.', 'warning');return;}
 let qs=0,qc=0;const qScores={},qJust={};
 QUALI_CRITERIA.forEach(c=>{
 const cb=document.getElementById('aplic-'+c.id);
 const na=cb&&!cb.checked;
 const v=parseFloat(document.getElementById('quali-note-'+c.id)?.value);
 const j=document.getElementById('quali-just-'+c.id)?.value||'';
 qScores[c.id]=na?null:isNaN(v)?null:v;qJust[c.id]=j;
 if(!na&&!isNaN(v)){qs+=v;qc++;}
 });
 const qualiScore=qc>0?qs/qc:0;
 let qws=0,qwv=0;const nScores={},nJust={};
 QUANTI_CRITERIA.forEach(c=>{
 const cb=document.getElementById('aplic-'+c.id);
 const na=cb&&!cb.checked;
 const v=na?null:parseFloat(document.getElementById('quanti-note-'+c.id)?.value);
 const j=document.getElementById('quanti-just-'+c.id)?.value||'';
 nScores[c.id]=na?null:isNaN(v)?null:v;nJust[c.id]=j;
 if(!na&&!isNaN(v)){qws+=c.peso;qwv+=v*c.peso;}
 });
 const quantiScore=qws>0?qwv/qws:0,scoreTotal=qualiScore*0.4+quantiScore*0.6;
 const fund=ELIGIBLE_FUNDS.find(f=>f.ticker===ticker)||{};
 const hoje=new Date(),data=String(hoje.getDate()).padStart(2,'0')+'/'+String(hoje.getMonth()+1).padStart(2,'0')+'/'+hoje.getFullYear();
 const analiseObj={ticker,nome:fund.nome||'',seg:fund.seg||'',analista,data,tipo,qualiScores:qScores,qualiJust:qJust,quantiScores:nScores,quantiJust:nJust,scoreTotal,scoreQuali:qualiScore,scoreQuanti:quantiScore,finalizado:true};
 analyses[ticker]=analiseObj;
 localStorage.setItem('apex_fii_analyses',JSON.stringify(analyses));
 // Salvar no Supabase (com feedback visual)
 const btnF=document.querySelector('.btn-finalizar');
 if(btnF){btnF.textContent='Salvando...';btnF.disabled=true;}
 try{
 await supaSave(analiseObj);
 toast('✓ Análise de '+ticker+' finalizada e salva!\nScore Final: '+scoreTotal.toFixed(1)+'/10', 'success');
 }catch(e){
 toast('⚠️ Análise salva localmente, mas houve erro no banco:\n'+e.message+'\n\nOs dados estão seguros no browser.', 'warning');
 }finally{
 if(btnF){btnF.textContent='✓ Finalizar Análise';btnF.disabled=false;}
 }
 renderScoreRanking();injectAnalyseTags();
 if(document.getElementById('tab-atividade')?.classList.contains('active'))renderAtividade();
 renderAtvVisaoGeral();
 updateKpiRow();
 // Limpar rascunho após finalizar
 await limparRascunhoAoFinalizar(ticker, analista);
 pararAutoSaveTimer();
 // Limpar formulário e voltar ao estado inicial
 resetAnaliseFundo();
}
/**
 * Limpa o formulário de análise e retorna ao estado inicial (fundo não selecionado).
 * Chamado automaticamente após finalizar uma análise com sucesso.
 * Quando o analista selecionar o mesmo fundo novamente, onFundoSelect() → reloadAnalise()
 * recarregará automaticamente os dados salvos.
 */
export function resetAnaliseFundo(){
 currentTicker='';
 window.currentTicker = currentTicker;

 // Voltar seletor de fundo para o estado inicial
 const fundoEl=document.getElementById('sel-fundo');
 if(fundoEl) fundoEl.value='';

 // Ocultar todos os cards de análise
 ['card-quali','card-quanti','card-summary','pa-alert',
 'fundo-status-banner','draft-banner-top','btn-forum-analise'].forEach(id=>{
 const el=document.getElementById(id);
 if(el) el.style.display='none';
 });

 // Limpar todos os inputs de score qualitativo
 QUALI_CRITERIA.forEach(c=>{
 const note=document.getElementById('quali-note-'+c.id);
 const just=document.getElementById('quali-just-'+c.id);
 if(note) note.value='';
 if(just) just.value='';
 const sug=document.getElementById('quali-sug-'+c.id);
 if(sug) sug.textContent='';
 });

 // Limpar todos os inputs de score quantitativo
 QUANTI_CRITERIA.forEach(c=>{
 const note=document.getElementById('quanti-note-'+c.id);
 const just=document.getElementById('quanti-just-'+c.id);
 if(note) note.value='';
 if(just) just.value='';
 // Reabilitar checkboxes de aplicabilidade
 const cb=document.getElementById('aplic-'+c.id);
 if(cb) cb.checked=false;
 });

 // Atualizar painéis dependentes
 injectAnalyseTags(); // atualiza tags na tabela de fundos
 injectPreAnaliseBadges(); // atualiza badges pré-análise
 renderScoreRanking(); // atualiza ranking de scores
 updateKpiRow(); // atualiza KPIs da visão geral
 renderAtvVisaoGeral(); // atualiza feed de atividade
}
export function reloadAnalise(ticker){
 const btnForum=document.getElementById('btn-forum-analise');
 if(btnForum)btnForum.style.display='block';
 const a=analyses[ticker];if(!a)return;
 document.getElementById('sel-tipo').value=a.tipo||'papel-ipca';
 document.getElementById('sel-analista').value=a.analista;
 ['card-comparativo','card-quali','card-quanti','card-summary'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='block';});
 renderQuantiBlocks(a.tipo||'papel-ipca');renderQualiBlocksPlaceholder();
 QUALI_CRITERIA.forEach(c=>{const v=a.qualiScores[c.id];const j=a.qualiJust[c.id];if(v!=null){const el=document.getElementById('quali-note-'+c.id);if(el)el.value=v;}if(j){const el=document.getElementById('quali-just-'+c.id);if(el)el.value=j;}});
 QUANTI_CRITERIA.forEach(c=>{const v=a.quantiScores[c.id];const j=a.quantiJust[c.id];if(c.checkAplic&&v!=null){const cb=document.getElementById('aplic-'+c.id);if(cb){cb.checked=true;const inp=document.getElementById('quanti-note-'+c.id);if(inp)inp.disabled=false;}}if(v!=null){const el=document.getElementById('quanti-note-'+c.id);if(el)el.value=v;}if(j){const el=document.getElementById('quanti-just-'+c.id);if(el)el.value=j;}});
 setTimeout(()=>preencherDadosBTG(ticker,a.tipo||'papel-ipca'),50);
 updateScore();
}
// renderScoreRanking, renderRankingEstabilidade e _renderRankingRows
// movidos para js/tabs/ranking.js (Fase 4 da modularização).
export function exportCSV(){
 const tbl=document.getElementById('tbl-fundos');if(!tbl)return;
 const rows=Array.from(tbl.querySelectorAll('tr')).filter(r=>r.style.display!=='none');
 const csv=rows.map(r=>Array.from(r.cells).slice(0,-2).map(c=>'"'+c.textContent.trim().replace(/"/g,'""')+'"').join(',')).join('\n');
 const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download='FII_Elegiveis_02062026.csv';a.click();URL.revokeObjectURL(url);
}
/**
 * Sanitiza texto para uso no jsPDF.
 * O jsPDF usa encoding WinAnsi (Latin-1). Caracteres fora desse range
 * (aspas tipográficas, travessão, reticências, etc.) produzem o efeito
 * "S oma d o s" — cada byte UTF-8 renderizado como caractere separado.
 * Esta função substitui todos esses caracteres por equivalentes Latin-1 legíveis.
 */
export function sanitizePDFText(str){
  if(!str) return '';
  return String(str)
    // Aspas tipográficas → aspas simples/duplas padrão
    .replace(/[\u201C\u201D\u201E\u201F]/g,'"') // " " „ ‟ → "
    .replace(/[\u2018\u2019\u201A\u201B]/g,"'")  // ' ' ‚ ‛ → '
    // Travessões e hífens especiais → hífen simples
    .replace(/[\u2013\u2014\u2015]/g,'-')         // – — ― → -
    // Reticências → ...
    .replace(/\u2026/g,'...')                     // … → ...
    // Espaços especiais → espaço normal
    .replace(/[\u00A0\u202F\u2009\u2008]/g,' ')  // nbsp, narrow space, etc.
    // Bullets e símbolos decorativos
    .replace(/[\u2022\u2023\u25AA\u25CF]/g,'*')  // • ‣ ▪ ● → *
    // Remover zero-width characters
    .replace(/[\u200B\u200C\u200D\uFEFF]/g,'')
    // Qualquer outro char fora de Latin-1 (> U+00FF) → ? 
    .replace(/[^\u0000-\u00FF]/g,'?');
}

export function exportarPDF(tickerParam){
 // Verificar se jsPDF foi carregado
 if(typeof window.jspdf==='undefined'){
 toast('Biblioteca PDF não carregada. Aguarde alguns segundos e tente novamente.','warning');
 return;
 }
 const t=tickerParam||currentTicker;
 const a=analyses[t];
 if(!a){toast('Análise não encontrada para este fundo.','error');return;}

 const{jsPDF}=window.jspdf;
 const doc=new jsPDF('p','mm','a4');
 const W=210,H=297;

 // Paleta Apex
 const DARK =[0,1,35];
 const NAVY =[0,32,96];
 const BLUE =[0,118,210];
 const WHITE=[255,255,255];
 const LIGHT=[160,196,240];
 const scoreRGB=a.scoreTotal>=7?[27,138,82]:a.scoreTotal>=4?[160,104,0]:[192,57,43];
 const scoreTxt=a.scoreTotal>=7?'APROVADO':a.scoreTotal>=4?'EM AVALIAÇÃO':'REPROVADO';

 const fund=ELIGIBLE_FUNDS.find(f=>f.ticker===t)||{};
 const fd=fundDataMap[t]||{};
 const hoje=new Date();
 const dataStr=String(hoje.getDate()).padStart(2,'0')+'/'+String(hoje.getMonth()+1).padStart(2,'0')+'/'+hoje.getFullYear();

 // ── HEADER ────────────────────────────────────────────────────
 doc.setFillColor(...DARK);
 doc.rect(0,0,W,55,'F');

 // Logotipo simplificado Apex (losango azul + texto branco)
 doc.setFillColor(0,120,210);
 doc.rect(10,8,24,24,'F');
 doc.setFillColor(...WHITE);
 // Losango: top, right, bottom, left
 const lx=22,ly=20;
 const pts=[[lx,ly-8],[lx+9,ly],[lx,ly+8],[lx-9,ly]];
 // Desenhar losango via linhas
 doc.setDrawColor(...WHITE);doc.setLineWidth(0.5);
 for(let i=0;i<pts.length;i++){
 const n=pts[(i+1)%pts.length];
 doc.line(pts[i][0],pts[i][1],n[0],n[1]);
 }
 doc.setFillColor(...WHITE);
 // Preencher losango com triangulos
 doc.triangle(pts[0][0],pts[0][1],pts[1][0],pts[1][1],pts[3][0],pts[3][1],'F');
 doc.triangle(pts[2][0],pts[2][1],pts[1][0],pts[1][1],pts[3][0],pts[3][1],'F');

 // Texto APEX Partners
 doc.setTextColor(...WHITE);
 doc.setFont('helvetica','bold');doc.setFontSize(16);
 doc.text('APEX',38,18);
 doc.setFont('helvetica','normal');doc.setFontSize(9);
 doc.setTextColor(...LIGHT);
 doc.text('Partners',38,24);

 // Tag confidencial
 doc.setFontSize(7);doc.setFont('helvetica','bold');
 doc.setTextColor(0,118,210);
 doc.text('ANÁLISE DE FII — USO INTERNO · CONFIDENCIAL',10,37);

 // Ticker grande
 doc.setFontSize(24);doc.setFont('helvetica','bold');
 doc.setTextColor(...WHITE);
 doc.text(a.ticker,10,50);

 // Nome e meta (direita) — sanitizar texto do usuário
 doc.setFontSize(9);doc.setFont('helvetica','normal');
 doc.setTextColor(...LIGHT);
 const nomeRaw=(a.nome||'');
 const nomeT=sanitizePDFText(nomeRaw.length>50?nomeRaw.slice(0,49)+'...':nomeRaw);
 doc.text(nomeT,W-10,40,{align:'right'});
 doc.text('Analista: '+sanitizePDFText(a.analista),W-10,47,{align:'right'});
 doc.text('Data: '+a.data,W-10,54,{align:'right'});

 // ── SCORE STRIP ───────────────────────────────────────────────
 doc.setFillColor(...NAVY);
 doc.rect(0,55,W,28,'F');
 doc.setDrawColor(...LIGHT);doc.setLineWidth(0.2);
 doc.line(70,58,70,80);doc.line(140,58,140,80);

 const scoreItems=[
 {lbl:'SCORE QUALITATIVO',val:(a.scoreQuali??0).toFixed(1),sub:'peso 40%',cx:35},
 {lbl:'SCORE QUANTITATIVO',val:(a.scoreQuanti??0).toFixed(1),sub:'peso 60%',cx:105},
 {lbl:'SCORE FINAL',val:(a.scoreTotal??0).toFixed(1),sub:scoreTxt,cx:175,dest:true},
 ];
 scoreItems.forEach(s=>{
 doc.setFontSize(7);doc.setFont('helvetica','bold');
 doc.setTextColor(...LIGHT);
 doc.text(s.lbl,s.cx,62,{align:'center'});
 doc.setFontSize(s.dest?22:18);
 doc.setTextColor(s.dest?scoreRGB[0]:255,s.dest?scoreRGB[1]:255,s.dest?scoreRGB[2]:255);
 doc.text(s.val,s.cx,74,{align:'center'});
 doc.setFontSize(8);doc.setFont('helvetica','normal');
 doc.setTextColor(0,118,210);
 doc.text(s.sub,s.cx,80,{align:'center'});
 });

 let y=91;

 // ── DADOS DO FUNDO ────────────────────────────────────────────
 doc.setFontSize(8);doc.setFont('helvetica','bold');
 doc.setTextColor(0,118,210);
 doc.text('DADOS DO FUNDO',10,y);
 doc.setDrawColor(0,118,210);doc.setLineWidth(0.3);
 doc.line(10,y+1.5,200,y+1.5);
 y+=5;

 const fichaItens=[
 ['Segmento',a.seg||fund.seg||'—'],
 ['Tipo de Fundo',a.tipo||'—'],
 ['Analista',a.analista],
 ['Data da Análise',a.data],
 ['Preço',fd.preco?'R$ '+parseFloat(fd.preco).toFixed(2):'—'],
 ['DY Anualizado',fd.yield?fmtPercent(fd.yield):'—'],
 ['P/VP',fd.pvp?parseFloat(fd.pvp).toFixed(2)+'x':'—'],
 ['MktCap',fd.mkt?'R$ '+((fd.mkt/1e6).toFixed(0))+'M':'—'],
 ];
 const cW=47.5;
 fichaItens.forEach((item,i)=>{
 const col=i%4,row=Math.floor(i/4);
 const fx=10+col*cW,fy=y+row*12;
 doc.setFillColor(244,248,253);
 doc.rect(fx,fy,cW-1,11,'F');
 doc.setFontSize(7);doc.setFont('helvetica','bold');
 doc.setTextColor(0,118,210);
 doc.text(item[0].toUpperCase(),fx+2,fy+4);
 doc.setFontSize(9);doc.setFont('helvetica','bold');
 doc.setTextColor(...NAVY);
 doc.text(String(item[1]),fx+2,fy+9.5);
 });
 y+=28;

 // ── HISTÓRICO DE ELEGIBILIDADE ────────────────────────────────
 if(typeof TRACKRECORD_DATA!=='undefined'){
 const tr=TRACKRECORD_DATA.find(r=>r.ticker===t);
 if(tr){
 y+=2;
 doc.setFontSize(8);doc.setFont('helvetica','bold');
 doc.setTextColor(0,118,210);
 doc.text('HISTÓRICO DE ELEGIBILIDADE',10,y);
 doc.line(10,y+1.5,200,y+1.5);
 y+=5;
 const entries=Object.entries(tr).filter(([k])=>k!=='ticker'&&k!=='nome');
 const bw=Math.min(8,190/entries.length);
 entries.forEach(([,val],idx)=>{
 const bx=10+idx*(bw+0.5);
 const rgb=val==='S'?[27,138,82]:val==='N'?[192,57,43]:[200,200,200];
 doc.setFillColor(...rgb);
 doc.rect(bx,y,bw,6,'F');
 });
 y+=9;
 doc.setFontSize(7);doc.setFont('helvetica','normal');
 doc.setTextColor(120,120,120);
 doc.text('Verde = Elegível | Vermelho = Não elegível | Cinza = sem dado',10,y);
 y+=5;
 }
 }

 // ── ANÁLISE QUALITATIVA ───────────────────────────────────────
 y+=2;
 doc.setFontSize(8);doc.setFont('helvetica','bold');
 doc.setTextColor(0,118,210);
 doc.text('ANÁLISE QUALITATIVA — Score: '+(a.scoreQuali??0).toFixed(1)+'/10 (peso 40%)',10,y);
 doc.line(10,y+1.5,200,y+1.5);
 y+=3;

 doc.autoTable({
 startY:y,
 head:[['Critério','Nota','Justificativa / Observações']],
 body:QUALI_CRITERIA.map(c=>{
 const sc=a.qualiScores?.[c.id];
 const jt=sanitizePDFText(a.qualiJust?.[c.id]||'');
 const notaBadge=sc!=null?String(sc):'N/A';
 return[sanitizePDFText(c.nome),notaBadge,jt];
 }),
 columnStyles:{0:{cellWidth:52,fontStyle:'bold'},1:{cellWidth:14,halign:'center'},2:{cellWidth:124}},
 headStyles:{fillColor:NAVY,fontSize:8,fontStyle:'bold',textColor:WHITE},
 bodyStyles:{fontSize:8,textColor:NAVY},
 alternateRowStyles:{fillColor:[244,248,253]},
 margin:{left:10,right:10},
 didParseCell:function(data){
 if(data.section==='body'&&data.column.index===1){
 const v=parseFloat(data.cell.text[0]);
 if(!isNaN(v)){
 data.cell.styles.textColor=v>=7?[27,138,82]:v>=4?[160,104,0]:[192,57,43];
 data.cell.styles.fontStyle='bold';
 }
 }
 }
 });
 y=doc.lastAutoTable.finalY+5;

 // ── ANÁLISE QUANTITATIVA ──────────────────────────────────────
 doc.setFontSize(8);doc.setFont('helvetica','bold');
 doc.setTextColor(0,118,210);
 doc.text('ANÁLISE QUANTITATIVA — Score: '+(a.scoreQuanti??0).toFixed(1)+'/10 (peso 60%)',10,y);
 doc.line(10,y+1.5,200,y+1.5);
 y+=3;

 doc.autoTable({
 startY:y,
 head:[['Indicador','Peso','Nota','Observações']],
 body:QUANTI_CRITERIA.map(c=>{
 const sc=a.quantiScores?.[c.id];
 const jt=sanitizePDFText(a.quantiJust?.[c.id]||'');
 return[sanitizePDFText(c.nome),c.peso.toFixed(1)+'%',sc!=null?String(sc):'N/A',jt];
 }),
 columnStyles:{0:{cellWidth:50,fontStyle:'bold'},1:{cellWidth:14,halign:'center'},2:{cellWidth:14,halign:'center'},3:{cellWidth:112}},
 headStyles:{fillColor:NAVY,fontSize:8,fontStyle:'bold',textColor:WHITE},
 bodyStyles:{fontSize:8,textColor:NAVY},
 alternateRowStyles:{fillColor:[244,248,253]},
 margin:{left:10,right:10},
 didParseCell:function(data){
 if(data.section==='body'&&data.column.index===2){
 const v=parseFloat(data.cell.text[0]);
 if(!isNaN(v)){
 data.cell.styles.textColor=v>=7?[27,138,82]:v>=4?[160,104,0]:[192,57,43];
 data.cell.styles.fontStyle='bold';
 }
 }
 }
 });

 // ── RODAPÉ EM TODAS AS PÁGINAS ────────────────────────────────
 const total=doc.internal.getNumberOfPages();
 for(let p=1;p<=total;p++){
 doc.setPage(p);
 doc.setFillColor(...DARK);
 doc.rect(0,H-16,W,16,'F');
 doc.setFontSize(7);doc.setFont('helvetica','normal');
 doc.setTextColor(...LIGHT);
 doc.text('APEX Partners · FII Universe · Uso Interno · Confidencial',10,H-9);
 doc.text('Gerado: '+dataStr+' · Pág. '+p+'/'+total,W-10,H-9,{align:'right'});
 doc.setTextColor(100,130,170);
 doc.text('Este material tem caráter exclusivamente informativo e não representa oferta ou recomendação de investimento.',10,H-4);
 }

 // ── DOWNLOAD ─────────────────────────────────────────────────
 const dataFile=dataStr.replace(/\//g,'');
 const filename=`${a.ticker}_${(a.analista||'Apex').replace(/\s+/g,'')}_${dataFile}.pdf`;
 doc.save(filename);
 toast('✓ PDF gerado: '+filename,'success');
}
// ── MAPA DE DADOS BTG POR FUNDO ───────────────────────────────
// fundDataMap agora vive em js/data-store.js (Fase 3 da modularização).
/**
 * Monta o mapa global `fundDataMap` (ticker → métricas) lendo as linhas já
 * renderizadas da tabela de fundos elegíveis (#fund-body).
 *
 * Por que ler do DOM em vez de usar ELIGIBLE_FUNDS?
 * ELIGIBLE_FUNDS contém apenas a lista estática {ticker, nome, seg}. Os valores
 * numéricos da semana corrente (Vol 90d, Yield, P/VP, MktCap, Preço) vêm do
 * Supabase e são escritos nas células da tabela por renderizarSemana(), com o
 * valor bruto em `data-val`. Esta função extrai justamente esses números já
 * formatados/calculados das células, evitando recalcular ou refazer a query.
 * É a fonte usada por preencherDadosBTG() para pré-preencher a aba de Análise.
 *
 * Depende de a tabela já estar renderizada — por isso é chamada após o load
 * dos dados (DOMContentLoaded e ao final de renderizarSemana).
 * @returns {void}
 */
export function buildFundDataMap(){
 document.querySelectorAll('#fund-body tr').forEach(r=>{
 const ticker=r.querySelector('strong')?.textContent?.trim();
 if(!ticker) return;
 const cells=r.querySelectorAll('td');
 const volRaw = parseFloat(cells[4]?.dataset?.val||0);
 const yieldRaw= parseFloat(cells[5]?.dataset?.val||0);
 const pvpTxt = cells[6]?.textContent?.trim()||'—';
 const pvpVal = parseFloat(pvpTxt.replace('x','').replace(',','.'));
 const mktRaw = parseFloat(cells[7]?.dataset?.val||0);
 fundDataMap[ticker]={
 vol:volRaw,
 yield:yieldRaw,
 pvp:pvpVal,
 mkt:mktRaw,
 yieldPct:fmtPercent(yieldRaw),
 pvpTxt:pvpTxt,
 volFmt:'R$ '+fmtCurrency(volRaw),
 mktFmt:'R$ '+fmtMillions(mktRaw),
 preco:cells[3]?.textContent?.trim()||'—',
 };
 });
}

// Sugerir nota com base nos limites do critério
export function sugerirNota(valor, limites){
 // limites: [{max, nota}] ordenado do menor para maior threshold
 if(isNaN(valor)||valor===null) return null;
 for(const l of limites){
 if(valor<=l.max) return l.nota;
 }
 return limites[limites.length-1].nota;
}

// Preencher scores quantitativos com dados do BTG Guide
export function preencherDadosBTG(ticker, tipo){
 const fd=fundDataMap[ticker];
 if(!fd) return;

 // n1: DY 12m — score baseado no tipo
 const dy=fd.yield;
 let n1Limites;
 if(tipo==='papel-cdi'||tipo==='hedge') n1Limites=[{max:0.12,nota:2},{max:0.14,nota:5},{max:99,nota:8}];
 else if(tipo==='tijolo'||tipo==='hibrido') n1Limites=[{max:0.08,nota:2},{max:0.10,nota:5},{max:99,nota:8}];
 else if(tipo==='fiagro') n1Limites=[{max:0.12,nota:2},{max:0.15,nota:5},{max:99,nota:8}];
 else n1Limites=[{max:0.10,nota:2},{max:0.12,nota:5},{max:99,nota:8}]; // ipca, fi-infra
 const n1Score = dy>0.14?10 : dy>0.12?9 : dy>0.10?8 : dy>0.09?7 : dy>0.08?6 : dy>0.07?5 : dy>0.06?4 : dy>0.05?3 : 2;

 // n5: ADTV 3m
 const vol=fd.vol;
 const n5Score = vol>3e6?10 : vol>2e6?9 : vol>1e6?8 : vol>500e3?7 : vol>400e3?6 : vol>350e3?5 : vol>300e3?4 : 2;

 // n6: PL Fundo (usando MktCap como proxy)
 const mkt=fd.mkt;
 const n6Score = mkt>2e9?10 : mkt>1e9?9 : mkt>700e6?8 : mkt>500e6?7 : mkt>400e6?6 : mkt>300e6?5 : mkt>200e6?4 : 2;

 // n8: P/VP
 const pvp=fd.pvp;
 const n8Score = pvp<0.85?10 : pvp<0.90?9 : pvp<0.95?8 : pvp<1.00?7 : pvp<1.05?6 : pvp<1.10?5 : pvp<1.15?4 : 2;

 const sugestoes = {
 n1:{score:n1Score, label:`DY ${fd.yieldPct}`, fonte:'BTG'},
 n5:{score:n5Score, label:`Vol ${fd.volFmt}/dia`, fonte:'BTG'},
 n6:{score:n6Score, label:`MktCap ${fd.mktFmt}`, fonte:'BTG'},
 n8:{score:n8Score, label:`P/VP ${fd.pvpTxt}`, fonte:'BTG'},
 };

 Object.entries(sugestoes).forEach(([id,s])=>{
 const n=document.getElementById('quanti-note-'+id);
 const sug=document.getElementById('quanti-sug-'+id);
 const val=document.getElementById('quanti-val-'+id);
 if(n&&!n.disabled&&!n.value){n.value=s.score;}
 if(sug)sug.innerHTML=`<span style="background:#dbeafe;color:#1e40af;padding:2px 7px;border-radius:5px;font-size:9px;font-weight:700">BTG: ${s.score}/10</span>`;
 if(val)val.textContent=s.label;
 });
 updateScore();
}

export function onAnalistaChange(){
 const ticker = currentTicker;
 const analista= document.getElementById('sel-analista')?.value||'';
 if(!ticker||!analista) return;
 ['draft-banner','draft-banner-top'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
 setDraftStatus('','');
 _draftRascunho=null;
 // Só verificar rascunho se não houver análise finalizada
 if(!analyses[ticker]?.finalizado){
 setTimeout(()=>verificarRascunho(ticker,analista),200);
 }
}
export function onTipoChange(){
 if(!currentTicker)return;
 const tipo=document.getElementById('sel-tipo').value||'papel-ipca';
 renderQuantiBlocks(tipo);
 setTimeout(()=>preencherDadosBTG(currentTicker,tipo),50);
}

export function confirmarExcluirAnalise(ticker){
 const a=analyses[ticker];
 const nome=(a&&a.nome)||ticker;
 const analista=(a&&a.analista)||'—';
 const data=(a&&a.data)||'—';
 openConfirmModal({
 title:'Excluir Análise — '+ticker,
 desc:'Excluir permanentemente a análise de '+ticker+' ('+nome+'), feita por '+analista+' em '+data+'. Comentários do fórum serão preservados. Esta ação não pode ser desfeita.',
 wordLabel:'Digite o ticker '+ticker+' para confirmar:',
 expectedWord:ticker,
 onConfirm:()=>excluirAnalise(ticker)
 });
}

export async function excluirAnalise(ticker){
 const db = getDB();
 if(!db){ toast('Supabase não disponível.', 'error'); return; }
 try{
 // 1. Deletar do Supabase
 const {error, data} = await db
 .from('analyses')
 .delete()
 .eq('ticker', ticker)
 .select(); // retorna o que foi deletado para confirmar
 if(error){
 console.error('Erro Supabase ao excluir:', error);
 toast('Erro ao excluir do banco: ' + error.message, 'error');
 return;
 }
 console.log('Supabase delete result:', data);
 // 2. Limpar localmente
 delete analyses[ticker];
 localStorage.setItem('apex_fii_analyses', JSON.stringify(analyses));
 // 3. Forçar re-sync para garantir consistência
 invalidateRankingCache();
 await supaLoad();
 // 4. Atualizar UI
 renderScoreRanking();
 injectAnalyseTags();
 updateKpiRow();
 renderAtvVisaoGeral();
 toast('Análise de ' + ticker + ' excluída com sucesso.', 'success');
 }catch(e){
 console.error('Exceção em excluirAnalise:', e);
 toast('Erro inesperado: ' + e.message, 'error');
 }
}

window.openAnalise = openAnalise;
window.initAnaliseFundoDropdown = initAnaliseFundoDropdown;
window.onFundoSelect = onFundoSelect;
window.renderQualiBlocksPlaceholder = renderQualiBlocksPlaceholder;
window.renderQuantiBlocks = renderQuantiBlocks;
window.toggleAplic = toggleAplic;
window.updateScore = updateScore;
window.finalizarAnalise = finalizarAnalise;
window.resetAnaliseFundo = resetAnaliseFundo;
window.reloadAnalise = reloadAnalise;
window.exportCSV = exportCSV;
window.sanitizePDFText = sanitizePDFText;
window.exportarPDF = exportarPDF;
window.buildFundDataMap = buildFundDataMap;
window.sugerirNota = sugerirNota;
window.preencherDadosBTG = preencherDadosBTG;
window.onAnalistaChange = onAnalistaChange;
window.onTipoChange = onTipoChange;
window.confirmarExcluirAnalise = confirmarExcluirAnalise;
window.excluirAnalise = excluirAnalise;
