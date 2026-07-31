'use strict';

// ══════════════════════════════════════════════════════════════
// MODAL — lista genérica (KPI cards clicáveis da Visão Geral)
// (Fase 4 da modularização)
// ══════════════════════════════════════════════════════════════
// Depende de getKpiData (js/tabs/visao-geral.js), ELIGIBLE_FUNDS/
// PRE_ANALISE (data), segChip (js/tabs/segmentos.js) e openAnalise/
// exportarPDF (Análise, ainda no script legado) — via window.

let _modalItems=[];

export function openModal(tipo){
 const overlay=document.getElementById('modal-overlay');
 const titleEl=document.getElementById('modal-title');
 const subtitleEl=document.getElementById('modal-subtitle');
 const footerEl=document.getElementById('modal-footer');
 const searchEl=document.getElementById('modal-search-input');
 if(!overlay)return;

 const d=getKpiData();
 let items=[], title='', subtitle='', renderFn=null;

 if(tipo==='elegiveis'){
 title='Fundos Elegíveis'; subtitle='Todos os fundos que passam nos 4 critérios BTG Guide';
 // Montar de ELIGIBLE_FUNDS
 items=ELIGIBLE_FUNDS.map(f=>({ticker:f.ticker,nome:f.nome,seg:f.seg,extra:'',score:null}));
 renderFn=(item)=>`<div class="modal-item" onclick="openAnalise('${item.ticker}')">
 <span class="modal-item-ticker">${item.ticker}</span>
 <span class="modal-item-nome">${item.nome}</span>
 ${segChip(item.seg,'mini')}
 </div>`;
 }
 else if(tipo==='analisados'){
 title='Fundos Analisados'; subtitle='Todos os fundos com análise finalizada';
 items=d.analisados.map(a=>({ticker:a.ticker,nome:a.nome,seg:a.seg,score:a.scoreTotal,analista:a.analista,data:a.data}));
 renderFn=itemScoreFn('var(--apex-blue)','#EBF4FB');
 }
 else if(tipo==='aprovados'){
 title='Fundos Aprovados'; subtitle='Score ≥ 6,0 — Recomendados para investimento';
 items=d.aprovados.map(a=>({ticker:a.ticker,nome:a.nome,seg:a.seg,score:a.scoreTotal,analista:a.analista,data:a.data}));
 renderFn=itemScoreFn('var(--success)','var(--success-bg)');
 }
 else if(tipo==='em-avaliacao'){
 title='Fundos Em Avaliação'; subtitle='Score entre 4,0 e 5,9 — Requerem análise adicional';
 items=d.emAval.map(a=>({ticker:a.ticker,nome:a.nome,seg:a.seg,score:a.scoreTotal,analista:a.analista,data:a.data}));
 renderFn=itemScoreFn('var(--warning)','var(--warning-bg)');
 }
 else if(tipo==='reprovados'){
 title='Fundos Reprovados'; subtitle='Score < 4,0 — Não recomendados no momento';
 items=d.reprovados.map(a=>({ticker:a.ticker,nome:a.nome,seg:a.seg,score:a.scoreTotal,analista:a.analista,data:a.data}));
 renderFn=itemScoreFn('var(--danger)','var(--danger-bg)');
 }
 else if(tipo==='pendentes'){
 title='Análise Pendente'; subtitle='Fundos elegíveis que ainda não foram analisados';
 const tickersPendentes=new Set(d.pendentes);
 items=ELIGIBLE_FUNDS.filter(f=>tickersPendentes.has(f.ticker)).map(f=>({ticker:f.ticker,nome:f.nome,seg:f.seg,score:null}));
 renderFn=(item)=>`<div class="modal-item" onclick="openAnalise('${item.ticker}')">
 <span class="modal-item-ticker">${item.ticker}</span>
 <span class="modal-item-nome">${item.nome}</span>
 ${segChip(item.seg,'mini')}
 <span style="font-size:9px;font-weight:700;padding:2px 8px;background:#fef9ec;color:#a06800;border-radius:4px;white-space:nowrap">● Iniciar análise</span>
 </div>`;
 }
 else if(tipo==='pre-analise'){
 title='Pré-Análises Registradas'; subtitle='Fundos com histórico de problemas ou em monitoramento';
 items=PRE_ANALISE.map(p=>({ticker:p.ticker,nome:p.nome,seg:p.segmento,score:null,obs:p.obs,status:p.status}));
 renderFn=(item)=>{
 const isReprov=item.status==='Reprovado';
 return`<div class="modal-item">
 <span class="modal-item-ticker">${item.ticker}</span>
 <span class="modal-item-nome">${item.nome}</span>
 ${segChip(item.seg,'mini')}
 <span style="font-size:9px;font-weight:700;padding:2px 8px;background:${isReprov?'#fdecea':'#fef9ec'};color:${isReprov?'var(--danger)':'var(--warning)'};border-radius:4px;white-space:nowrap">${isReprov?'●':'●'} ${item.status}</span>
 </div>`;
 };
 }

 _modalItems=items;
 titleEl.textContent=title;
 subtitleEl.textContent=subtitle;
 footerEl.textContent=items.length+' fundos';
 if(searchEl)searchEl.value='';
 renderModalList(items,renderFn||defaultRenderFn);
 overlay.classList.add('open');
 document.body.style.overflow='hidden';
 // Guardar renderFn para filtro
 overlay._renderFn=renderFn||defaultRenderFn;
}

