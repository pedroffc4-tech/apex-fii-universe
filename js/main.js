'use strict';

// ══════════════════════════════════════════════════════════════
// MAIN — ponto de entrada único do app (Fase 5 da modularização)
// ══════════════════════════════════════════════════════════════
// index.html carrega só este arquivo (<script type="module" src="./js/main.js">).
// Os imports abaixo disparam a execução de cada módulo, na mesma ordem
// de dependência que já era usada quando eram <script> separadas no
// <head>/<body> do index.html — cada um se registra em window.* para
// os onclick="..." do HTML continuarem funcionando sem mudança.
import './constants.js';
import './formatters.js';
import './data/pre-analise-data.js';
import './data/eligible-funds-data.js';
import './data-store.js';
import './supabase-client.js';
import './tabs/atividade.js';
import './tabs/pre-analise.js';
import './tabs/ranking.js';
import './tabs/segmentos.js';
import './tabs/fundos-elegiveis.js';
import './tabs/visao-geral.js';
import './modals/generic-list-modal.js';
import './modals/confirm-modal.js';
import './modals/forum.js';
import './tabs/carteira.js';
import './tabs/carteira-benchmarks.js';
import './tabs/analise.js';
import './tabs/analise-draft-autosave.js';
import './tabs/administracao.js';

// ── TOAST / NOTIFICAÇÕES (vanilla, zero dependências) ────────
/**
 * Exibe uma notificação toast não-bloqueante no canto superior direito.
 * Substitui os antigos alert() por feedback que não trava a interface.
 * @param {string} msg Texto da notificação (suporta \n para quebras de linha).
 * @param {'info'|'success'|'error'|'warning'} [type='info'] Tipo visual.
 * @param {number} [ms=4000] Tempo até auto-fechar em ms; use 0 para fixar.
 * @returns {void}
 */
function toast(msg, type='info', ms=4000){
 let cont=document.getElementById('toast-container');
 if(!cont){cont=document.createElement('div');cont.id='toast-container';document.body.appendChild(cont);}
 const ico={success:'✓',error:'✗',warning:'⚠️',info:'ℹ️'}[type]||'ℹ️';
 const el=document.createElement('div');
 el.className='toast'+(type&&type!=='info'?' '+type:'');
 el.setAttribute('role', type==='error'?'alert':'status');
 el.innerHTML='<span class="toast-ico" aria-hidden="true"></span><span class="toast-msg"></span>'+
 '<button class="toast-x" type="button" aria-label="Fechar notificação">✕</button>';
 el.querySelector('.toast-ico').textContent=ico;
 el.querySelector('.toast-msg').textContent=msg;
 const close=()=>{el.classList.add('leaving');setTimeout(()=>el.remove(),250);};
 el.querySelector('.toast-x').onclick=close;
 cont.appendChild(el);
 if(ms>0)setTimeout(close,ms);
}

const tableSortState={};
function showTab(id,el){
 document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
 document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
 document.getElementById('tab-'+id)?.classList.add('active');
 el.classList.add('active');
 if(id==='fundos') injectAnalyseTags();
 if(id==='segmentos') renderSegmentos();
 if(id==='carteira') initCarteira();
 if(id==='analise'){initAnaliseFundoDropdown();}
 if(id==='ranking'){ renderScoreRanking(); renderRankingEstabilidade(); }
 if(id==='admin') carregarListaSemanas();
 if(id==='pre'){renderPreAnalise();filterPreAnalise();}
 if(id==='atividade') renderAtividade();
}
function showSubTab(id,el){
 document.querySelectorAll('.sub-tab').forEach(t=>t.classList.remove('active'));
 document.querySelectorAll('.sub-content').forEach(t=>t.classList.remove('active'));
 el.classList.add('active');
 document.getElementById('sub-'+id)?.classList.add('active');
 if(id==='score') renderScoreRanking();
}
function toggleSection(id){const el=document.getElementById(id);if(!el)return;el.style.display=el.style.display==='none'?'block':'none';}
function sortTable(tblId,col){
 const tbl=document.getElementById(tblId);if(!tbl)return;
 const tbody=tbl.querySelector('tbody');if(!tbody)return;
 const st=tableSortState[tblId]||{col:-1,dir:0};
 const newDir=(st.col===col&&st.dir===1)?-1:1;
 tableSortState[tblId]={col,dir:newDir};
 tbl.querySelectorAll('thead th').forEach((th,i)=>{th.classList.remove('sorted');const a=th.querySelector('.sort-arrow');if(a)a.textContent='⇅';});
 const th=tbl.querySelectorAll('thead th')[col];
 if(th){th.classList.add('sorted');const a=th.querySelector('.sort-arrow');if(a)a.textContent=newDir===1?'↑':'↓';}
 const parse=txt=>{const n=parseFloat(txt.replace(/[^0-9.,-]/g,'').replace(',','.'));return isNaN(n)?txt.trim().toLowerCase():n;};
 const rows=Array.from(tbody.querySelectorAll('tr')).filter(r=>r.style.display!=='none');
 rows.sort((a,b)=>{
 const ca=(a.cells[col]?.dataset?.val??a.cells[col]?.textContent?.trim())||'';
 const cb=(b.cells[col]?.dataset?.val??b.cells[col]?.textContent?.trim())||'';
 const pa=parse(ca),pb=parse(cb);
 if(typeof pa==='number'&&typeof pb==='number')return newDir*(pa-pb);
 return newDir*String(pa).localeCompare(String(pb),'pt-BR');
 });
 rows.forEach(r=>tbody.appendChild(r));
}

window.toast = toast;
window.showTab = showTab;
window.showSubTab = showSubTab;
window.toggleSection = toggleSection;
window.sortTable = sortTable;

document.addEventListener('DOMContentLoaded', async ()=>{
 // 1. Render inicial com base no HTML estático já presente na página
 buildFundDataMap();
 injectAnalyseTags();
 injectPreAnaliseBadges();

 // 2. Carregar dados do Supabase. Usamos await em vez de setTimeout escalonados
 // para garantir que os badges/KPIs só sejam (re)injetados quando os dados
 // realmente estiverem disponíveis (A4). allSettled: uma falha não bloqueia a outra.
 await Promise.allSettled([
 supaLoad(), // análises (já reinjeta tags/ranking/KPIs ao final)
 carregarESemanaAtual() // semana mais recente → renderizarSemana reinjeta tags e badges
 ]);

 // 3. Pós-carga (dados já presentes): atualizar a UI dependente uma única vez.
 // injectPreAnaliseBadges é idempotente (ignora linhas que já têm badge).
 injectPreAnaliseBadges();
 updateKpiRow();
 renderAtvVisaoGeral();
 await atualizarHeaderSemana();
 await carregarListaSemanas();
 await carregarPendentesForum();
 await carregarForumGlobal();
});
