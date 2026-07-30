'use strict';

// ══════════════════════════════════════════════════════════════
// RANKING — Estabilidade e Score de Análise (Fase 4 da modularização)
// ══════════════════════════════════════════════════════════════
// Depende de globais ainda no script legado (analyses, _currentFundos,
// _currentSemana, getDB, sdToISO, exportarPDF, openForum,
// confirmarExcluirAnalise) e dos módulos já extraídos (ELIGIBLE_FUNDS,
// SEG_COLORS/SEG_BG, fmtPercentOrDash) — todos acessíveis via window.
//
// window._rankingCache é a única fonte da verdade do cache (ver
// js/data-store.js) — este módulo só lê/reatribui a propriedade em
// window, nunca declara uma variável de módulo própria para ela.

export function renderScoreRanking(){
 const cont=document.getElementById('score-ranking-content');if(!cont)return;
 const fin=Object.values(analyses).filter(a=>a.finalizado).sort((a,b)=>b.scoreTotal-a.scoreTotal);
 if(!fin.length){cont.innerHTML='<div style="text-align:center;padding:60px 20px;color:#6b7a9a"><div style="font-size:40px;margin-bottom:12px"></div><div style="font-size:16px;font-weight:700;color:var(--apex-navy);margin-bottom:6px">Nenhuma análise finalizada ainda</div><p style="font-size:12px">Acesse a aba <strong>Análise</strong> para iniciar.</p></div>';return;}
 const rows=fin.map((a,i)=>{
 const badge=i===0?'1.':i===1?'2.':i===2?'3.':`<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;font-size:10px;font-weight:700;background:var(--apex-mist);color:var(--apex-navy)">${i+1}</span>`;
 const col=a.scoreTotal>=7?'var(--success)':a.scoreTotal>=5?'var(--warning)':'var(--danger)';
 return`<tr>
 <td>${badge}</td>
 <td><strong style="color:var(--apex-blue)">${a.ticker}</strong></td>
 <td style="max-width:200px;white-space:normal">${a.nome}</td>
 <td style="font-size:16px;font-weight:800;color:${col};text-align:center">${a.scoreTotal?.toFixed(1)||'—'}</td>
 <td style="text-align:center">${a.scoreQuali?.toFixed(1)||'—'}</td>
 <td style="text-align:center">${a.scoreQuanti?.toFixed(1)||'—'}</td>
 <td style="font-size:11px">${a.analista}</td>
 <td style="font-size:11px;color:#6b7a9a">${a.data}</td>
 <td><div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">
 <button onclick="exportarPDF('${a.ticker}')"
 style="padding:5px 11px;background:var(--apex-navy);color:#fff;border:none;border-radius:5px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Manrope',sans-serif;white-space:nowrap">PDF</button>
 <button class="btn-forum" data-forum-ticker="${a.ticker}" onclick="openForum('${a.ticker}')" style="padding:5px 10px;line-height:1.4">Fórum</button>
 <button class="btn-excluir" onclick="confirmarExcluirAnalise('${a.ticker}')" title="Excluir análise" style="padding:5px 10px;line-height:1.4">Excluir</button>
 </div></td>
 </tr>`;
 }).join('');
 cont.innerHTML=`<div class="tbl-wrap"><table><thead><tr><th>#</th><th>Ticker</th><th>Nome</th><th>Score</th><th>Quali</th><th>Quanti</th><th>Analista</th><th>Data</th><th>Ações</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

export async function renderRankingEstabilidade(){
  const tbody = document.getElementById('tbl-rank-body');
  if(!tbody) return;
  // Cache inválido se a semana atual mudou desde a última construção
  const semanaAtual = _currentSemana?.num_semana||0;
  if(_rankingCache && _rankingCache.semanaRef === semanaAtual && semanaAtual > 0){
    _renderRankingRows(_rankingCache);
    return;
  }
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:#6b7a9a">Calculando ranking a partir do histórico...</td></tr>';
  const db = getDB();
  if(!db){
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--danger)">Supabase não disponível</td></tr>';
    return;
  }
  try{
    // Buscar todo o histórico de elegibilidade por ticker e semana
    const{data:rows,error}=await db.from('fund_data')
      .select('ticker,semana_data,elegivel')
      .order('semana_data',{ascending:true});
    if(error) throw new Error(error.message);

    // Total de semanas no histórico
    const totalSems = _currentSemana?.num_semana ||
      [...new Set(rows.map(r=>r.semana_data))].length;

    // Agrupar por ticker
    const byTicker = {};
    rows.forEach(r=>{
      if(!byTicker[r.ticker]) byTicker[r.ticker]=[];
      byTicker[r.ticker].push(r);
    });

    // Calcular métricas para cada fundo
    const ranking = Object.entries(byTicker)
      .map(([ticker,semanas])=>{
        // Ordenar semanas cronologicamente usando sdToISO
        const sorted = semanas.sort((a,b)=>sdToISO(a.semana_data).localeCompare(sdToISO(b.semana_data)));
        const totalFund = sorted.length;
        const elegiveis = sorted.filter(s=>s.elegivel).length;
        const consistencia = totalFund>0?(elegiveis/totalFund*100):0;

        // Calcular consecutivas (streak atual da semana mais recente)
        let consecutivas = 0;
        for(let i=sorted.length-1;i>=0;i--){
          if(sorted[i].elegivel) consecutivas++;
          else break;
        }

        // Dados atuais do fundo
        const fundAtual = _currentFundos.find(f=>f.ticker===ticker);
        const fundInfo  = ELIGIBLE_FUNDS.find(f=>f.ticker===ticker)||{};

        return{
          ticker,
          nome:fundInfo.nome||ticker,
          seg:fundInfo.seg||fundAtual?.segmento||'—',
          elegiveis,
          total:totalFund,
          consecutivas,
          consistencia,
          dyAtual:fundAtual?.dy_anual||null,
          elegivel:fundAtual?.elegivel||false
        };
      })
      .filter(f=>f.elegiveis>0) // só quem foi elegível ao menos uma vez
      .sort((a,b)=>b.consecutivas-a.consecutivas||b.consistencia-a.consistencia);

    _rankingCache = {ranking, totalSems, semanaRef: _currentSemana?.num_semana||0};
    _renderRankingRows({ranking, totalSems});

    // Atualizar KPIs
    const s = id=>document.getElementById(id);
    const consistentes100 = ranking.filter(f=>f.elegiveis===f.total).length;
    if(s('kpi-s-consistentes'))       s('kpi-s-consistentes').textContent = consistentes100;
    if(s('kpi-s-consistentes-sub'))   s('kpi-s-consistentes-sub').textContent = `Elegíveis em todas as ${totalSems} semanas`;
    if(s('kpi-s-ja-elegiveis'))       s('kpi-s-ja-elegiveis').textContent = ranking.length;
    if(s('kpi-s-semanas'))            s('kpi-s-semanas').textContent = totalSems;

  }catch(e){
    console.error('[renderRankingEstabilidade]',e);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--danger)">Erro: ${e.message}</td></tr>`;
  }
}

