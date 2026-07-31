'use strict';

// ══════════════════════════════════════════════════════════════
// CARTEIRA APX — MODEL PORTFOLIO (Fase 4 da modularização)
// ══════════════════════════════════════════════════════════════
// Depende de globais ainda no script legado (getDB, toast, SEG_COLORS/
// SEG_BG, ELIGIBLE_FUNDS, renderAtvVisaoGeral) — acessíveis via window.
//
// _carteira, _carteiraAlertasCfg, _carteiraRetornos, _carteiraObjetivo e
// _carteiraEdit são REATRIBUÍDOS aqui (não só mutados) e também LIDOS de
// fora deste módulo (js/tabs/segmentos.js, js/tabs/carteira-benchmarks.js
// consultam _carteira/_carteiraPrecos). Por isso, toda vez que uma dessas
// variáveis é reatribuída, sincronizamos window.X logo em seguida — do
// contrário os outros módulos ficariam lendo uma cópia desatualizada em
// window (mesmo problema já resolvido para window._rankingCache na Fase 3).
// _carteiraPrecos nunca é reatribuído (só mutado por chave), então não
// precisa desse cuidado.

// ── State ────────────────────────────────────────────────────
export let _carteira = []; // [{ticker, peso, incluido_por, created_at}]
export let _carteiraPrecos= {}; // {ticker: {preco, dy12m, dyMes, dyAnual, pvp, perf1m, perfAno, perfLtm, liq3m, nome}}
export let _carteiraEdit = false;
export let _carteiraAlertasCfg = [];
export let _carteiraRetornos = []; // [{ano, retCarteira, retIfix, acCarteira, acIfix}]
export let _carteiraObjetivo = 'Entregar renda mensal com gestão ativa, alinhando exposição ao ciclo imobiliário com controle de risco e preservação do patrimônio real.';

export const CORS_PROXY = 'https://api.allorigins.win/raw?url='; // usado pela carteira (atualizarPrecosCarteira)

export const YF_QUOTE_URL = 'https://query2.finance.yahoo.com/v7/finance/quote';
export const YF_CHART_URL = 'https://query2.finance.yahoo.com/v8/finance/chart';

/**
 * Busca preços mensais históricos via Yahoo Finance (mesmo proxy CORS usado em
 * atualizarPrecosCarteira). Usa adjclose para retorno total incluindo dividendos.
 * @param {string} ticker Ticker Yahoo (ex: '%5EBVSP' para IBOV, 'XFIX11.SA' para IFIX)
 * @param {string} startYM Início 'YYYY-MM'
 * @param {string} endYM Fim 'YYYY-MM'
 * @returns {Promise<{date:string,ret:number}[]>}
 */
export async function fetchYahooMonthly(ticker,startYM,endYM){
 const ctrl=new AbortController();
 const tid=setTimeout(()=>ctrl.abort(),15000);
 try{
 const chartUrl=`${YF_CHART_URL}/${ticker}?interval=1mo&range=max`;
 const res=await fetch(CORS_PROXY+encodeURIComponent(chartUrl),{signal:ctrl.signal});
 clearTimeout(tid);
 if(!res.ok) throw new Error(`Yahoo ${ticker}: HTTP ${res.status}`);
 const json=await res.json();
 const result=json?.chart?.result?.[0];
 const ts=result?.timestamp;
 if(!ts?.length) throw new Error(`Yahoo ${ticker}: sem histórico`);
 const closes=result.indicators?.quote?.[0]?.close;
 const adj=result.indicators?.adjclose?.[0]?.adjclose;
 const points=[];
 for(let i=1;i<ts.length;i++){
 const c0=adj?.[i-1]??closes?.[i-1];
 const c1=adj?.[i]??closes?.[i];
 if(!c0||!c1) continue;
 const d=new Date(ts[i]*1000);
 const ds=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
 if(ds>=startYM&&ds<=endYM) points.push({date:ds,ret:c1/c0-1});
 }
 return points;
 }finally{clearTimeout(tid);}
}

// ── Init ─────────────────────────────────────────────────────
export async function initCarteira(){
 if(_carteira.length===0) await carregarCarteira();
 else renderCarteira();
}

/**
 * Carrega posições da carteira do Supabase.
 * @returns {Promise<void>}
 */
export async function carregarCarteira(){
 const db=getDB();
 if(!db){ renderCarteiraVazia(); return; }
 try{
 const [
 {data:cart},
 {data:alertas},
 {data:retornos},
 {data:meta}
 ] = await Promise.all([
 db.from('carteira').select('*').order('peso',{ascending:false}),
 db.from('carteira_alertas').select('*').eq('ativo',true),
 db.from('carteira_retornos').select('*').order('ano',{ascending:false}),
 db.from('carteira_meta').select('*').limit(1)
 ]);
 _carteira = cart||[];
 _carteiraAlertasCfg = alertas||[];
 _carteiraRetornos = retornos||[];
 if(meta&&meta[0]?.objetivo) _carteiraObjetivo=meta[0].objetivo;
 window._carteira = _carteira;
 window._carteiraAlertasCfg = _carteiraAlertasCfg;
 window._carteiraRetornos = _carteiraRetornos;
 window._carteiraObjetivo = _carteiraObjetivo;
 renderCarteira();
 if(_carteira.length>0) await atualizarPrecosCarteira();
 }catch(e){
 console.error('[carregarCarteira]',e);
 // Tabelas podem não existir ainda — mostrar estado vazio com instrução
 renderCarteiraVazia();
 }
}

// ── Yahoo Finance ─────────────────────────────────────────────
/**
 * Atualiza preços, DY e performance de todos os fundos via Yahoo Finance.
 * Usa dados do BTG Guide (Supabase fund_data) para P/VP e DY Anualizado.
 * @returns {Promise<void>}
 */
