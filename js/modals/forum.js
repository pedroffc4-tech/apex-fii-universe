'use strict';

// ══════════════════════════════════════════════════════════════
// FÓRUM DE DISCUSSÃO — Por fundo, com visão consolidada
// (Fase 4 da modularização)
// ══════════════════════════════════════════════════════════════
// Depende de `analyses`/getDB (globais via window) e de renderAtividade/
// renderAtvVisaoGeral (js/tabs/atividade.js) — todos acessíveis via window.

export let _forumTicker = '';
export let _forumPosts = [];
export let _pendingByTicker = {}; // cache de pendentes por ticker

export const FORUM_TIPO_MAP = {
 'comentario': {label:' Comentário', css:'ftb-comentario', border:'comentario'},
 'questionamento':{label:' Questionamento',css:'ftb-questionamento',border:'questionamento'},
 'aprovacao': {label:'✓ Aprovação', css:'ftb-aprovacao', border:'aprovacao'},
 'discordancia': {label:'⚠ Discordância', css:'ftb-discordancia', border:'discordancia'},
};

/**
 * Abre o painel do fórum de discussão para um fundo e carrega seus posts.
 * @param {string} ticker Ticker do fundo (ex.: 'KNCR11').
 * @returns {Promise<void>}
 */
export async function openForum(ticker){
 _forumTicker = ticker;
 const a = analyses[ticker];
 const overlay = document.getElementById('forum-overlay');
 if(!overlay) return;
 document.getElementById('forum-ticker').textContent = ticker;
 document.getElementById('forum-subtitle').textContent =
 (a?.nome||'') + (a?.analista ? ' · Analista: '+a.analista : '');
 // Reset tabs
 switchForumTab('posts', document.querySelector('.forum-tab'));
 overlay.classList.add('open');
 document.body.style.overflow = 'hidden';
 await loadForumPosts(ticker);
}

export function closeForum(){
 const overlay = document.getElementById('forum-overlay');
 if(overlay) overlay.classList.remove('open');
 document.body.style.overflow = '';
}

export function switchForumTab(tab, el){
 document.querySelectorAll('.forum-tab').forEach(t=>t.classList.remove('active'));
 document.querySelectorAll('.forum-tab-content').forEach(t=>t.classList.remove('active'));
 if(el) el.classList.add('active');
 document.getElementById('forum-tab-'+tab)?.classList.add('active');
}

export async function loadForumPosts(ticker){
 const list = document.getElementById('forum-posts-list');
 if(!list) return;
 list.innerHTML = '<div class="forum-empty"><div class="spinner" style="border-color:var(--apex-mist);border-top-color:var(--apex-blue);width:24px;height:24px;margin:0 auto 8px"></div>Carregando...</div>';
 const db = getDB();
 if(!db){ list.innerHTML='<div class="forum-empty">Supabase não disponível</div>'; return; }
 const {data, error} = await db.from('analysis_comments')
 .select('*').eq('ticker', ticker).order('created_at', {ascending:true});
 if(error){ list.innerHTML=`<div class="forum-empty" style="color:var(--danger)">Erro: ${error.message}</div>`; return; }
 _forumPosts = data || [];
 renderForumPosts(_forumPosts, list);
 // Atualizar badge
 const pending = _forumPosts.filter(p=>p.tipo==='questionamento'&&!p.resposta).length;
 _pendingByTicker[ticker] = pending;
 updateForumBadges();
 // Atualizar aba consolidada se estiver aberta
 if(document.getElementById('tab-atividade')?.classList.contains('active')) renderAtividade();
 renderAtvVisaoGeral();
}

export function renderForumPosts(posts, container){
 if(!posts.length){
 container.innerHTML='<div class="forum-empty"><div style="font-size:28px;margin-bottom:8px"></div><div style="font-weight:700;color:var(--apex-navy);margin-bottom:4px">Nenhuma discussão ainda</div><p style="font-size:11px">Clique em "+ Nova postagem" para iniciar uma discussão.</p></div>';
 return;
 }
 const a = analyses[_forumTicker];
 const responsavelAnalise = a?.analista || '';
 container.innerHTML = posts.map(p => {
 const tipo = FORUM_TIPO_MAP[p.tipo] || FORUM_TIPO_MAP['comentario'];
 const temResp = !!p.resposta;
 const respostaHtml = temResp
 ? `<div class="forum-resposta">
 <div class="forum-resposta-label">↳ Resposta de ${p.respondido_por||'—'} · ${p.respondido_em||''}</div>
 <div class="forum-resposta-texto">${p.resposta}</div>
 </div>`
 : p.tipo==='questionamento'
 ? `<div class="forum-pendente">
 <span>⏳ Aguardando resposta do analista responsável</span>
 <button class="btn-forum-responder" onclick="abrirResposta('${p.id}','${responsavelAnalise}')">Responder</button>
 </div>
 <div id="resp-form-${p.id}" class="forum-form-resposta" style="display:none">
 <div class="form-group" style="margin-bottom:8px">
 <label class="form-label">Respondendo como</label>
 <select class="form-select" id="resp-autor-${p.id}">
 <option value="">— Selecione —</option>
 <option>João V.</option><option>Lucas S.</option>
 <option>Pedro C.</option><option>Pedro F.</option><option>Rafael P.</option>
 </select>
 </div>
 <textarea class="form-textarea" id="resp-texto-${p.id}" placeholder="Sua resposta..." style="min-height:60px;margin-bottom:8px"></textarea>
 <div style="display:flex;gap:6px;justify-content:flex-end">
 <button onclick="document.getElementById('resp-form-${p.id}').style.display='none'"
 style="padding:5px 12px;background:#f0f0f0;color:var(--apex-navy);border:none;border-radius:5px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Manrope',sans-serif">Cancelar</button>
 <button onclick="enviarResposta('${p.id}')"
 style="padding:5px 12px;background:var(--success);color:#fff;border:none;border-radius:5px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Manrope',sans-serif">Publicar resposta</button>
 </div>
 </div>` : '';
 return `<div class="forum-post ${tipo.border}">
 <div class="forum-post-header">
 <span class="forum-post-autor">${p.autor}</span>
 <span class="forum-post-data">${p.data_comentario||''}</span>
 <span class="forum-tipo-badge ${tipo.css}">${tipo.label}</span>
 </div>
 <div class="forum-post-texto">${p.texto}</div>
 ${respostaHtml}
 </div>`;
 }).join('');
}

