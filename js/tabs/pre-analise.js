'use strict';

// ══════════════════════════════════════════════════════════════
// PRÉ-ANÁLISE — Renderização e filtros (Fase 4 da modularização)
// ══════════════════════════════════════════════════════════════
// Depende de PRE_ANALISE/PRE_ANALISE_MAP (js/data/pre-analise-data.js)
// e fmtCurrency (js/formatters.js), já globais via window.

export function renderPreAnalise(){
 const tbody=document.getElementById('pre-body');
 if(!tbody)return;
 tbody.innerHTML=PRE_ANALISE.map(r=>{
 const isBadge=r.status==='Reprovado';
 const badge=isBadge
 ?'<span class="badge-reprov">● Reprovado</span>'
 :'<span class="badge-monit">● Monitorar</span>';
 const det=r.det?`<div style="max-width:320px">
 <div style="font-size:10px;line-height:1.5;color:#5a6e8a;max-height:60px;overflow:hidden;position:relative" id="det-${r.ticker}">${r.det.substring(0,180)}${r.det.length>180?'…':''}</div>
 ${r.det.length>180?`<span onclick="toggleDet('${r.ticker}')" style="font-size:9px;color:var(--apex-blue);cursor:pointer;font-weight:700">ver mais</span>`:''}
 </div>`:'—';
 const segChip=r.segmento?`<span class="seg-chip" style="background:var(--seg-out-bg);color:var(--seg-out-c)">${r.segmento}</span>`:'—';
 return`<tr>
 <td><strong style="color:var(--apex-blue)">${r.ticker}</strong></td>
 <td style="max-width:200px;white-space:normal">${r.nome}</td>
 <td style="font-size:11px">${r.gestora||'—'}</td>
 <td>${segChip}</td>
 <td style="text-align:right;font-weight:600">${r.mktcap?'R$ '+fmtCurrency(r.mktcap,{minimumFractionDigits:0})+'M':'—'}</td>
 <td>${badge}</td>
 <td style="font-size:10px;font-weight:600;color:#5a6e8a;max-width:150px;white-space:normal">${r.obs||'—'}</td>
 <td>${det}</td>
 <td style="font-size:11px;color:#6b7a9a">${r.analista||'—'}</td>
 <td style="font-size:11px;color:#6b7a9a;white-space:nowrap">${r.data_rev||'—'}</td>
 </tr>`;
 }).join('');
}

export function toggleDet(ticker){
 const el=document.getElementById('det-'+ticker);
 if(!el)return;
 const r=PRE_ANALISE_MAP[ticker];
 if(!r)return;
 if(el.style.maxHeight==='none'){
 el.style.maxHeight='60px';
 el.style.overflow='hidden';
 el.nextElementSibling.textContent='ver mais';
 el.textContent=r.det.substring(0,180)+'…';
 }else{
 el.style.maxHeight='none';
 el.style.overflow='visible';
 el.nextElementSibling.textContent='ver menos';
 el.textContent=r.det;
 }
}

export function filterPreAnalise(){
 const q=document.getElementById('pre-search')?.value.toLowerCase()||'';
 const st=document.getElementById('pre-status-filter')?.value||'';
 const ob=document.getElementById('pre-obs-filter')?.value||'';
 const rows=document.querySelectorAll('#pre-body tr');
 let v=0;
 rows.forEach(r=>{
 const txt=r.textContent.toLowerCase();
 const ok=(!q||txt.includes(q))&&(!st||txt.includes(st.toLowerCase()))&&(!ob||txt.includes(ob.toLowerCase()));
 r.style.display=ok?'':'none';
 if(ok)v++;
 });
 const el=document.getElementById('pre-count');
 if(el)el.textContent=v+' fundos';
}

// Injetar badges de pré-análise na tabela de fundos elegíveis
export function injectPreAnaliseBadges(){
 document.querySelectorAll('#fund-body tr').forEach(row=>{
 const ticker=row.querySelector('strong')?.textContent?.trim();
 if(!ticker)return;
 const pa=PRE_ANALISE_MAP[ticker];
 if(!pa)return;
 // Verificar se já tem badge
 if(row.querySelector('.badge-reprov,.badge-monit'))return;
 const firstCell=row.querySelector('td');
 if(!firstCell)return;
 const badge=pa.status==='Reprovado'
 ?`<span class="badge-reprov" title="${pa.obs}: ${pa.det.substring(0,120)}..." style="margin-left:4px">●</span>`
 :`<span class="badge-monit" title="${pa.obs}: ${pa.det.substring(0,120)}..." style="margin-left:4px">●</span>`;
 firstCell.insertAdjacentHTML('beforeend',badge);
 });
}

window.renderPreAnalise = renderPreAnalise;
window.toggleDet = toggleDet;
window.filterPreAnalise = filterPreAnalise;
window.injectPreAnaliseBadges = injectPreAnaliseBadges;