export async function atualizarPrecosCarteira(){
 if(!_carteira.length) return;
 const btn=document.getElementById('btn-carteira-refresh');
 const info=document.getElementById('carteira-update-info');
 if(btn){ btn.textContent='⟳ Atualizando...'; btn.disabled=true; }

 try{
 const tickers=_carteira.map(c=>c.ticker);

 // 1. Batch quote do Yahoo Finance
 const symbols=tickers.map(t=>t+'.SA').join(',');
 const quoteUrl=`${YF_QUOTE_URL}?symbols=${encodeURIComponent(symbols)}&fields=regularMarketPrice,averageDailyVolume3Month,trailingAnnualDividendYield,regularMarketChangePercent,shortName,priceToBook`;
 let yfData=[];
 try{
 const res=await fetch(CORS_PROXY+encodeURIComponent(quoteUrl));
 const json=await res.json();
 yfData=json?.quoteResponse?.result||[];
 }catch(e){ console.warn('[atualizarPrecosCarteira] Yahoo Finance indisponível:',e.message); }

 // 2. Dados do BTG Guide (última semana) para P/VP, DY Anual, performance
 const db=getDB();
 let btgMap={};
 if(db){
 try{
 const {data:semana}=await db.from('semanas').select('semana_data').is('deleted_at',null).order('created_at',{ascending:false}).limit(1);
 if(semana&&semana[0]){
 const {data:fundos}=await db.from('fund_data')
 .select('ticker,pvp_atual,dy_anual,dy_ltm,ret_mes,ret_ano,ret_ltm,vol3m,fechamento')
 .eq('semana_data',semana[0].semana_data)
 .in('ticker',tickers);
 (fundos||[]).forEach(f=>{ btgMap[f.ticker]=f; });
 }
 }catch(e){ console.warn('[atualizarPrecosCarteira] BTG data:',e.message); }
 }

 // 3. Mesclar dados
 tickers.forEach(ticker=>{
 const yf=yfData.find(q=>q.symbol===ticker+'.SA')||{};
 const btg=btgMap[ticker]||{};
 const fund=ELIGIBLE_FUNDS.find(f=>f.ticker===ticker)||{};
 const preco=yf.regularMarketPrice||btg.fechamento||0;
 const dy12m=yf.trailingAnnualDividendYield||btg.dy_ltm||0;
 const vol3mUnits=yf.averageDailyVolume3Month||0;
 _carteiraPrecos[ticker]={
 preco,
 nome: fund.nome||yf.shortName||ticker,
 seg: fund.seg||'—',
 dy12m, dyMes:dy12m/12,
 dyAnual:btg.dy_anual||dy12m,
 pvp: btg.pvp_atual||yf.priceToBook||0,
 perf1m:btg.ret_mes||0,
 perfAno:btg.ret_ano||0,
 perfLtm:btg.ret_ltm||0,
 liq3m: vol3mUnits*preco/1e6, // R$ milhões
 varDia:yf.regularMarketChangePercent||0
 };
 });

 const now=new Date();
 if(info) info.textContent=`Atualizado: ${now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} (delay ~15min)`;
 renderCarteira();
 verificarAlertasCarteira();
 }catch(e){
 console.error('[atualizarPrecosCarteira]',e);
 toast('Erro ao atualizar preços: '+e.message,'error');
 }finally{
 if(btn){ btn.textContent='Atualizar Preços'; btn.disabled=false; }
 }
}

// ── CRUD ──────────────────────────────────────────────────────
export async function adicionarFundoCarteira(){
 const ticker=(document.getElementById('carteira-add-ticker')?.value||'').toUpperCase().trim();
 const peso=parseFloat(document.getElementById('carteira-add-peso')?.value||'0');
 const analista=document.getElementById('carteira-add-analista')?.value||'';
 if(!ticker||ticker.length<5){ toast('Digite um ticker válido (ex: KNCR11)','warning'); return; }
 if(!peso||peso<=0||peso>100){ toast('Peso deve ser entre 0,1 e 100','warning'); return; }
 if(_carteira.find(c=>c.ticker===ticker)){ toast(ticker+' já está na carteira','warning'); return; }

 const db=getDB();
 if(!db){ toast('Supabase não disponível','error'); return; }
 try{
 const {error}=await db.from('carteira').upsert({ticker,peso,incluido_por:analista,updated_at:new Date().toISOString()});
 if(error) throw error;
 _carteira.push({ticker,peso,incluido_por:analista,created_at:new Date().toISOString()});
 _carteira.sort((a,b)=>b.peso-a.peso);
 document.getElementById('carteira-add-ticker').value='';
 document.getElementById('carteira-add-peso').value='';
 await logCarteiraAtividade('carteira-add',ticker,`Peso: ${peso}% · por ${analista}`);
 toast(`✓ ${ticker} adicionado à carteira (${peso}%)`, 'success');
 await atualizarPrecosCarteira();
 verificarPesoTotal();
 }catch(e){ toast('Erro ao adicionar: '+e.message,'error'); }
}

export async function removerFundoCarteira(ticker){
 const db=getDB();
 if(!db){ toast('Supabase não disponível','error'); return; }
 try{
 const {error}=await db.from('carteira').delete().eq('ticker',ticker);
 if(error) throw error;
 _carteira=_carteira.filter(c=>c.ticker!==ticker);
 window._carteira = _carteira;
 delete _carteiraPrecos[ticker];
 await logCarteiraAtividade('carteira-remove',ticker,'Removido da carteira');
 toast(`${ticker} removido da carteira`,'success');
 renderCarteira();
 verificarPesoTotal();
 }catch(e){ toast('Erro ao remover: '+e.message,'error'); }
}

