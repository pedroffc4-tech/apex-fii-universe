'use strict';

// ══════════════════════════════════════════════════════════════
// ADMINISTRAÇÃO — Upload/validação do BTG Guide, gestão de semanas
// (Fase 4 da modularização — última aba, revisada com o Pedro antes
// de mexer por ser o fluxo real de gravação semanal)
// ══════════════════════════════════════════════════════════════
// Depende de globais ainda no script legado/outros módulos (getDB,
// toast, CRIT_VOL/CRIT_YIELD/CRIT_PVP/CRIT_MKT, _currentFundos/
// _currentSemana, invalidateRankingCache, renderSegmentos,
// renderScoreRanking, injectAnalyseTags, updateKpiRow, renderAtvVisaoGeral,
// carregarForumGlobal, openConfirmModal, sdToISO) — acessíveis via window.
//
// adminFundos/adminSemanaData/adminSemanaNum/_adminRawFile são 100%
// privados desta aba (nenhum outro lugar do index.html ou dos módulos
// já extraídos os referencia — confirmado com grep antes da extração).

export let adminFundos=[], adminSemanaData='', adminSemanaNum=0;
export let _adminRawFile=null; // File object original do BTG Guide, guardado para upload no Storage

// ── Carregar e processar Excel ────────────────────────────────
// ── Validação do BTG FII Guide ──────────────────────────────
export function validarBTGGuide(wb){
 const erros=[];

 // 1. Verificar se a aba "Stock Guide" existe
 if(!wb.SheetNames.includes('Stock Guide')){
 erros.push('Aba "Stock Guide" não encontrada. Abas disponíveis: '+wb.SheetNames.slice(0,5).join(', ')+'...');
 return {valido:false, erros};
 }

 const ws=wb.Sheets['Stock Guide'];
 const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:true});

 // 2. Verificar se tem linhas suficientes (mínimo de 10 linhas de dados)
 if(rows.length<10){
 erros.push('Planilha com muito poucas linhas ('+rows.length+'). O BTG FII Guide deve ter pelo menos 200 fundos.');
 return {valido:false, erros};
 }

 // 3. Verificar estrutura da linha de cabeçalho (linha 4, índice 4)
 const header=rows[4]||[];
 // Colunas esperadas nas posições corretas
 const estruturaEsperada=[
 {col:1, nome:'Ticker/Código', matches:['Código','Ticker','código']},
 {col:3, nome:'Nome do Fundo', matches:['Nome','nome']},
 {col:6, nome:'Segmento', matches:['Segmento','segmento']},
 {col:8, nome:'Volume (col 8)',matches:['Média','Media','média','média - 3','volume']},
 {col:12, nome:'Valor de Mercado (col 12)', matches:['Valor de Mercado','mercado','Market']},
 {col:14, nome:'P/VPA (col 14)',matches:['P/VPA','P/VP','pvp','pvpa']},
 {col:17, nome:'DY Anualizado (col 17)', matches:['DY','Dividend','dividend','anualiz']},
 ];
 const colsFaltando=[];
 estruturaEsperada.forEach(e=>{
 const val=String(header[e.col]||'').toLowerCase();
 const encontrou=e.matches.some(m=>val.includes(m.toLowerCase()));
 if(!encontrou) colsFaltando.push(e.nome+' (col '+e.col+')');
 });

 if(colsFaltando.length>3){
 // Só bloqueia se mais de 3 colunas críticas estiverem fora do lugar
 // (tolerância para variações menores de versão do BTG Guide)
 erros.push('Estrutura de colunas fora do padrão. Colunas não reconhecidas: '+colsFaltando.join(', '));
 erros.push('Verifique se o arquivo é o BTG FII Guide (aba Stock Guide) na versão correta.');
 }

 // 4. Verificar se há pelo menos 50 tickers válidos nos dados
 const tickersValidos=rows.slice(5).filter(r=>{
 const t=String(r[1]||'').trim();
 return /^[A-Z]{4}[0-9]{2}$/.test(t);
 }).length;

 if(tickersValidos<50){
 erros.push('Apenas '+tickersValidos+' tickers válidos encontrados. O BTG FII Guide deve conter pelo menos 200 fundos.');
 }

 return {valido:erros.length===0, erros, tickersValidos};
}

export function mostrarErroValidacao(erros){
 const box=document.getElementById('admin-upload-box');
 const preview=document.getElementById('admin-preview');
 if(box){
 box.style.background='var(--danger-bg)';
 box.style.borderColor='var(--danger)';
 box.querySelector('div:nth-child(2)').textContent='✗ Arquivo inválido — não é o BTG FII Guide';
 }
 if(preview){
 preview.style.display='block';
 preview.innerHTML=`
 <div style="background:var(--danger-bg);border:1.5px solid #f5c6c6;border-radius:10px;padding:16px 18px">
 <div style="font-size:13px;font-weight:800;color:var(--danger);margin-bottom:10px">
 ✗ Arquivo não reconhecido como BTG FII Guide
 </div>
 <div style="font-size:11px;color:#7a1f1f;margin-bottom:10px">
 Os seguintes problemas foram encontrados:
 </div>
 <ul style="font-size:11px;color:#7a1f1f;padding-left:18px;line-height:1.8">
 ${erros.map(e=>`<li>${e}</li>`).join('')}
 </ul>
 <div style="margin-top:12px;font-size:11px;color:#5a6e8a;background:#fff;border-radius:6px;padding:10px 12px">
 <strong>Como resolver:</strong>Acesse o BTG Pactual → FII Guide → exporte a planilha completa 
 sem modificações e tente novamente.
 </div>
 </div>`;
 }
 // Garantir que o botão de confirmar fique bloqueado
 const btnConfirm=document.getElementById('admin-btn-confirm');
 if(btnConfirm) btnConfirm.style.display='none';
 document.getElementById('admin-btn-wrap').style.display='flex';
 // Esconder botão de confirmar, mostrar só cancelar
 document.getElementById('admin-btn-wrap').innerHTML=`
 <button onclick="adminReset()"
 style="padding:10px 24px;background:var(--danger);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Manrope',sans-serif">
 ✕ Remover arquivo e tentar novamente
 </button>`;
}

/**
 * Handler do upload do BTG FII Guide (.xlsx). Lê a aba 'Stock Guide' com
 * SheetJS, valida o arquivo, aplica os 4 critérios de elegibilidade e monta o
 * preview da semana (sem salvar — o salvamento ocorre em adminConfirmar).
 * @param {HTMLInputElement} input Campo de arquivo que disparou o evento.
 * @returns {Promise<void>}
 */
