'use strict';

// ══════════════════════════════════════════════════════════════
// BENCHMARKS — Comparação de Rentabilidade (Fase 4 da modularização)
// ══════════════════════════════════════════════════════════════
// Sub-aba de Carteira APX. Depende de _carteira/_carteiraPrecos
// (js/tabs/carteira.js), SEG_COLORS (js/constants.js) e getDB (js/
// supabase-client.js) — acessíveis via window.
//
// Todo o estado _bench*/_returnEngine e a função sdToISO são privados
// desta aba (nenhum outro módulo os reatribui) — confirmado com grep
// antes da extração. js/tabs/ranking.js CHAMA sdToISO (não reatribui),
// então continua funcionando via window.sdToISO normalmente.

export const BENCH_COLORS={carteira:'#000123',cdi:'#27ae60',ipca:'#e67e22',selic:'#8e44ad',ifix:'#307AE0',ibov:'#c0392b'};
export const BENCH_LABELS={carteira:'Carteira APX',cdi:'CDI',ipca:'IPCA',selic:'SELIC',ifix:'IFIX',ibov:'IBOV'};
export const BCB_SERIES_IDS={cdi:4391,ipca:433,selic:4390};


// Tickers Yahoo Finance para os índices de referência (via CORS_PROXY, mesmo usado na Carteira)
// IBOV: %5EBVSP é o índice oficial direto no Yahoo.
// IFIX: não existe índice direto no Yahoo; usamos XFIX11.SA (ETF que replica o IFIX) como proxy.
export const YF_INDEX_MAP={ibov:'%5EBVSP',ifix:'XFIX11.SA'};

export let _benchData={};
export let _benchFundData={};
export let _benchDataStatus={}; // {key: 'ok'|'failed'|'loading'|'empty'}
export let _benchPeriodStart='';
export let _benchPeriodEnd='';
export let _benchVisible=new Set(['carteira','cdi','ipca','ifix','ibov']);
export let _benchLoaded=false;

export async function initBenchmarks(){
 if(!_benchPeriodStart){
 _benchPeriodStart='2021-09';
 const now=new Date();
 _benchPeriodEnd=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
 }
 // Preencher inputs texto MM/AAAA
 const s=document.getElementById('bench-start');
 const e=document.getElementById('bench-end');
 if(s&&!s.value){s.value=toMMAAAA(_benchPeriodStart);s.style.borderColor='var(--apex-blue)';}
 if(e&&!e.value){e.value=toMMAAAA(_benchPeriodEnd);e.style.borderColor='var(--apex-blue)';}
 // Marcar atalho ativo (Desde o início é o padrão)
 const now=new Date();
 const curYM=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
 if(_benchPeriodStart==='2021-09'&&_benchPeriodEnd===curYM)
   document.querySelector('.bench-period-btn[data-period="inicio"]')?.classList.add('active');
 updatePeriodLabel(_benchPeriodStart,_benchPeriodEnd);
 renderBenchToggles();
 if(!_benchLoaded) await loadAllBenchmarkData(_benchPeriodStart,_benchPeriodEnd);
 else renderAllBenchmarks();
}