export async function salvarPesoCarteira(ticker){
 const input=document.getElementById('peso-input-'+ticker);
 if(!input) return;
 const novoPeso=parseFloat(input.value)||0;
 if(novoPeso<=0||novoPeso>100){ toast('Peso inválido','warning'); return; }
 const db=getDB();
 if(!db) return;
 try{
 const {error}=await db.from('carteira').update({peso:novoPeso,updated_at:new Date().toISOString()}).eq('ticker',ticker);
 if(error) throw error;
 const f=_carteira.find(c=>c.ticker===ticker);
 if(f){ const old=f.peso; f.peso=novoPeso; await logCarteiraAtividade('carteira-edit',ticker,`Peso: ${old}% → ${novoPeso}%`); }
 toast(`${ticker} atualizado: ${novoPeso}%`,'success');
 verificarPesoTotal();
 renderCarteiraFooter();
 renderCarteiraComposicao();
 renderCarteiraKPIs();
 }catch(e){ toast('Erro ao salvar peso: '+e.message,'error'); }
}

export function verificarPesoTotal(){
 const total=_carteira.reduce((a,c)=>a+(parseFloat(c.peso)||0),0);
 const warn=document.getElementById('carteira-peso-warn');
 if(!warn) return;
 if(Math.abs(total-100)>0.5){
 warn.style.display='block';
 warn.textContent=`⚠ Peso total: ${total.toFixed(1)}% (${total>100?'acima':'abaixo'} de 100%)`;
 } else { warn.style.display='none'; }
}

// ── Render ────────────────────────────────────────────────────
export function renderCarteira(){
 renderCarteiraPosicoes();
 renderCarteiraComposicao();
 renderCarteiraVisaoGeral();
}

export function renderCarteiraVazia(){
 const body=document.getElementById('tbl-carteira-body');
 if(body) body.innerHTML=`<tr><td colspan="15" style="text-align:center;padding:40px;color:#6b7a9a">
 <div style="font-size:24px;margin-bottom:8px"></div>
 <div style="font-weight:700;color:var(--apex-navy);margin-bottom:6px">Carteira vazia</div>
 <div style="font-size:11px">Clique em <strong>Editar Carteira</strong> para adicionar fundos.</div>
 <div style="font-size:10px;margin-top:8px;color:#aaa">Se for o primeiro uso, execute o SQL de criação das tabelas (disponível no bloco SQL Migrations do arquivo).</div>
 </td></tr>`;
 const sub=document.getElementById('carteira-subtitle');
 if(sub) sub.textContent='Nenhum fundo na carteira';
}

export function renderCarteiraPosicoes(){
 const body=document.getElementById('tbl-carteira-body');
 if(!body) return;
 if(!_carteira.length){ renderCarteiraVazia(); return; }

 const sorted=[..._carteira].sort((a,b)=>b.peso-a.peso);
 const pct=fmtPercent;
 const perfCls=v=>v>0?'cart-perf-pos':v<0?'cart-perf-neg':'cart-perf-neu';
 const perfFmt=v=>v===0?'—':(v>0?'+':'')+pct(v);
 const analysisData=analyses||{};

 body.innerHTML=sorted.map(c=>{
 const p=_carteiraPrecos[c.ticker]||{};
 const nome=(p.nome||c.ticker).replace(/ FII$/i,'').replace(/ Fundo de Investimento Imobiliário$/i,'');
 const nomeAbrv=nome.length>28?nome.slice(0,27)+'…':nome;
 const seg=p.seg||ELIGIBLE_FUNDS.find(f=>f.ticker===c.ticker)?.seg||'—';
 const cor=SEG_COLORS[seg]||'#555';
 const bg=SEG_BG[seg]||'#eee';
 const a=analysisData[c.ticker];
 const statusBadge=a?.status==='finalizado'
 ?`<span class="carteira-status-badge" style="background:var(--success-bg);color:var(--success)">✓ Analisado</span>`
 :`<span class="carteira-status-badge" style="background:#f0f4fa;color:#6b7a9a">Pendente</span>`;
 const nota=a?.scoreTotal!=null?`<span style="font-weight:700;color:${a.scoreTotal>=7?'var(--success)':a.scoreTotal>=5?'var(--warning)':'var(--danger)'}">${a.scoreTotal.toFixed(1)}</span>`:'—';

 const editPeso=_carteiraEdit
 ?`<input type="number" class="cart-edit-peso" id="peso-input-${c.ticker}" value="${c.peso}" min="0.1" max="100" step="0.1" onchange="salvarPesoCarteira('${c.ticker}')">`
 :`<strong>${c.peso.toFixed(1)}%</strong>`;

 const actionBtn=_carteiraEdit
 ?`<td><button class="cart-remove-btn" onclick="removerFundoCarteira('${c.ticker}')">✕ Remover</button></td>`
 :'';

 return`<tr class="${_carteiraEdit?'carteira-edit-row':''}">
 <td><strong style="color:var(--apex-blue);font-size:12px">${c.ticker}</strong></td>
 <td style="text-align:center">${editPeso}</td>
 <td>
 <div style="font-size:11px;color:var(--apex-navy);font-weight:600">${nomeAbrv}</div>
 <span style="font-size:9px;padding:1px 6px;border-radius:6px;background:${bg};color:${cor};font-weight:700">${seg}</span>
 </td>
 <td style="font-weight:700;color:var(--apex-navy)">${p.preco?'R$ '+p.preco.toFixed(2):'—'}</td>
 <td>${p.liq3m?'R$ '+p.liq3m.toFixed(3):'—'}</td>
 <td style="font-weight:700;color:${!p.pvp?'#6b7a9a':p.pvp<1?'var(--success)':p.pvp<1.15?'var(--warning)':'var(--danger)'}">${p.pvp?p.pvp.toFixed(2)+'x':'—'}</td>
 <td style="background:rgba(255,255,255,.4);color:var(--apex-navy);font-weight:600">${p.dyMes?pct(p.dyMes):'—'}</td>
 <td style="background:rgba(255,255,255,.4);font-weight:600">${p.dy12m?pct(p.dy12m):'—'}</td>
 <td style="background:rgba(255,255,255,.4);font-weight:600">${p.dyAnual?pct(p.dyAnual):'—'}</td>
 <td class="${perfCls(p.perf1m||0)}" style="background:rgba(248,252,255,.6)">${perfFmt(p.perf1m||0)}</td>
 <td class="${perfCls(p.perfAno||0)}" style="background:rgba(248,252,255,.6)">${perfFmt(p.perfAno||0)}</td>
 <td class="${perfCls(p.perfLtm||0)}" style="background:rgba(248,252,255,.6)">${perfFmt(p.perfLtm||0)}</td>
 <td>${statusBadge}</td>
 <td style="text-align:center">${nota}</td>
 ${actionBtn}
 </tr>`;
 }).join('');

 renderCarteiraFooter();
 renderCarteiraDonut();
 renderCarteiraDYBar();

 // Sub-título
 const sub=document.getElementById('carteira-subtitle');
 const total=_carteira.reduce((a,c)=>a+(c.peso||0),0);
 if(sub) sub.textContent=`${_carteira.length} fundos · Peso total: ${total.toFixed(1)}%`;
}

