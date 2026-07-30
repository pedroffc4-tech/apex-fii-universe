'use strict';

// Conexão com o Supabase (Fase 3 do plano de refatoração) — antes vivia
// solta no meio do script gigante do index.html, agora isolada aqui.
// `analyses` continua vindo de js/data-store.js (via window, carregado antes
// deste módulo); as funções de render chamadas por supaLoad continuam no
// script legado por enquanto (movem na Fase 4, quando cada aba virar módulo).

export const SUPA_URL='https://ystjnkvodohjcruixiqv.supabase.co';
export const SUPA_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzdGpua3ZvZG9oamNydWl4aXF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MDgwMjUsImV4cCI6MjA5NTk4NDAyNX0.pqtJybMMp_i9p05oakWjYp1IHajhaZBd07QIfPzHdpU';

// Singleton: o cliente é criado uma única vez e reaproveitado em todas
// as chamadas. _db guarda a instância; chamadas subsequentes retornam a
// mesma referência, evitando múltiplos clientes/conexões em re-renders (B3).
let _db=null;
/**
 * Retorna a instância única (singleton) do cliente Supabase.
 * Cria o cliente na primeira chamada e o reaproveita depois.
 * @returns {Object|null} Cliente Supabase, ou null se o SDK não carregou.
 */
export function getDB(){
 if(_db)return _db;
 if(typeof supabase==='undefined'){console.warn('[getDB] SDK Supabase não carregou');return null;}
 _db=supabase.createClient(SUPA_URL,SUPA_KEY);
 return _db;
}

/**
 * Carrega todas as análises do Supabase para o objeto global `analyses`
 * e atualiza a UI dependente (tags, ranking, KPIs, atividade, fórum).
 * Usa localStorage como cache de performance; o Supabase é a fonte da verdade.
 * @returns {Promise<void>}
 */
export async function supaLoad(){
 const db=getDB();
 const ss=document.getElementById('sync-status');
 if(!db){if(ss)ss.innerHTML='⚠️ SDK não carregado';return;}
 try{
 if(ss)ss.innerHTML='⟳ Sincronizando...';
 const {data:rows,error}=await db.from('analyses').select('*');
 if(error)throw new Error(error.message);
 // Limpar SEMPRE — antes de verificar se há linhas
 Object.keys(analyses).forEach(k=>delete analyses[k]);
 localStorage.setItem('apex_fii_analyses','{}');
 if(!rows||rows.length===0){
 if(ss)ss.innerHTML='✓ Banco vazio — pronto para uso';
 injectAnalyseTags();
 renderScoreRanking();
 updateKpiRow();
 return;
 }
 rows.forEach(row=>{
 analyses[row.ticker]={
 ticker:row.ticker,nome:row.nome,seg:row.segmento,
 analista:row.analista,data:row.data,tipo:row.tipo,
 qualiScores:row.quali_scores||{},qualiJust:row.quali_just||{},
 quantiScores:row.quanti_scores||{},quantiJust:row.quanti_just||{},
 scoreTotal:row.score_total,scoreQuali:row.score_quali,
 scoreQuanti:row.score_quanti,finalizado:row.finalizado
 };
 });
 localStorage.setItem('apex_fii_analyses',JSON.stringify(analyses));
 if(ss)ss.innerHTML='✓ Sincronizado · '+rows.length+' análises';
 console.log('✓ Supabase: '+rows.length+' análises carregadas');
 injectAnalyseTags();renderScoreRanking();
 if(document.getElementById('tab-atividade')?.classList.contains('active'))renderAtividade();
 renderAtvVisaoGeral();
 updateKpiRow();
 carregarForumGlobal();
 atualizarHeaderSemana();
 }catch(e){
 console.warn('Supabase load falhou:',e.message);
 if(ss)ss.innerHTML='⚠️ Offline — '+e.message.substring(0,50);
 }
}

// Salvar/atualizar análise no Supabase
export async function supaSave(a){
 const db=getDB();
 if(!db)throw new Error('SDK Supabase não disponível');
 const payload={
 ticker:a.ticker,nome:a.nome,segmento:a.seg,
 analista:a.analista,data:a.data,tipo:a.tipo,
 quali_scores:a.qualiScores,quali_just:a.qualiJust,
 quanti_scores:a.quantiScores,quanti_just:a.quantiJust,
 score_total:a.scoreTotal,score_quali:a.scoreQuali,
 score_quanti:a.scoreQuanti,finalizado:a.finalizado,
 updated_at:new Date().toISOString()
 };
 const {error}=await db.from('analyses').upsert(payload,{onConflict:'ticker'});
 if(error)throw new Error(error.message);
 console.log('✓ Supabase: análise de '+a.ticker+' salva');
}

window.SUPA_URL=SUPA_URL;
window.SUPA_KEY=SUPA_KEY;
window.getDB=getDB;
window.supaLoad=supaLoad;
window.supaSave=supaSave;
