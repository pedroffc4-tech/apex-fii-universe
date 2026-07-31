'use strict';

// ══════════════════════════════════════════════════════════════
// FUNDOS ELEGÍVEIS (Fase 4 da modularização)
// ══════════════════════════════════════════════════════════════
// Depende de `analyses` (js/data-store.js) e de openAnalise/exportarPDF/
// openForum/confirmarExcluirAnalise (Análise/Fórum/Confirm-modal, ainda
// no script legado) — acessíveis via window.

/**
 * Filtra a tabela de fundos elegíveis pelos campos de busca (texto), segmento
 * e situação de análise (pendente/analisado), mostrando/ocultando as linhas e
 * atualizando o contador de resultados.
 * @returns {void}
 */
export function filterFunds(){
 const q=document.getElementById('search-input').value.toLowerCase();
 const seg=document.getElementById('seg-filter').value.toLowerCase();
 const af=document.getElementById('analise-filter').value;
 const rows=document.querySelectorAll('#fund-body tr');
 let v=0;
 rows.forEach(r=>{
 const ticker=r.querySelector('strong')?.textContent?.trim()||'';
 const txt=r.textContent.toLowerCase();
 const isAn=!!analyses[ticker]?.finalizado;
 const ok=(!q||txt.includes(q))&&(!seg||txt.includes(seg))&&(!af||(af==='pendente'&&!isAn)||(af==='analisado'&&isAn));
 r.style.display=ok?'':'none';if(ok)v++;
 });
 document.getElementById('fund-count').textContent=v+' fundos';
}
export function injectAnalyseTags(){
 document.querySelectorAll('#fund-body tr').forEach(r=>{
 const ticker=r.querySelector('strong')?.textContent?.trim();if(!ticker)return;
 const cell=r.querySelector('.analise-cell');if(cell)cell.innerHTML=makeTagHTML(ticker);
 });
}
export function makeTagHTML(ticker){
 const a=analyses[ticker];
 if(a?.finalizado)return`
 <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
 <span class="tag-done" onclick="openAnalise('${ticker}')" title="Abrir análise">● ${a.data} · ${a.analista}</span>
 <button onclick="exportarPDF('${ticker}')" title="Baixar PDF"
 style="padding:5px 10px;background:var(--apex-navy);color:#fff;border:none;border-radius:5px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Manrope',sans-serif;white-space:nowrap;line-height:1.4">PDF</button>
 <button class="btn-forum" data-forum-ticker="${ticker}" onclick="openForum('${ticker}')" title="Fórum de discussão" style="padding:5px 10px;line-height:1.4">Fórum</button>
 <button class="btn-excluir" onclick="confirmarExcluirAnalise('${ticker}')" title="Excluir análise" style="padding:5px 10px;line-height:1.4">Excluir</button>
 </div>`;
 return`<span class="tag-pending" onclick="openAnalise('${ticker}')" title="Iniciar análise">● Análise Pendente</span>`;
}

window.filterFunds = filterFunds;
window.injectAnalyseTags = injectAnalyseTags;
window.makeTagHTML = makeTagHTML;