export function renderCarteiraFooter(){
 const foot=document.getElementById('tbl-carteira-foot');
 if(!foot||!_carteira.length) return;
 const pct=fmtPercent;
 const wavg=(key)=>{
 const tot=_carteira.reduce((s,c)=>{const p=_carteiraPrecos[c.ticker];return s+(p&&p[key]?p[key]*c.peso:0);},0);
 const w=_carteira.reduce((s,c)=>{const p=_carteiraPrecos[c.ticker];return s+(p&&p[key]?c.peso:0);},0);
 return w?tot/w:0;
 };
 const pesoTotal=_carteira.reduce((a,c)=>a+(c.peso||0),0);
 const avgDyMes=wavg('dyMes'), avgDy12m=wavg('dy12m'), avgDyAn=wavg('dyAnual');
 const avgPvp=wavg('pvp'), avgPerf1m=wavg('perf1m'), avgPerfAno=wavg('perfAno'), avgPerfLtm=wavg('perfLtm');
 const avgLiq=_carteira.reduce((s,c)=>{const p=_carteiraPrecos[c.ticker];return s+(p?.liq3m||0);},0)/_carteira.length;

 const pCls=v=>v>0?'cart-perf-pos':v<0?'cart-perf-neg':'cart-perf-neu';
 const pFmt=v=>v===0?'—':(v>0?'+':'')+pct(v);

 foot.innerHTML=`<tr style="background:var(--apex-navy);color:#fff;font-weight:700;font-size:11px">
 <td style="padding:8px 10px;color:#fff">Média</td>
 <td style="color:#fff;text-align:center">${pesoTotal.toFixed(1)}%</td>
 <td></td>
 <td></td>
 <td style="color:#fff">${avgLiq?'R$ '+avgLiq.toFixed(3):'—'}</td>
 <td style="color:#fff">${avgPvp?avgPvp.toFixed(2)+'x':'—'}</td>
 <td style="background:rgba(255,255,255,.08);color:#fff">${avgDyMes?pct(avgDyMes):'—'}</td>
 <td style="background:rgba(255,255,255,.08);color:#fff">${avgDy12m?pct(avgDy12m):'—'}</td>
 <td style="background:rgba(255,255,255,.08);color:#fff">${avgDyAn?pct(avgDyAn):'—'}</td>
 <td class="${pCls(avgPerf1m)}" style="background:rgba(255,255,255,.1)">${pFmt(avgPerf1m)}</td>
 <td class="${pCls(avgPerfAno)}" style="background:rgba(255,255,255,.1)">${pFmt(avgPerfAno)}</td>
 <td class="${pCls(avgPerfLtm)}" style="background:rgba(255,255,255,.1)">${pFmt(avgPerfLtm)}</td>
 <td></td><td></td>${_carteiraEdit?'<td></td>':''}
 </tr>`;
}