export function abrirResposta(id, analista){
 const el = document.getElementById('resp-form-'+id);
 if(!el) return;
 el.style.display = el.style.display==='none'?'block':'none';
 const sel = document.getElementById('resp-autor-'+id);
 if(sel && analista) sel.value = analista;
}

export async function enviarResposta(id){
 const autor = document.getElementById('resp-autor-'+id)?.value;
 const texto = document.getElementById('resp-texto-'+id)?.value?.trim();
 if(!autor){toast('Selecione o analista que está respondendo', 'warning');return;}
 if(!texto){toast('Escreva a resposta antes de publicar', 'warning');return;}
 const db=getDB();if(!db)return;
 const hoje=new Date();
 const data=String(hoje.getDate()).padStart(2,'0')+'/'+String(hoje.getMonth()+1).padStart(2,'0')+'/'+hoje.getFullYear();
 const {error}=await db.from('analysis_comments').update({
 resposta:texto, respondido_por:autor, respondido_em:data
 }).eq('id',id);
 if(error){toast('Erro: '+error.message, 'error');return;}
 await loadForumPosts(_forumTicker);
}

export async function publicarForumPost(){
 const autor = document.getElementById('forum-autor')?.value;
 const tipo = document.getElementById('forum-tipo')?.value;
 const texto = document.getElementById('forum-texto')?.value?.trim();
 if(!autor){toast('Selecione o analista', 'warning');return;}
 if(!texto){toast('Escreva a mensagem antes de publicar', 'warning');return;}
 const db=getDB();if(!db){toast('Supabase não disponível', 'error');return;}
 const hoje=new Date();
 const data=String(hoje.getDate()).padStart(2,'0')+'/'+String(hoje.getMonth()+1).padStart(2,'0')+'/'+hoje.getFullYear();
 const {error}=await db.from('analysis_comments').insert({
 ticker:_forumTicker, autor, tipo, texto, data_comentario:data,
 created_at:new Date().toISOString()
 });
 if(error){toast('Erro ao publicar: '+error.message, 'error');return;}
 document.getElementById('forum-texto').value='';
 document.getElementById('forum-autor').value='';
 switchForumTab('posts', document.querySelectorAll('.forum-tab')[0]);
 await loadForumPosts(_forumTicker);
}

// Atualizar badges em todos os botões de fórum
export function updateForumBadges(){
 document.querySelectorAll('[data-forum-ticker]').forEach(btn=>{
 const t=btn.dataset.forumTicker;
 const n=_pendingByTicker[t]||0;
 let badge=btn.querySelector('.forum-badge');
 if(n>0){
 if(!badge){badge=document.createElement('span');badge.className='forum-badge';btn.appendChild(badge);}
 badge.textContent=n;
 }else if(badge){badge.remove();}
 });
}

// Carregar contagem de pendentes para todos os fundos analisados
export async function carregarPendentesForum(){
 const db=getDB();if(!db)return;
 try{
 const tickers=Object.keys(analyses).filter(t=>analyses[t]?.finalizado);
 if(!tickers.length)return;
 const {data}=await db.from('analysis_comments')
 .select('ticker').eq('tipo','questionamento').is('resposta',null);
 if(data){
 data.forEach(r=>{_pendingByTicker[r.ticker]=(_pendingByTicker[r.ticker]||0)+1;});
 updateForumBadges();
 }
 }catch(e){console.warn('Forum pendentes:',e.message);}
}

// Fechar com ESC
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeForum();}});

export let _forumPostsGlobal=[];
export async function carregarForumGlobal(){
 const db=getDB();if(!db)return;
 try{
 const {data}=await db.from('analysis_comments').select('*').order('created_at',{ascending:false}).limit(100);
 _forumPostsGlobal=data||[];
 renderAtvVisaoGeral();
 if(document.getElementById('tab-atividade')?.classList.contains('active'))renderAtividade();
 }catch(e){console.warn('Forum global:',e.message);}
}

window.openForum = openForum;
window.closeForum = closeForum;
window.switchForumTab = switchForumTab;
window.loadForumPosts = loadForumPosts;
window.renderForumPosts = renderForumPosts;
window.abrirResposta = abrirResposta;
window.enviarResposta = enviarResposta;
window.publicarForumPost = publicarForumPost;
window.updateForumBadges = updateForumBadges;
window.carregarPendentesForum = carregarPendentesForum;
window.carregarForumGlobal = carregarForumGlobal;
window._forumTicker = _forumTicker;
window._forumPosts = _forumPosts;
window._pendingByTicker = _pendingByTicker;
window.FORUM_TIPO_MAP = FORUM_TIPO_MAP;
window._forumPostsGlobal = _forumPostsGlobal;
