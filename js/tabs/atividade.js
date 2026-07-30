'use strict';

// ══════════════════════════════════════════════════════════════
// ATIVIDADE — Feed de movimentações (Fase 4 da modularização)
// ══════════════════════════════════════════════════════════════
// Depende de globais ainda definidos no script legado do index.html
// (analyses, PRE_ANALISE, _forumPostsGlobal, exportarPDF, openAnalise) —
// seguem acessíveis via window até essas partes também virarem módulo.

export function buildAtividadeItems(apenasEstaSemana=false){
 const items=[];
 // Calcular intervalo da semana atual (seg-dom)
 const hoje=new Date();
 const diaSemana=hoje.getDay();
 const seg=new Date(hoje);seg.setDate(hoje.getDate()-(diaSemana===0?6:diaSemana-1));seg.setHours(0,0,0,0);
 const dom=new Date(seg);dom.setDate(seg.getDate()+6);dom.setHours(23,59,59,999);
 const dentroDaSemana=(ts)=>!apenasEstaSemana||(ts>=seg.getTime()&&ts<=dom.getTime());

 // 1. Análises finalizadas
 Object.values(analyses).forEach(a=>{
 if(!a.finalizado) return;
 const ts=parseDateBR(a.data);
 if(!dentroDaSemana(ts)) return;
 items.push({tipo:'analise',ticker:a.ticker,nome:a.nome||'',seg:a.seg||'',
 analista:a.analista||'—',data:a.data||'—',
 scoreTotal:a.scoreTotal,scoreQuali:a.scoreQuali,scoreQuanti:a.scoreQuanti,ts});
 });

 // 2. Pré-análises
 PRE_ANALISE.forEach(p=>{
 if(!p.data_rev)return;
 const ts=parseDateBR(p.data_rev);
 if(!dentroDaSemana(ts))return;
 items.push({tipo:p.status==='Reprovado'?'pre-reprov':'pre-monit',
 ticker:p.ticker,nome:p.nome||'',seg:p.segmento||'',
 analista:p.analista||'—',data:p.data_rev,
 obs:p.obs||'',det:p.det||'',status:p.status,ts});
 });

 // 3. Comentários e postagens do fórum (do cache _forumPostsGlobal)
 (_forumPostsGlobal||[]).forEach(p=>{
 const ts=new Date(p.created_at||0).getTime();
 if(!dentroDaSemana(ts))return;
 items.push({tipo:'forum-'+p.tipo,ticker:p.ticker,
 nome:analyses[p.ticker]?.nome||p.ticker,seg:analyses[p.ticker]?.seg||'',
 analista:p.autor,data:p.data_comentario||'',
 texto:p.texto,temResposta:!!p.resposta,ts});
 });

 items.sort((a,b)=>(b.ts||0)-(a.ts||0));
 return items;
}

export function parseDateBR(str){
 if(!str) return 0;
 // DD/MM/AAAA
 const p=str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
 if(p) return new Date(p[3],p[2]-1,p[1]).getTime();
 return new Date(str).getTime()||0;
}

export function renderAtividade(){
 const tipoF =document.getElementById('atv-tipo-filter')?.value||'';
 const analistaF=document.getElementById('atv-analista-filter')?.value||'';
 const segF =document.getElementById('atv-seg-filter')?.value||'';

 let items=buildAtividadeItems(false); // aba completa — sem filtro de semana

 // Filtros
 if(tipoF) items=items.filter(i=>i.tipo===tipoF||(tipoF==='pre'&&i.tipo.startsWith('pre')));
 if(analistaF) items=items.filter(i=>i.analista===analistaF);
 if(segF) items=items.filter(i=>i.seg===segF);

 const countEl=document.getElementById('atv-count');
 if(countEl) countEl.textContent=items.length+' movimentações';

 // Sumário
 const nAnalise=items.filter(i=>i.tipo==='analise').length;
 const nPre =items.filter(i=>i.tipo.startsWith('pre')).length;
 const analistas=[...new Set(items.map(i=>i.analista).filter(Boolean))];
 const summaryEl=document.getElementById('atv-summary');
 if(summaryEl) summaryEl.innerHTML=`
 <div class="kpi" style="border-top-color:var(--apex-blue)">
 <div class="kpi-lbl">Análises</div>
 <div class="kpi-val">${nAnalise}</div>
 <div class="kpi-sub">fundos analisados</div>
 </div>
 <div class="kpi" style="border-top-color:var(--danger)">
 <div class="kpi-lbl">Pré-Análises</div>
 <div class="kpi-val">${nPre}</div>
 <div class="kpi-sub">histórico registrado</div>
 </div>
 <div class="kpi" style="border-top-color:var(--success)">
 <div class="kpi-lbl">Analistas Ativos</div>
 <div class="kpi-val">${analistas.length}</div>
 <div class="kpi-sub">${analistas.join(', ')||'—'}</div>
 </div>`;

 const tlEl=document.getElementById('atv-timeline');
 if(!tlEl) return;

 if(items.length===0){
 tlEl.innerHTML=`<div class="atv-empty">
 <div class="atv-empty-icon"></div>
 <div style="font-size:15px;font-weight:700;color:var(--apex-navy);margin-bottom:6px">Nenhuma atividade encontrada</div>
 <p style="font-size:12px">Finalize análises ou registre pré-análises para ver o histórico aqui.</p>
 </div>`;
 return;
 }

 // Agrupar por mês/ano
 const grupos={};
 items.forEach(item=>{
 const d=item.data||'Sem data';
 const key=d.length>=10?d.substring(3):'Sem data'; // MM/AAAA
 if(!grupos[key]) grupos[key]=[];
 grupos[key].push(item);
 });

 let html='';
 Object.entries(grupos).forEach(([periodo,gr])=>{
 // Formatar título do período
 let tituloGrupo=periodo;
 const mp=periodo.match(/(\d{2})\/(\d{4})/);
 if(mp){
 const meses=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
 tituloGrupo=meses[parseInt(mp[1])-1]+' '+mp[2];
 }
 html+=`<div class="atv-date-divider">${tituloGrupo} <span style="font-weight:400;color:#6b7a9a">(${gr.length})</span></div>`;
 gr.forEach(item=>{
 html+=renderAtvItem(item);
 });
 });

 tlEl.innerHTML=html;
}

