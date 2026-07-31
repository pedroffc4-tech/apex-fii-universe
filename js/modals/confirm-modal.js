'use strict';

// ══════════════════════════════════════════════════════════════
// MODAL DE CONFIRMAÇÃO GENÉRICO — "digite a palavra para confirmar"
// (Fase 4 da modularização)
// ══════════════════════════════════════════════════════════════
// Padrão reusável por qualquer ação destrutiva (excluir análise, ocultar
// semana, etc. — ver CLAUDE.md §11: "Ações destrutivas exigem confirmação
// digitando uma palavra-chave"). Os consumidores (confirmarExcluirAnalise,
// confirmarExcluirSemana, ...) ficam com suas respectivas abas.

let _confirmAction = null;
let _confirmExpected = '';

/**
 * Abre o modal de confirmação para ações destrutivas. O usuário precisa
 * digitar uma palavra-chave (ex.: o ticker ou a data) para habilitar o botão.
 * @param {Object} opts Opções da confirmação.
 * @param {string} opts.title Título do modal.
 * @param {string} opts.desc Descrição da ação e suas consequências.
 * @param {string} opts.wordLabel Rótulo do campo de confirmação.
 * @param {string} opts.expectedWord Palavra que o usuário deve digitar para confirmar.
 * @param {Function} opts.onConfirm Callback (sync ou async) executado ao confirmar.
 * @returns {void}
 */
export function openConfirmModal({title, desc, wordLabel, expectedWord, onConfirm}){
 _confirmAction = onConfirm;
 _confirmExpected = expectedWord.toUpperCase();
 document.getElementById('confirm-title').textContent = title;
 document.getElementById('confirm-desc').textContent = desc;
 document.getElementById('confirm-word-label').textContent = wordLabel;
 document.getElementById('confirm-word').value = '';
 document.getElementById('confirm-word').placeholder = expectedWord;
 const btn = document.getElementById('confirm-ok-btn');
 btn.disabled = true;
 btn.style.background = '#ccc';
 btn.style.cursor = 'not-allowed';
 document.getElementById('confirm-overlay').classList.add('open');
 setTimeout(()=>document.getElementById('confirm-word').focus(), 100);
}

export function closeConfirmModal(){
 document.getElementById('confirm-overlay').classList.remove('open');
 _confirmAction = null;
}

export function checkConfirmReady(){
 const inputEl = document.getElementById('confirm-word');
 const word = (inputEl?.value||'').toUpperCase().trim();
 const ok = word === _confirmExpected.toUpperCase().trim();
 const btn = document.getElementById('confirm-ok-btn');
 if(!btn) return;
 btn.disabled = !ok;
 btn.style.background = ok ? 'var(--danger)' : '#ccc';
 btn.style.cursor = ok ? 'pointer' : 'not-allowed';
 if(inputEl) inputEl.classList.toggle('danger', word.length>0 && !ok);
}

export async function executeConfirmAction(){
 if(!_confirmAction||typeof _confirmAction!=='function') return;
 const action = _confirmAction; // salvar antes de fechar (closeConfirmModal zera _confirmAction)
 closeConfirmModal();
 await action();
}

window.openConfirmModal = openConfirmModal;
window.closeConfirmModal = closeConfirmModal;
window.checkConfirmReady = checkConfirmReady;
window.executeConfirmAction = executeConfirmAction;
