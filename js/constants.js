'use strict';

// Critérios de elegibilidade — IMUTÁVEIS sem aprovação explícita do Pedro (ver CLAUDE.md §2).
export const CRIT_VOL = 400000;
export const CRIT_YIELD = 0.08;
export const CRIT_PVP = 1.15;
export const CRIT_MKT = 200000000;

// Paleta de cores por segmento — IMUTÁVEL sem aprovação explícita (ver CLAUDE.md §6/§7).
// Espelha as variáveis CSS --seg-*-c / --seg-*-bg no <style> do index.html; qualquer
// mudança de cor precisa ser feita nos dois lugares (aqui e no CSS) para não dessincronizar.
export const SEG_COLORS = {
 'Recebível':'#1a6fa8','Galpão Logístico':'#3B6D11','Shopping Center':'#854F0B',
 'Laje Corporativa':'#3C3489','Fundo de Fundos':'#085041','FI-Infra':'#7a1a6b',
 'FIAgro - FII':'#5e3a00','Hedge Fund':'#8B0000','Renda Urbana':'#0a5f7a',
 'Híbrido':'#4a4a00','Agronegócio':'#2d5a00','Desenvolvimento':'#003366',
 'Agência Bancária':'#333300','Hotel':'#552200','Educacional':'#002244','Outros':'#444444'
};
export const SEG_BG = {
 'Recebível':'#D2E5FF','Galpão Logístico':'#EAF3DE','Shopping Center':'#FAEEDA',
 'Laje Corporativa':'#EEEDFE','Fundo de Fundos':'#E1F5EE','FI-Infra':'#f5e1f7',
 'FIAgro - FII':'#fff3cd','Hedge Fund':'#FCEBEB','Renda Urbana':'#e1f5fb',
 'Híbrido':'#fffff0','Agronegócio':'#e8f5e1','Desenvolvimento':'#e1eaf5',
 'Agência Bancária':'#f5f5dc','Hotel':'#f5ebe1','Educacional':'#e1e8f5','Outros':'#f0f0f0'
};

// O script legado (index.html) ainda não é um módulo — ele enxerga essas constantes
// como globais via `window`, exatamente como antes da extração.
window.CRIT_VOL = CRIT_VOL;
window.CRIT_YIELD = CRIT_YIELD;
window.CRIT_PVP = CRIT_PVP;
window.CRIT_MKT = CRIT_MKT;
window.SEG_COLORS = SEG_COLORS;
window.SEG_BG = SEG_BG;