export function renderCarteiraDonut(){
 const svgEl=document.getElementById('carteira-donut-svg');
 const legEl=document.getElementById('carteira-donut-legend');
 if(!svgEl||!_carteira.length) return;

 // Aggregate by segment
 const segMap={};
 _carteira.forEach(c=>{
 const s=(_carteiraPrecos[c.ticker]?.seg)||ELIGIBLE_FUNDS.find(f=>f.ticker===c.ticker)?.seg||'Outros';
 segMap[s]=(segMap[s]||0)+c.peso;
 });
 const total=Object.values(segMap).reduce((a,v)=>a+v,0)||1;
 const segs=Object.entries(segMap).sort((a,b)=>b[1]-a[1]);

 const R=70,r=40,CX=80,CY=80,SIZE=160;
 let angle=-Math.PI/2;
 let paths='';
 segs.forEach(([nome,peso])=>{
 const frac=peso/total;
 const sweep=frac*2*Math.PI;
 const x1=CX+R*Math.cos(angle), y1=CY+R*Math.sin(angle);
 const x2=CX+R*Math.cos(angle+sweep), y2=CY+R*Math.sin(angle+sweep);
 const xi1=CX+r*Math.cos(angle), yi1=CY+r*Math.sin(angle);
 const xi2=CX+r*Math.cos(angle+sweep), yi2=CY+r*Math.sin(angle+sweep);
 const large=sweep>Math.PI?1:0;
 const cor=SEG_COLORS[nome]||'#999';
 paths+=`<path d="M${xi1},${yi1} L${x1},${y1} A${R},${R} 0 ${large},1 ${x2},${y2} L${xi2},${yi2} A${r},${r} 0 ${large},0 ${xi1},${yi1}" fill="${cor}" stroke="#fff" stroke-width="1.5"><title>${nome}: ${peso.toFixed(1)}%</title></path>`;
 angle+=sweep;
 });
 svgEl.innerHTML=`<svg viewBox="0 0 ${SIZE} ${SIZE}" width="160" height="160"><g>${paths}</g></svg>`;

 legEl.innerHTML=segs.map(([nome,peso])=>{
 const cor=SEG_COLORS[nome]||'#999';
 return`<div style="display:flex;align-items:center;gap:6px">
 <div style="width:10px;height:10px;border-radius:2px;background:${cor};flex-shrink:0"></div>
 <span style="color:var(--apex-navy)">${nome} <strong>(${peso.toFixed(1)}%)</strong></span>
 </div>`;
 }).join('');
}

export function renderCarteiraDYBar(){
 const wrap=document.getElementById('carteira-dy-bar-wrap');
 if(!wrap||!_carteira.length) return;
 const sorted=[..._carteira].sort((a,b)=>b.peso-a.peso).slice(0,15);
 const vals=sorted.map(c=>(_carteiraPrecos[c.ticker]?.dyMes||0)*100);
 const maxV=Math.max(...vals,0.5);
 const W=Math.max(400,sorted.length*52), H=180, PAD={t:30,b:40,l:8,r:8};
 const bw=Math.min(36,(W-PAD.l-PAD.r)/sorted.length-8);
 const ph=H-PAD.t-PAD.b;

 let svg=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${W}px;font-family:Manrope,sans-serif">`;
 sorted.forEach((c,i)=>{
 const v=vals[i];
 const x=PAD.l+i*(W-PAD.l-PAD.r)/sorted.length+(W-PAD.l-PAD.r)/sorted.length/2-bw/2;
 const bh=Math.max(2,(v/maxV)*ph);
 const y=PAD.t+ph-bh;
 const cor=SEG_COLORS[_carteiraPrecos[c.ticker]?.seg||'Outros']||'var(--apex-blue)';
 svg+=`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="${cor}" rx="3" fill-opacity=".85">
 <title>${c.ticker}: ${v.toFixed(2)}% ao mês</title></rect>`;
 svg+=`<text x="${x+bw/2}" y="${y-4}" text-anchor="middle" font-size="9" font-weight="700" fill="${cor}">${v>0?v.toFixed(2)+'%':'—'}</text>`;
 svg+=`<text x="${x+bw/2}" y="${H-10}" text-anchor="middle" font-size="9" fill="#5a6e8a" font-weight="700">${c.ticker}</text>`;
 });
 svg+='</svg>';
 wrap.innerHTML=svg;
}

export function renderCarteiraComposicao(){
 // Alocação por ativo
 const aBody=document.getElementById('tbl-cart-ativo-body');
 if(aBody){
 const sorted=[..._carteira].sort((a,b)=>b.peso-a.peso);
 const pct=v=>fmtPercent(v,1);
 aBody.innerHTML=sorted.map(c=>{
 const p=_carteiraPrecos[c.ticker]||{};
 const nome=(p.nome||c.ticker).replace(/ FII$/i,'');
 const seg=p.seg||ELIGIBLE_FUNDS.find(f=>f.ticker===c.ticker)?.seg||'—';
 const cor=SEG_COLORS[seg]||'#555', bg=SEG_BG[seg]||'#eee';
 return`<tr>
 <td><strong style="color:var(--apex-blue)">${c.ticker}</strong></td>
 <td style="font-size:11px;color:var(--apex-navy)">${nome.length>20?nome.slice(0,19)+'…':nome}</td>
 <td><span style="background:${bg};color:${cor};padding:1px 7px;border-radius:6px;font-size:9px;font-weight:700">${seg}</span></td>
 <td data-val="${c.peso}" style="font-weight:700;color:var(--apex-blue);text-align:center">${c.peso.toFixed(1)}%</td>
 <td data-val="${p.dy12m||0}" style="font-weight:600;color:var(--success)">${p.dy12m?pct(p.dy12m):'—'}</td>
 </tr>`;
 }).join('');
 }

 // Composição por segmento
 const sBody=document.getElementById('tbl-cart-seg-body');
 if(sBody){
 const segMap={};
 _carteira.forEach(c=>{
 const s=(_carteiraPrecos[c.ticker]?.seg)||ELIGIBLE_FUNDS.find(f=>f.ticker===c.ticker)?.seg||'Outros';
 if(!segMap[s]) segMap[s]={peso:0,dy:0,n:0};
 segMap[s].peso+=c.peso;
 segMap[s].dy+=(_carteiraPrecos[c.ticker]?.dy12m||0)*c.peso;
 segMap[s].n++;
 });
 const total=Object.values(segMap).reduce((a,v)=>a+v.peso,0)||1;
 const segs=Object.entries(segMap).sort((a,b)=>b[1].peso-a[1].peso);
 const pct=v=>fmtPercent(v,1);
 sBody.innerHTML=segs.map(([nome,s])=>{
 const cor=SEG_COLORS[nome]||'#555', bg=SEG_BG[nome]||'#eee';
 const dyMed=s.peso?s.dy/s.peso:0;
 return`<tr>
 <td><span style="background:${bg};color:${cor};padding:2px 9px;border-radius:8px;font-size:10px;font-weight:700">${nome}</span></td>
 <td data-val="${s.peso}" style="font-weight:700;color:var(--apex-blue);text-align:center">${s.peso.toFixed(1)}%</td>
 <td data-val="${dyMed}" style="font-weight:600;color:var(--success)">${dyMed?pct(dyMed):'—'}</td>
 <td style="text-align:center;color:#6b7a9a">${s.n}</td>
 </tr>`;
 }).join('');
 }
}