export function renderAtvItem(item){
 const isAnalise=item.tipo==='analise';
 const isPre=item.tipo.startsWith('pre');
 const isReprov=item.tipo==='pre-reprov';
 const isMonit=item.tipo==='pre-monit';

 const iconMap={
 'analise':'✦','pre-reprov':'●','pre-monit':'●','revisao':'↺'
 };
 const iconClass={
 'analise':'analise','pre-reprov':'pre-reprov','pre-monit':'pre-monit','revisao':'revisao'
 };
 const badgeClass={
 'analise':'atv-tipo-analise','pre-reprov':'atv-tipo-pre-reprov',
 'pre-monit':'atv-tipo-pre-monit','revisao':'atv-tipo-revisao'
 };
 const tipoLabel={
 'analise':'Análise finalizada','pre-reprov':'⚠ Pré-análise · Reprovado',
 'pre-monit':'⚠ Pré-análise · Monitorar','revisao':'↺ Análise revisada',
 'forum-comentario':'Fórum · Comentário','forum-questionamento':' Fórum · Questionamento',
 'forum-aprovacao':'✓ Fórum · Aprovação','forum-discordancia':'⚠ Fórum · Discordância'
 };

 // Score pill para análises
 let scorePill='';
 if(isAnalise&&item.scoreTotal!=null){
 const col=item.scoreTotal>=7?'var(--success)':item.scoreTotal>=5?'var(--warning)':'var(--danger)';
 const bg=item.scoreTotal>=7?'var(--success-bg)':item.scoreTotal>=5?'var(--warning-bg)':'var(--danger-bg)';
 scorePill=`<span class="atv-score-pill" style="background:${bg};color:${col}">Score ${item.scoreTotal.toFixed(1)}/10</span>`;
 }

 const segChipHtml=item.seg?`<span class="seg-chip" style="font-size:9px;padding:1px 7px;background:var(--apex-mist);color:var(--apex-navy)">${item.seg}</span>`:'';

 // Descrição expandida
 let descExtra='';
 if(isPre&&item.det){
 const short=item.det.substring(0,160)+(item.det.length>160?'…':'');
 descExtra=`<div class="atv-desc" style="margin-top:4px;font-style:italic">"${short}"</div>`;
 }
 if(isAnalise){
 descExtra=`<div class="atv-desc">Quali: <strong>${item.scoreQuali?.toFixed(1)||'—'}</strong> · Quanti: <strong>${item.scoreQuanti?.toFixed(1)||'—'}</strong></div>`;
 }
 if(item.tipo?.startsWith('forum-')){
 descExtra=`<div class="atv-desc" style="font-style:italic">"${(item.texto||'').substring(0,120)}${(item.texto||'').length>120?'…':''}"</div>
 ${item.tipo==='forum-questionamento'&&!item.temResposta?'<div style="font-size:10px;color:var(--warning);font-weight:600;margin-top:3px">⏳ Aguardando resposta</div>':''}
 ${item.tipo==='forum-questionamento'&&item.temResposta?'<div style="font-size:10px;color:var(--success);font-weight:600;margin-top:3px">✓ Respondido</div>':''}`;
 }

 // Botão PDF se for análise finalizada
 const pdfBtn=isAnalise?`<button onclick="exportarPDF('${item.ticker}')"
 style="padding:5px 11px;background:var(--apex-navy);color:#fff;border:none;border-radius:5px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Manrope',sans-serif;margin-left:auto">PDF</button>`:'';

 return`<div class="atv-timeline-item">
 <div class="atv-icon ${iconClass[item.tipo]||'analise'}">${iconMap[item.tipo]||'◉'}</div>
 <div class="atv-body">
 <div class="atv-header">
 <span class="atv-ticker">${item.ticker}</span>
 <span class="atv-nome">${item.nome}</span>
 ${segChipHtml}
 <span class="atv-tipo-badge ${badgeClass[item.tipo]||''}">${tipoLabel[item.tipo]||item.tipo}</span>
 ${scorePill}
 ${pdfBtn}
 </div>
 ${descExtra}
 <div class="atv-meta">
 <div class="atv-meta-item"> <strong>${item.analista}</strong></div>
 <div class="atv-meta-item"> <strong>${item.data}</strong></div>
 ${isAnalise?`<button onclick="openAnalise('${item.ticker}')" style="font-size:9px;color:var(--apex-blue);background:none;border:none;cursor:pointer;font-family:'Manrope',sans-serif;font-weight:700;padding:0;text-decoration:underline">Ver análise</button>`:''}
 </div>
 </div>
 </div>`;
}

