'use strict';

// ══════════════════════════════════════════════════════════════
// POR SEGMENTO — 4 sub-abas (Fase 4 da modularização)
// ══════════════════════════════════════════════════════════════
// Depende de globais ainda no script legado (_currentFundos,
// _currentSemana, _carteira, _carteiraPrecos, analyses, toast,
// openAnalise, showTab, filterFunds) e dos módulos já extraídos
// (ELIGIBLE_FUNDS, SEG_COLORS/SEG_BG, formatters) — todos acessíveis
// via window.
//
// _segData/_segBarMetric/_segHighlight/_segCompSegs/_segTooltipTimer/
// _segDrillSeg/_radarSelectedSegs/SEG_HEATMAP_METRICS são estado 100%
// privado desta aba (nenhum outro lugar do index.html os referencia —
// conferido antes da extração). O window.X abaixo é só um retrato do
// valor inicial para inspeção via devtools; a leitura/escrita real
// acontece toda por referência lexical direta entre as funções deste
// arquivo, então nunca dessincroniza.

export let _segData={};
export let _radarSelectedSegs=new Set(); // kept for backward compat

/** Constrói o mapa de dados por segmento a partir dos fundos da semana atual. */
export function buildSegData(fundos, semana){
 const segs={};
 const entraram=JSON.parse(semana?.entraram||'[]');
 const sairam =JSON.parse(semana?.sairam ||'[]');

 fundos.filter(f=>f.elegivel).forEach(f=>{
 const s=f.segmento||'Outros';
 if(!segs[s]) segs[s]={fundos:[],entraram:0,sairam:0};
 segs[s].fundos.push(f);
 });

 // Tendências por segmento
 entraram.forEach(m=>{if(segs[m.segmento]) segs[m.segmento].entraram++;});
 sairam .forEach(m=>{if(segs[m.segmento]) segs[m.segmento].sairam++;});

 // Calcular médias
 Object.entries(segs).forEach(([,s])=>{
 const n=s.fundos.length||1;
 const avg=key=>s.fundos.reduce((a,f)=>a+(parseFloat(f[key])||0),0)/n;
 s.count=s.fundos.length;
 s.dy_anual =avg('dy_anual'); s.dy_ltm =avg('dy_ltm');
 s.pvp_atual=avg('pvp_atual'); s.vol3m =avg('vol3m');
 s.mktcap =avg('mktcap'); s.ret_mes =avg('ret_mes');
 s.ret_ano =avg('ret_ano'); s.ret_ltm =avg('ret_ltm');
 });
 return segs;
}

/** Entry point: reconstrói tudo a partir dos dados globais. */

// ══════════════════════════════════════════════════════════════
// POR SEGMENTO — Redesign completo (4 sub-abas)
// ══════════════════════════════════════════════════════════════
export let _segBarMetric='count';
export let _segCompSegs=[]; // até 3 segmentos selecionados na aba Comparar
export let _segHighlight=null; // segmento destacado pelo analista
export let _segTooltipTimer=null;
export let _segDrillSeg='';

export const SEG_HEATMAP_METRICS=[
 {key:'dy_anual', label:'DY Anual', fmt:v=>fmtPercent(v,1), higher:true},
 {key:'dy_ltm', label:'DY LTM', fmt:v=>fmtPercent(v,1), higher:true},
 {key:'pvp_atual',label:'P/VP', fmt:v=>v.toFixed(2)+'x', higher:false},
 {key:'vol3m', label:'Vol 3M', fmt:v=>'R$'+fmtMillions(v), higher:true},
 {key:'ret_mes', label:'Ret.Mês', fmt:v=>(v>=0?'+':'')+fmtPercent(v,2), higher:true},
 {key:'ret_ano', label:'Ret.Ano', fmt:v=>(v>=0?'+':'')+fmtPercent(v,1), higher:true},
 {key:'ret_ltm', label:'Ret.LTM', fmt:v=>(v>=0?'+':'')+fmtPercent(v,1), higher:true},
 {key:'mktcap', label:'MktCap', fmt:v=>'R$'+(v/1e9).toFixed(1)+'B', higher:true},
];

// ── Sub-tab switcher ─────────────────────────────────────────
export function showSegSubTab(id, btn){
 document.querySelectorAll('.seg-stab').forEach(b=>b.classList.remove('active'));
 document.querySelectorAll('.seg-stab-content').forEach(el=>el.style.display='none');
 if(btn) btn.classList.add('active');
 const el=document.getElementById('seg-stab-'+id);
 if(el) el.style.display='block';
 if(id==='comparar') { initSegCompChips(); renderSegComparar(); }
 if(id==='drilldown') renderSegDrilldown();
 if(id==='carteiraseg') renderSegCarteiraSeg();
}

// ── Main orchestrator ────────────────────────────────────────
export function renderSegmentos(){
 if(!_currentFundos.length) return;
 _segData=buildSegData(_currentFundos,_currentSemana);

 const el=_currentFundos.filter(f=>f.elegivel).length;
 const d=_currentSemana?.semana_data||'—';
 const h=document.getElementById('seg-hdr-title');
 const p=document.getElementById('seg-hdr-sub');
 if(h) h.textContent='Análise por Segmento';
 if(p) p.textContent=`${Object.keys(_segData).length} segmentos · ${el} fundos elegíveis · Referência: ${d}`;

 renderSegKpiStrip();
 renderSegBars();
 renderSegHeatmap();
 renderSegRankingCruzado();
 renderSegTable();
 // Atualizar sub-abas ativas
 const active=document.querySelector('.seg-stab.active');
 if(active){
 const id=active.onclick?.toString().match(/'(\w+)'/)?.[1];
 if(id==='comparar') renderSegComparar();
 if(id==='carteiraseg') renderSegCarteiraSeg();
 }
}