export function itemScoreFn(col,bg){
 return(item)=>`<div class="modal-item" onclick="openAnalise('${item.ticker}')">
 <span class="modal-item-ticker">${item.ticker}</span>
 <span class="modal-item-nome">${item.nome}</span>
 ${segChip(item.seg,'mini')}
 <span style="display:inline-flex;align-items:center;padding:2px 10px;border-radius:10px;font-size:10px;font-weight:800;background:${bg};color:${col};white-space:nowrap">${item.score?.toFixed(1)||'—'}/10</span>
 <span style="font-size:10px;color:#6b7a9a;white-space:nowrap">${item.analista||''}</span>
 ${item.score!=null?`<button onclick="event.stopPropagation();exportarPDF('${item.ticker}')" style="padding:5px 11px;background:var(--apex-navy);color:#fff;border:none;border-radius:5px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Manrope',sans-serif;flex-shrink:0">PDF</button>`:''}
 </div>`;
}

export function defaultRenderFn(item){
 return`<div class="modal-item"><span class="modal-item-ticker">${item.ticker}</span><span class="modal-item-nome">${item.nome||''}</span></div>`;
}

export function renderModalList(items,renderFn){
 const list=document.getElementById('modal-list');
 const footer=document.getElementById('modal-footer');
 if(!list)return;
 if(items.length===0){
 list.innerHTML='<div class="modal-empty"><div style="font-size:32px;margin-bottom:10px"></div><div style="font-weight:700;color:var(--apex-navy)">Nenhum fundo encontrado</div></div>';
 }else{
 list.innerHTML=items.map(renderFn).join('');
 }
 if(footer)footer.textContent=items.length+' fundos';
}

export function filterModal(){
 const q=document.getElementById('modal-search-input')?.value?.toLowerCase()||'';
 const overlay=document.getElementById('modal-overlay');
 const filtered=q?_modalItems.filter(i=>(i.ticker+' '+(i.nome||'')).toLowerCase().includes(q)):_modalItems;
 renderModalList(filtered,overlay._renderFn||defaultRenderFn);
}

export function closeModal(){
 const overlay=document.getElementById('modal-overlay');
 if(overlay)overlay.classList.remove('open');
 document.body.style.overflow='';
}

// Fechar com ESC
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});

window.openModal = openModal;
window.itemScoreFn = itemScoreFn;
window.defaultRenderFn = defaultRenderFn;
window.renderModalList = renderModalList;
window.filterModal = filterModal;
window.closeModal = closeModal;