export async function onBTGUpload(input){
 const file=input.files[0];
 if(!file)return;
 _adminRawFile=file; // guardar para upload no Storage em adminConfirmar
 const box=document.getElementById('admin-upload-box');
 box.style.background='var(--apex-blue-lt)';
 box.style.borderColor='var(--apex-blue)';
 box.querySelector('div:nth-child(2)').textContent='⟳ Validando arquivo...';

 const data=await file.arrayBuffer();
 const wb=XLSX.read(data,{type:'array'});

 // ── VALIDAÇÃO ─────────────────────────────────────────────
 const validacao=validarBTGGuide(wb);
 if(!validacao.valido){
 mostrarErroValidacao(validacao.erros);
 return; // Bloqueia todo o processamento
 }

 // ── Arquivo válido — prosseguir ───────────────────────────
 box.querySelector('div:nth-child(2)').textContent='⟳ Processando '+validacao.tickersValidos+' fundos...';

 const ws=wb.Sheets['Stock Guide'];
 const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:true});

 // Dados começam na linha 5 (índice 5)
 const fundos=[];
 for(let i=5;i<rows.length;i++){
 const r=rows[i];
 const ticker=String(r[1]||'').trim();
 if(!/^[A-Z]{4}[0-9]{2}$/.test(ticker))continue;
 const vol3m =parseFloat(r[8])||0;
 const dyAnual =parseFloat(r[17])||0;
 const pvpAtual=parseFloat(r[14])||0;
 const mktcap =parseFloat(r[12])||0;
 const elegivel=vol3m>CRIT_VOL&&dyAnual>CRIT_YIELD&&pvpAtual<CRIT_PVP&&mktcap>CRIT_MKT;
 fundos.push({
 ticker,nome:String(r[3]||'').trim(),segmento:String(r[6]||'').trim(),
 elegivel,vol3m,fechamento:parseFloat(r[9])||0,mktcap,
 vp:parseFloat(r[13])||0,pvp_atual:pvpAtual,
 dy_anual:dyAnual,dy_ltm:parseFloat(r[16])||0,
 ret_mes:parseFloat(r[20])||0,ret_ano:parseFloat(r[21])||0,ret_ltm:parseFloat(r[22])||0,
 fail_vol:vol3m<=CRIT_VOL,fail_yield:dyAnual<=CRIT_YIELD,
 fail_pvp:pvpAtual>=CRIT_PVP,fail_mktcap:mktcap<=CRIT_MKT
 });
 }

 adminFundos=fundos;
 const nEl=fundos.filter(f=>f.elegivel).length;
 const nNao=fundos.filter(f=>!f.elegivel).length;

 // Calcular movimentações vs semana anterior
 const db=getDB();
 let entraram=[], sairam=[];
 if(db){
 const {data:semAnt}=await db.from('semanas').select('semana_data').order('created_at',{ascending:false}).limit(1);
 if(semAnt&&semAnt.length>0){
 const dataAnt=semAnt[0].semana_data;
 const {data:fdAnt}=await db.from('fund_data').select('ticker,elegivel').eq('semana_data',dataAnt);
 if(fdAnt){
 const antEl=new Set(fdAnt.filter(f=>f.elegivel).map(f=>f.ticker));
 const curEl=new Set(fundos.filter(f=>f.elegivel).map(f=>f.ticker));
 entraram=[...curEl].filter(t=>!antEl.has(t)).map(t=>{
 const f=fundos.find(x=>x.ticker===t);
 return {ticker:t,segmento:f?.segmento||'—',motivo:`DY ${fmtPercent(f.dy_anual)} · P/VP ${f.pvp_atual.toFixed(4)}x · Vol R$${fmtCurrency(f.vol3m)}`};
 });
 sairam=[...antEl].filter(t=>!curEl.has(t)).map(t=>{
 const f=fundos.find(x=>x.ticker===t);
 if(!f)return{ticker:t,segmento:'—',criterio:'Sem dado',motivo:'Removido do BTG Guide'};
 const crit=f.fail_vol?'Volume':f.fail_yield?'Yield':f.fail_pvp?'P/VP':'MktCap';
 const motivo=f.fail_vol?`Vol caiu para R$${fmtCurrency(f.vol3m)} (min R$400k)`:
 f.fail_yield?`DY caiu para ${fmtPercent(f.dy_anual)} (min 8%)`:
 f.fail_pvp?`P/VP subiu para ${f.pvp_atual.toFixed(4)}x (max 1,15x)`:
 `MktCap caiu para R$${fmtMillions(f.mktcap)} (min R$200M)`;
 return{ticker:t,segmento:f.segmento||'—',criterio:crit,motivo};
 });
 }
 }
 }

 // Pegar data/num do formulário
 adminSemanaData=document.getElementById('admin-data').value.trim();
 adminSemanaNum=parseInt(document.getElementById('admin-num').value)||0;
 if(!adminSemanaData){toast('Preencha a data da semana (DD/MM/AAAA) antes de processar.', 'warning');adminReset();return;}

 // Exibir preview
 const prevEl=document.getElementById('admin-preview');
 prevEl.style.display='block';
 prevEl.innerHTML=`
 <div style="background:var(--apex-blue-lt);border-radius:10px;padding:16px;border:1px solid var(--apex-mist)">
 <div style="font-size:13px;font-weight:700;color:var(--apex-navy);margin-bottom:12px">Prévia — ${adminSemanaData}</div>
 <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:14px">
 <div style="background:#fff;border-radius:8px;padding:12px;text-align:center;border:1px solid var(--apex-mist)">
 <div style="font-size:10px;color:#6b7a9a;text-transform:uppercase;margin-bottom:4px">Total</div>
 <div style="font-size:22px;font-weight:800;color:var(--apex-navy)">${fundos.length}</div>
 </div>
 <div style="background:#fff;border-radius:8px;padding:12px;text-align:center;border:1px solid var(--apex-mist)">
 <div style="font-size:10px;color:#6b7a9a;text-transform:uppercase;margin-bottom:4px">Elegíveis</div>
 <div style="font-size:22px;font-weight:800;color:var(--success)">${nEl}</div>
 </div>
 <div style="background:#fff;border-radius:8px;padding:12px;text-align:center;border:1px solid var(--apex-mist)">
 <div style="font-size:10px;color:#6b7a9a;text-transform:uppercase;margin-bottom:4px">Não Elegíveis</div>
 <div style="font-size:22px;font-weight:800;color:var(--danger)">${nEl>0?fundos.length-nEl:fundos.length}</div>
 </div>
 <div style="background:#fff;border-radius:8px;padding:12px;text-align:center;border:1px solid var(--apex-mist)">
 <div style="font-size:10px;color:#6b7a9a;text-transform:uppercase;margin-bottom:4px">Entraram</div>
 <div style="font-size:22px;font-weight:800;color:var(--success)">${entraram.length}</div>
 </div>
 <div style="background:#fff;border-radius:8px;padding:12px;text-align:center;border:1px solid var(--apex-mist)">
 <div style="font-size:10px;color:#6b7a9a;text-transform:uppercase;margin-bottom:4px">Saíram</div>
 <div style="font-size:22px;font-weight:800;color:var(--danger)">${sairam.length}</div>
 </div>
 </div>
 ${entraram.length>0?`<div style="margin-bottom:8px"><div style="font-size:10px;font-weight:700;background:var(--success-bg);color:#155a34;padding:4px 10px;border-radius:5px;margin-bottom:6px">✓ Entraram (${entraram.length})</div>${entraram.map(e=>`<div style="font-size:11px;padding:4px 0;border-bottom:1px solid #f0f4fa"><strong>${e.ticker}</strong> · ${e.segmento} · <span style="color:#6b7a9a">${e.motivo}</span></div>`).join('')}</div>`:''}
 ${sairam.length>0?`<div><div style="font-size:10px;font-weight:700;background:var(--danger-bg);color:#922b21;padding:4px 10px;border-radius:5px;margin-bottom:6px">✗ Saíram (${sairam.length})</div>${sairam.map(e=>`<div style="font-size:11px;padding:4px 0;border-bottom:1px solid #f0f4fa"><strong>${e.ticker}</strong> · ${e.segmento} · <span style="color:var(--danger);font-size:9px;font-weight:700;padding:1px 5px;background:var(--danger-bg);border-radius:3px">${e.criterio||''}</span> · <span style="color:#6b7a9a">${e.motivo}</span></div>`).join('')}</div>`:''}
 </div>`;

 // Guardar movimentações para salvar
 adminFundos._entraram=entraram;
 adminFundos._sairam=sairam;

 box.style.background='var(--success-bg)';
 box.querySelector('div:nth-child(2)').textContent='✓ '+file.name+' processado';
 document.getElementById('admin-btn-wrap').style.display='flex';
}