export function renderCarteiraKPIs(){
 const pct=fmtPercent;
 const wavg=key=>{
 const tot=_carteira.reduce((s,c)=>{const p=_carteiraPrecos[c.ticker];return s+(p&&p[key]?p[key]*c.peso:0);},0);
 const w=_carteira.reduce((s,c)=>{const p=_carteiraPrecos[c.ticker];return s+(p&&p[key]?c.peso:0);},0);
 return w?tot/w:0;
 };
 const avgDyAn=wavg('dyAnual'), avgPvp=wavg('pvp'), n=_carteira.length;
 const el=id=>document.getElementById(id);
 if(el('cart-kpi-dy')) el('cart-kpi-dy').textContent=avgDyAn?pct(avgDyAn)+' a.a.':'—';
 if(el('cart-kpi-dy-mes'))el('cart-kpi-dy-mes').textContent=avgDyAn?pct(avgDyAn/12)+' a.m.':'—';
 if(el('cart-kpi-pvp')) el('cart-kpi-pvp').textContent=avgPvp?avgPvp.toFixed(2)+'x':'—';
 if(el('cart-kpi-n')) el('cart-kpi-n').textContent=n;

 // Stats
 const statsEl=el('carteira-stats-body');
 if(statsEl){
 const avgPerf1m=wavg('perf1m'), avgPerfAno=wavg('perfAno');
 const perf=v=>`<strong style="color:${v>0?'var(--success)':v<0?'var(--danger)':'#6b7a9a'}">${v>0?'+':''}${pct(v)}</strong>`;
 statsEl.innerHTML=`
 <div style="display:flex;justify-content:space-between;border-bottom:1px solid #f0f4fa;padding:4px 0">
 <span>Nº médio de ativos</span><strong>~${n}</strong>
 </div>
 <div style="display:flex;justify-content:space-between;border-bottom:1px solid #f0f4fa;padding:4px 0">
 <span>P/VP médio ponderado</span>${el('cart-kpi-pvp')?.textContent||'—'}
 </div>
 <div style="display:flex;justify-content:space-between;border-bottom:1px solid #f0f4fa;padding:4px 0">
 <span>DY médio ponderado (a.a.)</span>${el('cart-kpi-dy')?.textContent||'—'}
 </div>
 <div style="display:flex;justify-content:space-between;border-bottom:1px solid #f0f4fa;padding:4px 0">
 <span>Retorno no mês (média pond.)</span>${perf(avgPerf1m)}
 </div>
 <div style="display:flex;justify-content:space-between;padding:4px 0">
 <span>Retorno no ano (média pond.)</span>${perf(avgPerfAno)}
 </div>`;
 }
}

export function renderCarteiraVisaoGeral(){
 renderCarteiraKPIs();

 // Objetivo
 const objEl=document.getElementById('carteira-objetivo-text');
 if(objEl) objEl.textContent=_carteiraObjetivo;

 // Rentabilidade anual
 renderCarteiraRetornos();
}

export function renderCarteiraRetornos(){
 const head=document.getElementById('tbl-cart-retornos-head');
 const body=document.getElementById('tbl-cart-retornos-body');
 if(!head||!body) return;

 const anos=[..._carteiraRetornos].map(r=>r.ano).sort((a,b)=>b-a);
 const pct=fmtPercentSigned;
 const cls=v=>v==null?'ret-neu':v>0?'ret-pos':'ret-neg';

 head.innerHTML=`<tr><th>Rentabilidade</th>${anos.map(a=>`<th>${a}</th>`).join('')}</tr>`;
 const rows=[
 {label:'APX FIIs', key:'retCarteira'},
 {label:'Acum. APX', key:'acCarteira', accent:true},
 {label:'IFIX', key:'retIfix'},
 {label:'Acum. IFIX', key:'acIfix'},
 ];
 const map={};
 _carteiraRetornos.forEach(r=>{ map[r.ano]=r; });

 body.innerHTML=rows.map((row,ri)=>`<tr${row.accent?' style="background:#f4f8fd"':''}>
 <td style="font-weight:700;color:var(--apex-navy)">${row.label}</td>
 ${anos.map(a=>{
 const v=map[a]?.[row.key];
 return`<td class="${cls(v)}">${pct(v)}</td>`;
 }).join('')}
 </tr>`).join('');

 if(!anos.length){
 head.innerHTML=`<tr><th>Rentabilidade</th><th>2026</th><th>2025</th><th>2024</th><th>2023</th><th>2022</th></tr>`;
 body.innerHTML=`<tr><td colspan="6" style="text-align:center;padding:20px;color:#6b7a9a;font-size:11px">Clique em <strong>Editar</strong> para inserir os retornos anuais históricos.</td></tr>`;
 }
}