export function renderAtvVisaoGeral(){
 const el=document.getElementById('atv-visao-content');
 if(!el) return;

 const items=buildAtividadeItems(true).slice(0,8); // apenas esta semana, máx 8

 if(items.length===0){
 el.innerHTML='<div style="color:#6b7a9a;font-size:12px;text-align:center;padding:16px">Nenhuma atividade registrada ainda.</div>';
 return;
 }

 el.innerHTML=items.map(item=>{
 const isAnalise=item.tipo==='analise';
 const isReprov=item.tipo==='pre-reprov';
 const isMonit=item.tipo==='pre-monit';

 const iconMap={'analise':'✦','pre-reprov':'●','pre-monit':'●','revisao':'↺','forum-comentario':'','forum-questionamento':'','forum-aprovacao':'✓','forum-discordancia':'⚠'};
 const tipoLabel={'analise':'Análise finalizada','pre-reprov':'Pré-análise · Reprovado','pre-monit':'Pré-análise · Monitorar','revisao':'Análise revisada'};
 const tipoColor={'analise':'var(--apex-blue)','pre-reprov':'var(--danger)','pre-monit':'var(--warning)','revisao':'#a06800'};
 const tipoBg={'analise':'var(--apex-blue-lt)','pre-reprov':'var(--danger-bg)','pre-monit':'var(--warning-bg)','revisao':'#fffff0'};

 let scorePill='';
 if(isAnalise&&item.scoreTotal!=null){
 const col=item.scoreTotal>=7?'var(--success)':item.scoreTotal>=5?'var(--warning)':'var(--danger)';
 const bg=item.scoreTotal>=7?'var(--success-bg)':item.scoreTotal>=5?'var(--warning-bg)':'var(--danger-bg)';
 scorePill=`<span style="display:inline-flex;align-items:center;padding:1px 8px;border-radius:10px;font-size:9px;font-weight:700;background:${bg};color:${col}">Score ${item.scoreTotal.toFixed(1)}</span>`;
 }

 return`<div class="mov-item" style="padding:8px 0;align-items:flex-start;gap:10px;border-bottom:1px solid #f0f4fa">
 <div style="width:28px;height:28px;border-radius:50%;background:${tipoBg[item.tipo]||'#f0f0f0'};display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;margin-top:1px;border:1px solid ${tipoColor[item.tipo]||'#ccc'}">
 ${iconMap[item.tipo]||'◉'}
 </div>
 <div style="flex:1;min-width:0">
 <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:2px">
 <strong style="font-size:12px;color:var(--apex-navy)">${item.ticker}</strong>
 ${scorePill}
 <span style="font-size:9px;font-weight:700;padding:1px 7px;border-radius:4px;background:${tipoBg[item.tipo]||'#f0f0f0'};color:${tipoColor[item.tipo]||'#444'}">${tipoLabel[item.tipo]||item.tipo}</span>
 </div>
 <div style="font-size:10px;color:#6b7a9a">
 ${item.seg?`<span style="margin-right:6px">${item.seg}</span>`:''}
 ${item.analista} · ${item.data}
 </div>
 </div>
 ${isAnalise?`<button onclick="exportarPDF('${item.ticker}')" style="padding:5px 11px;background:var(--apex-navy);color:#fff;border:none;border-radius:5px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Manrope',sans-serif;flex-shrink:0">PDF</button>`:''}
 </div>`;
 }).join('');
}

window.buildAtividadeItems = buildAtividadeItems;
window.parseDateBR = parseDateBR;
window.renderAtividade = renderAtividade;
window.renderAtvItem = renderAtvItem;
window.renderAtvVisaoGeral = renderAtvVisaoGeral;