// ── Confirmar e salvar no Supabase ────────────────────────────
/**
 * Confirma e salva a semana processada: grava a linha em `semanas` e os fundos
 * em `fund_data` (em lotes), gera o backup JSON e atualiza o dashboard.
 * @returns {Promise<void>}
 */
/**
 * Confirma e salva a semana processada: verifica se já existe arquivo no Storage,
 * pede confirmação de sobrescrita se necessário, faz upload bloqueante para o Storage,
 * grava os dados no Supabase e gera o backup JSON.
 * @param {boolean} [overwriteConfirmado=false] true quando chamado após confirmação de sobrescrita.
 * @returns {Promise<void>}
 */
export async function adminConfirmar(overwriteConfirmado=false){
 const db=getDB();
 if(!db){toast('Supabase não disponível.', 'error');return;}
 const btn=document.getElementById('admin-btn-confirm');
 const storageStatusEl=document.getElementById('admin-storage-status');
 const overwriteWarnEl=document.getElementById('admin-overwrite-warn');

 if(overwriteWarnEl) overwriteWarnEl.style.display='none';
 btn.textContent='Salvando...';btn.disabled=true;

 try{
 // ── 1. Upload para Storage (bloqueante — falha para tudo) ───────
 if(_adminRawFile){
 const dataSemana=adminSemanaData.replace(/\//g,'');
 const nomeArquivo=`BTGGuide_${dataSemana}.xlsx`;

 if(!overwriteConfirmado){
 if(storageStatusEl){
 storageStatusEl.style.display='block';
 storageStatusEl.style.background='var(--apex-blue-lt)';
 storageStatusEl.style.color='var(--apex-blue)';
 storageStatusEl.textContent='⟳ Verificando Storage...';
 }
 const jaExiste=await verificarArquivoStorage(nomeArquivo);
 if(jaExiste){
 const descEl=document.getElementById('admin-overwrite-desc');
 if(descEl) descEl.textContent=
 `Já existe o arquivo "${nomeArquivo}" no Storage referente à semana ${adminSemanaData}. `+
 `Deseja substituí-lo pelo arquivo que você acabou de subir?`;
 if(overwriteWarnEl) overwriteWarnEl.style.display='block';
 if(storageStatusEl) storageStatusEl.style.display='none';
 btn.textContent='✓ Confirmar e Salvar';btn.disabled=false;
 return;
 }
 }

 if(storageStatusEl){
 storageStatusEl.style.display='block';
 storageStatusEl.style.background='var(--apex-blue-lt)';
 storageStatusEl.style.color='var(--apex-blue)';
 storageStatusEl.textContent='⟳ Salvando arquivo no Storage...';
 }
 const {error:stErr}=await db.storage.from('fii-guides').upload(nomeArquivo,_adminRawFile,{
 contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 upsert:overwriteConfirmado
 });
 if(stErr) throw new Error('Erro ao salvar arquivo no Storage: '+stErr.message);

 if(storageStatusEl){
 storageStatusEl.style.background='var(--success-bg)';
 storageStatusEl.style.color='var(--success)';
 storageStatusEl.textContent='✓ Arquivo salvo no Storage';
 }
 console.log('[adminConfirmar] Storage: '+nomeArquivo+' salvo com sucesso');
 }

 // ── 2. Salvar metadados da semana ───────────────────────────────
 btn.textContent='Salvando dados...';
 const nEl=adminFundos.filter(f=>f.elegivel).length;
 const {error:eS}=await db.from('semanas').upsert({
 semana_data:adminSemanaData,
 num_semana:adminSemanaNum,
 n_elegiveis:nEl,
 n_nao_elegiveis:adminFundos.length-nEl,
 n_total:adminFundos.length,
 entraram:JSON.stringify(adminFundos._entraram||[]),
 sairam:JSON.stringify(adminFundos._sairam||[])
 },{onConflict:'semana_data'});
 if(eS) throw new Error('Erro ao salvar semana: '+eS.message);

 // ── 3. Salvar fundos em lotes de 100 ────────────────────────────
 const fundosParaSalvar=adminFundos.map(f=>({...f,semana_data:adminSemanaData}));
 for(let i=0;i<fundosParaSalvar.length;i+=100){
 const lote=fundosParaSalvar.slice(i,i+100);
 const {error:eF}=await db.from('fund_data').upsert(lote,{onConflict:'semana_data,ticker'});
 if(eF) throw new Error('Erro ao salvar fundos: '+eF.message);
 }

 // ── 4. Backup JSON ──────────────────────────────────────────────
 gerarBackupJSON(adminSemanaData, adminSemanaNum, adminFundos);

 toast(`✓ Semana ${adminSemanaData} salva com sucesso!\n${nEl} fundos elegíveis · ${adminFundos.length} total\n\n Backup JSON gerado automaticamente na pasta Downloads.`, 'success');

 // ── 5. Atualizar dashboard ──────────────────────────────────────
 await carregarESemanaAtual();
 await atualizarHeaderSemana();
 adminReset();
 await carregarListaSemanas();

 }catch(e){
 console.error('[adminConfirmar]', e);
 if(storageStatusEl && storageStatusEl.textContent.includes('⟳')){
 storageStatusEl.style.display='none';
 }
 toast('✗ Erro ao salvar: '+e.message, 'error');
 }finally{
 btn.textContent='✓ Confirmar e Salvar';btn.disabled=false;
 }
}

// ── Verificar existência de arquivo no Storage ────────────────
/**
 * Verifica se um arquivo com o nome dado já existe no bucket fii-guides.
 * @param {string} nomeArquivo Ex.: 'BTGGuide_09022026.xlsx'
 * @returns {Promise<boolean>}
 */
export async function verificarArquivoStorage(nomeArquivo){
 const db=getDB();
 if(!db) return false;
 try{
 const {data,error}=await db.storage.from('fii-guides').list('',{search:nomeArquivo});
 if(error||!data) return false;
 return data.some(f=>f.name===nomeArquivo);
 }catch(e){
 console.warn('[verificarArquivoStorage]',e.message);
 return false;
 }
}


// ── Backup JSON automático ───────────────────────────────────
export function gerarBackupJSON(semanaData, numSemana, fundos){
 try{
 // Montar estrutura completa do backup
 const nEl = fundos.filter(f=>f.elegivel).length;
 const nNel = fundos.length - nEl;
 const agora = new Date();
 const geradoEm = agora.toLocaleString('pt-BR',{
 day:'2-digit',month:'2-digit',year:'numeric',
 hour:'2-digit',minute:'2-digit',second:'2-digit'
 });

 const backup = {
 meta: {
 semana: numSemana,
 data: semanaData,
 gerado_em: geradoEm,
 plataforma: 'APEX Partners — FII Universe',
 versao: '2.0'
 },
 resumo: {
 n_total: fundos.length,
 n_elegiveis: nEl,
 n_nao_elegiveis:nNel,
 pct_elegiveis: parseFloat((nEl/fundos.length*100).toFixed(1)),
 entraram: (fundos._entraram||[]).map(m=>({
 ticker: m.ticker,
 segmento: m.segmento,
 motivo: m.motivo
 })),
 sairam: (fundos._sairam||[]).map(m=>({
 ticker: m.ticker,
 segmento: m.segmento,
 criterio: m.criterio||'',
 motivo: m.motivo
 }))
 },
 criterios_elegibilidade: {
 vol_minimo_90d: 400000,
 dy_anual_minimo: 0.08,
 pvp_maximo: 1.15,
 mktcap_minimo: 200000000
 },
 fundos: fundos.map(f=>({
 ticker: f.ticker,
 nome: f.nome,
 segmento: f.segmento,
 elegivel: f.elegivel,
 // Critérios
 vol3m: f.vol3m ?? null,
 dy_anual: f.dy_anual ?? null,
 pvp_atual: f.pvp_atual ?? null,
 mktcap: f.mktcap ?? null,
 // Dados adicionais
 fechamento: f.fechamento ?? null,
 vp: f.vp ?? null,
 dy_ltm: f.dy_ltm ?? null,
 ret_mes: f.ret_mes ?? null,
 ret_ano: f.ret_ano ?? null,
 ret_ltm: f.ret_ltm ?? null,
 // Flags de reprovação (apenas para não elegíveis)
 ...(!f.elegivel ? {
 fail_vol: f.fail_vol || false,
 fail_yield: f.fail_yield || false,
 fail_pvp: f.fail_pvp || false,
 fail_mktcap: f.fail_mktcap || false
 } : {})
 }))
 };

 // Converter para JSON formatado
 const jsonStr = JSON.stringify(backup, null, 2);
 const blob = new Blob([jsonStr], {type:'application/json;charset=utf-8'});
 const url = URL.createObjectURL(blob);

 // Nome do arquivo: FII_Backup_SemanaNN_DDMMAAAA.json
 const dataSemana = semanaData.replace(/\//g,''); // ex: 09062026
 const nomeArquivo = `FII_Backup_Semana${numSemana||'XX'}_${dataSemana}.json`;

 // Disparar download
 const a = document.createElement('a');
 a.href = url;
 a.download = nomeArquivo;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);

 console.log(`✓ Backup gerado: ${nomeArquivo} (${(jsonStr.length/1024).toFixed(0)} KB)`);
 }catch(e){
 console.error('Erro ao gerar backup JSON:', e);
 // Não bloqueia o fluxo principal — backup é best-effort
 }
}

// ══════════════════════════════════════════════════════════════
// MÁSCARA DE DATA — campo "Data da semana" no Admin
// ══════════════════════════════════════════════════════════════

/**
 * Formata o campo de data conforme o usuário digita, inserindo as barras
 * automaticamente nas posições corretas (DD/MM/AAAA).
 * Disparado pelo evento `oninput`.
 * @param {InputEvent} e
 */
export function adminDataMask(e){
 const input=e.target;
 const digits=input.value.replace(/\D/g,'').slice(0,8);
 let formatted=digits;
 if(digits.length>2) formatted=digits.slice(0,2)+'/'+digits.slice(2);
 if(digits.length>4) formatted=digits.slice(0,2)+'/'+digits.slice(2,4)+'/'+digits.slice(4);
 input.value=formatted.slice(0,10);
 adminDataValidar(input);
}

/**
 * Trata o backspace sobre uma barra "/" para apagar também o dígito anterior,
 * evitando que o cursor fique preso na posição da barra.
 * Disparado pelo evento `onkeydown`.
 * @param {KeyboardEvent} e
 */
export function adminDataKeydown(e){
 const input=e.target;
 if(e.key==='Backspace'){
 const pos=input.selectionStart;
 const val=input.value;
 if(pos>0 && val[pos-1]==='/'){
 e.preventDefault();
 input.value=val.slice(0,pos-2)+val.slice(pos);
 input.setSelectionRange(pos-2,pos-2);
 adminDataValidar(input);
 }
 }
}

/**
 * Intercepta colagem (Ctrl+V / Cmd+V) e reformata o conteúdo colado para
 * o padrão DD/MM/AAAA, extraindo apenas os dígitos do texto colado.
 * Ex.: "09052026", "09/05/2026", "2026-05-09" → "09/05/2026".
 * Disparado pelo evento `onpaste`.
 * @param {ClipboardEvent} e
 */
export function adminDataPaste(e){
 e.preventDefault();
 const pasted=(e.clipboardData||window.clipboardData).getData('text');
 const digits=pasted.replace(/\D/g,'').slice(0,8);
 let formatted=digits;
 if(digits.length>2) formatted=digits.slice(0,2)+'/'+digits.slice(2);
 if(digits.length>4) formatted=digits.slice(0,2)+'/'+digits.slice(2,4)+'/'+digits.slice(4);
 e.target.value=formatted.slice(0,10);
 adminDataValidar(e.target);
}

/**
 * Valida o conteúdo do campo de data e aplica o feedback visual.
 * - Campo vazio ou incompleto: neutro (sem cor).
 * - Data completa e válida: borda verde + avança para o campo de semana.
 * - Data completa e inválida: borda vermelha + mensagem de erro específica.
 * @param {HTMLInputElement} input
 */
export function adminDataValidar(input){
 const val=input.value;
 const errEl=document.getElementById('admin-data-error');

 // Campo vazio ou incompleto → estado neutro
 if(val.length===0){
 input.style.borderColor='';
 if(errEl) errEl.style.display='none';
 return;
 }
 if(val.length<10){
 input.style.borderColor='';
 if(errEl) errEl.style.display='none';
 return;
 }

 // Data completa (10 chars) → validar
 const match=val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
 if(!match){
 input.style.borderColor='var(--danger)';
 if(errEl){ errEl.textContent='⚠ Use o formato DD/MM/AAAA'; errEl.style.display='block'; }
 return;
 }
 const d=parseInt(match[1]), m=parseInt(match[2]), y=parseInt(match[3]);
 let erroMsg='';
 if(m<1||m>12) erroMsg='⚠ Mês inválido — use 01 a 12';
 else if(d<1) erroMsg='⚠ Dia inválido';
 else if(y<2020||y>2035) erroMsg='⚠ Ano fora do intervalo esperado (2020–2035)';
 else{
 const maxDias=new Date(y,m,0).getDate();
 if(d>maxDias) erroMsg=`⚠ ${String(m).padStart(2,'0')}/${y} tem no máximo ${maxDias} dias`;
 }

 if(erroMsg){
 input.style.borderColor='var(--danger)';
 if(errEl){ errEl.textContent=erroMsg; errEl.style.display='block'; }
 return;
 }

 // Data válida ✓
 input.style.borderColor='var(--success)';
 if(errEl) errEl.style.display='none';

 // Avançar cursor para o campo Número da Semana
 const numInput=document.getElementById('admin-num');
 if(numInput) numInput.focus();

 // Sugerir automaticamente o próximo número de semana
 autoCalcularNumSemana();
}

/**
 * Busca no Supabase o maior num_semana existente e sugere o próximo valor
 * automaticamente no campo "Número da semana", sem sobrescrever se o
 * analista já tiver digitado algo.
 * @returns {Promise<void>}
 */
export async function autoCalcularNumSemana(){
 const numInput=document.getElementById('admin-num');
 const sugEl=document.getElementById('admin-num-suggest');
 if(!numInput||numInput.value) return; // não sobrescreve o que o analista digitou
 const db=getDB();
 if(!db) return;
 try{
 const {data:semanas}=await db.from('semanas')
 .select('num_semana')
 .is('deleted_at',null)
 .order('num_semana',{ascending:false})
 .limit(1);
 const proximo=(semanas&&semanas.length>0&&semanas[0].num_semana)
 ?(semanas[0].num_semana+1):1;
 numInput.value=proximo;
 if(sugEl) sugEl.style.display='block';
 // Flash verde breve no campo
 numInput.style.borderColor='var(--success)';
 setTimeout(()=>{ numInput.style.borderColor=''; },2500);
 console.log('[autoCalcularNumSemana] sugerido: Semana '+proximo);
 }catch(e){
 console.warn('[autoCalcularNumSemana]',e.message);
 }
}


export function adminReset(){
 adminFundos=[];adminSemanaData='';adminSemanaNum=0;_adminRawFile=null;
 const ssEl=document.getElementById('admin-storage-status');
 const owEl=document.getElementById('admin-overwrite-warn');
 const errEl=document.getElementById('admin-data-error');
 const sugEl=document.getElementById('admin-num-suggest');
 const dataInput=document.getElementById('admin-data');
 const numInput=document.getElementById('admin-num');
 if(ssEl) ssEl.style.display='none';
 if(owEl) owEl.style.display='none';
 if(errEl) errEl.style.display='none';
 if(sugEl) sugEl.style.display='none';
 if(dataInput){ dataInput.value=''; dataInput.style.borderColor=''; }
 if(numInput) { numInput.value=''; numInput.style.borderColor=''; }
 document.getElementById('admin-file-input').value='';
 document.getElementById('admin-preview').style.display='none';
 document.getElementById('admin-btn-wrap').style.display='none';
 // Restaurar botões originais (caso tenham sido sobrescritos pela validação)
 const btnWrap=document.getElementById('admin-btn-wrap');
 if(btnWrap && !document.getElementById('admin-btn-confirm')){
 btnWrap.innerHTML=`
 <button id="admin-btn-cancel" onclick="adminReset()"
 style="padding:10px 24px;background:#f0f0f0;color:var(--apex-navy);border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Manrope',sans-serif">
 Cancelar
 </button>
 <button id="admin-btn-confirm" onclick="adminConfirmar()"
 style="padding:10px 24px;background:var(--apex-blue);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Manrope',sans-serif">
 ✓ Confirmar e Salvar
 </button>`;
 }
 const box=document.getElementById('admin-upload-box');
 if(box){
 box.style.background='#fafcff';
 box.style.borderColor='var(--apex-mist)';
 box.querySelector('div:nth-child(2)').textContent='Clique para selecionar o BTG FII Guide';
 }
}

// ── Listar arquivos disponíveis no Storage ────────────────────
export async function listarArquivosStorage(){
 const db=getDB();
 if(!db) return new Set();
 try{
 const {data,error}=await db.storage.from('fii-guides').list('',{limit:200});
 if(error||!data) return new Set();
 // Retorna Set com os nomes dos arquivos (ex: "BTGGuide_09022026.xlsx")
 return new Set(data.map(f=>f.name));
 }catch(e){
 console.warn('[listarArquivosStorage]',e.message);
 return new Set();
 }
}

// Montar nome do arquivo no Storage a partir da data da semana (DD/MM/AAAA → DDMMAAAA)
export function nomeArquivoStorage(semanaData){
 return 'BTGGuide_'+semanaData.replace(/\//g,'')+'.xlsx';
}

// URL pública de download
export function urlDownloadStorage(semanaData){
 return `${SUPA_URL}/storage/v1/object/public/fii-guides/${nomeArquivoStorage(semanaData)}`;
}

// ── Listar semanas processadas ────────────────────────────────
export async function carregarListaSemanas(){
 const el=document.getElementById('admin-semanas-list');
 if(!el)return;
 const db=getDB();
 if(!db){el.innerHTML='<div style="color:#6b7a9a;font-size:12px">Supabase não disponível</div>';return;}

 // Buscar semanas e arquivos disponíveis no Storage em paralelo
 const [{data:semanas,error}, arquivosStorage] = await Promise.all([
 db.from('semanas').select('*').order('created_at',{ascending:false}),
 listarArquivosStorage()
 ]);

 // Atualizar contador do painel de upload retroativo
 const countEl=document.getElementById('retro-storage-count');
 if(countEl) countEl.textContent=arquivosStorage.size+' arquivo(s) no Storage';

 if(error||!semanas||semanas.length===0){
 el.innerHTML='<div style="color:#6b7a9a;font-size:12px;text-align:center;padding:20px">Nenhuma semana processada ainda</div>';
 return;
 }

 const ativas =semanas.filter(s=>!s.deleted_at);
 const inativas=semanas.filter(s=>!!s.deleted_at);

 const renderRow=s=>{
 const deletada=!!s.deleted_at;
 const rowId='row-'+s.semana_data.replace(/\//g,'-');
 const nomeArq=nomeArquivoStorage(s.semana_data);
 const temArquivo=arquivosStorage.has(nomeArq);
 const btnDownload=temArquivo
 ? `<a href="${urlDownloadStorage(s.semana_data)}" target="_blank" download
 class="btn-download" title="Baixar BTG FII Guide original de ${s.semana_data}">BTG Guide</a>`
 : `<span class="btn-download disabled" title="Arquivo original não disponível para esta semana">BTG Guide</span>`;
 return`<tr id="${rowId}" class="${deletada?'semana-deletada':''}">
 <td><strong>${s.semana_data}</strong></td>
 <td>${s.num_semana||'—'}</td>
 <td>${s.n_total||0}</td>
 <td style="color:var(--success);font-weight:700">${s.n_elegiveis||0}</td>
 <td style="color:var(--danger);font-weight:700">${s.n_nao_elegiveis||0}</td>
 <td style="color:var(--success);font-weight:600">${JSON.parse(s.entraram||'[]').length}</td>
 <td style="color:var(--danger);font-weight:600">${JSON.parse(s.sairam||'[]').length}</td>
 <td class="acoes-semana"><div style="display:flex;gap:4px;flex-wrap:wrap">
 ${btnDownload}
 ${deletada
 ? `<button class="btn-restaurar" onclick="restaurarSemana('${s.semana_data}')">↺ Restaurar</button>`
 : `<button class="btn-editar" onclick="editarSemana('${s.semana_data}',${s.num_semana||0})">Editar</button>
 <button class="btn-excluir" onclick="confirmarExcluirSemana('${s.semana_data}')">Excluir</button>`
 }
 </div></td>
 </tr>`;
 };

 el.innerHTML=`<div class="tbl-wrap" style="border:none"><table>
 <thead><tr><th>Data</th><th>#</th><th>Total</th><th>Elegíveis</th><th>Não Elegíveis</th><th>Entraram</th><th>Saíram</th><th>Ações</th></tr></thead>
 <tbody>${[...ativas,...inativas].map(renderRow).join('')}</tbody>
 </table></div>
 ${inativas.length>0?`<div style="font-size:10px;color:#6b7a9a;margin-top:8px;text-align:right">${inativas.length} semana(s) oculta(s) — restaurável(is) a qualquer momento</div>`:''}`
 +`<div style="font-size:10px;color:#6b7a9a;margin-top:8px">
 BTG Guide <span style="color:var(--success)">verde</span> = arquivo original disponível ·
 <span style="color:#aaa">cinza</span> = não disponível (faça o upload retroativo acima)
 </div>`;
}

// ── Upload retroativo de arquivos para o Storage ─────────────
/**
 * Recebe uma lista de File objects (FileList ou Array), extrai a data de cada
 * um pelo padrão BTGSGF_D_M_AAAA no nome, e faz upload para o bucket fii-guides.
 * Mostra barra de progresso e log linha a linha.
 * @param {FileList|File[]} files Arquivos selecionados pelo usuário.
 * @returns {Promise<void>}
 */
export async function uploadRetroativo(files){
 const db=getDB();
 if(!db){toast('Supabase não disponível','error');return;}
 if(!files||files.length===0) return;

 const lista=Array.from(files).filter(f=>f.name.endsWith('.xlsx')||f.name.endsWith('.xls'));
 if(!lista.length){toast('Nenhum arquivo .xlsx encontrado na seleção','warning');return;}

 // Mostrar painel de progresso
 const progDiv =document.getElementById('retro-progress');
 const barFill =document.getElementById('retro-bar-fill');
 const progLabel=document.getElementById('retro-progress-label');
 const progPct =document.getElementById('retro-progress-pct');
 const logEl =document.getElementById('retro-log');
 if(progDiv) progDiv.style.display='block';
 if(logEl) logEl.innerHTML='';

 const addLog=(msg,tipo='')=>{
 if(!logEl) return;
 const cor=tipo==='ok'?'var(--success)':tipo==='err'?'var(--danger)':tipo==='skip'?'var(--warning)':'#5a6e8a';
 logEl.innerHTML+=`<div style="color:${cor}">${msg}</div>`;
 logEl.scrollTop=logEl.scrollHeight;
 };

 let ok=0, skip=0, err=0;

 for(let i=0;i<lista.length;i++){
 const file=lista[i];
 const pct=Math.round((i/lista.length)*100);
 if(barFill) barFill.style.width=pct+'%';
 if(progPct) progPct.textContent=pct+'%';
 if(progLabel)progLabel.textContent=`Enviando ${i+1}/${lista.length}: ${file.name}`;

 // Extrair data do nome: BTGSGF_D_M_AAAA
 const m=file.name.match(/BTGSGF_(\d+)_(\d+)_(\d{4})/i);
 if(!m){
 addLog(`⚠ ${file.name} — nome fora do padrão BTGSGF_D_M_AAAA, ignorado`,'skip');
 skip++; continue;
 }
 const d =String(m[1]).padStart(2,'0');
 const mo=String(m[2]).padStart(2,'0');
 const y =m[3];
 const dataSemana=`${d}${mo}${y}`; // ex: 09022026
 const nomeArq=`BTGGuide_${dataSemana}.xlsx`;
 const dataFmt=`${d}/${mo}/${y}`;

 try{
 const {error}=await db.storage.from('fii-guides').upload(nomeArq, file, {
 contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 upsert:true // sobrescreve se já existir
 });
 if(error) throw error;
 addLog(`✓ ${dataFmt} → ${nomeArq} enviado`,'ok');
 ok++;
 }catch(e){
 addLog(`✗ ${dataFmt} — erro: ${e.message}`,'err');
 err++;
 }
 }

 // Finalizar barra
 if(barFill) barFill.style.width='100%';
 if(progPct) progPct.textContent='100%';
 if(progLabel)progLabel.textContent='Concluído';

 addLog(`\n─── ${ok} enviados · ${skip} ignorados · ${err} erros ───`);

 const tipo=err>0?'warning':'success';
 toast(`Upload retroativo: ${ok} arquivo(s) enviado(s)${err>0?' · '+err+' erro(s)':''}`,tipo);

 // Limpar seleção e recarregar tabela para mostrar botões verdes
 document.getElementById('retro-file-input').value='';
 await carregarListaSemanas();
}
/**
 * Carrega do Supabase a semana ativa mais recente e seus fundos, e dispara a
 * renderização do dashboard (KPIs, tabelas, segmentos).
 * @returns {Promise<void>}
 */
export async function carregarESemanaAtual(){
 const db=getDB();if(!db)return;
 const {data:semanas}=await db.from('semanas').select('*').order('created_at',{ascending:false}).limit(1);
 if(!semanas||semanas.length===0)return;
 const semana=semanas[0];
 const {data:fundos}=await db.from('fund_data').select('*').eq('semana_data',semana.semana_data);
 if(!fundos||fundos.length===0)return;
 renderizarSemana(semana,fundos);
}

// ── Renderizar semana no dashboard ───────────────────────────
export function renderizarSemana(semana, fundos){
 const el=fundos.filter(f=>f.elegivel);
 const nel=fundos.filter(f=>!f.elegivel);
 const pctEl=(el.length/fundos.length*100).toFixed(1);
 const entraram=JSON.parse(semana.entraram||'[]');
 const sairam=JSON.parse(semana.sairam||'[]');

 // Atualizar header
 const hDate = document.getElementById('header-date');
 if(hDate) hDate.textContent = semana.semana_data||'—';

 // Atualizar KPIs
 const kpis=document.querySelectorAll('.kpi-val');
 if(kpis.length>=6){
 kpis[0].textContent=fundos.length;
 kpis[1].textContent=el.length;
 kpis[2].textContent=nel.length;
 // kpis[3] = semanas (manter)
 // kpis[4] = 100% consistentes (manter — vem do trackrecord)
 // kpis[5] = já elegíveis (manter)
 }

 // Atualizar subtítulo
 const subs=document.querySelectorAll('.kpi-sub');
 if(subs.length>=3){
 subs[0].textContent='Universo BTG FII Guide';
 subs[1].textContent=pctEl+'% do universo';
 subs[2].textContent=(100-parseFloat(pctEl)).toFixed(1)+'% do universo';
 }

 // Atualizar movimentações
 const movIn=document.querySelector('.mov-grid > div:first-child');
 const movOut=document.querySelector('.mov-grid > div:last-child');
 if(movIn){
 movIn.innerHTML=`<div class="mov-lbl mov-in">Entraram (${entraram.length})</div>`+
 (entraram.length>0?entraram.map(e=>`<div class="mov-item-rich">
 <div style="display:flex;align-items:center;gap:7px;margin-bottom:4px">
 <span class="dot dot-in"></span><strong>${e.ticker}</strong><span class="mov-seg">${e.segmento}</span>
 </div>
 <div class="mov-justif mov-justif-in"> ${e.motivo||''}</div>
 </div>`).join(''):'<div class="mov-item" style="color:#6b7a9a;font-size:11px">Nenhum fundo entrou</div>');
 }
 if(movOut){
 movOut.innerHTML=`<div class="mov-lbl mov-out">Saíram (${sairam.length})</div>`+
 (sairam.length>0?sairam.map(e=>`<div class="mov-item-rich">
 <div style="display:flex;align-items:center;gap:7px;margin-bottom:4px">
 <span class="dot dot-out"></span><strong>${e.ticker}</strong><span class="mov-seg">${e.segmento}</span>
 ${e.criterio?`<span class="crit-fail">${e.criterio}</span>`:''}
 </div>
 <div class="mov-justif mov-justif-out"> ${e.motivo||''}</div>
 </div>`).join(''):'<div class="mov-item" style="color:#6b7a9a;font-size:11px">Nenhum fundo saiu</div>');
 }

 // Atualizar tabela de fundos
 const tbody=document.getElementById('fund-body');
 if(tbody){
 tbody.innerHTML=el.sort((a,b)=>a.ticker.localeCompare(b.ticker)).map(f=>{
 const dyC=f.dy_anual>=0.12?'var(--success)':f.dy_anual>=0.09?'var(--warning)':'var(--danger)';
 const pvpC=f.pvp_atual<0.95?'var(--success)':f.pvp_atual<1.05?'var(--warning)':'#6b7a9a';
 const segChipHtml=segChip(f.segmento);
 return`<tr>
 <td><strong style="color:var(--apex-blue)">${f.ticker}</strong></td>
 <td style="max-width:220px;white-space:normal">${f.nome||''}</td>
 <td>${segChipHtml}</td>
 <td>R$ ${f.fechamento?.toFixed(2)||'—'}</td>
 <td data-val="${f.vol3m||0}">R$ ${fmtCurrency(f.vol3m||0)}</td>
 <td style="color:${dyC};font-weight:700" data-val="${f.dy_anual||0}">${f.dy_anual?fmtPercent(f.dy_anual):'—'}</td>
 <td style="color:${pvpC};font-weight:700">${f.pvp_atual?f.pvp_atual.toFixed(4)+'x':'—'}</td>
 <td data-val="${f.mktcap||0}">R$ ${fmtMillions(f.mktcap||0)}</td>
 <td class="analise-cell"></td>
 <td><a href="https://statusinvest.com.br/fundos-imobiliarios/${f.ticker.toLowerCase()}" target="_blank"
 style="font-size:10px;padding:3px 9px;background:var(--apex-blue);color:#fff;border-radius:5px;text-decoration:none;font-weight:600;white-space:nowrap">Status Invest ↗</a></td>
 </tr>`;
 }).join('');
 injectAnalyseTags();
 buildFundDataMap();
 }

 // Atualizar contagem
 const fc=document.getElementById('fund-count');
 if(fc)fc.textContent=el.length+' fundos';

 injectPreAnaliseBadges();

 // ── Atualizar títulos das abas por ID ────────────────────────
 const totalSems = _currentSemana?.num_semana || '—';
 const dataAtual = semana.semana_data;

 const visaoH2 = document.getElementById('visao-h2');
 if(visaoH2) visaoH2.textContent = 'Visão Geral — ' + dataAtual;

 const fundosH2 = document.getElementById('fundos-h2');
 if(fundosH2) fundosH2.innerHTML = 'Fundos Elegíveis — <span>' + el.length + '</span> fundos';

 const fundosSubData = document.getElementById('fundos-sub-data');
 if(fundosSubData) fundosSubData.textContent = dataAtual;

 const rankSub = document.getElementById('ranking-sub');
 if(rankSub && analyses) {
 const uniqueTickers = Object.keys(analyses).length;
 rankSub.textContent = uniqueTickers + ' fundos elegíveis ao menos 1x · Dados até ' + dataAtual;
 }

 // ── Atualizar Linha 2 de KPIs (antes estáticos, agora dinâmicos) ─
 const nEl2=el.length;
 const nTotal2=fundos.length;
 const nNao2=nTotal2-nEl2;
 const pctEl2=nTotal2>0?(nEl2/nTotal2*100).toFixed(1):'—';
 const pctNao2=nTotal2>0?(nNao2/nTotal2*100).toFixed(1):'—';

 const s = id => document.getElementById(id);
 if(s('kpi-s-total')) s('kpi-s-total').textContent=nTotal2;
 if(s('kpi-s-elegiveis')) s('kpi-s-elegiveis').textContent=nEl2;
 if(s('kpi-s-elegiveis-pct')) s('kpi-s-elegiveis-pct').textContent=pctEl2+'% do universo';
 if(s('kpi-s-nao-elegiveis')) s('kpi-s-nao-elegiveis').textContent=nNao2;
 if(s('kpi-s-nao-elegiveis-pct')) s('kpi-s-nao-elegiveis-pct').textContent=pctNao2+'% do universo';
 // Semanas, consistentes e já elegíveis vêm do trackrecord — atualizar se disponível
 if(semana.num_semana && s('kpi-s-semanas')) s('kpi-s-semanas').textContent = semana.num_semana;

 // Limpar cache do ranking — garante que a aba Ranking busque dados
 // frescos do Supabase na próxima abertura (não a semana antiga em cache)
 invalidateRankingCache();

 // Armazenar dados globalmente para uso na aba Por Segmento
 _currentFundos = fundos;
 _currentSemana = semana;
 renderSegmentos();
 console.log('✓ Dashboard atualizado com dados de '+semana.semana_data);
}

// Toda a aba Carteira APX (fetchYahooMonthly, initCarteira, carregarCarteira,
// atualizarPrecosCarteira, render*, alertas, edição inline etc. + estado
// privado) foi movida para js/tabs/carteira.js (Fase 4 da modularização).
// Toda a sub-aba Benchmarks (initBenchmarks, fetchBCBSeries, sdToISO,
// calcPortfolioMonthlyReturns, loadAllBenchmarkData, render* + estado
// privado) foi movida para js/tabs/carteira-benchmarks.js (Fase 4).


// SEG_COLORS e SEG_BG movidos para js/constants.js (Fase 1 da modularização).
// Toda a aba Por Segmento (buildSegData, renderSegmentos e as demais
// funções/estado de bastidor) movida para js/tabs/segmentos.js (Fase 4).

// onAnalistaChange e onTipoChange movidos para
// js/tabs/analise.js (Fase 4 da modularização).
// buildAtividadeItems, parseDateBR, renderAtividade, renderAtvItem e
// renderAtvVisaoGeral movidos para js/tabs/atividade.js (Fase 4 da modularização).

// SCORE_APROVADO, SCORE_EM_AVAL, getKpiData e updateKpiRow movidos para
// js/tabs/visao-geral.js (Fase 4 da modularização).
// _modalItems, openModal, itemScoreFn, defaultRenderFn, renderModalList,
// filterModal e closeModal movidos para js/modals/generic-list-modal.js.

// ══════════════════════════════════════════════════════════════
// COMENTÁRIOS — Sistema de comentários e questionamentos
// ══════════════════════════════════════════════════════════════









// O Fórum de Discussão inteiro (openForum, closeForum, switchForumTab,
// loadForumPosts, renderForumPosts, abrirResposta, enviarResposta,
// publicarForumPost, updateForumBadges, carregarPendentesForum,
// carregarForumGlobal + estado privado) foi movido para
// js/modals/forum.js (Fase 4 da modularização).
// ══════════════════════════════════════════════════════════════
// CRUD — Excluir análise · Excluir/editar semana
// ══════════════════════════════════════════════════════════════

// openConfirmModal, closeConfirmModal, checkConfirmReady e
// executeConfirmAction movidos para js/modals/confirm-modal.js (Fase 4).

// confirmarExcluirAnalise e excluirAnalise movidos para
// js/tabs/analise.js (Fase 4 da modularização).

// ── EXCLUIR SEMANA (soft delete) ──────────────────────────────
export function confirmarExcluirSemana(data){
 openConfirmModal({
 title: ' Excluir Semana',
 desc: `Você está prestes a ocultar a semana ${data} do dashboard.

Os dados de fundos do BTG Guide desta semana serão ocultados. As análises de fundos serão preservadas. A semana pode ser restaurada depois pela aba Admin.`,
 wordLabel: `Digite a data "${data}" para confirmar:`,
 expectedWord: data,
 onConfirm: ()=>excluirSemana(data)
 });
}

export async function excluirSemana(data){
 const db = getDB();
 if(!db){ toast('Supabase não disponível.', 'error'); return; }
 const {error} = await db.from('semanas')
 .update({deleted_at: new Date().toISOString()})
 .eq('semana_data', data);
 if(error){ toast('Erro ao excluir semana: '+error.message, 'error'); return; }
 toast(`✓ Semana ${data} ocultada do dashboard. Você pode restaurá-la a qualquer momento.`, 'success');
 await carregarListaSemanas();
 await carregarESemanaAtual();
}

export async function restaurarSemana(data){
 const db = getDB();
 if(!db){ toast('Supabase não disponível.', 'error'); return; }
 const {error} = await db.from('semanas')
 .update({deleted_at: null})
 .eq('semana_data', data);
 if(error){ toast('Erro ao restaurar: '+error.message, 'error'); return; }
 toast(`✓ Semana ${data} restaurada com sucesso!`, 'success');
 await carregarListaSemanas();
 await carregarESemanaAtual();
}

// ── EDITAR SEMANA (data e número) ─────────────────────────────
export function editarSemana(data, numAtual){
 const rowId = 'row-'+data.replace(/\//g,'-');
 const row = document.getElementById(rowId);
 if(!row) return;
 const cells = row.querySelectorAll('td');
 // Substituir as duas primeiras células por campos editáveis
 cells[0].innerHTML=`<div class="edit-inline">
 <input type="text" id="edit-data-${rowId}" value="${data}" placeholder="DD/MM/AAAA" maxlength="10" style="width:110px">
 </div>`;
 cells[1].innerHTML=`<div class="edit-inline">
 <input type="number" id="edit-num-${rowId}" value="${numAtual||''}" placeholder="#" style="width:55px">
 </div>`;
 // Trocar botão editar por salvar/cancelar
 const acoes = row.querySelector('.acoes-semana');
 if(acoes) acoes.innerHTML=`
 <button onclick="salvarEdicaoSemana('${data}','${rowId}')" class="btn-editar" style="background:var(--success);color:#fff;border-color:var(--success)">✓ Salvar</button>
 <button onclick="carregarListaSemanas()" class="btn-excluir" style="background:#f0f0f0;color:var(--apex-navy);border-color:#ccc">Cancelar</button>`;
}

export async function salvarEdicaoSemana(dataOriginal, rowId){
 const novaData = document.getElementById('edit-data-'+rowId)?.value?.trim();
 const novoNum = parseInt(document.getElementById('edit-num-'+rowId)?.value)||0;
 if(!novaData || !/^\d{2}\/\d{2}\/\d{4}$/.test(novaData)){
 toast('Data inválida. Use o formato DD/MM/AAAA.', 'warning');return;
 }
 const db=getDB();if(!db)return;
 const updates = {semana_data: novaData, num_semana: novoNum};
 // Atualizar semana
 const {error:eS} = await db.from('semanas').update(updates).eq('semana_data', dataOriginal);
 if(eS){ toast('Erro ao salvar: '+eS.message, 'error'); return; }
 // Atualizar fund_data se a data mudou
 if(novaData !== dataOriginal){
 await db.from('fund_data').update({semana_data: novaData}).eq('semana_data', dataOriginal);
 }
 toast(`✓ Semana atualizada: ${novaData} (#${novoNum})`, 'success');
 await carregarListaSemanas();
 await carregarESemanaAtual();
}

// Atualizar header com dados reais do Supabase
export async function atualizarHeaderSemana(){
 const db=getDB();
 if(!db) return;
 try{
 // Buscar todas as semanas ativas (não deletadas) ordenadas por num_semana
 const {data:semanas,error}=await db
 .from('semanas')
 .select('semana_data,num_semana,created_at')
 .is('deleted_at',null)
 .order('created_at',{ascending:false});

 if(error||!semanas||semanas.length===0) return;

 const latest = semanas[0]; // semana mais recente
 const totalSems = semanas.length; // total de semanas ativas
 const numSemana = latest.num_semana||totalSems;
 const dataUltima = latest.semana_data||'—';

 // Atualizar header
 const hDate = document.getElementById('header-date');
 const hSem = document.getElementById('header-semana');
 if(hDate) hDate.textContent = dataUltima;
 if(hSem) hSem.textContent = 'FII Universe · Uso Interno · Semana '+numSemana+' de '+totalSems;

 // Atualizar footer (mesmos dados, antes estático)
 const fData = document.getElementById('footer-data');
 const fSem = document.getElementById('footer-semana');
 if(fData) fData.textContent = dataUltima;
 if(fSem) fSem.textContent = 'Semana '+numSemana+' de '+totalSems;

 console.log('Header atualizado: Semana '+numSemana+' de '+totalSems+' ('+dataUltima+')');
 }catch(e){
 console.warn('Erro ao atualizar header:', e.message);
 }
}

window.validarBTGGuide = validarBTGGuide;
window.mostrarErroValidacao = mostrarErroValidacao;
window.onBTGUpload = onBTGUpload;
window.adminConfirmar = adminConfirmar;
window.verificarArquivoStorage = verificarArquivoStorage;
window.gerarBackupJSON = gerarBackupJSON;
window.adminDataMask = adminDataMask;
window.adminDataKeydown = adminDataKeydown;
window.adminDataPaste = adminDataPaste;
window.adminDataValidar = adminDataValidar;
window.autoCalcularNumSemana = autoCalcularNumSemana;
window.adminReset = adminReset;
window.listarArquivosStorage = listarArquivosStorage;
window.nomeArquivoStorage = nomeArquivoStorage;
window.urlDownloadStorage = urlDownloadStorage;
window.carregarListaSemanas = carregarListaSemanas;
window.uploadRetroativo = uploadRetroativo;
window.carregarESemanaAtual = carregarESemanaAtual;
window.renderizarSemana = renderizarSemana;
window.confirmarExcluirSemana = confirmarExcluirSemana;
window.excluirSemana = excluirSemana;
window.restaurarSemana = restaurarSemana;
window.editarSemana = editarSemana;
window.salvarEdicaoSemana = salvarEdicaoSemana;
window.atualizarHeaderSemana = atualizarHeaderSemana;
window.adminFundos = adminFundos;
window.adminSemanaData = adminSemanaData;
window.adminSemanaNum = adminSemanaNum;
window._adminRawFile = _adminRawFile;