// ── Alertas ───────────────────────────────────────────────────
export function verificarAlertasCarteira(){
 const alertas=[];

 _carteira.forEach(c=>{
 const p=_carteiraPrecos[c.ticker];
 // Elegibilidade
 const elegivel=_currentFundos.find(f=>f.ticker===c.ticker&&f.elegivel);
 if(_currentFundos.length&&!elegivel)
 alertas.push({tipo:'danger',msg:`⚠ ${c.ticker} saiu do universo elegível esta semana`});
 // P/VP
 if(p?.pvp&&p.pvp>1.15)
 alertas.push({tipo:'warning',msg:` ${c.ticker}: P/VP em ${p.pvp.toFixed(2)}x (acima de 1,15x)`});
 });

 // Alertas configuráveis
 _carteiraAlertasCfg.forEach(al=>{
 if(al.tipo==='segmento'){
 const segMap={};
 _carteira.forEach(c=>{
 const s=_carteiraPrecos[c.ticker]?.seg||ELIGIBLE_FUNDS.find(f=>f.ticker===c.ticker)?.seg||'Outros';
 segMap[s]=(segMap[s]||0)+c.peso;
 });
 const peso=segMap[al.parametro]||0;
 if(peso>al.limite)
 alertas.push({tipo:'warning',msg:` Segmento ${al.parametro}: ${peso.toFixed(1)}% (limite: ${al.limite}%)`});
 }
 });

 const banner=document.getElementById('carteira-alertas-banner');
 if(!banner) return;
 if(!alertas.length){ banner.style.display='none'; return; }
 banner.style.display='block';
 banner.innerHTML=alertas.map(a=>`<div class="cart-alert-item cart-alert-${a.tipo}">${a.msg}</div>`).join('');

 // Também mostrar na sub-aba de alertas
 const listaEl=document.getElementById('carteira-alertas-lista');
 if(listaEl) listaEl.innerHTML=alertas.length
 ?alertas.map(a=>`<div class="cart-alert-item cart-alert-${a.tipo}">${a.msg}</div>`).join('')
 :'<div style="color:var(--success);font-weight:600">✓ Nenhum alerta ativo no momento.</div>';
}

export async function salvarAlerta(){
 const tipo=document.getElementById('alerta-tipo')?.value;
 const param=document.getElementById('alerta-param')?.value||null;
 const limite=parseFloat(document.getElementById('alerta-limite')?.value||'0');
 if(!limite){ toast('Informe um limite válido','warning'); return; }
 const db=getDB();
 if(!db){ toast('Supabase não disponível','error'); return; }
 try{
 const {data,error}=await db.from('carteira_alertas').insert({tipo,parametro:param,limite,ativo:true}).select();
 if(error) throw error;
 _carteiraAlertasCfg.push(data[0]);
 toast('✓ Alerta configurado','success');
 renderAlertasLista();
 verificarAlertasCarteira();
 }catch(e){ toast('Erro: '+e.message,'error'); }
}

export function renderAlertasLista(){
 const el=document.getElementById('carteira-alertas-lista');
 if(!el) return;
 if(!_carteiraAlertasCfg.length){
 el.innerHTML='<div style="color:#6b7a9a;font-size:12px">Nenhum alerta configurado ainda.</div>';
 return;
 }
 const tipoLabel={elegibilidade:'Elegibilidade',pvp:'P/VP',segmento:'Segmento',dy:'DY',peso:'Peso'};
 el.innerHTML=_carteiraAlertasCfg.map(a=>`
 <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f4fa;font-size:11px">
 <div>
 <strong style="color:var(--apex-navy)">${tipoLabel[a.tipo]||a.tipo}</strong>
 ${a.parametro?`<span style="color:#6b7a9a"> · ${a.parametro}</span>`:''}
 <span style="color:var(--warning)"> › ${a.limite}</span>
 </div>
 <button onclick="removerAlerta(${a.id})" style="font-size:10px;padding:5px 10px;background:var(--danger-bg);color:var(--danger);border:1px solid #f5c6c6;border-radius:5px;cursor:pointer;font-family:'Manrope',sans-serif">Remover</button>
 </div>`).join('');
}

export async function removerAlerta(id){
 const db=getDB();
 if(!db) return;
 await db.from('carteira_alertas').delete().eq('id',id);
 _carteiraAlertasCfg=_carteiraAlertasCfg.filter(a=>a.id!==id);
 window._carteiraAlertasCfg = _carteiraAlertasCfg;
 renderAlertasLista();
 toast('Alerta removido','success');
}

export function updateAlertaForm(){
 const tipo=document.getElementById('alerta-tipo')?.value;
 const paramWrap=document.getElementById('alerta-param-wrap');
 const paramLabel=document.getElementById('alerta-param-label');
 const limiteLabel=document.getElementById('alerta-limite-label');
 const paramInput=document.getElementById('alerta-param');
 if(!paramWrap) return;
 if(tipo==='segmento'){
 paramWrap.style.display='block';
 paramLabel.textContent='Nome do segmento';
 paramInput.placeholder='ex: Recebível';
 limiteLabel.textContent='Peso máximo (%)';
 document.getElementById('alerta-limite').placeholder='40';
 } else if(tipo==='pvp'){
 paramWrap.style.display='none';
 limiteLabel.textContent='P/VP máximo';
 document.getElementById('alerta-limite').placeholder='1.15';
 } else if(tipo==='dy'){
 paramWrap.style.display='none';
 limiteLabel.textContent='DY mínimo anualizado (ex: 0.08 = 8%)';
 document.getElementById('alerta-limite').placeholder='0.08';
 } else {
 paramWrap.style.display='none';
 limiteLabel.textContent='Limite';
 document.getElementById('alerta-limite').placeholder='';
 }
}