export function _renderRankingRows({ranking, totalSems}){
  const tbody = document.getElementById('tbl-rank-body');
  if(!tbody) return;
  const tbody2 = ranking.map((f,i)=>{
    const badge = i===0?'1.':i===1?'2.':i===2?'3.':`<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;font-size:9px;font-weight:700;background:var(--apex-mist);color:var(--apex-navy)">${i+1}</span>`;
    const cor = f.consistencia>=100?'var(--success)':f.consistencia>=80?'var(--warning)':'var(--danger)';
    const corBar = f.consistencia>=100?'var(--success)':f.consistencia>=80?'var(--warning)':'var(--danger)';
    const segBg = SEG_BG[f.seg]||'#eee', segC = SEG_COLORS[f.seg]||'#555';
    const dyStr = fmtPercentOrDash(f.dyAtual,2);
    const dyCor = f.dyAtual!=null&&f.dyAtual>=0.10?'var(--success)':'var(--apex-navy)';
    return`<tr>
      <td>${badge}</td>
      <td><strong style="color:var(--apex-blue)">${f.ticker}</strong></td>
      <td style="max-width:200px;white-space:normal;font-size:11px">${f.nome}</td>
      <td><span style="background:${segBg};color:${segC};padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700">${f.seg}</span></td>
      <td style="text-align:center;font-weight:700">${f.elegiveis}/${totalSems}</td>
      <td style="text-align:center;font-weight:700;color:${cor}">${f.consecutivas}</td>
      <td><div style="display:flex;align-items:center;gap:6px">
        <span style="font-weight:700;color:${cor};min-width:42px">${f.consistencia.toFixed(1)}%</span>
        <div style="width:60px;height:5px;background:var(--apex-mist);border-radius:3px;overflow:hidden">
          <div style="width:${f.consistencia.toFixed(1)}%;height:5px;background:${corBar};border-radius:3px"></div>
        </div>
      </div></td>
      <td style="color:${dyCor};font-weight:700">${dyStr}</td>
    </tr>`;
  }).join('');
  tbody.innerHTML = tbody2||'<tr><td colspan="8" style="text-align:center;padding:24px;color:#6b7a9a">Nenhum dado disponível</td></tr>';
}

window.renderScoreRanking = renderScoreRanking;
window.renderRankingEstabilidade = renderRankingEstabilidade;
window._renderRankingRows = _renderRankingRows;