// ── Seleção de período ────────────────────────────────────────
export function maskMMAAAA(input){
 let v=input.value.replace(/\D/g,'');
 if(v.length>6)v=v.slice(0,6);
 if(v.length>=3)v=v.slice(0,2)+'/'+v.slice(2);
 input.value=v;
 const ym=parseMMAAAA(input.value);
 input.style.borderColor=ym?'var(--apex-blue)':'#e57373';
}
export function parseMMAAAA(str){
 const m=str.match(/^(\d{2})\/(\d{4})$/);
 if(!m)return null;
 const mm=parseInt(m[1]),yyyy=parseInt(m[2]);
 if(mm<1||mm>12||yyyy<2010||yyyy>2040)return null;
 return `${yyyy}-${String(mm).padStart(2,'0')}`;
}
export function toMMAAAA(ym){
 if(!ym)return'';
 const[y,mo]=ym.split('-');
 return `${mo}/${y}`;
}
export function updatePeriodLabel(startYM,endYM){
  const el=document.getElementById('bench-period-label');if(!el) return;
  const[sy,sm]=startYM.split('-');const[ey,em]=endYM.split('-');
  const months=((parseInt(ey)-parseInt(sy))*12+(parseInt(em)-parseInt(sm)));
  // Se a carteira tiver menos meses do que o período pedido, mostrar aviso
  const actualMonths=_benchData?.carteira?.length||0;
  if(actualMonths>0&&actualMonths<months){
    el.textContent=`${toMMAAAA(startYM)} → ${toMMAAAA(endYM)} · ${months} meses solicitados · dados da carteira: ${actualMonths} meses (desde quando o BTG Guide foi processado)`;
    el.style.color='var(--warning)';
  } else {
    el.textContent=`${toMMAAAA(startYM)} → ${toMMAAAA(endYM)} · ${months} meses`;
    el.style.color='#6b7a9a';
  }
}
export function applyPeriodShortcut(period){
 const now=new Date();
 const endYM=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
 let startYM;
 if(period==='3M'){const d=new Date(now.getFullYear(),now.getMonth()-3,1);startYM=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
 else if(period==='6M'){const d=new Date(now.getFullYear(),now.getMonth()-6,1);startYM=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
 else if(period==='1A'){const d=new Date(now.getFullYear()-1,now.getMonth(),1);startYM=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
 else if(period==='YTD'){startYM=`${now.getFullYear()}-01`;}
 else{startYM='2021-09';}
 const sEl=document.getElementById('bench-start');
 const eEl=document.getElementById('bench-end');
 if(sEl){sEl.value=toMMAAAA(startYM);sEl.style.borderColor='var(--apex-blue)';}
 if(eEl){eEl.value=toMMAAAA(endYM);eEl.style.borderColor='var(--apex-blue)';}
 document.querySelectorAll('.bench-period-btn').forEach(b=>b.classList.remove('active'));
 document.querySelector(`.bench-period-btn[data-period="${period}"]`)?.classList.add('active');
 updatePeriodLabel(startYM,endYM);
 _benchPeriodStart=startYM;_benchPeriodEnd=endYM;
 _benchLoaded=false;_benchData={};_benchFundData={};_benchDataStatus={};
 loadAllBenchmarkData(startYM,endYM);
}
export function applyManualPeriod(){
 const startYM=parseMMAAAA(document.getElementById('bench-start')?.value||'');
 const endYM=parseMMAAAA(document.getElementById('bench-end')?.value||'');
 if(!startYM){toast('Data de início inválida. Use MM/AAAA (ex: 01/2023)','warning');return;}
 if(!endYM){toast('Data de fim inválida. Use MM/AAAA (ex: 06/2026)','warning');return;}
 if(startYM>=endYM){toast('A data de início deve ser anterior ao fim','warning');return;}
 document.querySelectorAll('.bench-period-btn').forEach(b=>b.classList.remove('active'));
 updatePeriodLabel(startYM,endYM);
 _benchPeriodStart=startYM;_benchPeriodEnd=endYM;
 _benchLoaded=false;_benchData={};_benchFundData={};_benchDataStatus={};
 loadAllBenchmarkData(startYM,endYM);
}
export function updateBenchmarkPeriod(){applyManualPeriod();}

export async function fetchBCBSeries(codigo,startYM,endYM){
 const[sy,sm]=startYM.split('-');
 const[ey,em]=endYM.split('-');
 const lastDay=new Date(parseInt(ey),parseInt(em),0).getDate();
 const url=`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados?formato=json`+
 `&dataInicial=01%2F${sm}%2F${sy}&dataFinal=${lastDay}%2F${em}%2F${ey}`;
 const res=await fetch(url);
 if(!res.ok) throw new Error(`BCB ${codigo}: HTTP ${res.status}`);
 const data=await res.json();
 return data.map(d=>{
 const p=d.data.split('/');
 return{date:`${p[2]}-${p[1]}`,ret:parseFloat((d.valor||'0').replace(',','.'))/100};
 }).filter(d=>d.date>=startYM&&d.date<=endYM);
}


// ══════════════════════════════════════════════════════════════
// MOTOR DE RENTABILIDADE — (P_fim - P_ini + Div) / P_ini
// Dividendos reinvestidos (TRI). Base 0% no início do período.
// ══════════════════════════════════════════════════════════════
export let _benchGranularity='mensal'; // 'mensal' | 'semanal'
export let _returnEngine={}; // cache {monthly:{}, weekly:{}} por período

/** Converte DD/MM/AAAA → ISO YYYY-MM-DD para ordenação correta */
export function sdToISO(str){
  if(!str) return '';
  const p=str.split('/');
  return p.length===3?`${p[2]}-${p[1]}-${p[0]}`:str;
}

/** Toggle de granularidade */
export function setBenchGranularity(g,btn){
  _benchGranularity=g;
  document.querySelectorAll('#btn-gran-mensal,#btn-gran-semanal').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  // Re-renderizar sem recarregar dados
  applyGranularityToBenchData();
  renderAllBenchmarks();
}

/**
 * Aplica a granularidade selecionada nos dados do motor de retorno
 * e atualiza _benchData.carteira e _benchFundData.
 */
export function applyGranularityToBenchData(){
  if(!_returnEngine.monthly&&!_returnEngine.weekly) return;
  const src=_benchGranularity==='semanal'?_returnEngine.weekly:_returnEngine.monthly;
  if(!src) return;
  // Carteira consolidada
  if(src.carteira) _benchData.carteira=src.carteira;
  // Fundos individuais
  _carteira.forEach(c=>{
    if(src[c.ticker]) _benchFundData[c.ticker]=src[c.ticker];
  });
}

/**
 * Motor completo: busca fund_data, calcula retorno com dividendo,
 * monta séries mensais e semanais para carteira + fundos individuais.
 * Fórmula: (P_fim − P_ini + div_mes) / P_ini
 */
export async function calcPortfolioMonthlyReturns(startYM,endYM){
  if(!_carteira.length) return[];
  const db=getDB();
  if(!db) return[];

  const tickers=_carteira.map(c=>c.ticker);
  const totalPeso=_carteira.reduce((s,c)=>s+(c.peso||0),0)||100;
  const pesoMap={};
  _carteira.forEach(c=>{pesoMap[c.ticker]=(c.peso||0)/totalPeso;});

  // Pesos históricos: quando cada fundo entrou na carteira
  const entryMap={};
  _carteira.forEach(c=>{
    const entry=c.created_at?new Date(c.created_at).toISOString().slice(0,7):startYM;
    entryMap[c.ticker]=entry<startYM?startYM:entry;
  });

  const info=document.getElementById('bench-update-info');
  if(info) info.textContent='Buscando preços e dividendos no Supabase...';

  try{
    // Buscar 1 mês extra ANTES do início para ter o preço base do primeiro mês
    const[sy,sm]=startYM.split('-').map(Number);
    const baseDate=new Date(sy,sm-2,1);
    const baseYM=`${baseDate.getFullYear()}-${String(baseDate.getMonth()+1).padStart(2,'0')}`;

    // Buscar TODOS os dados do período (sem filtro de semanas — mais direto)
    const{data:rows,error}=await db.from('fund_data')
      .select('semana_data,ticker,fechamento,ret_mes')
      .in('ticker',tickers)
      .order('semana_data',{ascending:true});

    if(error) throw new Error('Supabase fund_data: '+error.message);
    if(!rows?.length) throw new Error('Nenhum dado encontrado em fund_data para esses tickers');

    // Diagnóstico: logar o que chegou
    const sample=rows.filter(r=>r.ticker===tickers[0]).slice(0,3);
    console.log('[Motor Rentabilidade] Total registros:',rows.length);
    console.log('[Motor Rentabilidade] Sample',tickers[0],':',sample);
    console.log('[Motor Rentabilidade] Campos disponíveis:',Object.keys(sample[0]||{}));

    // Processar: converter datas, filtrar período, ordenar
    const processed=rows.map(r=>({
      ...r,
      iso:sdToISO(r.semana_data),          // YYYY-MM-DD
      ym:sdToISO(r.semana_data).slice(0,7), // YYYY-MM
      fechamento:parseFloat(r.fechamento)||0,
      // div_mes não existe na tabela — ret_mes já inclui dividendos (total return BTG)
      ret_mes:parseFloat(r.ret_mes)||0,
    })).filter(r=>r.ym>=baseYM&&r.ym<=endYM)
      .sort((a,b)=>a.iso.localeCompare(b.iso));

    // Agrupar por ticker
    const byTicker={};
    processed.forEach(r=>{
      if(!byTicker[r.ticker])byTicker[r.ticker]=[];
      byTicker[r.ticker].push(r);
    });

    // ── Calcular retornos MENSAIS ─────────────────────────────
    const monthly={};
    for(const[ticker,pts] of Object.entries(byTicker)){
      // Último ponto de cada mês
      const byMonth={};
      pts.forEach(p=>{
        if(!byMonth[p.ym]||p.iso>byMonth[p.ym].iso) byMonth[p.ym]=p;
      });
      const months=Object.keys(byMonth).sort();
      const rets=[];
      for(let i=1;i<months.length;i++){
        const ym=months[i];
        if(ym<startYM||ym>endYM) continue;
        const prev=byMonth[months[i-1]];
        const curr=byMonth[ym];
        let ret;
        if(prev.fechamento>0&&curr.fechamento>0){
          // Usar ret_mes (total return BTG = preço + dividendos). 
          // Se ret_mes disponível, usa direto; senão calcula só pela variação de preço.
          if(curr.ret_mes){
            ret=curr.ret_mes;
          } else {
            ret=(curr.fechamento-prev.fechamento)/prev.fechamento;
          }
        } else if(curr.ret_mes){
          // Fallback: ret_mes do BTG (já inclui dividendos)
          ret=curr.ret_mes;
          console.warn(`[Motor] ${ticker} ${ym}: sem fechamento, usando ret_mes=${ret}`);
        } else {
          console.warn(`[Motor] ${ticker} ${ym}: sem dados disponíveis`);
          continue;
        }
        rets.push({date:ym,ret});
      }
      monthly[ticker]=rets;
      console.log(`[Motor Mensal] ${ticker}: ${rets.length} meses, último=${rets[rets.length-1]?.ret?.toFixed(4)}`);
    }

    // ── Calcular retornos SEMANAIS ────────────────────────────
    const weekly={};
    for(const[ticker,pts] of Object.entries(byTicker)){
      const rets=[];
      let prevDiv=0;
      for(let i=1;i<pts.length;i++){
        const prev=pts[i-1],curr=pts[i];
        if(curr.ym<startYM||curr.ym>endYM) continue;
        if(!prev.fechamento||!curr.fechamento) continue;
        // Dividendo: incluir apenas quando muda (evita dupla contagem)
        // Modo semanal: usa ret_mes (inclui dividendos) quando disponível
        const ret=curr.ret_mes||(curr.fechamento-prev.fechamento)/prev.fechamento;
        rets.push({date:curr.ym,ret});
      }
      weekly[ticker]=rets;
    }

    // ── Retorno ponderado da Carteira APX ─────────────────────
    const calcCarteira=(fundRets)=>{
      const dateSet=new Set();
      tickers.forEach(t=>(fundRets[t]||[]).forEach(r=>dateSet.add(r.date)));
      const dates=[...dateSet].sort().filter(d=>d>=startYM&&d<=endYM);
      return dates.map(date=>{
        let wRet=0,wTotal=0;
        tickers.forEach(t=>{
          if(date<entryMap[t]) return; // fundo ainda não havia entrado
          const pt=(fundRets[t]||[]).find(r=>r.date===date);
          if(!pt) return;
          wRet+=pt.ret*pesoMap[t];
          wTotal+=pesoMap[t];
        });
        return{date,ret:wTotal>0?wRet/wTotal:0};
      });
    };

    monthly.carteira=calcCarteira(monthly);
    weekly.carteira=calcCarteira(weekly);

    // Cache para troca de granularidade sem novo fetch
    _returnEngine={monthly,weekly};
    // Armazenar fundos individuais
    tickers.forEach(t=>{
      if(monthly[t]) _benchFundData[t]=monthly[t];
    });

    const n=monthly.carteira.length;
    const nFailed=tickers.filter(t=>!monthly[t]?.length).length;
    console.log(`[Motor Rentabilidade] Carteira: ${n} meses. Fundos carregados: ${tickers.length-nFailed}/${tickers.length}`);
    if(info) info.textContent=
      n>0?`Carteira: ${n} meses calculados (${tickers.length-nFailed}/${tickers.length} fundos)`
         :'Carteira: dados insuficientes — verifique os logs do console';

    _benchDataStatus.carteira=n>0?'ok':'failed';
    return monthly.carteira;

  }catch(e){
    console.error('[calcPortfolioMonthlyReturns]',e.message);
    if(info) info.textContent='Erro: '+e.message;
    _benchDataStatus.carteira='failed';
    return[];
  }
}



export async function loadAllBenchmarkData(startYM,endYM){
 setBenchLoading(true);
 const info=document.getElementById('bench-update-info');
 if(info) info.textContent='Carregando benchmarks...';

 ['cdi','ipca','selic','carteira','ifix','ibov']
 .forEach(k=>{_benchDataStatus[k]='loading';});

 try{
 // 1. BCB (CDI/IPCA/SELIC) + Carteira via Supabase — paralelo
 if(info) info.textContent='Buscando CDI, IPCA, SELIC (BCB) + retornos da carteira (Supabase)...';

 const[cdi,ipca,selic,carteira]=await Promise.allSettled([
 fetchBCBSeries(BCB_SERIES_IDS.cdi, startYM,endYM),
 fetchBCBSeries(BCB_SERIES_IDS.ipca, startYM,endYM),
 fetchBCBSeries(BCB_SERIES_IDS.selic,startYM,endYM),
 calcPortfolioMonthlyReturns(startYM,endYM),
 ]);
 const ok=r=>r.status==='fulfilled'?r.value:[];
 _benchData.cdi =ok(cdi); _benchDataStatus.cdi =ok(cdi).length>0?'ok':'failed';
 _benchData.ipca =ok(ipca); _benchDataStatus.ipca =ok(ipca).length>0?'ok':'failed';
 _benchData.selic =ok(selic); _benchDataStatus.selic =ok(selic).length>0?'ok':'failed';
 _benchData.carteira=ok(carteira);_benchDataStatus.carteira=ok(carteira).length>0?'ok':'failed';

 // Renderizar imediatamente com o que temos
 renderAllBenchmarks();

 // 2. IBOV/IFIX via Yahoo Finance (mesmo proxy CORS usado na Carteira)
 if(info) info.textContent='Buscando IBOV e IFIX via Yahoo Finance...';
 const[ibov,ifix]=await Promise.allSettled([
  fetchYahooMonthly(YF_INDEX_MAP.ibov,startYM,endYM),
  fetchYahooMonthly(YF_INDEX_MAP.ifix,startYM,endYM),
 ]);
 const ok2=r=>r.status==='fulfilled'?r.value:[];
 _benchData.ibov=ok2(ibov); _benchDataStatus.ibov=ok2(ibov).length>0?'ok':'failed';
 _benchData.ifix=ok2(ifix); _benchDataStatus.ifix=ok2(ifix).length>0?'ok':'failed';
 if(_benchDataStatus.ibov==='failed') console.warn('[benchmarks] IBOV: falha ao buscar via Yahoo Finance',ibov.reason?.message);
 if(_benchDataStatus.ifix==='failed') console.warn('[benchmarks] IFIX: falha ao buscar via Yahoo Finance',ifix.reason?.message);

 _benchLoaded=true;
 renderAllBenchmarks();

 const nOk=Object.values(_benchDataStatus).filter(v=>v==='ok').length;
 const nFail=Object.values(_benchDataStatus).filter(v=>v==='failed').length;
 const now=new Date();
 if(info) info.textContent=
 `Atualizado: ${now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} · `+
 `${nOk} séries OK${nFail>0?' · '+nFail+' indisponíveis':''}`;

 }catch(e){
 console.error('[loadAllBenchmarkData]',e);
 toast('Erro ao carregar benchmarks: '+e.message,'error');
 }finally{setBenchLoading(false);}
}

export function setBenchLoading(on){
 const el=document.getElementById('bench-loading');
 if(el) el.style.display=on?'block':'none';
 const card=document.getElementById('bench-chart-card');
 if(card) card.style.opacity=on?'0.4':'1';
}

export function renderAllBenchmarks(){
 renderBenchToggles();
 renderBenchDataStatus(); // painel de status
 renderBenchChart();
 renderBenchKPIs();
 renderBenchAnnualTable();
 renderBenchHeatmap();
 renderBenchStats();
}

/** Mostra resumo do que foi carregado vs o que falhou */
export function renderBenchDataStatus(){
 const el=document.getElementById('bench-data-status');if(!el)return;
 const ok=[],fail=[];
 const all=['carteira','cdi','ipca','selic','ifix','ibov',..._carteira.map(c=>c.ticker)];
 all.forEach(k=>{
  const st=_benchDataStatus[k],lbl=BENCH_LABELS[k]||k;
  if(st==='ok') ok.push(lbl);
  else if(st==='failed') fail.push(lbl);
 });
 let html='';
 if(ok.length) html+=`<span style="color:var(--success)">Carregados: ${ok.join(', ')}</span>`;
 if(fail.length) html+=`${ok.length?' · ':''}<span style="color:var(--danger)">Falhou: ${fail.join(', ')}</span>`;
 el.innerHTML=html||'';
}

export function renderBenchToggles(){
 const wrap=document.getElementById('bench-series-toggles');
 if(!wrap) return;
 const fixed=['carteira','cdi','ipca','selic','ifix','ibov'];
 const fundKeys=_carteira.map(c=>c.ticker);

 wrap.innerHTML=[...fixed,...fundKeys].map(key=>{
 const cor=BENCH_COLORS[key]||SEG_COLORS[_carteiraPrecos[key]?.seg||'Outros']||'#999';
 const active=_benchVisible.has(key);
 const label=BENCH_LABELS[key]||key;
 const status=_benchDataStatus[key];

 // Dados disponíveis?
 const hasData=BENCH_LABELS[key]
 ?(_benchData[key]?.length>0)
 :(_benchFundData[key]?.length>0);

 // Ícone de status ao lado do label
 const icon=status==='loading'?'⟳ ':
 status==='failed'?'✕ ':
 (!status||!hasData)?'':
 ''; // ok = sem ícone extra

 // Estilo: opaco se não tem dados e não está carregando
 const opacity=(!hasData&&status!=='loading'&&status)?'0.45':'1';
 const title=status==='failed'?`${label}: dados não disponíveis`:
 status==='loading'?`${label}: carregando...`:
 hasData?`${label}: ${_benchData[key]?.length||_benchFundData[key]?.length||0} meses`:
 `${label}: clique em Atualizar`;

 return`<button class="bench-toggle${active&&hasData?' active':''}"
 onclick="toggleBenchSeries('${key}',this)"
 style="border-color:${cor};background:${active&&hasData?cor:'transparent'};color:${active&&hasData?'#fff':cor};opacity:${opacity}"
 title="${title}">${icon}${label}</button>`;
 }).join('');
}

export function toggleBenchSeries(key,btn){
 if(_benchVisible.has(key))_benchVisible.delete(key);
 else _benchVisible.add(key);
 const cor=BENCH_COLORS[key]||'#999';
 const active=_benchVisible.has(key);
 btn.classList.toggle('active',active);
 btn.style.background=active?cor:'transparent';
 btn.style.color=active?'#fff':cor;
 renderBenchChart();
 renderBenchStats();
}

export function calcCumulative(series){
 let cum=1;
 return series.map(p=>{cum*=(1+p.ret);return{date:p.date,cum:(cum-1)*100};});
}

export function calcBenchStats(series,rfSeries){
 if(!series||series.length<2) return null;
 const rfMap={};(rfSeries||[]).forEach(p=>{rfMap[p.date]=p.ret;});
 const rets=series.map(p=>p.ret);const n=rets.length;
 const totalRet=rets.reduce((acc,r)=>acc*(1+r),1)-1;
 const years=n/12;
 const annRet=years>0?Math.pow(1+totalRet,1/years)-1:0;
 const mean=rets.reduce((a,b)=>a+b,0)/n;
 const variance=rets.reduce((acc,r)=>acc+Math.pow(r-mean,2),0)/(n-1||1);
 const annVol=Math.sqrt(variance)*Math.sqrt(12);
 const excess=series.map(p=>p.ret-(rfMap[p.date]||0));
 const meanEx=excess.reduce((a,b)=>a+b,0)/excess.length;
 const varEx=excess.reduce((acc,r)=>acc+Math.pow(r-meanEx,2),0)/((excess.length-1)||1);
 const sharpe=Math.sqrt(varEx)>0?meanEx*12/(Math.sqrt(varEx)*Math.sqrt(12)):0;
 const rfTotal=(rfSeries||[]).reduce((acc,p)=>acc*(1+p.ret),1)-1;
 const alpha=totalRet-rfTotal;
 let peak=1,maxDD=0,c=1;
 rets.forEach(r=>{c*=(1+r);if(c>peak)peak=c;const dd=(peak-c)/peak;if(dd>maxDD)maxDD=dd;});
 return{totalRet,annRet,annVol,sharpe,alpha,maxDD};
}

export function bPct(v,dec=2){return v==null?'—':((v>=0?'+':'')+(v*100).toFixed(dec)+'%');}
export function bPctAbs(v,dec=2){return v==null?'—':((v*100).toFixed(dec)+'%');}

export function renderBenchChart(){
 const wrap=document.getElementById('bench-chart-wrap');
 const legEl=document.getElementById('bench-chart-legend');
 if(!wrap) return;
 const allKeys=[..._benchVisible].filter(k=>{
 if(BENCH_LABELS[k]) return(_benchData[k]?.length>0);
 return(_benchFundData[k]?.length>0);
 });
 if(!allKeys.length){
 wrap.innerHTML='<div style="padding:40px;text-align:center;color:#6b7a9a">Nenhuma série com dados disponíveis.</div>';
 return;
 }
 const monthSet=new Set();
 allKeys.forEach(k=>{const src=BENCH_LABELS[k]?_benchData[k]:_benchFundData[k];src?.forEach(p=>monthSet.add(p.date));});
 const months=[...monthSet].sort();if(!months.length) return;
 const cumMap={};
 allKeys.forEach(k=>{
 const src=BENCH_LABELS[k]?_benchData[k]:_benchFundData[k];
 const byDate={};(src||[]).forEach(p=>{byDate[p.date]=p.ret;});
 let c=1;
 cumMap[k]=months.map(m=>{c*=(1+(byDate[m]||0));return{date:m,cum:(c-1)*100};});
 });
 const allV=Object.values(cumMap).flat().map(p=>p.cum);
 const vMin=Math.min(...allV,0),vMax=Math.max(...allV,1);
 const pad=(vMax-vMin)*0.08||2;
 const W=680,H=300,P={t:16,r:110,b:44,l:56};
 const pw=W-P.l-P.r,ph=H-P.t-P.b;
 const sx=i=>P.l+(months.length>1?i/(months.length-1):0.5)*pw;
 const sy=v=>P.t+(1-(v-(vMin-pad))/((vMax+pad)-(vMin-pad)))*ph;
 let svg=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${W}px;font-family:Manrope,sans-serif">`;
 svg+=`<rect x="${P.l}" y="${P.t}" width="${pw}" height="${ph}" fill="#fafcff" rx="3"/>`;
 const zy=sy(0);
 svg+=`<line x1="${P.l}" y1="${zy}" x2="${P.l+pw}" y2="${zy}" stroke="#bbb" stroke-width="1" stroke-dasharray="4,3"/>`;
 svg+=`<text x="${P.l-4}" y="${zy+4}" text-anchor="end" font-size="9" fill="#9aa7bd">0%</text>`;
 const range=(vMax+pad)-(vMin-pad);
 const step=range>200?50:range>100?20:range>50?10:range>20?5:2;
 for(let t=Math.ceil((vMin-pad)/step)*step;t<=(vMax+pad);t+=step){
 const y=sy(t);if(y<P.t||y>P.t+ph) continue;
 svg+=`<line x1="${P.l}" y1="${y}" x2="${P.l+pw}" y2="${y}" stroke="#e4ecf7" stroke-width="1"/>`;
 svg+=`<text x="${P.l-4}" y="${y+4}" text-anchor="end" font-size="9" fill="#9aa7bd">${t>0?'+':''}${t.toFixed(0)}%</text>`;
 }
 const labelEvery=months.length>48?12:months.length>24?6:months.length>12?3:1;
 months.forEach((m,i)=>{
 if(i%labelEvery===0){
 const x=sx(i);const[y,mo]=m.split('-');
 svg+=`<text x="${x}" y="${H-6}" text-anchor="middle" font-size="9" fill="#9aa7bd">${mo}/${y.slice(2)}</text>`;
 svg+=`<line x1="${x}" y1="${P.t}" x2="${x}" y2="${P.t+ph}" stroke="#e4ecf7" stroke-width="1"/>`;
 }
 });
 allKeys.forEach(k=>{
 const cor=BENCH_COLORS[k]||SEG_COLORS[_carteiraPrecos[k]?.seg||'Outros']||'#999';
 const pts=cumMap[k].map((p,i)=>`${sx(i).toFixed(1)},${sy(p.cum).toFixed(1)}`).join(' ');
 svg+=`<polyline points="${pts}" fill="none" stroke="${cor}" stroke-width="${k==='carteira'?2.5:1.8}" stroke-linejoin="round"/>`;
 const last=cumMap[k][cumMap[k].length-1];
 if(last){
 const lx=P.l+pw+5,ly=Math.max(P.t+8,Math.min(P.t+ph-4,sy(last.cum)));
 svg+=`<text x="${lx}" y="${ly+4}" font-size="9" font-weight="700" fill="${cor}">${BENCH_LABELS[k]||k}: ${last.cum>=0?'+':''}${last.cum.toFixed(1)}%</text>`;
 }
 });
 svg+='</svg>';
 wrap.innerHTML=svg;
 if(legEl) legEl.innerHTML=allKeys.map(k=>{
 const cor=BENCH_COLORS[k]||'#999';
 const last=cumMap[k]?.[cumMap[k].length-1];
 return`<div style="display:flex;align-items:center;gap:5px"><div style="width:16px;height:3px;background:${cor};border-radius:2px"></div><span style="color:${cor};font-weight:700">${BENCH_LABELS[k]||k}</span>${last?`<span style="color:#6b7a9a;font-size:10px">${last.cum>=0?'+':''}${last.cum.toFixed(1)}%</span>`:''}</div>`;
 }).join('');
}

export function renderBenchKPIs(){
 const el=document.getElementById('bench-kpi-section');if(!el) return;
 const tot=series=>series.reduce((a,p)=>a*(1+p.ret),1)-1;
 const cT=tot(_benchData.carteira||[]),cdiT=tot(_benchData.cdi||[]);
 const ifT=tot(_benchData.ifix||[]),ibT=tot(_benchData.ibov||[]);
 const ipT=tot(_benchData.ipca||[]),slT=tot(_benchData.selic||[]);
 const perf=v=>v>0?'var(--success)':v<0?'var(--danger)':' #6b7a9a';
 const card=(label,val,sub,cor)=>`<div class="bench-kpi-card"><div class="bench-kpi-label">${label}</div><div class="bench-kpi-val" style="color:${cor||'var(--apex-navy)'}">${bPct(val,1)}</div>${sub?`<div class="bench-kpi-sub">${sub}</div>`:''}</div>`;
 el.innerHTML=`<div class="bench-kpi-grid">
 ${card('Carteira APX',cT,'Período selecionado',perf(cT))}
 ${card('CDI',cdiT,'',perf(cdiT))}
 ${card('IPCA',ipT,'',perf(ipT))}
 ${card('SELIC',slT,'',perf(slT))}
 ${ifT?card('IFIX',ifT,'',perf(ifT)):''}
 ${ibT?card('IBOV',ibT,'',perf(ibT)):''}
 ${cT&&cdiT?card('Alfa vs CDI',cT-cdiT,'Carteira − CDI',perf(cT-cdiT)):''}
 ${ifT&&cT?card('Alfa vs IFIX',cT-ifT,'Carteira − IFIX',perf(cT-ifT)):''}
 </div>`;
}

export function renderBenchAnnualTable(){
 const wrap=document.getElementById('bench-annual-wrap');if(!wrap) return;
 const visK=['carteira','cdi','ipca','selic','ifix','ibov'].filter(k=>_benchVisible.has(k)&&_benchData[k]?.length>0);
 if(!visK.length){wrap.innerHTML='<div style="padding:20px;text-align:center;color:#6b7a9a;font-size:12px">Nenhuma série visível</div>';return;}
 const ySet=new Set();visK.forEach(k=>_benchData[k].forEach(p=>ySet.add(p.date.split('-')[0])));
 const years=[...ySet].sort((a,b)=>b-a);
 let html=`<div style="overflow-x:auto"><table class="bench-annual-table"><thead><tr><th style="text-align:left">Série</th>${years.map(y=>`<th>${y}</th>`).join('')}</tr></thead><tbody>`;
 visK.forEach(k=>{
 const cor=BENCH_COLORS[k];
 const byDate={};_benchData[k].forEach(p=>{byDate[p.date]=p.ret;});
 html+=`<tr><td style="color:${cor};font-weight:700">${BENCH_LABELS[k]}</td>${years.map(y=>{
 const rets=Object.entries(byDate).filter(([d])=>d.startsWith(y)).map(([,v])=>v);
 const tot=rets.length?rets.reduce((a,r)=>a*(1+r),1)-1:null;
 const c=tot==null?'#f8f9fa':tot>0.05?'#c8e6c9':tot>0.01?'#e8f5e9':tot>0?'#f1f8e9':tot>-0.05?'#ffcdd2':'#ef9a9a';
 const fg=tot==null?'#6b7a9a':Math.abs(tot)>0.08?'#1a3a2a':'#333';
 return`<td style="background:${c};color:${fg}">${tot!=null?bPct(tot,2):'—'}</td>`;
 }).join('')}</tr>`;
 });
 html+='</tbody></table></div>';wrap.innerHTML=html;
}

export function renderBenchHeatmap(){
 const wrap=document.getElementById('bench-heatmap-wrap');if(!wrap) return;
 const visK=['carteira','cdi','ipca','selic','ifix','ibov'].filter(k=>_benchVisible.has(k)&&_benchData[k]?.length>0);
 if(!visK.length){wrap.innerHTML='<div style="padding:20px;text-align:center;color:#6b7a9a;font-size:12px">Nenhuma série visível</div>';return;}
 const ySet=new Set();visK.forEach(k=>_benchData[k].forEach(p=>ySet.add(p.date.split('-')[0])));
 const years=[...ySet].sort();
 const mNames=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
 const hc=v=>{if(v==null)return'#f8f9fa';const p=v*100;return p>3?'#1b5e20':p>1.5?'#388e3c':p>0.3?'#81c784':p>0?'#c8e6c9':p>-0.3?'#ffcdd2':p>-1.5?'#e57373':p>-3?'#c62828':'#7f0000';};
 const tc=v=>{if(v==null)return'#6b7a9a';return Math.abs(v*100)>1.5?'#fff':'#333';};
 let html=`<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:10px;min-width:600px"><thead><tr><th style="padding:6px 10px;text-align:left;background:var(--apex-navy);color:#fff;white-space:nowrap">Série</th>${mNames.map(m=>`<th style="padding:6px 8px;text-align:center;background:var(--apex-navy);color:#fff">${m}</th>`).join('')}<th style="padding:6px 10px;text-align:center;background:var(--apex-navy);color:#fff">Ano</th></tr></thead><tbody>`;
 years.forEach((year,yi)=>{
 if(yi>0) html+=`<tr><td colspan="14" style="height:3px;background:#e0e8f4;padding:0"></td></tr>`;
 visK.forEach(k=>{
 const cor=BENCH_COLORS[k];
 const byDate={};_benchData[k].forEach(p=>{byDate[p.date]=p.ret;});
 let yc=1;
 html+=`<tr><td style="padding:5px 10px;font-weight:700;color:${cor};white-space:nowrap;background:${yi%2?'#f8faff':'#fff'}">${BENCH_LABELS[k]} ${year}</td>`;
 [1,2,3,4,5,6,7,8,9,10,11,12].forEach(mo=>{
 const d=`${year}-${String(mo).padStart(2,'0')}`;
 const v=byDate[d];if(v!==undefined) yc*=(1+v);
 html+=`<td class="hm-cell" style="background:${hc(v)};color:${tc(v)}">${bPctAbs(v,2)}</td>`;
 });
 const yr=yc-1;
 html+=`<td class="hm-cell" style="background:${hc(yr)};color:${tc(yr)};font-weight:700">${bPct(yr,2)}</td></tr>`;
 });
 });
 html+='</tbody></table></div>';wrap.innerHTML=html;
}

export function renderBenchStats(){
 const wrap=document.getElementById('bench-stats-wrap');if(!wrap) return;
 const cdi=_benchData.cdi||[];
 const visK=['carteira','ifix','ibov','cdi','ipca','selic'].filter(k=>_benchVisible.has(k)&&_benchData[k]?.length>1);
 if(!visK.length){wrap.innerHTML='<div style="padding:20px;text-align:center;color:#6b7a9a;font-size:12px">Nenhuma série com dados suficientes</div>';return;}
 const metrics=[
 {key:'totalRet',label:'Retorno Total',fmt:v=>bPct(v,2)},
 {key:'annRet',label:'Retorno Anualizado',fmt:v=>bPct(v,2)},
 {key:'annVol',label:'Volatilidade (anual.)',fmt:v=>bPctAbs(v,2)},
 {key:'sharpe',label:'Sharpe Ratio',fmt:v=>v?.toFixed(2)||'—'},
 {key:'alpha',label:'Alfa vs CDI',fmt:v=>bPct(v,2)},
 {key:'maxDD',label:'Drawdown Máximo',fmt:v=>v!=null?'-'+bPctAbs(v,2):'—'},
 ];
 const statsMap={};visK.forEach(k=>{statsMap[k]=calcBenchStats(_benchData[k],cdi);});
 const perf=v=>v>0?'var(--success)':v<0?'var(--danger)':'inherit';
 let html=`<div style="overflow-x:auto"><table class="bench-stats-table"><thead><tr><th style="text-align:left">Métrica</th>${visK.map(k=>`<th style="color:${BENCH_COLORS[k]||'#fff'};text-align:center">${BENCH_LABELS[k]||k}</th>`).join('')}</tr></thead><tbody>`;
 metrics.forEach(m=>{
 html+=`<tr><td>${m.label}</td>`;
 visK.forEach(k=>{
 const s=statsMap[k];const v=s?.[m.key];
 const col=['totalRet','annRet','alpha'].includes(m.key)&&v!=null?perf(v):'inherit';
 const neg=m.key==='maxDD'&&v>0?'var(--danger)':'inherit';
 html+=`<td style="color:${neg!=='inherit'?neg:col}">${s?m.fmt(v):'—'}</td>`;
 });
 html+='</tr>';
 });
 html+='</tbody></table></div>';wrap.innerHTML=html;
}

window.initBenchmarks = initBenchmarks;
window.maskMMAAAA = maskMMAAAA;
window.parseMMAAAA = parseMMAAAA;
window.toMMAAAA = toMMAAAA;
window.updatePeriodLabel = updatePeriodLabel;
window.applyPeriodShortcut = applyPeriodShortcut;
window.applyManualPeriod = applyManualPeriod;
window.updateBenchmarkPeriod = updateBenchmarkPeriod;
window.fetchBCBSeries = fetchBCBSeries;
window.sdToISO = sdToISO;
window.setBenchGranularity = setBenchGranularity;
window.applyGranularityToBenchData = applyGranularityToBenchData;
window.calcPortfolioMonthlyReturns = calcPortfolioMonthlyReturns;
window.loadAllBenchmarkData = loadAllBenchmarkData;
window.setBenchLoading = setBenchLoading;
window.renderAllBenchmarks = renderAllBenchmarks;
window.renderBenchDataStatus = renderBenchDataStatus;
window.renderBenchToggles = renderBenchToggles;
window.toggleBenchSeries = toggleBenchSeries;
window.calcCumulative = calcCumulative;
window.calcBenchStats = calcBenchStats;
window.bPct = bPct;
window.bPctAbs = bPctAbs;
window.renderBenchChart = renderBenchChart;
window.renderBenchKPIs = renderBenchKPIs;
window.renderBenchAnnualTable = renderBenchAnnualTable;
window.renderBenchHeatmap = renderBenchHeatmap;
window.renderBenchStats = renderBenchStats;
window.BENCH_COLORS = BENCH_COLORS;
window.BENCH_LABELS = BENCH_LABELS;
window.BCB_SERIES_IDS = BCB_SERIES_IDS;
window.YF_INDEX_MAP = YF_INDEX_MAP;
window._benchData = _benchData;
window._benchFundData = _benchFundData;
window._benchDataStatus = _benchDataStatus;
window._benchPeriodStart = _benchPeriodStart;
window._benchPeriodEnd = _benchPeriodEnd;
window._benchVisible = _benchVisible;
window._benchLoaded = _benchLoaded;
window._benchGranularity = _benchGranularity;
window._returnEngine = _returnEngine;