// ── Edição inline ─────────────────────────────────────────────
export function toggleCarteiraEdit(){
 _carteiraEdit=!_carteiraEdit;
 window._carteiraEdit = _carteiraEdit;
 const btn=document.getElementById('btn-carteira-edit');
 const addForm=document.getElementById('carteira-add-form');
 const actionsCols=document.querySelectorAll('#carteira-actions-col,#carteira-actions-col2');
 if(btn) btn.textContent=_carteiraEdit?'Concluir Edição':'Editar Carteira';
 if(addForm) addForm.style.display=_carteiraEdit?'block':'none';
 actionsCols.forEach(el=>el.style.display=_carteiraEdit?'table-cell':'none');
 renderCarteiraPosicoes();
}

// ── Sub-tabs ──────────────────────────────────────────────────
export function showCarteiraTab(id, btn){
 document.querySelectorAll('.ctab').forEach(b=>b.classList.remove('active'));
 document.querySelectorAll('.ctab-content').forEach(el=>el.style.display='none');
 if(btn) btn.classList.add('active');
 const el=document.getElementById('ctab-'+id);
 if(el) el.style.display='block';
 if(id==='composicao') renderCarteiraComposicao();
 if(id==='visaogeral') renderCarteiraVisaoGeral();
 if(id==='benchmarks') initBenchmarks();
 if(id==='alertas'){ renderAlertasLista(); verificarAlertasCarteira(); }
}

// ── Editar Objetivo ───────────────────────────────────────────
export async function editarObjetivoCarteira(){
 const novo=window.prompt('Editar objetivo da carteira:',_carteiraObjetivo);
 if(!novo||novo===_carteiraObjetivo) return;
 _carteiraObjetivo=novo;
 window._carteiraObjetivo = _carteiraObjetivo;
 const el=document.getElementById('carteira-objetivo-text');
 if(el) el.textContent=novo;
 const db=getDB();
 if(db) await db.from('carteira_meta').upsert({id:1,objetivo:novo});
}

// ── Editar Retornos Anuais ────────────────────────────────────
export async function editarRetornosCarteira(){
 const ano=parseInt(window.prompt('Ano (ex: 2025):',''))||0;
 if(!ano||ano<2020||ano>2030){ toast('Ano inválido','warning'); return; }
 const retC=parseFloat(window.prompt(`Retorno APX FIIs ${ano} (ex: 20.28):`,'')||'0')/100;
 const retI=parseFloat(window.prompt(`Retorno IFIX ${ano} (ex: 21.15):`,'')||'0')/100;
 const db=getDB();
 if(!db){ toast('Supabase não disponível','error'); return; }
 try{
 const {error}=await db.from('carteira_retornos').upsert({ano,retCarteira:retC,retIfix:retI},{onConflict:'ano'});
 if(error) throw error;
 const ex=_carteiraRetornos.find(r=>r.ano===ano);
 if(ex){ ex.retCarteira=retC; ex.retIfix=retI; } else _carteiraRetornos.push({ano,retCarteira:retC,retIfix:retI});
 // Calcular acumulados
 renderCarteiraRetornos();
 toast(`✓ Retorno ${ano} salvo`,'success');
 }catch(e){ toast('Erro: '+e.message,'error'); }
}

// ── Activity feed ─────────────────────────────────────────────
export async function logCarteiraAtividade(tipo, ticker, detalhe){
 const db=getDB();
 if(!db) return;
 const analista=localStorage.getItem('apex_analista')||'Analista';
 try{
 await db.from('analysis_comments').insert({
 ticker, tipo, conteudo:detalhe,
 analista, created_at:new Date().toISOString()
 });
 renderAtvVisaoGeral();
 }catch(e){ console.warn('[logCarteiraAtividade]',e.message); }
}




window.fetchYahooMonthly = fetchYahooMonthly;
window.initCarteira = initCarteira;
window.carregarCarteira = carregarCarteira;
window.atualizarPrecosCarteira = atualizarPrecosCarteira;
window.adicionarFundoCarteira = adicionarFundoCarteira;
window.removerFundoCarteira = removerFundoCarteira;
window.salvarPesoCarteira = salvarPesoCarteira;
window.verificarPesoTotal = verificarPesoTotal;
window.renderCarteira = renderCarteira;
window.renderCarteiraVazia = renderCarteiraVazia;
window.renderCarteiraPosicoes = renderCarteiraPosicoes;
window.renderCarteiraFooter = renderCarteiraFooter;
window.renderCarteiraDonut = renderCarteiraDonut;
window.renderCarteiraDYBar = renderCarteiraDYBar;
window.renderCarteiraComposicao = renderCarteiraComposicao;
window.renderCarteiraKPIs = renderCarteiraKPIs;
window.renderCarteiraVisaoGeral = renderCarteiraVisaoGeral;
window.renderCarteiraRetornos = renderCarteiraRetornos;
window.verificarAlertasCarteira = verificarAlertasCarteira;
window.salvarAlerta = salvarAlerta;
window.renderAlertasLista = renderAlertasLista;
window.removerAlerta = removerAlerta;
window.updateAlertaForm = updateAlertaForm;
window.toggleCarteiraEdit = toggleCarteiraEdit;
window.showCarteiraTab = showCarteiraTab;
window.editarObjetivoCarteira = editarObjetivoCarteira;
window.editarRetornosCarteira = editarRetornosCarteira;
window.logCarteiraAtividade = logCarteiraAtividade;
window._carteira = _carteira;
window._carteiraPrecos = _carteiraPrecos;
window._carteiraEdit = _carteiraEdit;
window._carteiraAlertasCfg = _carteiraAlertasCfg;
window._carteiraRetornos = _carteiraRetornos;
window._carteiraObjetivo = _carteiraObjetivo;
window.CORS_PROXY = CORS_PROXY;
window.YF_QUOTE_URL = YF_QUOTE_URL;
window.YF_CHART_URL = YF_CHART_URL;