// ── KPI Strip ────────────────────────────────────────────────
export function renderSegKpiStrip(){
 const el=document.getElementById('seg-kpi-strip');
 if(!el) return;
 const segs=Object.entries(_segData);
 if(!segs.length) return;
 const wavg=(key)=>{
 const tot=segs.reduce((s,[,d])=>s+d[key]*d.count,0);
 const w=segs.reduce((s,[,d])=>s+d.count,0)||1;
 return tot/w;
 };
 const bestDY=segs.reduce((b,c)=>c[1].dy_anual>b[1].dy_anual?c:b);
 const bestRet=segs.reduce((b,c)=>c[1].ret_mes>b[1].ret_mes?c:b);
 const totalFundos=segs.reduce((s,[,d])=>s+d.count,0);

 const kpis=[
 {lbl:'Total Elegíveis', val:totalFundos, sub:'Todos os segmentos', cor:'var(--apex-blue)'},
 {lbl:'DY Médio Pond.', val:fmtPercent(wavg('dy_anual'),1), sub:'Ponderado por fundos', cor:'var(--success)'},
 {lbl:'P/VP Médio', val:wavg('pvp_atual').toFixed(2)+'x', sub:'Média ponderada', cor:'var(--apex-navy)'},
 {lbl:'Melhor DY', val:fmtPercent(bestDY[1].dy_anual,1), sub:bestDY[0], cor:'var(--success)'},
 {lbl:'Ret. Mês Pond.', val:fmtPercent(wavg('ret_mes'),2), sub:'Média ponderada', cor:wavg('ret_mes')>=0?'var(--success)':'var(--danger)'},
 {lbl:'Melhor Ret.Mês', val:fmtPercent(bestRet[1].ret_mes,2), sub:bestRet[0], cor:'var(--apex-blue)'},
 ];
 el.innerHTML=kpis.map(k=>`<div style="background:#fff;border:1.5px solid var(--apex-mist);border-radius:10px;padding:12px 14px">
 <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7a9a;margin-bottom:4px">${k.lbl}</div>
 <div style="font-size:20px;font-weight:800;color:${k.cor};line-height:1.1">${k.val}</div>
 <div style="font-size:10px;color:#6b7a9a;margin-top:3px">${k.sub}</div>
 </div>`).join('');
}

// ── Barras (mantidas) ────────────────────────────────────────
export function setSegBarMetric(metric, btn){
 _segBarMetric=metric;
 document.querySelectorAll('.seg-toggle').forEach(b=>b.classList.remove('active'));
 if(btn) btn.classList.add('active');
 renderSegBars();
}

export function renderSegBars(){
 const cont=document.getElementById('seg-bars-container');
 if(!cont) return;
 const segs=Object.entries(_segData).sort((a,b)=>b[1].count-a[1].count);
 if(!segs.length){cont.innerHTML='<div style="color:#6b7a9a;font-size:12px;text-align:center;padding:20px">Sem dados</div>';return;}
 const getVal=s=>{switch(_segBarMetric){case'dy':return s.dy_anual;case'pvp':return s.pvp_atual;case'vol':return s.vol3m;case'mkt':return s.mktcap;default:return s.count;}};
 const fmtVal=(v)=>{switch(_segBarMetric){case'dy':return fmtPercent(v,1);case'pvp':return v.toFixed(2)+'x';case'vol':return'R$'+fmtMillions(v);case'mkt':return'R$'+(v/1e9).toFixed(1)+'B';default:return v+' fundos';}};
 const maxVal=Math.max(...segs.map(([,s])=>getVal(s)))||1;
 cont.innerHTML=segs.map(([nome,s])=>{
 const val=getVal(s),pct=Math.max(3,Math.round(val/maxVal*100));
 const cor=SEG_COLORS[nome]||'#555',bg=SEG_BG[nome]||'#eee';
 const trendHtml=s.entraram>0&&s.sairam>0?`<span class="seg-bar-trend trend-up">▲${s.entraram} ▼${s.sairam}</span>`:
 s.entraram>0?`<span class="seg-bar-trend trend-up">▲${s.entraram}</span>`:
 s.sairam>0?`<span class="seg-bar-trend trend-dn">▼${s.sairam}</span>`:`<span class="seg-bar-trend trend-neu">—</span>`;
 const rowId='seg-row-'+nome.replace(/\W/g,'-');
 const expandId='seg-exp-'+nome.replace(/\W/g,'-');
 const tickersHtml=s.fundos.sort((a,b)=>a.ticker.localeCompare(b.ticker)).map(f=>`<span class="seg-ticker-pill" onclick="openAnalise('${f.ticker}')" title="DY: ${f.dy_anual?fmtPercent(f.dy_anual,1):'—'} · P/VP: ${f.pvp_atual?f.pvp_atual.toFixed(2)+'x':'—'}">${f.ticker}</span>`).join('');
 return`<div class="seg-bar-row"><div class="seg-bar-header" onclick="toggleSegExpand('${expandId}',this)" id="${rowId}">
 <span class="seg-bar-chip" style="background:${bg};color:${cor}">${nome}</span>
 <div class="seg-bar-track"><div class="seg-bar-fill" style="width:${pct}%;background:${cor}"></div></div>
 <span class="seg-bar-val">${fmtVal(val)}</span>${trendHtml}
 <span style="font-size:10px;color:#aaa;margin-left:4px;transition:transform .2s" class="seg-arrow">▼</span>
 </div>
 <div class="seg-expand-body" id="${expandId}">
 <div style="font-size:10px;color:#6b7a9a;margin-bottom:6px">${s.count} fundos · DY: <strong>${fmtPercent(s.dy_anual,1)}</strong> · P/VP: <strong>${s.pvp_atual.toFixed(2)}x</strong> · Vol: <strong>R$${fmtMillions(s.vol3m)}</strong></div>
 <div class="seg-ticker-grid">${tickersHtml}</div>
 </div></div>`;
 }).join('');
}
export function toggleSegExpand(expandId,headerEl){
 const body=document.getElementById(expandId);if(!body)return;
 const arrow=headerEl.querySelector('.seg-arrow');
 const open=body.classList.toggle('open');
 if(arrow)arrow.style.transform=open?'rotate(180deg)':'';
}

// ── Heatmap (substitui scatter) ──────────────────────────────
export function renderSegHeatmap(){
 const wrap=document.getElementById('seg-heatmap-wrap');
 if(!wrap)return;
 const segs=Object.entries(_segData).sort((a,b)=>b[1].count-a[1].count);
 if(!segs.length)return;

 // Normalizar cada coluna: 0=pior, 1=melhor
 const ranges={};
 SEG_HEATMAP_METRICS.forEach(m=>{
 const vals=segs.map(([,s])=>s[m.key]??null).filter(v=>v!==null);
 ranges[m.key]={min:Math.min(...vals),max:Math.max(...vals)};
 });
 const cellColor=(val,key,higher)=>{
 const r=ranges[key];if(!r||r.max===r.min||val===null)return'#f8f9fa';
 const n=(val-r.min)/(r.max-r.min);
 const score=higher?n:1-n; // 1=best
 if(score>0.75)return`rgba(27,138,82,${0.12+score*0.38})`;
 if(score>0.45)return`rgba(255,193,7,${0.08+score*0.18})`;
 return`rgba(192,57,43,${0.08+(1-score)*0.32})`;
 };

 let html=`<div style="overflow-x:auto"><table class="seg-hm-table">
 <thead><tr>
 <th style="min-width:150px">Segmento</th>
 <th>Fundos</th>
 <th title="Movimento vs semana anterior">▲▼</th>
 ${SEG_HEATMAP_METRICS.map(m=>`<th>${m.label}</th>`).join('')}
 </tr></thead><tbody>`;

 segs.forEach(([nome,s])=>{
 const cor=SEG_COLORS[nome]||'#555';
 const hl=_segHighlight===nome;
 const mvHtml=s.entraram>0||s.sairam>0
 ?`<span style="color:var(--success);font-size:10px">${s.entraram>0?'▲'+s.entraram:''}</span>${s.sairam>0?`<span style="color:var(--danger);font-size:10px"> ▼${s.sairam}</span>`:''}`
 :`<span style="color:#bbb">—</span>`;
 const nomeSafe=nome.replace(/'/g,"\\'");
 html+=`<tr class="${hl?'seg-highlighted':''}" onclick="toggleSegHighlight('${nomeSafe}')" onmouseenter="scheduleSegTooltip('${nomeSafe}',event)" onmouseleave="maybeHideTooltip()">
 <td style="background:${hl?SEG_BG[nome]||'#eef':'#fff'}">
 <div style="display:flex;align-items:center;gap:7px">
 <div style="width:8px;height:8px;border-radius:2px;background:${cor};flex-shrink:0"></div>
 <span style="font-weight:700;color:var(--apex-navy)">${nome}</span>
 </div>
 </td>
 <td style="font-weight:700;color:var(--apex-blue)">${s.count}</td>
 <td>${mvHtml}</td>
 ${SEG_HEATMAP_METRICS.map(m=>{
 const v=s[m.key]??null;
 return`<td style="background:${cellColor(v,m.key,m.higher)}">${v!==null?m.fmt(v):'—'}</td>`;
 }).join('')}
 </tr>`;
 });
 html+='</tbody></table></div>';
 wrap.innerHTML=html;
}

// ── Ranking cruzado (mantido) ─────────────────────────────────
export function renderSegRankingCruzado(){
 const cont=document.getElementById('seg-ranking-cruzado');if(!cont)return;
 const segs=Object.entries(_segData);if(!segs.length)return;
 const criterios=[
 {label:'Maior DY Anual', key:'dy_anual', fmt:v=>fmtPercent(v,1), best:'max'},
 {label:'Menor P/VP', key:'pvp_atual',fmt:v=>v.toFixed(2)+'x', best:'min'},
 {label:'Maior Vol. Médio',key:'vol3m', fmt:v=>'R$'+fmtMillions(v),best:'max'},
 {label:'Maior Ret. Ano', key:'ret_ano', fmt:v=>fmtPercent(v,1), best:'max'},
 {label:'Maior MktCap', key:'mktcap', fmt:v=>'R$'+(v/1e9).toFixed(1)+'B',best:'max'},
 {label:'Mais fundos', key:'count', fmt:v=>v+' fundos', best:'max'},
 ];
 const medals=['1.','2.','3.'];
 cont.innerHTML=criterios.map(c=>{
 const sorted=[...segs].sort((a,b)=>c.best==='max'?b[1][c.key]-a[1][c.key]:a[1][c.key]-b[1][c.key]);
 const top3=sorted.slice(0,3).map(([n,sv],i)=>`<div style="display:flex;align-items:center;gap:5px;padding:4px 0;border-bottom:1px solid #f0f4fa">
 <span style="font-size:13px;width:20px">${medals[i]}</span>
 <span style="font-size:10px;padding:1px 7px;border-radius:6px;background:${SEG_BG[n]||'#eee'};color:${SEG_COLORS[n]||'#555'};font-weight:700">${n}</span>
 <span style="font-size:11px;font-weight:700;color:var(--apex-navy);margin-left:auto">${c.fmt(sv[c.key])}</span>
 </div>`).join('');
 return`<div style="margin-bottom:16px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7a9a;margin-bottom:6px">${c.label}</div>${top3}</div>`;
 }).join('');
}

// ── Tabela com semáforo (mantida) ─────────────────────────────
export function renderSegTable(){
 const tbody=document.getElementById('tbl-seg-body');if(!tbody)return;
 const segs=Object.entries(_segData).sort((a,b)=>b[1].count-a[1].count);
 const clrDY=v=>v>=0.12?'var(--success)':v>=0.09?'var(--warning)':'var(--danger)';
 const clrPVP=v=>v<0.90?'var(--success)':v<1.05?'var(--warning)':'var(--danger)';
 const clrRet=v=>v>0.005?'var(--success)':v>-0.005?'#6b7a9a':'var(--danger)';
 const pct=fmtPercent;
 tbody.innerHTML=segs.map(([nome,s])=>{
 const cor=SEG_COLORS[nome]||'#555',bg=SEG_BG[nome]||'#eee';
 return`<tr><td><span style="background:${bg};color:${cor};padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700;white-space:nowrap">${nome}</span></td>
 <td style="text-align:center;font-weight:700;color:var(--apex-blue)">${s.count}</td>
 <td data-val="${s.dy_anual}" style="color:${clrDY(s.dy_anual)};font-weight:700">${pct(s.dy_anual)}</td>
 <td data-val="${s.pvp_atual}" style="color:${clrPVP(s.pvp_atual)};font-weight:700">${s.pvp_atual.toFixed(2)}x</td>
 <td data-val="${s.vol3m}">R$${fmtMillions(s.vol3m)}</td>
 <td data-val="${s.ret_mes}" style="color:${clrRet(s.ret_mes)};font-weight:600">${pct(s.ret_mes)}</td>
 <td data-val="${s.ret_ano}" style="color:${clrRet(s.ret_ano)};font-weight:600">${pct(s.ret_ano)}</td>
 </tr>`;
 }).join('');
}

// ── Tooltip flutuante ─────────────────────────────────────────
export function scheduleSegTooltip(nome,event){
 clearTimeout(_segTooltipTimer);
 _segTooltipTimer=setTimeout(()=>showSegTooltip(nome,event),300);
}
export function maybeHideTooltip(){
 clearTimeout(_segTooltipTimer);
 _segTooltipTimer=setTimeout(()=>{
 const tt=document.getElementById('seg-tooltip');
 if(tt&&!tt.matches(':hover'))hideSegTooltip();
 },200);
}
export function showSegTooltip(nome,event){
 const tt=document.getElementById('seg-tooltip');if(!tt)return;
 const s=_segData[nome];if(!s)return;
 const cor=SEG_COLORS[nome]||'#555',bg=SEG_BG[nome]||'#eee';
 const topFunds=s.fundos.sort((a,b)=>(b.dy_anual||0)-(a.dy_anual||0)).slice(0,5);
 const nomeSafe=nome.replace(/'/g,"\\'");
 tt.innerHTML=`
 <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
 <span style="background:${bg};color:${cor};padding:3px 10px;border-radius:8px;font-size:11px;font-weight:700">${nome}</span>
 <span style="font-size:10px;color:#6b7a9a">${s.count} fundos</span>
 </div>
 <div style="font-size:10px;color:#6b7a9a;margin-bottom:8px">DY médio: <strong style="color:var(--success)">${fmtPercent(s.dy_anual,1)}</strong> · P/VP médio: <strong>${s.pvp_atual.toFixed(2)}x</strong></div>
 <table style="width:100%;font-size:11px;border-collapse:collapse">
 <thead><tr style="background:var(--apex-navy)">
 <th style="padding:5px 8px;color:#fff;text-align:left;border-radius:4px 0 0 0">Ticker</th>
 <th style="padding:5px 8px;color:#fff;text-align:center">DY</th>
 <th style="padding:5px 8px;color:#fff;text-align:center;border-radius:0 4px 0 0">P/VP</th>
 </tr></thead>
 <tbody>
 ${topFunds.map(f=>`<tr style="border-bottom:1px solid #f0f4fa">
 <td style="padding:5px 8px;font-weight:700;color:var(--apex-blue)">${f.ticker}</td>
 <td style="padding:5px 8px;text-align:center;color:var(--success);font-weight:600">${f.dy_anual?fmtPercent(f.dy_anual,1):'—'}</td>
 <td style="padding:5px 8px;text-align:center;font-weight:600">${f.pvp_atual?f.pvp_atual.toFixed(2)+'x':'—'}</td>
 </tr>`).join('')}
 </tbody>
 </table>
 <div style="margin-top:10px;display:flex;gap:8px">
 <button onclick="showSegSubTab('drilldown',document.querySelector('.seg-stab:nth-child(3)'));_segDrillSeg='${nomeSafe}';renderSegDrilldown();hideSegTooltip();"
 style="flex:1;padding:6px;background:var(--apex-blue-lt);color:var(--apex-blue);border:1px solid var(--apex-blue);border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Manrope',sans-serif">
 Drill-down
 </button>
 <button onclick="segVerTodosFiltrado('${nomeSafe}');hideSegTooltip();"
 style="flex:1;padding:6px;background:var(--apex-navy);color:#fff;border:none;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Manrope',sans-serif">
 Ver todos →
 </button>
 </div>`;
 tt.style.display='block';
 const x=Math.min(event.clientX+12,window.innerWidth-380);
 const y=Math.min(event.clientY+12,window.innerHeight-320);
 tt.style.left=x+'px';tt.style.top=y+'px';
}
export function hideSegTooltip(){
 const tt=document.getElementById('seg-tooltip');
 if(tt)tt.style.display='none';
}
export function segVerTodosFiltrado(segmento){
 // 1. Navegar para aba Fundos Elegíveis
 const fundosBtn = document.querySelector('.nav-tab[onclick*="fundos"]');
 showTab('fundos', fundosBtn);

 // 2. Aplicar filtro de segmento e rolar para o topo
 setTimeout(()=>{
 const sel = document.getElementById('seg-filter'); // ID correto na aba Fundos
 if(sel){
 sel.value = segmento;
 filterFunds();
 }
 // Rolar para o topo da aba (seção de fundos elegíveis)
 const tabEl = document.getElementById('tab-fundos');
 if(tabEl){
 tabEl.scrollIntoView({behavior:'smooth', block:'start'});
 } else {
 window.scrollTo({top:0, behavior:'smooth'});
 }
 }, 150);
}
export function toggleSegHighlight(nome){
 _segHighlight=_segHighlight===nome?null:nome;
 document.querySelectorAll('.seg-hm-table tr').forEach(row=>{
 const cell=row.querySelector('td:first-child span');
 if(!cell)return;
 const n=cell.textContent.trim();
 row.classList.toggle('seg-highlighted',n===_segHighlight);
 if(n===_segHighlight)row.querySelector('td:first-child').style.background=SEG_BG[n]||'#eef';
 else row.querySelector('td:first-child').style.background='#fff';
 });
}

// ── Comparar Segmentos ────────────────────────────────────────
export function initSegCompChips(){
 const wrap=document.getElementById('seg-comp-chips');if(!wrap)return;
 const segs=Object.keys(_segData).sort();
 // Default: primeiros 3 mais populares
 if(_segCompSegs.length===0){
 const top3=Object.entries(_segData).sort((a,b)=>b[1].count-a[1].count).slice(0,3).map(([n])=>n);
 _segCompSegs=[...top3];
 }
 wrap.innerHTML=segs.map(nome=>{
 const cor=SEG_COLORS[nome]||'#555';
 const sel=_segCompSegs.includes(nome);
 return`<button class="seg-comp-chip${sel?' selected':''}" onclick="toggleSegCompChip('${nome.replace(/'/g,"\\'")}',this)"
 style="border-color:${cor};background:${sel?cor:'transparent'};color:${sel?'#fff':cor}">${nome}</button>`;
 }).join('');
}
export function toggleSegCompChip(nome,btn){
 if(_segCompSegs.includes(nome)){
 _segCompSegs=_segCompSegs.filter(s=>s!==nome);
 btn.classList.remove('selected');
 const cor=SEG_COLORS[nome]||'#555';
 btn.style.background='transparent';btn.style.color=cor;
 } else {
 if(_segCompSegs.length>=3){toast('Máximo 3 segmentos para comparação','warning');return;}
 _segCompSegs.push(nome);
 btn.classList.add('selected');
 const cor=SEG_COLORS[nome]||'#555';
 btn.style.background=cor;btn.style.color='#fff';
 }
 renderSegComparar();
}
export function renderSegComparar(){
 if(!_segCompSegs.length){
 const cw=document.getElementById('seg-comp-chart-wrap');
 if(cw)cw.innerHTML='<div style="padding:30px;text-align:center;color:#6b7a9a">Selecione ao menos 1 segmento acima.</div>';
 return;
 }
 renderSegCompChart();
 renderSegCompTable();
}
export function renderSegCompChart(){
 const wrap=document.getElementById('seg-comp-chart-wrap');if(!wrap)return;
 const periodo=document.getElementById('seg-comp-periodo')?.value||'atual';
 const segs=_segCompSegs.filter(s=>_segData[s]);
 if(!segs.length)return;

 const metrics=SEG_HEATMAP_METRICS.slice(0,6); // DY, DY LTM, P/VP, Vol, Ret Mês, Ret Ano
 // Normalizar 0-100% dentro de cada metric (entre os segmentos do universo)
 const allSegs=Object.entries(_segData);
 const norm=(val,key,higher)=>{
 const vals=allSegs.map(([,s])=>s[key]??0);
 const mn=Math.min(...vals),mx=Math.max(...vals);
 if(mx===mn)return 50;
 const n=(val-mn)/(mx-mn)*100;
 return higher?n:100-n;
 };

 const W=Math.max(500,metrics.length*80+80),H=260;
 const PAD={t:20,r:20,b:70,l:45};
 const pw=W-PAD.l-PAD.r,ph=H-PAD.t-PAD.b;
 const nG=metrics.length;
 const groupW=pw/nG;
 const barW=Math.min(22,groupW/segs.length-4);

 let svg=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${W}px;font-family:Manrope,sans-serif">`;
 svg+=`<rect x="${PAD.l}" y="${PAD.t}" width="${pw}" height="${ph}" fill="#fafcff" rx="3"/>`;

 // Grid lines
 [0,25,50,75,100].forEach(v=>{
 const y=PAD.t+ph-(v/100*ph);
 svg+=`<line x1="${PAD.l}" y1="${y}" x2="${PAD.l+pw}" y2="${y}" stroke="#e4ecf7" stroke-width="1"/>`;
 svg+=`<text x="${PAD.l-4}" y="${y+4}" text-anchor="end" font-size="9" fill="#9aa7bd">${v}%</text>`;
 });

 // Bars
 metrics.forEach((m,gi)=>{
 const gx=PAD.l+gi*groupW+groupW/2;
 segs.forEach((segNome,si)=>{
 const s=_segData[segNome];
 const val=s[m.key]??0;
 const pctNorm=norm(val,m.key,m.higher);
 const bh=Math.max(2,pctNorm/100*ph);
 const bx=gx-(segs.length*barW+(segs.length-1)*3)/2+si*(barW+3);
 const by=PAD.t+ph-bh;
 const cor=SEG_COLORS[segNome]||'#999';
 svg+=`<rect x="${bx}" y="${by}" width="${barW}" height="${bh}" fill="${cor}" rx="2" fill-opacity=".85">
 <title>${segNome} — ${m.label}: ${m.fmt(val)} (${pctNorm.toFixed(0)}% relativo)</title></rect>`;
 if(pctNorm>12) svg+=`<text x="${bx+barW/2}" y="${by-3}" text-anchor="middle" font-size="8" fill="${cor}" font-weight="700">${pctNorm.toFixed(0)}</text>`;
 });
 // Label eixo X
 svg+=`<text x="${gx}" y="${H-10}" text-anchor="middle" font-size="9" fill="#5a6e8a" font-weight="700">${m.label}</text>`;
 svg+=`<line x1="${gx}" y1="${PAD.t}" x2="${gx}" y2="${PAD.t+ph}" stroke="#e4ecf7" stroke-width="1" stroke-dasharray="3,3"/>`;
 });

 // Legend
 const legY=H-35;
 segs.forEach((segNome,i)=>{
 const lx=PAD.l+i*110;
 const cor=SEG_COLORS[segNome]||'#999';
 svg+=`<rect x="${lx}" y="${legY}" width="10" height="10" fill="${cor}" rx="2"/>`;
 svg+=`<text x="${lx+14}" y="${legY+9}" font-size="9" font-weight="700" fill="${cor}">${segNome.length>14?segNome.slice(0,13)+'…':segNome}</text>`;
 });
 svg+='</svg>';
 wrap.innerHTML=svg;
}
export function renderSegCompTable(){
 const wrap=document.getElementById('seg-comp-table-wrap');if(!wrap)return;
 const segs=_segCompSegs.filter(s=>_segData[s]);
 if(!segs.length)return;
 const metrics=SEG_HEATMAP_METRICS;
 let html=`<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">
 <thead><tr>
 <th style="padding:8px 12px;background:var(--apex-navy);color:#fff;text-align:left">Indicador</th>
 ${segs.map(n=>`<th style="padding:8px 12px;background:${SEG_COLORS[n]||'#333'};color:#fff;text-align:center">${n}</th>`).join('')}
 </tr></thead><tbody>`;
 metrics.forEach((m,i)=>{
 const vals=segs.map(n=>_segData[n][m.key]??null);
 const best=m.higher?Math.max(...vals.filter(v=>v!==null)):Math.min(...vals.filter(v=>v!==null));
 html+=`<tr style="background:${i%2?'#f8faff':'#fff'}">
 <td style="padding:7px 12px;font-weight:700;color:var(--apex-navy)">${m.label}</td>
 ${segs.map((n,si)=>{
 const v=vals[si];
 const isBest=v!==null&&v===best;
 return`<td style="padding:7px 12px;text-align:center;font-weight:${isBest?700:500};color:${isBest?'var(--success)':'var(--apex-navy)'}${isBest?';background:var(--success-bg)':''}">${v!==null?m.fmt(v):'—'}${isBest?' ✓':''}</td>`;
 }).join('')}
 </tr>`;
 });
 // Linha de totais/fundos
 html+=`<tr style="background:var(--apex-navy)">
 <td style="padding:8px 12px;color:#fff;font-weight:700">Nº de fundos</td>
 ${segs.map(n=>`<td style="padding:8px 12px;text-align:center;color:#fff;font-weight:700">${_segData[n].count}</td>`).join('')}
 </tr>`;
 html+='</tbody></table></div>';
 wrap.innerHTML=html;
}

// ── Drill-down ────────────────────────────────────────────────
export function renderSegDrilldown(){
 const sel=document.getElementById('seg-drill-sel');
 const btnVer=document.getElementById('seg-drill-ver-todos');

 // Popular dropdown (só na primeira vez)
 if(sel&&sel.options.length<=1){
 Object.keys(_segData).sort().forEach(s=>{
 const o=document.createElement('option');
 o.value=s;o.textContent=s;
 sel.appendChild(o);
 });
 }

 // Ler a seleção atual do usuário PRIMEIRO — não sobrescrever com _segDrillSeg
 // _segDrillSeg só é usado quando a função é chamada programaticamente (ex: do tooltip)
 const nome=sel?.value||_segDrillSeg||'';
 _segDrillSeg=nome; // sincronizar estado com o que o usuário escolheu
 if(sel&&nome) sel.value=nome; // garantir que o select mostre o valor correto se chamado programaticamente
 if(!nome||!_segData[nome]){
 const tw=document.getElementById('seg-drill-table-wrap');
 if(tw)tw.innerHTML='<div style="padding:20px;text-align:center;color:#6b7a9a">Selecione um segmento acima.</div>';
 if(btnVer)btnVer.style.display='none';
 return;
 }
 _segDrillSeg=nome;
 if(btnVer)btnVer.style.display='inline-block';
 // Título
 const title=document.getElementById('seg-drill-title');
 const cor=SEG_COLORS[nome]||'#555',bg=SEG_BG[nome]||'#eee';
 if(title)title.innerHTML=`Fundos de <span style="background:${bg};color:${cor};padding:2px 10px;border-radius:8px;font-weight:700">${nome}</span>`;
 // KPIs
 const s=_segData[nome];
 const kpiEl=document.getElementById('seg-drill-kpis');
 if(kpiEl){
 const kpis=[
 {lbl:'Fundos',val:s.count,cor:'var(--apex-blue)'},
 {lbl:'DY Médio',val:fmtPercent(s.dy_anual,1),cor:'var(--success)'},
 {lbl:'P/VP Médio',val:s.pvp_atual.toFixed(2)+'x',cor:'var(--apex-navy)'},
 {lbl:'Vol. Médio',val:'R$'+fmtMillions(s.vol3m),cor:'var(--apex-navy)'},
 {lbl:'Ret. Mês',val:(s.ret_mes>=0?'+':'')+fmtPercent(s.ret_mes,2),cor:s.ret_mes>=0?'var(--success)':'var(--danger)'},
 {lbl:'Entraram ▲',val:s.entraram,cor:'var(--success)'},
 {lbl:'Saíram ▼',val:s.sairam,cor:'var(--danger)'},
 ];
 kpiEl.innerHTML=kpis.map(k=>`<div class="seg-drill-kpi">
 <div class="lbl">${k.lbl}</div>
 <div class="val" style="color:${k.cor}">${k.val}</div>
 </div>`).join('');
 }
 // Tabela de fundos
 const tw=document.getElementById('seg-drill-table-wrap');
 if(!tw)return;
 const fundos=s.fundos.sort((a,b)=>(b.dy_anual||0)-(a.dy_anual||0));
 const analyses_local=typeof analyses!=='undefined'?analyses:{};
 const pct=fmtPercentOrDash;
 const perf=v=>v!=null?`<span style="color:${v>0?'var(--success)':v<0?'var(--danger)':'#6b7a9a'};font-weight:600">${v>0?'+':''}${pct(v)}</span>`:'—';
 let html=`<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">
 <thead><tr style="background:var(--apex-navy)">
 <th style="padding:8px 12px;color:#fff;text-align:left">Ticker</th>
 <th style="padding:8px 12px;color:#fff;text-align:left">Nome</th>
 <th style="padding:8px 12px;color:#fff;text-align:center">Preço</th>
 <th style="padding:8px 12px;color:#fff;text-align:center">DY Anual</th>
 <th style="padding:8px 12px;color:#fff;text-align:center">P/VP</th>
 <th style="padding:8px 12px;color:#fff;text-align:center">Vol 3M</th>
 <th style="padding:8px 12px;color:#fff;text-align:center">Ret. Mês</th>
 <th style="padding:8px 12px;color:#fff;text-align:center">Ret. Ano</th>
 <th style="padding:8px 12px;color:#fff;text-align:center">Análise</th>
 </tr></thead><tbody>`;
 fundos.forEach((f,i)=>{
 const a=analyses_local[f.ticker];
 const statusBadge=a?.finalizado
 ?`<span style="background:var(--success-bg);color:var(--success);padding:2px 8px;border-radius:6px;font-size:9px;font-weight:700">${a.scoreTotal?.toFixed(1)||'—'}</span>`
 :`<span style="background:#f0f4fa;color:#6b7a9a;padding:2px 8px;border-radius:6px;font-size:9px">Pendente</span>`;
 const nome_fund=(ELIGIBLE_FUNDS.find(ef=>ef.ticker===f.ticker)?.nome||f.ticker).replace(/ FII$/i,'');
 html+=`<tr style="background:${i%2?'#f8faff':'#fff'};cursor:pointer" onclick="openAnalise('${f.ticker}')">
 <td style="padding:7px 12px;font-weight:700;color:var(--apex-blue)">${f.ticker}</td>
 <td style="padding:7px 12px;color:var(--apex-navy)">${nome_fund.length>25?nome_fund.slice(0,24)+'…':nome_fund}</td>
 <td style="padding:7px 12px;text-align:center">${f.fechamento?'R$ '+parseFloat(f.fechamento).toFixed(2):'—'}</td>
 <td style="padding:7px 12px;text-align:center;color:var(--success);font-weight:600">${pct(f.dy_anual)}</td>
 <td style="padding:7px 12px;text-align:center;font-weight:600">${f.pvp_atual?f.pvp_atual.toFixed(2)+'x':'—'}</td>
 <td style="padding:7px 12px;text-align:center">${f.vol3m?'R$'+fmtMillions(f.vol3m):'—'}</td>
 <td style="padding:7px 12px;text-align:center">${perf(f.ret_mes)}</td>
 <td style="padding:7px 12px;text-align:center">${perf(f.ret_ano)}</td>
 <td style="padding:7px 12px;text-align:center">${statusBadge}</td>
 </tr>`;
 });
 html+='</tbody></table></div>';
 tw.innerHTML=html;
}
export function segDrillVerTodos(){
 const nome=document.getElementById('seg-drill-sel')?.value||_segDrillSeg;
 if(nome) segVerTodosFiltrado(nome);
}

// ── Carteira APX por Segmento ─────────────────────────────────
export function renderSegCarteiraSeg(){
 renderSegCartMain();
 renderSegCartVsUniverse();
 renderSegCartKPIs();
}
export function renderSegCartMain(){
  const el=document.getElementById('seg-cart-main');if(!el)return;
  if(!_carteira?.length){
    el.innerHTML='<div style="text-align:center;padding:20px;color:#6b7a9a">Nenhum fundo na Carteira APX. <a href="#" onclick="showTab(\'carteira\',null);return false" style="color:var(--apex-blue)">Adicionar fundos →</a></div>';
    return;
  }
  const segMap={};
  _carteira.forEach(c=>{
    const s=(_carteiraPrecos[c.ticker]?.seg)||ELIGIBLE_FUNDS.find(f=>f.ticker===c.ticker)?.seg||'Outros';
    if(!segMap[s]){segMap[s]={peso:0,fundos:[],dy:0,dyN:0};}
    segMap[s].peso+=c.peso||0;
    segMap[s].fundos.push(c.ticker);
    const p=_carteiraPrecos[c.ticker];
    if(p?.dyAnual){segMap[s].dy+=p.dyAnual*(c.peso||0);segMap[s].dyN+=c.peso||0;}
  });
  const segs=Object.entries(segMap).sort((a,b)=>b[1].peso-a[1].peso);
  const totalW=segs.reduce((s,[,d])=>s+d.peso,0)||100;
  let html='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">';
  segs.forEach(([nome,d])=>{
    const cor=SEG_COLORS[nome]||'#555',bg=SEG_BG[nome]||'#eee';
    const pctW=(d.peso/totalW*100).toFixed(1);
    const dyMed=d.dyN>0?fmtPercent(d.dy/d.dyN,1):'—';
    html+=`<div style="border:1.5px solid ${cor};border-radius:10px;padding:12px;background:${bg}22">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="background:${bg};color:${cor};padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700">${nome}</span>
        <span style="font-size:18px;font-weight:800;color:${cor}">${pctW}%</span>
      </div>
      <div style="background:#fff;border-radius:6px;height:6px;margin-bottom:8px">
        <div style="background:${cor};height:6px;border-radius:6px;width:${pctW}%"></div>
      </div>
      <div style="font-size:10px;color:#5a6e8a">${d.fundos.length} fundo${d.fundos.length>1?'s':''} · DY médio: <strong style="color:var(--success)">${dyMed}</strong></div>
      <div style="font-size:10px;color:#6b7a9a;margin-top:4px">${d.fundos.slice(0,4).join(', ')}${d.fundos.length>4?' +'+(d.fundos.length-4):''}</div>
    </div>`;
  });
  html+='</div>';
  el.innerHTML=html;
}

export function renderSegCartVsUniverse(){
 const el=document.getElementById('seg-cart-vs-wrap');if(!el)return;
 if(!_carteira?.length){el.innerHTML='<div style="color:#6b7a9a;font-size:12px;text-align:center;padding:20px">Sem dados</div>';return;}
 // Segmentos na carteira vs universo
 const cartMap={},univMap={};
 _carteira.forEach(c=>{
 const s=(_carteiraPrecos[c.ticker]?.seg)||ELIGIBLE_FUNDS.find(f=>f.ticker===c.ticker)?.seg||'Outros';
 cartMap[s]=(cartMap[s]||0)+(c.peso||0);
 });
 const univTotal=Object.values(_segData).reduce((s,d)=>s+d.count,0)||1;
 Object.entries(_segData).forEach(([s,d])=>{univMap[s]=d.count/univTotal*100;});
 const cartTotal=Object.values(cartMap).reduce((s,v)=>s+v,0)||100;
 const allSegs=[...new Set([...Object.keys(cartMap),...Object.keys(univMap)])].sort();
 let html='';
 allSegs.forEach(nome=>{
 const cPct=(cartMap[nome]||0)/cartTotal*100;
 const uPct=univMap[nome]||0;
 const cor=SEG_COLORS[nome]||'#555';
 const diff=cPct-uPct;
 const diffLabel=diff>0.5?`<span style="color:var(--success);font-size:10px">+${diff.toFixed(1)}%</span>`:
 diff<-0.5?`<span style="color:var(--danger);font-size:10px">${diff.toFixed(1)}%</span>`:
 `<span style="color:#aaa;font-size:10px">≈</span>`;
 html+=`<div class="seg-vs-row">
 <span style="font-size:10px;font-weight:700;color:${cor};min-width:110px;white-space:nowrap">${nome.length>14?nome.slice(0,13)+'…':nome}</span>
 <div style="flex:1;position:relative;height:12px">
 <div style="height:12px;background:#f0f4fa;border-radius:6px;overflow:hidden">
 <div style="height:12px;background:${cor};opacity:.85;border-radius:6px;width:${cPct.toFixed(1)}%;min-width:2px"></div>
 </div>
 <div style="position:absolute;top:4px;left:0;height:4px;background:#aaa;opacity:.4;border-radius:2px;width:${uPct.toFixed(1)}%;min-width:2px;pointer-events:none"></div>
 </div>
 <span style="min-width:40px;text-align:right;font-size:10px;font-weight:700;color:var(--apex-navy)">${cPct.toFixed(1)}%</span>
 ${diffLabel}
 </div>`;
 });
 html+=`<div style="margin-top:10px;font-size:10px;color:#6b7a9a">
 <span style="display:inline-flex;align-items:center;gap:5px;margin-right:12px"><div style="width:12px;height:6px;background:var(--apex-blue);border-radius:3px;opacity:.85"></div>Carteira</span>
 <span style="display:inline-flex;align-items:center;gap:5px"><div style="width:12px;height:4px;background:#aaa;border-radius:2px;opacity:.5"></div>Universo elegível</span>
 </div>`;
 el.innerHTML=html;
}
export function renderSegCartKPIs(){
 const el=document.getElementById('seg-cart-kpis-wrap');if(!el)return;
 if(!_carteira?.length){el.innerHTML='';return;}
 const segMap={};
 _carteira.forEach(c=>{
 const s=(_carteiraPrecos[c.ticker]?.seg)||ELIGIBLE_FUNDS.find(f=>f.ticker===c.ticker)?.seg||'Outros';
 if(!segMap[s]){segMap[s]={peso:0,dy:0,dyN:0,pvp:0,pvpN:0};}
 segMap[s].peso+=c.peso||0;
 const p=_carteiraPrecos[c.ticker];
 if(p?.dyAnual){segMap[s].dy+=p.dyAnual*(c.peso||0);segMap[s].dyN+=c.peso||0;}
 if(p?.pvp){segMap[s].pvp+=p.pvp*(c.peso||0);segMap[s].pvpN+=c.peso||0;}
 });
 const segs=Object.entries(segMap).sort((a,b)=>b[1].peso-a[1].peso);
 const pct=v=>fmtPercent(v,1);
 let html=`<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">
 <thead><tr style="background:var(--apex-navy)">
 <th style="padding:7px 10px;color:#fff;text-align:left">Segmento</th>
 <th style="padding:7px 10px;color:#fff;text-align:center">Peso Cart.</th>
 <th style="padding:7px 10px;color:#fff;text-align:center">DY Médio</th>
 <th style="padding:7px 10px;color:#fff;text-align:center">P/VP Médio</th>
 <th style="padding:7px 10px;color:#fff;text-align:center">Fundos</th>
 </tr></thead><tbody>`;
 segs.forEach(([nome,d],i)=>{
 const cor=SEG_COLORS[nome]||'#555',bg=SEG_BG[nome]||'#eee';
 const dyMed=d.dyN>0?pct(d.dy/d.dyN):'—';
 const pvpMed=d.pvpN>0?(d.pvp/d.pvpN).toFixed(2)+'x':'—';
 const nFundos=_carteira.filter(c=>{const s=(_carteiraPrecos[c.ticker]?.seg)||ELIGIBLE_FUNDS.find(f=>f.ticker===c.ticker)?.seg||'Outros';return s===nome;}).length;
 html+=`<tr style="background:${i%2?'#f8faff':'#fff'}">
 <td style="padding:6px 10px"><span style="background:${bg};color:${cor};padding:1px 7px;border-radius:6px;font-size:10px;font-weight:700">${nome}</span></td>
 <td style="padding:6px 10px;text-align:center;font-weight:700;color:var(--apex-blue)">${d.peso.toFixed(1)}%</td>
 <td style="padding:6px 10px;text-align:center;font-weight:600;color:var(--success)">${dyMed}</td>
 <td style="padding:6px 10px;text-align:center;font-weight:600">${pvpMed}</td>
 <td style="padding:6px 10px;text-align:center;color:#6b7a9a">${nFundos}</td>
 </tr>`;
 });
 html+='</tbody></table></div>';
 el.innerHTML=html;
}



export function segChip(seg, size='normal'){
 const MAP={
 'Recebível':'var(--seg-rec-bg),var(--seg-rec-c)','Galpão Logístico':'var(--seg-gal-bg),var(--seg-gal-c)',
 'Shopping Center':'var(--seg-sho-bg),var(--seg-sho-c)','Laje Corporativa':'var(--seg-laj-bg),var(--seg-laj-c)',
 'Fundo de Fundos':'var(--seg-fof-bg),var(--seg-fof-c)','FI-Infra':'var(--seg-fii-bg),var(--seg-fii-c)',
 'FIAgro - FII':'var(--seg-fia-bg),var(--seg-fia-c)','Hedge Fund':'var(--seg-hed-bg),var(--seg-hed-c)',
 'Renda Urbana':'var(--seg-ren-bg),var(--seg-ren-c)','Híbrido':'var(--seg-hib-bg),var(--seg-hib-c)',
 'Agronegócio':'var(--seg-agr-bg),var(--seg-agr-c)','Desenvolvimento':'var(--seg-dev-bg),var(--seg-dev-c)',
 'Agência Bancária':'var(--seg-age-bg),var(--seg-age-c)','Hotel':'var(--seg-hot-bg),var(--seg-hot-c)',
 'Educacional':'var(--seg-edu-bg),var(--seg-edu-c)','Outros':'var(--seg-out-bg),var(--seg-out-c)'
 };
 const [bg,c]=(MAP[seg]||'var(--seg-out-bg),var(--seg-out-c)').split(',');
 if(size==='mini')
 return`<span style="background:${bg};color:${c};padding:1px 7px;border-radius:8px;font-size:9px;font-weight:600;white-space:nowrap">${seg||'—'}</span>`;
 return`<span class="seg-chip" style="background:${bg};color:${c}">${seg||'—'}</span>`;
}

window.buildSegData = buildSegData;
window.showSegSubTab = showSegSubTab;
window.renderSegmentos = renderSegmentos;
window.renderSegKpiStrip = renderSegKpiStrip;
window.setSegBarMetric = setSegBarMetric;
window.renderSegBars = renderSegBars;
window.toggleSegExpand = toggleSegExpand;
window.renderSegHeatmap = renderSegHeatmap;
window.renderSegRankingCruzado = renderSegRankingCruzado;
window.renderSegTable = renderSegTable;
window.scheduleSegTooltip = scheduleSegTooltip;
window.maybeHideTooltip = maybeHideTooltip;
window.showSegTooltip = showSegTooltip;
window.hideSegTooltip = hideSegTooltip;
window.segVerTodosFiltrado = segVerTodosFiltrado;
window.toggleSegHighlight = toggleSegHighlight;
window.initSegCompChips = initSegCompChips;
window.toggleSegCompChip = toggleSegCompChip;
window.renderSegComparar = renderSegComparar;
window.renderSegCompChart = renderSegCompChart;
window.renderSegCompTable = renderSegCompTable;
window.renderSegDrilldown = renderSegDrilldown;
window.segDrillVerTodos = segDrillVerTodos;
window.renderSegCarteiraSeg = renderSegCarteiraSeg;
window.renderSegCartMain = renderSegCartMain;
window.renderSegCartVsUniverse = renderSegCartVsUniverse;
window.renderSegCartKPIs = renderSegCartKPIs;
window.segChip = segChip;
window._segData = _segData;
window._radarSelectedSegs = _radarSelectedSegs;
window._segBarMetric = _segBarMetric;
window._segCompSegs = _segCompSegs;
window._segHighlight = _segHighlight;
window._segTooltipTimer = _segTooltipTimer;
window._segDrillSeg = _segDrillSeg;
window.SEG_HEATMAP_METRICS = SEG_HEATMAP_METRICS;
