// ==UserScript==
// @name         Ileva - Alertas de Atendimento (Equipe)
// @namespace    https://ileva.com.br/supervisor-equipe
// @version      2.0.0
// @description  Versão para colaboradores: mostra só os atendimentos em aberto / aguardando resposta, com o menu de prazo. Sem configurações, sem revisão de tom, sem base, sem relatórios. SOMENTE LEITURA.
// @match        *://*/*
// @noframes
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @run-at       document-idle
// ==/UserScript==
/* Gerado automaticamente a partir do ileva-supervisor-core.js. Não edite este arquivo à mão. */
(function () {
  'use strict';
  if (window.__ilevaSupervisor) return;
  window.__ilevaSupervisor = true;
  // Extensão própria "Ileva Supervisor": quando ela está instalada, o script do Tampermonkey fica parado
  // e, na primeira vez, entrega para a extensão os dados que guardava (reuniões, preferências, tarefas...).
  const IS_EXT = typeof __ILEVA_EXT__ !== 'undefined';
  if (!IS_EXT && document.documentElement.hasAttribute('data-ileva-ext')) {
    try {
      if (location.hostname === 'web.whatsapp.com' && typeof GM_getValue === 'function' && !localStorage.getItem('ilevaSup.migr.v1')) {
        const d = {}; ['ilevaSup.meet.v1','ilevaSup.ui.v1','ilevaSup.rxdone.v1','ilevaSup.user.v1','ilevaSup.mt.v1','ilevaSup.mtReun.v1','ilevaSup.cob.v1','ilevaSup.chat.v1','ilevaSup.pres.v1','ilevaSup.lunch.v1','ilevaSup.lemb.v1','ilevaSup.mtAgenda.v1','ilevaSup.block.v1','ilevaSup.mtClean.v1','ilevaSup.tar.v1','ilevaSup.tarSeen.v1','ilevaSup.closeKb.v1','ilevaSup.offers.v1','ilevaSup.tarMtQ.v1','ilevaSup.summary.v1','ilevaSup.lastAct.v1','ilevaSup.lunchLog.v1','ilevaSup.finQ.v1','ilevaSup.mtReunQ.v1','ilevaSup.rxSent.v1','ilevaSup.welcome.v1','ilevaSup.eod.v1'].forEach(k => { const v = GM_getValue(k, null); if (v != null) d[k] = v; });
        localStorage.setItem('ilevaSup.migr.v1', JSON.stringify({ at: Date.now(), d }));
      }
    } catch (e) { }
    return;
  }

  const VERSION = '1.5.0-equipe';
  const LS_CFG = 'ilevaSup.cfg.v1';
  const LS_DATA = 'ilevaSup.data.v1';
  const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;

  // ------------------------------------------------------------------ CONFIG
  const DEFAULT_CFG = {
    team: [
      'Lucas - Atendimento', 'Adriel - Atendimento', 'Richard - Atendimento',
      'Stony', 'Akim Ileva', 'Francisco - ILEVA', 'Você'
    ],
    teamRegex: 'atendimento ao cliente|ileva\\s*-\\s*atendimento',
    ignoreGroups: ['TIME - ILEVA', 'Ileva - Suporte', 'Clientes Ileva Novos', 'Equipe de Suporte interna'],
    clientGroupRegex: '(&|/)\\s*ileva|ileva\\s*(&|/)',
    autoRound: false,
    morningAuto: true,      // leitura diária automática de todos os grupos
    idleSec: 120,
    roundEveryMin: 10,
    promiseHours: 2,
    morningTime: '08:15',   // leitura diária de todos os grupos
    morningDays: 7,         // considera grupos com atividade nos últimos N dias
    notify: false
  };

  // WhatsApp Web = painel completo. Outras abas = "vitrine": só a barra de atendimentos, os alertas de reunião e o mascote.
  const IS_WA = location.hostname === 'web.whatsapp.com';
  const HAS_GM = typeof GM_getValue === 'function' && typeof GM_setValue === 'function';
  if (!IS_WA && !HAS_GM) return; // sem o armazenamento do Tampermonkey não há como mostrar nada fora do WhatsApp
  // reuniões e preferências de tela ficam no armazenamento do Tampermonkey, compartilhado por todas as abas
  const GM_KEYS = new Set(['ilevaSup.meet.v1', 'ilevaSup.ui.v1', 'ilevaSup.rxdone.v1', 'ilevaSup.user.v1', 'ilevaSup.mt.v1', 'ilevaSup.mtReun.v1', 'ilevaSup.cob.v1', 'ilevaSup.chat.v1', 'ilevaSup.pres.v1', 'ilevaSup.lunch.v1', 'ilevaSup.lemb.v1', 'ilevaSup.mtAgenda.v1', 'ilevaSup.block.v1', 'ilevaSup.mtClean.v1', 'ilevaSup.tar.v1', 'ilevaSup.tarSeen.v1', 'ilevaSup.closeKb.v1', 'ilevaSup.offers.v1', 'ilevaSup.tarMtQ.v1']);
  const UI_SHARED = ['fabPos', 'meetPos', 'fabPosMon', 'meetPosMon', 'meetMin', 'meetMinMon', 'meetHideMon', 'fabOp', 'meetOp', 'pqOp', 'mascot', 'miniMon', 'miniAll', 'miniMin', 'miniMinAt', 'meetSound', 'saverMon', 'mascot3d', 'corp'];
  const gmGetJ = (k, d) => { try { const v = GM_getValue(k, null); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const gmSetJ = (k, v) => { try { GM_setValue(k, JSON.stringify(v)); } catch (e) { } };
  const lsGet = (k, d) => {
    if (HAS_GM && GM_KEYS.has(k)) {
      const g = gmGetJ(k, null);
      if (g != null) return g;
      if (!IS_WA) return d;
    } else if (!IS_WA) return d; // fora do WhatsApp não lê nada do site
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; }
  };
  const lsSet = (k, v) => {
    if (HAS_GM && GM_KEYS.has(k)) {
      if (k === 'ilevaSup.ui.v1' && !IS_WA) { // na vitrine só compartilha posição/transparência/mascote
        const cur = gmGetJ(k, {}); UI_SHARED.forEach(x => { if (v[x] !== undefined) cur[x] = v[x]; }); gmSetJ(k, cur); return;
      }
      gmSetJ(k, v);
    }
    if (!IS_WA) return; // nunca grava nada no armazenamento dos outros sites
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* cheio ou bloqueado */ }
  };
  const TT = (() => { try { return window.trustedTypes && trustedTypes.createPolicy ? trustedTypes.createPolicy('ilevaSupervisor', { createHTML: x => x }) : null; } catch (e) { return null; } })();
  let pipWin = null; // janela flutuante (Picture-in-Picture), quando aberta
  const VW = () => pipWin ? pipWin.innerWidth : window.innerWidth, VH = () => pipWin ? pipWin.innerHeight : window.innerHeight;
  const setHTML = (el, html, pos) => { try { const v = TT ? TT.createHTML(html) : html; if (pos) el.insertAdjacentHTML(pos, v); else el.innerHTML = v; } catch (e) { } };

  let cfg = Object.assign({}, DEFAULT_CFG, { notify: true, autoRound: false });
  let data = lsGet(LS_DATA, null);
  if (!data || typeof data !== 'object' || !data.groups) data = { groups: {} };
  if (!data.final) data.final = {};      // grupo -> { ts, by } atendimento finalizado manualmente
  if (!data.dismissed) data.dismissed = {}; // chave da mensagem -> ts (alerta de tom já revisado)
  // data.morning = { date:'2026-10-30', at: ts, items:[{name, kind, since}] } – pendências encontradas na leitura das 08:15

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // EXPEDIENTE: segunda a sexta, 08:00 às 18:00
  const BIZ_OPEN = 8 * 60, BIZ_CLOSE = 18 * 60;
  const isBizDay = d => d.getDay() >= 1 && d.getDay() <= 5;
  function inBiz(ts) { const d = new Date(ts), m = d.getHours() * 60 + d.getMinutes(); return isBizDay(d) && m >= BIZ_OPEN && m < BIZ_CLOSE; }
  function nextOpen(ts) { // quando o expediente começa (ou ts, se já estiver dentro)
    if (inBiz(ts)) return ts;
    const d = new Date(ts);
    if (isBizDay(d) && d.getHours() * 60 + d.getMinutes() < BIZ_OPEN) { d.setHours(8, 0, 0, 0); return d.getTime(); }
    do { d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); } while (!isBizDay(d));
    return d.getTime();
  }
  function bizWindowStart(now) { // fim do expediente do último dia útil antes de hoje (segunda -> sexta 18:00)
    const d = new Date(now); d.setHours(12, 0, 0, 0);
    do { d.setDate(d.getDate() - 1); } while (!isBizDay(d));
    d.setHours(18, 0, 0, 0); return d.getTime();
  }

  // ------------------------------------------------------------------ TEXT UTILS
  const norm = s => String(s || '').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim();
  const cleanName = s => norm(s).replace(/^~\s*/, '');
  const lc = s => norm(s).toLowerCase();
  const deacc = s => lc(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const pad = n => String(n).padStart(2, '0');

  function isTeam(sender) {
    const s = cleanName(sender);
    if (!s) return false;
    if (/^você$/i.test(s)) return true;
    const l = s.toLowerCase();
    if (cfg.team.some(t => { const tl = String(t || '').toLowerCase().trim(); return tl && (l.includes(tl) || (l.length >= 3 && (tl === l || tl.startsWith(l + ' ') || tl.startsWith(l + ' -')))); })) return true;
    try { return new RegExp(cfg.teamRegex, 'i').test(s); } catch (e) { return false; }
  }
  function isClientGroup(name) {
    const l = lc(name);
    if (!l) return false;
    if (cfg.ignoreGroups.some(g => g && l.includes(String(g).toLowerCase()))) return false;
    try { return new RegExp(cfg.clientGroupRegex, 'i').test(name); } catch (e) { return false; }
  }
  function shortName(sender) {
    const s = cleanName(sender);
    if (/^você$/i.test(s)) return 'Você';
    return s.split(/\s+-\s+/)[0].trim() || s;
  }
  const isPhone = s => /^\+?[\d\s()-]{8,}$/.test(cleanName(s));

  // Mensagens que não contam como "relevantes" (ok, obrigado, figurinha etc.)
  const TRIVIAL_WORDS = new Set(('ok okk okkk okay oki okey blz beleza certo certinho perfeito show top joia ta ' +
    'entendi entendido ah aa a sim isso valeu vlw obg obgd obrigado obrigada obrigadao obrigados obrigadas ' +
    'brigado brigada grato grata muito mto pelo retorno de nada combinado maravilha otimo e o tudo bem bom tb tbm tambem igualmente td ' +
    'opa opaa oi ola paz em gracas graca deus amem espero que por ai aqui tranquilo tranquila firme forte voce vc vcs sim tudo bom boa graças tmj').split(' '));
  const GREET_WORDS = new Set('bom boa dia tarde noite tenha um uma otimo otima excelente feliz bons boas abraco abracos att atenciosamente ate mais logo amanha semana fim final trabalho pessoal ai voce voces tambem igualmente pra para vc vcs'.split(' '));
  const ACK_WORDS = new Set('ok okk okay oki okey blz beleza certo certinho perfeito joia ta entendi entendido valeu vlw obg obgd obrigado obrigada obrigadao obrigados obrigadas brigado brigada grato grata combinado maravilha otimo show top igualmente'.split(' '));
  function isTrivial(text) {
    const t = deacc(text);
    if (!t) return true;
    if (/^aguardando mensagem/.test(t)) return true;
    if (/^(figurinha|sticker|mensagem apagada|esta mensagem foi apagada|voce apagou esta mensagem|\[figurinha\]|\[midia\]|foto|imagem)$/.test(t)) return true;
    const words = t.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
    if (!words.length) return true; // só emoji
    if (words.length > 9) return false;
    if (words.every(w => TRIVIAL_WORDS.has(w))) return true;
    // "Tá bem, obrigada, boa tarde" / "Obrigado, tenha um ótimo dia" -> encerramento
    const hasAck = words.some(w => ACK_WORDS.has(w));
    return hasAck && words.every(w => TRIVIAL_WORDS.has(w) || GREET_WORDS.has(w));
  }
  // mensagem de encerramento do cliente (agradecimento/confirmação)
  function isClosing(text) {
    const t = deacc(text || '');
    if (!t || /\?/.test(t)) return false;
    if (closeLearned(text)) return true;
    if (isTrivial(text) && /\b(obrigad|brigad|obg|valeu|vlw|grat[oa]|agradec|entendi|entendido|certo|perfeito|combinado|ok|beleza|blz|show|top|resolvido|deu certo|funcionou)/.test(t)) return true;
    return t.length <= 60 && /^((entendi|entendido|ok|okk|certo|perfeito|show|top|beleza|blz|combinado|deu certo|deu tudo certo|funcionou|resolvido|resolveu|tudo certo|ah sim|otimo|maravilha)[ ,.!]*)*(muito |mto )?(obrigad|agradec|valeu|vlw|grat)/.test(t);
  }
  // ===== Base de encerramento aprendida com os "Finalizar" da equipe =====
  const CLOSE_KB = 'ilevaSup.closeKb.v1', CLOSE_MIN = 2;
  const closeKey = t => deacc(t || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const CLOSE_REQ = /\b(preciso|precisamos|pode|podem|poderia|poderiam|consegue|conseguem|gostaria|favor|envia|enviar|manda|mandar|verificar|verifica|ver se|quando|como|qual|quais|onde|porque|por que|nao (chegou|consigo|recebi|funciona)|erro|problema|urgente|aguardo)\b/;
  function closeKbAll() { const k = lsGet(CLOSE_KB, {}); return k && typeof k === 'object' ? k : {}; }
  function closeKbAdd(text, id, by, ts, del) {
    const key = closeKey(text); if (!key) return;
    const kb = closeKbAll(); const e = kb[key] || { text: String(text).slice(0, 140), ids: [], by: [], at: 0 };
    if (del) { e.del = ts || Date.now(); }
    else if (!e.ids.includes(id)) { e.ids.push(id); e.ids = e.ids.slice(-50); if (by && !e.by.includes(by)) e.by.push(by); e.at = Math.max(e.at || 0, ts || Date.now()); if (e.del && (ts || 0) > e.del) delete e.del; }
    kb[key] = e; lsSet(CLOSE_KB, kb);
  }
  function closeLearned(text) { const e = closeKbAll()[closeKey(text)]; return !!(e && !e.del && e.ids.length >= CLOSE_MIN); }
  // Cliente avisou que vai mandar algo -> aguardando o cliente
  const AWAIT_RE = /^(um |so um |s[oó] um )?(momento|momenot|minuto|instante|segundinho|segundo)\b|^(vou|irei) (verificar|ver|olhar|mandar|enviar|pegar|conferir|pedir|checar|solicitar)|^ja (te |lhes? )?(mando|envio|passo)|^solicitei|^estou verificando|^vou providenciar/;
  // Equipe prometeu retorno
  const PROMISE_RE = /(amanha|assim que (tivermos|tiver|recebermos|eles)|quando (tivermos|eles nos|o setor)|informaremos|retornaremos|daremos (um )?retorno|estaremos (lhe )?informando|setor responsavel|devolutiva|aguardando retorno)/;

  // ------------------------------------------------------------------ TIME UTILS
  const TIME_RE = /^\d{1,2}:\d{2}$/;
  const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  function todayAt(h, m) { const d = new Date(); d.setHours(h, m, 0, 0); return d.getTime(); }
  function labelToTs(label) {
    const l = lc(label);
    if (TIME_RE.test(l)) { const [h, m] = l.split(':').map(Number); let t = todayAt(h, m); if (t > Date.now() + 5 * MIN) t -= DAY; return { ts: t, exact: true }; } // horário "no futuro" = era de ontem
    if (l === 'ontem') { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(12, 0, 0, 0); return { ts: d.getTime(), exact: false, label: 'ontem' }; }
    const wi = WEEKDAYS.indexOf(l);
    if (wi >= 0) { const d = new Date(); let back = (d.getDay() - wi + 7) % 7 || 7; d.setDate(d.getDate() - back); d.setHours(12, 0, 0, 0); return { ts: d.getTime(), exact: false, label: l }; }
    const m = l.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) { let y = +m[3]; if (y < 100) y += 2000; return { ts: new Date(y, +m[2] - 1, +m[1], 12, 0).getTime(), exact: false, label: l }; }
    return { ts: null, exact: false };
  }
  function parsePre(pre) {
    const m = String(pre || '').match(/^\[(\d{1,2}):(\d{2})(?::\d{2})?,\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})\]\s*(.*?):\s*$/);
    if (!m) return null;
    let y = +m[5]; if (y < 100) y += 2000;
    return { ts: new Date(y, +m[4] - 1, +m[3], +m[1], +m[2]).getTime(), sender: norm(m[6]) };
  }
  function fmtDur(ms) {
    if (ms < 0) ms = 0;
    const m = Math.floor(ms / MIN);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60), mm = m % 60;
    if (h < 24) return `${h} h ${pad(mm)} min`;
    return `${Math.floor(h / 24)} d ${h % 24} h`;
  }
  function fmtTime(ts, approxLabel) {
    if (approxLabel) return approxLabel;
    const d = new Date(ts), now = new Date();
    const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (d.toDateString() === now.toDateString()) return hm;
    const y = new Date(now); y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return `ontem ${hm}`;
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${hm}`;
  }
  function saud(ts) { const h = new Date(ts || Date.now()).getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; }

  // ------------------------------------------------------------------ STORE
  function G(name) { return data.groups[name] || (data.groups[name] = { msgs: [], preview: null, lastChatRead: 0 }); }
  function addMsg(name, msg) {
    const g = G(name);
    msg.text = norm(msg.text);
    const t = msg.text.slice(0, 40);
    const ex = g.msgs.find(m => Math.abs(m.ts - msg.ts) <= MIN && (m.role === msg.role || isTeam(m.sender) === isTeam(msg.sender)) &&
      ((m.text || '').startsWith(t) || msg.text.startsWith((m.text || '').slice(0, 40))));
    if (ex) {
      if (ex.role !== msg.role && msg.role === 'team') ex.role = 'team';
      if (msg.src === 'chat' && ex.src !== 'chat') Object.assign(ex, msg);
      else if (msg.src === ex.src && msg.text.length > (ex.text || '').length) ex.text = msg.text;
      return ex;
    }
    g.msgs.push(msg);
    g.msgs.sort((a, b) => a.ts - b.ts);
    if (g.msgs.length > 400) g.msgs.splice(0, g.msgs.length - 400);
    return msg;
  }
  function prune() {
    const lim = Date.now() - 8 * DAY;
    const lim30 = Date.now() - 30 * DAY;
    for (const k of Object.keys(data.final || {})) if (!data.final[k] || data.final[k].ts < lim30) delete data.final[k];
    for (const k of Object.keys(data.dismissed || {})) if (data.dismissed[k] < lim30) delete data.dismissed[k];
    for (const n of Object.keys(data.groups)) {
      const g = data.groups[n];
      g.msgs = g.msgs.filter(m => m.ts >= lim);
      if (!g.msgs.length && (!g.preview || !g.preview.ts || g.preview.ts < Date.now() - 8 * DAY)) delete data.groups[n];
    }
  }
  let saveTimer = 0;
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => lsSet(LS_DATA, data), 500); }

  // ------------------------------------------------------------------ READERS (somente leitura do DOM)
  function listRows() {
    const pane = document.querySelector('#pane-side');
    if (!pane) return [];
    return [...new Set(pane.querySelectorAll('[role="row"],[role="listitem"]'))];
  }
  function parseRow(r) {
    const tEl = r.querySelector('span[title]');
    const lines = (r.innerText || '').split('\n').map(norm).filter(Boolean);
    let name = norm(tEl && tEl.getAttribute('title'));
    if (!name) name = lines.find(l => !/mensage(m|ns) não lida/i.test(l)) || '';
    const timeLabel = lines.find(l => TIME_RE.test(l) || /^ontem$/i.test(l) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(l) || WEEKDAYS.includes(l.toLowerCase())) || '';
    const isDraft = lines.some(l => /^rascunho/i.test(l));
    const isReaction = lines.some(l => /reagiu com/i.test(l));
    const ci = lines.findIndex(l => l === ':');
    let sender = null, text = '';
    if (ci > 0) {
      sender = lines[ci - 1];
      text = lines.slice(ci + 1).filter(l => !/^\d+$/.test(l)).join(' ');
    } else {
      const ti = lines.indexOf(timeLabel);
      text = lines.slice(ti + 1).filter(l => !/^\d+$/.test(l) && !/mensage(m|ns) não lida/i.test(l)).join(' ');
    }
    return { name, timeLabel, sender, text, isDraft, isReaction };
  }
  function ingestList() {
    for (const r of listRows()) {
      const p = parseRow(r);
      if (!p.name || !isClientGroup(p.name)) continue;
      const g = G(p.name);
      if (p.isDraft || p.isReaction) { if (g.preview) g.preview.seen = Date.now(); continue; }
      const t = labelToTs(p.timeLabel);
      const role = p.sender ? (isTeam(p.sender) ? 'team' : 'client') : null;
      g.preview = { sender: p.sender, text: p.text, timeLabel: p.timeLabel, ts: t.ts, exact: t.exact, approxLabel: t.label || null, role, seen: Date.now() };
      if (t.exact && role) addMsg(p.name, { ts: t.ts, sender: p.sender, text: p.text, role, src: 'list' });
    }
  }
  function currentChatName() {
    const h = document.querySelector('#main header');
    if (!h) return null;
    const first = norm((h.innerText || '').split('\n')[0]);
    if (first) return first;
    const t = h.querySelector('span[title]');
    return norm(t && t.getAttribute('title')) || null;
  }
  function composerHasText() {
    const c = document.querySelector('#main footer [contenteditable="true"]');
    return !!(c && norm(c.innerText).length);
  }
  function ingestOpenChat() {
    const main = document.querySelector('#main');
    if (!main) return;
    const name = currentChatName();
    if (!name || !isClientGroup(name)) return;
    const g = G(name);
    const now = Date.now();
    let lastTs = null;
    for (const r of main.querySelectorAll('[role="row"]')) {
      const isOut = !!r.querySelector('.message-out');
      const isIn = !!r.querySelector('.message-in');
      if (!isOut && !isIn) continue;
      const pre = r.querySelector('[data-pre-plain-text]');
      if (pre) {
        const p = parsePre(pre.getAttribute('data-pre-plain-text'));
        if (!p) continue;
        lastTs = p.ts;
        const spans = [...pre.querySelectorAll('span.selectable-text')].filter(s => !s.closest('[role="button"]'));
        let text = spans.length ? spans.map(s => s.innerText).join(' ') : pre.innerText;
        text = norm(text).replace(/\s*Ler mais$/i, '');
        const role = (isOut || isTeam(p.sender)) ? 'team' : 'client';
        addMsg(name, { ts: p.ts, sender: p.sender, text, role, src: 'chat' });
      } else {
        // mídia sem texto: só consideramos áudio (figurinha/foto sem legenda são ignoradas)
        const txt = r.innerText || '';
        const times = txt.match(/\b\d{1,2}:\d{2}\b/g) || [];
        const isAudio = !!r.querySelector('audio,[data-icon*="audio"],[data-icon*="ptt"],[aria-label*="áudio" i],[aria-label*="voz" i]');
        const isVideo = !isAudio && !!r.querySelector('video,[data-icon*="video"],[data-icon*="media-play"],[aria-label*="vídeo" i],[aria-label*="video" i]');
        const isDoc = !isAudio && !isVideo && !!r.querySelector('[data-icon*="document"],[data-icon*="doc-"],[data-icon*="pdf"],[title*="Baixar" i],[aria-label*="documento" i]');
        const isImg = !isAudio && !isVideo && !isDoc && !!r.querySelector('img[src^="blob:"]') && !r.querySelector('[data-icon*="sticker"]');
        if (!times.length || !(isAudio || times.length >= 2 || isVideo || isDoc || isImg)) continue;
        const kind = isVideo ? '[vídeo]' : isDoc ? '[documento]' : isImg ? '[imagem]' : '[áudio]';
        const [hh, mm] = times[times.length - 1].split(':').map(Number);
        const base = lastTs ? new Date(lastTs) : new Date();
        base.setHours(hh, mm, 0, 0);
        let ts = base.getTime();
        if (lastTs && ts < lastTs - MIN) ts += DAY;
        if (ts > now + 5 * MIN) ts -= DAY;
        let sender = isOut ? 'Você' : norm(txt.split('\n')[0]);
        if (!sender || /\d{1,2}:\d{2}/.test(sender)) sender = 'Cliente';
        const mrole = (isOut || isTeam(sender)) ? 'team' : 'client';
        if (kind !== '[áudio]' && mrole !== 'team') { lastTs = ts; continue; } // mídia do cliente sem texto continua ignorada
        addMsg(name, { ts, sender, text: kind, role: mrole, src: 'chat' });
        lastTs = ts;
      }
    }
    g.lastChatRead = now;
    if (g._learnedN !== g.msgs.length) { g._learnedN = g.msgs.length; try { learnGroup(name); } catch (e) { console.warn('[Supervisor Ileva] aprender', e); } }
  }

  // ------------------------------------------------------------------ RONDA (abre grupos – nunca digita)
  let lastInput = Date.now(), rounding = false, manualRound = false, abortRound = false, lastRound = 0, lastSweep = 0, roundInfo = '';
  ['keydown', 'mousedown', 'wheel', 'touchstart'].forEach(ev => document.addEventListener(ev, e => {
    if (!e.isTrusted) return;
    const inPanel = host && e.composedPath && e.composedPath().includes(host);
    if (inPanel) return;
    lastInput = Date.now();
    if (rounding && !manualRound) abortRound = true;
  }, true));

  async function sweepList() {
    const pane = document.querySelector('#pane-side');
    if (!pane) return [];
    const start = pane.scrollTop;
    const names = new Set();
    pane.scrollTop = 0; await sleep(300);
    let prev = -1;
    for (let i = 0; i < 80; i++) {
      ingestList();
      for (const r of listRows()) { const p = parseRow(r); if (p.name && isClientGroup(p.name)) names.add(p.name); }
      if (pane.scrollTop === prev || abortRound) break;
      prev = pane.scrollTop;
      pane.scrollTop += Math.max(200, pane.clientHeight * 0.8);
      await sleep(350);
    }
    pane.scrollTop = start;
    lastSweep = Date.now();
    return [...names];
  }
  async function findRow(name) {
    let r = listRows().find(x => parseRow(x).name === name);
    if (r) return r;
    const pane = document.querySelector('#pane-side');
    if (!pane) return null;
    const start = pane.scrollTop;
    pane.scrollTop = 0; await sleep(300);
    let prev = -1;
    for (let i = 0; i < 80; i++) {
      r = listRows().find(x => parseRow(x).name === name);
      if (r) return r;
      if (pane.scrollTop === prev) break;
      prev = pane.scrollTop;
      pane.scrollTop += Math.max(200, pane.clientHeight * 0.8);
      await sleep(300);
    }
    pane.scrollTop = start;
    return null;
  }
  async function openChat(name) {
    pipFocusWa();
    if (currentChatName() === name) return true;
    const r = await findRow(name);
    if (!r) return false;
    const t = r.querySelector('span[title]') || r;
    for (const type of ['mousedown', 'mouseup', 'click']) t.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    for (let i = 0; i < 25; i++) { await sleep(200); if (currentChatName() === name) break; }
    await sleep(1200);
    return currentChatName() === name;
  }
  async function round(manual, lookbackMs, label) {
    if (!pode('ronda')) return;
    if (rounding) return;
    rounding = true; manualRound = !!manual; abortRound = false;
    const LB = lookbackMs || 36 * HOUR;
    const tag = label || 'Ronda';
    roundInfo = `${tag}: listando grupos…`; render(true);
    try {
      const original = currentChatName();
      const names = await sweepList();
      const recent = names.filter(n => { const pv = data.groups[n] && data.groups[n].preview; return pv && pv.ts && Date.now() - pv.ts < LB; });
      for (let i = 0; i < recent.length; i++) {
        if (abortRound) break;
        if (!manual && composerHasText()) break;
        roundInfo = `${tag}: ${i + 1}/${recent.length} — ${recent[i]}`; render(true);
        if (await openChat(recent[i])) ingestOpenChat();
      }
      if (original && currentChatName() !== original) await openChat(original);
      lastRound = Date.now();
      return !abortRound;
    } catch (e) { console.warn('[Supervisor Ileva] ronda', e); }
    finally { rounding = false; roundInfo = ''; save(); render(true); }
  }
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
  function morningDue() { return false;
    const [hh, mm] = String(cfg.morningTime || '08:15').split(':').map(Number);
    const t = new Date(); t.setHours(hh || 8, mm || 0, 0, 0);
    return cfg.morningAuto !== false && Date.now() >= t.getTime() && (!data.morning || data.morning.date !== dayKey());
  }
  let morningRetryAt = 0, morningTries = 0;
  if (!data.morningInit) {
    data.morningInit = true;
    const [hh, mm] = String(cfg.morningTime || '08:15').split(':').map(Number);
    const t = new Date(); t.setHours(hh || 8, mm || 0, 0, 0);
    if (Date.now() >= t.getTime()) data.morning = { date: dayKey(), at: 0, items: [], pending: true };
    lsSet(LS_DATA, data);
  }
  async function morningRound(manual) {
    if (rounding) return;
    const ok = await round(manual, cfg.morningDays * DAY, '🌅 Leitura do início do dia');
    if (!ok && !manual) {
      // interrompida: tenta de novo em 5 min, no máximo 3 vezes por dia (depois desiste até amanhã)
      morningTries++;
      if (morningTries >= 3) { data.morning = { date: dayKey(), at: Date.now(), items: [], skipped: true }; lsSet(LS_DATA, data); return; }
      morningRetryAt = Date.now() + 5 * MIN; return;
    }
    try { learnAll(); } catch (e) { }
    snapshotMorning();
  }
  function snapshotMorning() {
    const today0 = startOfToday();
    const items = [];
    for (const n of Object.keys(data.groups)) {
      if (!isClientGroup(n)) continue;
      const c = computeGroup(n);
      if (!c) continue;
      if (c.status === 'open' || c.status === 'await') {
        const since = c.pend[0] ? c.pend[0].ts : (c.lastRel ? c.lastRel.ts : 0);
        const lab = (c.pend[0] && c.pend[0].approxLabel) || (c.lastRel && c.lastRel.approxLabel) || null;
        if (since < today0) items.push({ name: n, kind: c.status, since, label: lab });
      } else if (c.promise && c.promise.since < today0) items.push({ name: n, kind: 'promise', since: c.promise.since });
    }
    items.sort((a, b) => a.since - b.since);
    data.morning = { date: dayKey(), at: Date.now(), items };
    lsSet(LS_DATA, data);
    if (cfg.notify && 'Notification' in window && Notification.permission === 'granted' && items.length) {
      try { ilevaNotif('🌅 Pendências do início do dia', { body: `${items.length} atendimento(s) ficaram em aberto. Veja na aba "Início do dia".`, tag: 'ileva-morning' }); } catch (e) { }
    }
    ui.tab = 'manha'; ui.filter = null; saveUi(); render(true);
  }
  async function maybeAuto() {
    if (rounding) return;
    // leitura diária às 08:15 (ou na primeira vez que o WhatsApp for aberto depois desse horário)
    if (morningDue() && Date.now() >= morningRetryAt) {
      const busy = Date.now() - lastInput < 30 * 1000 || composerHasText();
      if (!busy) { morningRound(false); return; }
    }
    const idle = Date.now() - lastInput > cfg.idleSec * 1000;
    if (!idle || composerHasText()) return;
    if (cfg.autoRound && Date.now() - lastRound > cfg.roundEveryMin * MIN) { round(false); return; }
  }

  // ------------------------------------------------------------------ ANÁLISE DE ATENDIMENTOS
  function computeGroup(name) {
    const g = data.groups[name];
    if (!g) return null;
    const now = Date.now();
    const msgs = g.msgs.filter(m => m.ts > now - 8 * DAY).map(m => Object.assign({}, m, m.ts > now + 5 * MIN ? { ts: m.ts - DAY } : {})); // corrige horários gravados no futuro
    const pv = g.preview;
    if (pv && pv.ts > now + 5 * MIN) pv.ts -= DAY;
    if (pv && pv.role && !pv.exact && pv.ts && pv.ts > now - 8 * DAY) {
      const t = (pv.text || '').slice(0, 30);
      if (!msgs.some(m => m.role === pv.role && (m.text || '').startsWith(t)))
        msgs.push({ ts: pv.ts, sender: pv.sender, text: pv.text, role: pv.role, src: 'preview', approx: true, approxLabel: pv.approxLabel });
    }
    msgs.forEach(m => { if (m.role !== 'team' && isTeam(m.sender)) m.role = 'team'; });
    msgs.sort((a, b) => a.ts - b.ts);
    // remove duplicadas (mesma mensagem vista na lista e na conversa, ou gravada por versão anterior)
    for (let i = msgs.length - 1; i > 0; i--) {
      for (let j = i - 1; j >= 0 && msgs[i].ts - msgs[j].ts <= MIN; j--) {
        const a = (msgs[i].text || '').slice(0, 40), b = (msgs[j].text || '').slice(0, 40);
        if (msgs[i].role === msgs[j].role && (a.startsWith(b) || b.startsWith(a))) {
          if (msgs[i].src === 'chat' && msgs[j].src !== 'chat') msgs[j] = msgs[i];
          msgs.splice(i, 1); break;
        }
      }
    }
    if (!msgs.length) return null;
    let lastRel = null;
    for (let i = msgs.length - 1; i >= 0; i--) if (!isTrivial(msgs[i].text)) { lastRel = msgs[i]; break; }
    let status = 'closed';
    const pend = [];
    if (lastRel && lastRel.role === 'client') {
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'team' && !isTrivial(msgs[i].text)) break;
        if (msgs[i].role === 'client' && !isTrivial(msgs[i].text)) pend.unshift(msgs[i]);
      }
      status = AWAIT_RE.test(deacc(lastRel.text)) ? 'await' : 'open';
      // o cliente encerrou: a última mensagem dele é um agradecimento/confirmação ("Entendi, muito obrigado", "ok, deu certo")
      // depois de uma resposta da equipe, e nada do que ficou pendente é pergunta -> finalizado
      const last = msgs[msgs.length - 1];
      if (status === 'open' && last && last.role === 'client' && isClosing(last.text)) {
        const teamBefore = msgs.some(m => m.role === 'team' && !isTrivial(m.text) && m.ts <= last.ts && last.ts - m.ts < 3 * DAY);
        const REQ = /\b(preciso|precisamos|pode|podem|poderia|poderiam|consegue|conseguem|gostaria|favor|envia|enviar|manda|mandar|verificar|verifica|ver se|quando|como|qual|quais|onde|porque|por que|nao (chegou|consigo|recebi|funciona)|erro|problema|urgente|aguardo)\b/;
        if (teamBefore && !pend.some(m => m !== last && (/\?/.test(m.text) || REQ.test(deacc(m.text))))) { status = 'closed'; pend.length = 0; }
      }
    } else if (!lastRel) status = 'unknown';
    // finalizado manualmente pelo gestor: só reabre se o cliente mandar algo relevante depois
    const fin = data.final && data.final[name];
    let finalized = null;
    if (fin && lastRel && lastRel.ts <= fin.ts) { finalized = fin; if (status === 'open' || status === 'await') status = 'closed'; }
    else if (fin && pend.length) { // reaberto: a espera conta só a partir do que o cliente mandou depois da finalização
      const novos = pend.filter(m => m.ts > fin.ts);
      if (novos.length) pend.splice(0, pend.length, ...novos);
    }
    const since = pend.length ? pend[0] : lastRel;
    const wait = since ? now - since.ts : 0;
    const approx = !!(since && since.approx);
    const afterHours = !!(since && !inBiz(since.ts));
    const bizWait = since ? Math.max(0, now - Math.max(since.ts, nextOpen(since.ts))) : 0; // o prazo só corre dentro do expediente
    const level = (approx && !afterHours) ? 'red' : bizWait <= 10 * MIN ? 'green' : bizWait <= 15 * MIN ? 'yellow' : 'red';
    // nome do cliente para @menção
    let clientName = '';
    const cm = [...msgs].reverse().find(m => m.role === 'client' && m.sender);
    if (cm) clientName = cleanName(cm.sender);
    if ((!clientName || isPhone(clientName)) && pv && pv.role === 'client' && pv.sender && !isPhone(pv.sender)) clientName = cleanName(pv.sender);
    // retorno prometido e ainda não dado
    let promise = null;
    if (!finalized && status === 'closed' && lastRel && lastRel.role === 'team' && PROMISE_RE.test(deacc(lastRel.text)) && now - lastRel.ts > cfg.promiseHours * HOUR && now - lastRel.ts < 8 * DAY) {
      promise = { since: lastRel.ts, text: lastRel.text, who: shortName(lastRel.sender) };
      const cl = [...msgs].reverse().find(m => m.role === 'client' && m.sender);
      if (cl) clientName = cleanName(cl.sender);
    }
    return { name, status, msgs, lastRel, pend, wait, approx, level, afterHours, bizWait, clientName: clientName || 'cliente', promise, finalized, partial: !g.lastChatRead, lastChatRead: g.lastChatRead };
  }

  // ------------------------------------------------------------------ REVISÃO DE TOM
  const matchCase = (orig, rep) => (orig[0] && orig[0] === orig[0].toUpperCase() && orig[0] !== orig[0].toLowerCase()) ? rep[0].toUpperCase() + rep.slice(1) : rep;
  const SLANG = [
    [/\bbeleza\b|\bblz\b/gi, 'Perfeito', '"beleza/blz"'],
    [/\bvlw\b|\bvaleu\b/gi, 'Obrigado', '"vlw/valeu"'],
    [/\bshow\b/gi, 'Perfeito', '"show"'],
    [/\btipo\b(?!\s+(de|do|da|dos|das)\b),?\s*/gi, '', '"tipo"'],
    [/\bpra gente\b/gi, 'para a gente', '"pra"'], [/\bpras\b/gi, 'para as', '"pras"'], [/\bpros\b/gi, 'para os', '"pros"'],
    [/\bpra\b/gi, 'para', '"pra"'], [/\bpro\b(?!-)/gi, 'para o', '"pro"'],
    [/(?<![\p{L}])(tá|ta)(?![\p{L}])/giu, 'está', '"tá"'],
    [/,?\s*(?<![\p{L}])né(?![\p{L}])\??/giu, '', '"né"'],
    [/\bvcs\b/gi, 'vocês', '"vcs"'], [/\bvc\b/gi, 'você', '"vc"'],
    [/\btbm?\b/gi, 'também', '"tb/tbm"'], [/\bpq\b/gi, 'porque', '"pq"'],
    [/\bobg\b/gi, 'obrigado', '"obg"'], [/\bmsm\b/gi, 'mesmo', '"msm"'], [/\bhj\b/gi, 'hoje', '"hj"'],
    [/\btmj\b/gi, 'Conte conosco', '"tmj"'], [/\s*\b(kkk+|rsrs|rs)\b/gi, '', 'risadas ("kkk/rs")']
  ];
  const GER_INF = { ando: 'ar', endo: 'er', indo: 'ir' };
  const PT_FIX = [
    [/\banaliz(\w*)/gi, (m, s) => matchCase(m, 'analis' + s), '"analiz…" → "analis…"'],
    [/\bdemosntr(\w*)/gi, (m, s) => matchCase(m, 'demonstr' + s), '"demosntr…" → "demonstr…"'],
    [/\bconcerteza\b/gi, 'com certeza', '"concerteza" → "com certeza"'],
    [/\bderrepente\b/gi, 'de repente', '"derrepente" → "de repente"'],
    [/\bexcess[ãa]o\b/gi, 'exceção', '"excessão" → "exceção"'],
    [/\batravez\b/gi, 'através', '"atravez" → "através"'],
    [/\bporisso\b/gi, 'por isso', '"porisso" → "por isso"'],
    [/\bseje\b/gi, 'seja', '"seje" → "seja"'], [/\besteje\b/gi, 'esteja', '"esteje" → "esteja"'],
    [/\bmenas\b/gi, 'menos', '"menas" → "menos"'], [/\benchergar\b/gi, 'enxergar', '"enchergar" → "enxergar"'],
    [/\bimpecilho\b/gi, 'empecilho', '"impecilho" → "empecilho"'], [/\bancios(o|a)\b/gi, 'ansios$1', '"ancioso" → "ansioso"'],
    [/\bhouveram\b/gi, 'houve', '"houveram" → "houve"'], [/\ba nível de\b/gi, 'em nível de', '"a nível de" → "em nível de"'],
    [/\bfazem (\d+|alguns|muitos|poucos) (dias|meses|anos|minutos|horas|semanas)\b/gi, 'faz $1 $2', '"fazem X dias" → "faz X dias"'],
    [/\bpara mim (fazer|ver|enviar|verificar|analisar|conferir|olhar|mandar|ajudar|entender|passar|checar)\b/gi, 'para eu $1', '"para mim fazer" → "para eu fazer"'],
    [/\ba (sua |vossa )?disposição/gi, (m, s) => matchCase(m, 'à ' + (s || '') + 'disposição'), 'crase: "à disposição"'],
    [/\b(vou estar|vamos estar|estaremos|estarei|estar)\s+(lhe |lhes |te |os |as |o |a )?(?!quando\b)(\w+?)(ando|endo|indo)\b/gi, (m, aux, pron, stem, end) => {
      const inf = stem + GER_INF[end.toLowerCase()];
      const p = pron ? pron.trim() + ' ' : '';
      const a = aux.toLowerCase();
      const out = a === 'estar' ? p + inf : a === 'vou estar' ? 'vou ' + p + inf : a === 'vamos estar' ? 'vamos ' + p + inf : a === 'estaremos' ? p + inf + 'emos' : p + inf + 'ei';
      return matchCase(m, out);
    }, 'gerundismo ("estar + -ndo")'],
    [/\b(bom dia|boa tarde|boa noite|olá|oi)\s+@/gi, '$1, @', 'falta vírgula antes do nome ("Bom dia, @Nome")'],
    [/\b(perfeito|obrigad[oa]|claro|certo|ótimo|otimo|combinado|entendido|exatamente)\s+@/gi, '$1, @', 'falta vírgula antes do nome ("Perfeito, @Nome")'],
    [/\bPor Nada\b/g, 'Por nada', '"Por Nada" → "Por nada" (sem maiúscula)'],
    [/(?<![\p{L}])mão (será|é|tem|foi|vai|vamos|consegui|conseguimos|há|existe|precisa|deu)(?![\p{L}])/giu, 'não $1', 'digitação: "mão" → "não"'],
    [/\b(deve|devem|vai|vão|pode|podem|irá|irão|precisa|precisam|vamos|poderia|poderiam) (analisa|verifica|envia|libera|atualiza|ajusta|corrige|confere|resolve|implementa|retorna|informa)\b/gi, (m, a, v) => `${a} ${v}r`, 'verbo no infinitivo ("deve analisar")'],
    [/\bum (requisição|solicitação|reunião|configuração|função|opção|situação|alteração|atualização|informação|análise|ligação|dúvida|mensagem|planilha|tela|conta|integração)\b/gi, (m, w) => matchCase(m, 'uma ' + w), 'concordância: "uma requisição"'],
    [/\b(possibilidade|necessidade|forma|opção|maneira) (restringir|alterar|excluir|editar|ativar|desativar|configurar|cadastrar|gerar|emitir|liberar|bloquear|mudar|trocar|incluir|remover)\b/gi, '$1 de $2', 'falta "de" ("possibilidade de restringir")'],
    [/\b(pertenc\w*|referente|devido|junto|igual|semelhante|chegou|chegar|voltou|voltar|retornar|retornou) a (equipe|regional|filial|empresa|associação|tela|página|configuração|situação|data)\b/gi, '$1 à $2', 'crase: "à equipe"'],
    [/\bpoderia por gentileza,/gi, (m) => matchCase(m, 'poderia, por gentileza,'), 'vírgula: "Poderia, por gentileza, …"'],
    [/\bvia email\b|\bpor email\b|\bo email\b|\bseu email\b|\bno email\b/gi, (m) => m.replace(/email/i, 'e-mail'), '"email" → "e-mail"']
  ];
  const INFORMAL_IMP = { faz: 'faça', apaga: 'apague', limpa: 'limpe', manda: 'envie', envia: 'envie', clica: 'clique', tenta: 'tente', coloca: 'coloque', atualiza: 'atualize', abre: 'abra', entra: 'acesse', verifica: 'verifique', olha: 'verifique', refaz: 'refaça', exclui: 'exclua', cadastra: 'cadastre', preenche: 'preencha', seleciona: 'selecione', reinicia: 'reinicie', baixa: 'baixe', salva: 'salve', espera: 'aguarde', aguarda: 'aguarde', confere: 'confira', muda: 'altere', troca: 'altere', desliga: 'desligue', fecha: 'feche', marca: 'marque', desmarca: 'desmarque' };
  const FORMAL_IMP = new Set(['faça', 'apague', 'limpe', 'mande', 'envie', 'clique', 'tente', 'coloque', 'atualize', 'abra', 'acesse', 'verifique', 'refaça', 'exclua', 'cadastre', 'preencha', 'selecione', 'reinicie', 'baixe', 'salve', 'aguarde', 'confira', 'altere', 'feche', 'marque']);
  const POLITE_RE = /(por gentileza|por favor|poderia|poderiam|pode(m)? |consegue|conseguem|gentileza|seria poss[ií]vel|peço que|pedimos que|solicitamos|recomendamos|sugerimos|se poss[ií]vel)/i;
  const EMPATHY = [
    /nao (e|eh) (problema|culpa|responsabilidade|com a gente|conosco|nosso|nossa|da ileva)/,
    /(problema|culpa) (e )?(do|da|dos|das) (banco|cliente|associado|voces|fornecedor)/,
    /sao entre eles/, /nao (temos|tem) (nada a ver|como ajudar|o que fazer)/,
    /nao depende (de nos|da gente|da ileva)/, /isso e com (o|a) (banco|fornecedor|associado|asaas)/,
    /(nos|a gente),? (do|da) ileva,? (apenas|so)\b/, /(verifique|veja|verificar|ver|procure|procurar|verifiquem) com o banco/,
    /(nao sei|sei la)\b/, /\bse vira\b/, /fica (por parte|a cargo) deles/, /nao tenho como (eu )?garantir/, /depende (deles|da equipe de desenvolvimento)/
  ];
  const TECH = [
    { re: /(asaas|sicoob|sicredi?|maps).{0,80}(gerar|enviar|processar|subir|importar|fazer).{0,30}(remessa|retorno)|(gerar|enviar|processar|subir|importar|fazer).{0,30}(remessa|retorno).{0,80}(asaas|sicoob|sicredi?|maps)/, note: 'Treinamento Faturamento §10: ASAAS, SICOOB, SICRED e MAPS IP têm remessa e retorno automáticos (não precisam de tratamento manual).' },
    { re: /(nao precisa|sem precisar|nao e necessario).{0,30}rateio|fechamento.{0,40}(sem|antes de) (fechar )?(o )?rateio/, note: 'Treinamento Faturamento §6: é obrigatório fechar o rateio do mês antes de qualquer fechamento, mesmo com valor fixo.' },
    { re: /(exclu|remov|tir)\w*.{0,25}(veiculo|carro|placa).{0,40}fechamento/, unless: /isenc/, note: 'Treinamento Gestão do Associado §5.2: para tirar o veículo do fechamento por um período, use o campo Isenção (preserva o histórico).' },
    { re: /(previsao de entrega|tempo maximo).{0,60}(bloque|trava|impede)/, unless: /nao (bloque|trava|impede)/, note: 'Treinamento Eventos Inicial §4.3/5.3: previsão de entrega e tempo máximo sugerido são apenas alertas; não bloqueiam o evento.' },
    { re: /(exclu|apag)\w*.{0,25}(documento|arquivo|foto).{0,40}(ilegive|errad|divergen)/, note: 'Treinamento Eventos §4: documentos ilegíveis ou divergentes devem ser Arquivados (não excluídos) e o reenvio solicitado.' },
    { re: /perda total.{0,60}link externo|link externo.{0,60}perda total/, unless: /nao (e )?recomend|evit/, note: 'Treinamento Eventos Inicial §4.3: não é recomendado disponibilizar "Perda total" no link externo.' },
    { re: /(nao (da|tem como|e possivel|conseguimos)).{0,40}(alterar|trocar|mudar|redefinir).{0,20}senha.{0,40}(app|aplicativo|associado)/, note: 'Treinamento Gestão do Associado §4.2: a associação pode alterar a senha do app em Dados de acesso, na ficha do associado.' },
    { re: /fipe.{0,60}(atualiza|muda).{0,30}(semana|todo dia|diariamente|anual|todo ano)/, note: 'Treinamento Comercial Inicial §4.2: a tabela FIPE é atualizada automaticamente todo início de mês.' },
    { re: /repetir veiculo.{0,40}\bsim\b/, note: 'Treinamento Faturamento §7.2: "Repetir veículo(s) na referência" deve ficar como Não na grande maioria dos casos.' },
    { re: /considerar no fechamento.{0,30}\bnao\b.{0,60}(nao|sem) (cobra|duplic)/, note: 'Treinamento Faturamento §8.1: com "Considerar no fechamento" = Não, o veículo é cobrado no avulso E no fechamento.' }
  ];
  const toneCache = new Map();
  function analyzeTone(g, i) {
    const m = g.msgs[i];
    const key = `${g.name}|${m.ts}|${m.text}`;
    const prev = i > 0 ? g.msgs[i - 1] : null;
    const prevKey = prev ? `${prev.role}|${prev.ts}` : '-';
    const cached = toneCache.get(key);
    if (cached && cached.prevKey === prevKey) return cached.res;
    const res = analyzeToneRaw(g, i);
    toneCache.set(key, { prevKey, res });
    return res;
  }
  function analyzeToneRaw(g, i) {
    const m = g.msgs[i];
    const t = m.text || '';
    if (!t || /^\[.*\]$/.test(t) || isTrivial(t) && t.length < 25) return null;
    const issues = [];
    let fixed = t;
    // 1) gírias / informalidade
    for (const [re, rep, label] of SLANG) {
      re.lastIndex = 0;
      if (re.test(t)) { issues.push({ cat: 'Gíria/informalidade', text: label }); re.lastIndex = 0; fixed = fixed.replace(re, (mm) => rep ? matchCase(mm.trim(), rep) + (/\s$/.test(mm) ? ' ' : '') : ''); }
    }
    // 2) português
    for (const [re, rep, label] of PT_FIX) {
      re.lastIndex = 0;
      if (re.test(fixed)) { issues.push({ cat: 'Português', text: label }); re.lastIndex = 0; fixed = fixed.replace(re, rep); }
    }
    // 3) imperativo seco
    const polite = POLITE_RE.test(t);
    const hasList = /(^|\s)\d+[.)]\s/.test(t);
    const sentences = fixed.split(/(?<=[.!?])\s+/);
    let impFound = false;
    const newSent = sentences.map(s => {
      const stripped = s.replace(/^@[^,!?.\n]{1,40}[,!]?\s*/, '').replace(/^(bom dia|boa tarde|boa noite|olá|oi)[,!]?\s*/i, '').replace(/^((perfeito|ok|okay|certo|beleza|blz|então|entao|ah|bom|show|certinho)[,!.]?\s+)+/i, '');
      const w = (stripped.match(/^[\p{L}]+/u) || [''])[0];
      const wl = w.toLowerCase();
      if (INFORMAL_IMP[wl]) {
        impFound = true;
        return s.replace(stripped, 'Por gentileza, ' + INFORMAL_IMP[wl] + stripped.slice(w.length));
      }
      if (FORMAL_IMP.has(wl) && !polite && !hasList && stripped.length < 90) {
        impFound = true;
        return s.replace(stripped, 'Por gentileza, ' + wl + stripped.slice(w.length));
      }
      return s;
    });
    if (impFound) { issues.push({ cat: 'Imperativo seco', text: 'ordem direta sem "por gentileza/poderia"' }); fixed = newSent.join(' '); }
    // 4) empatia / "não é problema nosso"
    const dt = deacc(t);
    if (EMPATHY.some(re => re.test(dt))) {
      issues.push({ cat: 'Falta de empatia', text: 'passa a ideia de "não é problema nosso"; ofereça ajuda e o próximo passo' });
      fixed += '\n\n[Ajuste sugerido: em vez de transferir a responsabilidade, ofereça ajuda. Ex.: "Vamos verificar isso com vocês. Para agilizar, poderiam nos enviar … ? Se for necessário contato com o banco, orientamos o associado sobre o que informar."]';
    }
    // 5) saudação / nome (primeira resposta da equipe após mensagem do cliente)
    const prev = i > 0 ? g.msgs[i - 1] : null;
    const lastTeamBefore = (() => { for (let j = i - 1; j >= 0; j--) if (g.msgs[j].role === 'team') return g.msgs[j]; return null; })();
    const newTurn = prev && prev.role === 'client' && (!lastTeamBefore || m.ts - lastTeamBefore.ts > 60 * MIN);
    if (newTurn) {
      const clientName = cleanName(prev.sender) || g.clientName;
      const first = clientName.split(/\s+/)[0] || '';
      const hasGreet = /(?<![\p{L}])(bom dia|boa tarde|boa noite|olá|ola|oi)(?![\p{L}])/iu.test(t);
      const hasName = /@/.test(t) || (first.length > 2 && !isPhone(first) && lc(t).includes(first.toLowerCase()));
      const nm = isPhone(clientName) ? clientName : clientName;
      if (!hasGreet) {
        issues.push({ cat: 'Saudação/nome', text: 'começou sem saudação' + (hasName ? '' : ' e sem o nome do cliente') });
        const rest = fixed.replace(/^@[^,!?.\n]{1,40}[,!]?\s*/, '');
        fixed = `${saud(m.ts)}, @${nm}! ` + rest.charAt(0).toUpperCase() + rest.slice(1);
      } else if (!hasName) {
        issues.push({ cat: 'Saudação/nome', text: 'faltou o nome do cliente (@menção)' });
        fixed = fixed.replace(/\b(bom dia|boa tarde|boa noite|olá|oi)\b[,!]?\s*/i, (g0, s) => `${s}, @${nm}! `);
      }
    }
    // 5b) saudação no horário errado ("Bom dia" à tarde etc.)
    {
      const hh = new Date(m.ts).getHours();
      const g0 = deacc(t).match(/(?<![a-z])(bom dia|boa tarde|boa noite)(?![a-z])/);
      if (g0) {
        const right = hh < 12 ? 'bom dia' : hh < 18 ? 'boa tarde' : 'boa noite';
        if (g0[1] !== right) {
          issues.push({ cat: 'Saudação/nome', text: `"${g0[1]}" às ${pad(hh)}:${pad(new Date(m.ts).getMinutes())}; o correto seria "${right}"` });
          fixed = fixed.replace(/(bom dia|boa tarde|boa noite)/i, mm => matchCase(mm, right));
        }
      }
    }
    // 6) técnica x treinamentos
    for (const r of TECH) {
      if (r.re.test(dt) && !(r.unless && r.unless.test(dt))) issues.push({ cat: 'Técnico x treinamento', text: r.note });
    }
    if (!issues.length) return null;
    fixed = fixed.replace(/([,;]\s+)Por gentileza/g, '$1por gentileza').replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').replace(/,\s*,/g, ',').trim();
    fixed = fixed.charAt(0).toUpperCase() + fixed.slice(1);
    // dedupe issues
    const seen = new Set();
    const uniq = issues.filter(x => { const k = x.cat + x.text; if (seen.has(k)) return false; seen.add(k); return true; });
    return { group: g.name, who: shortName(m.sender), sender: m.sender, ts: m.ts, original: t, issues: uniq, fixed };
  }

  // ------------------------------------------------------------------ RESPOSTAS SUGERIDAS (base: treinamentos do projeto)
  const fmtD = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  const TOPICS = [
    { id: 'filtroVeiculos', re: /filtro.{0,80}(veiculo|associad)|(veiculo|associad).{0,80}filtro|sem boleto|nao (tem|tenha|possui) boleto|(completa|completou|completaram|fazem|faz) (1|um) ano|mais de (1|um) ano/, kb: true, src: 'Orientação do gestor (30/10/2026)',
      body: () => {
        const now = new Date(), y = new Date(now); y.setFullYear(now.getFullYear() - 1);
        const m0 = new Date(y.getFullYear(), y.getMonth(), 1), m1 = new Date(y.getFullYear(), y.getMonth() + 1, 0);
        return 'Os dois filtros ficam em Associados > Veículos, no botão Filtros:\n\n' +
          '1. Veículos sem boletos gerados\n' +
          '• Selecione o filtro "Possui Boletos" e marque "Não";\n' +
          '• Clique em Buscar. A lista mostrará apenas os veículos que ainda não têm nenhum boleto gerado.\n\n' +
          '2. Veículos que já completaram 1 ano\n' +
          '• Selecione o filtro "Dt. Contrato" (ou "Dt. Ativação Comercial", caso vocês contem o ano a partir da ativação);\n' +
          `• Em "Até", informe a data de exatamente 1 ano atrás (hoje seria ${fmtD(y)}) e deixe o campo "De" em branco;\n` +
          `• Se quiser apenas os que completam 1 ano neste mês, preencha um intervalo, por exemplo: de ${fmtD(m0)} até ${fmtD(m1)}.\n\n` +
          'Vocês podem usar os dois filtros juntos e clicar em "Salvar Filtros" para não precisar montá-los novamente da próxima vez.';
      } },
    { id: 'asaas', re: /asaas.{0,80}(analise|aprova|document|cadastr|verifica)|(analise|aprova).{0,80}asaas/, kb: false,
      body: 'Vamos verificar a situação da análise da conta ASAAS de vocês e retornamos aqui no grupo assim que tivermos uma posição.',
      note: 'Os treinamentos não tratam da análise de cadastro da conta ASAAS. Confirme com o setor responsável antes de enviar.' },
    { id: 'remessa', re: /remessa|arquivo (de )?retorno|\bretornos?\b.{0,20}banc/, kb: true, src: 'Treinamento Faturamento §10',
      body: 'Sobre remessa e retorno: os bancos ASAAS, SICOOB, SICRED e MAPS IP têm remessa e retorno automáticos, sem necessidade de tratamento manual. Para os demais bancos, o processo é feito assim:\n\n1. Acesse Faturamento > Remessas para gerar o arquivo com os boletos a registrar e enviá-lo ao banco;\n2. Em seguida, acesse Faturamento > Retornos para processar o arquivo do banco com os pagamentos e liquidações.\n\nSe preferirem, podemos acompanhar esse processo com vocês.' },
    { id: 'fechamento', re: /fechamento|rateio|fechar o mes/, kb: true, src: 'Treinamento Faturamento §6–7',
      body: 'Para realizar o fechamento, o passo a passo é:\n\n1. Acesse Faturamento > Rateio e feche o rateio do mês de referência (obrigatório, mesmo para quem trabalha com valor fixo);\n2. Em Faturamento > Fechamentos, use "Listar não participantes" e "Conferência" para conferir quais veículos entram;\n3. Clique em "Novo registro", preencha a descrição, a referência do rateio e os demais campos, e liste os veículos;\n4. Confira a listagem e clique em "Gerar fechamento";\n5. Por fim, clique em "Enviar para o banco" para registrar os boletos.\n\nSe o cálculo for por Valor Total ou por Ordens de Compra, podemos agendar um acompanhamento com o nosso suporte.' },
    { id: 'boleto', re: /boleto|pagar|pagamento|linha digitavel|codigo de barras|segunda via|2a via|nosso numero/, kb: true, src: 'Treinamento Faturamento §8',
      body: 'Para verificarmos o que está acontecendo com o boleto, poderia, por gentileza, nos enviar uma das informações abaixo?\n\n1. O link do boleto no sistema (Faturamento > Boletos > abrir o boleto); ou\n2. O nome do associado e o nosso número ou a linha digitável do boleto.\n\nCom esses dados, conferimos o boleto e retornamos o quanto antes.' },
    { id: 'sindicancia', re: /sindicancia|\bsla\b/, kb: true, src: 'Treinamento Eventos Inicial §9.1',
      body: 'Para os documentos de Sindicância e SLA, caso vocês já tenham os modelos prontos, poderiam nos encaminhar aqui no grupo? Nossa equipe faz a implantação diretamente no sistema (Eventos > Documentos) e avisa assim que estiver concluído.' },
    { id: 'orcamento', re: /orcament|ordem de compra|comparativo|fornecedor|oficina|nota fiscal|regulagem/, kb: true, src: 'Treinamento Eventos Completo §6–9',
      body: 'No evento, o fluxo de orçamento funciona assim:\n\n1. Na Regulagem, são listadas as peças e os serviços danificados (quantidade, troca, lanternagem, pintura);\n2. Na Orçamentação, essa lista é enviada para um ou mais fornecedores precificarem;\n3. No Comparativo de Orçamentos, você marca o orçamento recomendado;\n4. Na Ordem de Compra, o fornecedor escolhido é confirmado e, depois do reparo, a oficina envia a nota fiscal pelo link recebido.\n\nPara entendermos o lançamento que você fez, poderia, por gentileza, nos enviar um print da tela ou a placa/evento em questão? Assim verificamos com você o ponto exato.' },
    { id: 'vistoria', re: /vistori/, kb: true, src: 'Treinamento Gestão do Associado §6',
      body: 'Para emitir uma nova vistoria:\n\n1. Abra a ficha do veículo do associado (Gestão do Associado > Veículos);\n2. Clique em "Nova vistoria", selecione a modalidade à distância e o Modelo de Vistoria, e salve;\n3. O sistema gera o link, que pode ser enviado ao associado, ao consultor ou a um vistoriador terceirizado.\n\nCaso seja um vistoriador terceirizado, ele precisa estar cadastrado antes; assim, o link cai automaticamente no aplicativo dele.' },
    { id: 'evento', re: /evento|sinistro|comunicado|acionar|colisao|guincho/, kb: true, src: 'Treinamento Eventos Completo §3–4',
      body: 'Um evento (sinistro) pode ser aberto de três formas: pelo Aplicativo do Associado, pelo Link Externo ou internamente pelo sistema. Para abrir pelo sistema:\n\n1. Acesse Eventos e clique em "Criar comunicado";\n2. Preencha filial, tipo do evento, data, hora e local;\n3. Busque a placa para o sistema preencher os dados do associado;\n4. Marque "Acionamento associado" como Sim se o associado for acionar a proteção;\n5. Informe os terceiros (se houver), escreva o relato e salve.\n\nDepois, na tela de Envolvidos, é possível solicitar a documentação pelo botão "Solicitar arquivos".' },
    { id: 'termo', re: /\btermos?\b/, kb: true, src: 'Treinamento Gestão do Associado §7 / Comercial Inicial §7',
      body: 'Os termos ficam registrados na ficha do associado, no campo Termos. Para reenviar ou emitir um novo termo:\n\n1. Acesse Gestão do Associado > Associados e abra o associado;\n2. No campo Termos, emita o novo termo e envie para assinatura.\n\nO texto oficial do termo de filiação fica em Termos > Modelo de Termos.' },
    { id: 'fipe', re: /fipe|nao aparece.{0,30}(modelo|veiculo|carro|moto)|(modelo|veiculo).{0,30}nao aparece|cotar|cotacao/, kb: true, src: 'Treinamento Comercial Inicial §4.2',
      body: 'Quando um modelo não aparece para cotação no aplicativo, normalmente ele ainda não foi categorizado na tabela FIPE. Para liberar:\n\n1. Acesse Configurações > FIPE > Veículos FIPE;\n2. Filtre por marca, ano e valor FIPE;\n3. Marque os veículos encontrados e clique em "Categorizar em massa", escolhendo a categoria correta.\n\nComo a FIPE é atualizada todo início de mês, os novos modelos precisam ser categorizados sempre que forem publicados.' },
    { id: 'senha', re: /^(?!.*(comercial|consultor)).*((senha|login|acess).{0,40}(app|aplicativo)|(app|aplicativo).{0,40}(senha|login|acess))/, kb: true, src: 'Treinamento Gestão do Associado §4.2',
      body: 'A senha do aplicativo do associado pode ser alterada pela própria associação:\n\n1. Acesse Gestão do Associado > Associados e abra a ficha do associado;\n2. No bloco Dados de acesso, altere a senha e salve;\n3. Informe ao associado a nova senha para acessar o aplicativo.' },
    { id: 'usuario', re: /usuario|permiss|grupo de usuario/, kb: true, src: 'Treinamento Comercial Inicial §3',
      body: 'Para liberar o acesso de um colaborador:\n\n1. Em Cadastro > Grupo de Usuário, confira (ou crie) o grupo com as permissões adequadas;\n2. Em Cadastro > Usuário > Adicionar usuário, preencha os dados e defina usuário e senha;\n3. Marque "Alterar senha no próximo login?" como Sim;\n4. Em Permissões, selecione o grupo correto e salve.' },
    { id: 'titularidade', re: /titularidade|vendeu o (carro|veiculo)|troca de dono/, kb: true, src: 'Treinamento Faturamento §5.2',
      body: 'Para transferir o veículo de um associado para outro:\n\n1. Acesse Gestão do Associado > Ferramentas > Titularidade > Novo Registro;\n2. Informe a placa e o chassi; o sistema busca o modelo e o associado atual;\n3. Informe os dados do novo associado (nome e CPF/CNPJ) e confirme a troca.' },
    { id: 'isencao', re: /isenc|isent/, kb: true, src: 'Treinamento Gestão do Associado §5.2',
      body: 'Para isentar um veículo do fechamento por um período:\n\n1. Abra a ficha do veículo do associado;\n2. No campo Isenção, informe até qual mês ele ficará isento e salve.\n\nEnquanto durar a isenção, o veículo não entra na lista de fechamento de boletos, e o histórico fica preservado.' },
    { id: 'serasa', re: /serasa|\bspc\b|negativ/, kb: true, src: 'Treinamento Faturamento §5.3',
      body: 'Para gerar o arquivo de Serasa/SPC:\n\n1. Acesse Gestão do Associado > Ferramentas > Serasa > Novo Registro;\n2. Escolha se o arquivo é de Inclusão ou de Exclusão;\n3. Filtre os boletos em aberto que devem compor o arquivo e gere o arquivo de remessa para envio ao Serasa/SPC.' },
    { id: 'integracao', re: /integra|rastread|rastreamento|assistencia 24|\bapi\b/, kb: true, src: 'Treinamento Comercial Inicial §4.3',
      body: 'Para integrações com empresas de rastreamento, assistência 24h ou outros parceiros, nossa equipe faz a configuração. Poderiam nos informar o nome do fornecedor? Se ele não estiver na lista de integrações prontas (Configurações > Integrações), também existe a opção de API aberta: enviamos a documentação para o fornecedor se integrar.' },
    { id: 'devolutiva', re: /devolutiva|alguma (novidade|posicao|resposta|atualizacao)|conseguiu(ram)? (ver|verificar|olhar)|tem retorno|algum retorno|\be ai\b|alguma previsao|no aguardo/, kb: false,
      body: 'Agradecemos a paciência! A sua solicitação está com o setor responsável e estamos acompanhando de perto. Assim que tivermos a devolutiva, informaremos aqui no grupo.',
      note: 'Resposta de status. Confirme com o setor responsável a situação real antes de enviar.' },
    { id: 'erro', re: /nao consig|erro|travou|trava|nao funciona|nao carrega|bug|problema|nao abre|nao esta (funcionando|indo|aparecendo)/, kb: true, src: 'Padrão de atendimento Ileva (coleta de informações)',
      body: 'Para conseguirmos analisar o que está acontecendo, poderia, por gentileza, nos enviar um print ou um vídeo curto mostrando o passo a passo até o erro? Se possível, informe também a placa ou o associado envolvido. Com isso, verificamos e retornamos o quanto antes.' }
  ];
  const DEFAULT_TOPIC = { id: 'geral', kb: false,
    body: 'Recebemos a sua mensagem e já estamos verificando. Retornamos aqui no grupo assim que tivermos uma posição.',
    note: 'Não encontrei esse assunto nos treinamentos. Confirme com o setor responsável antes de responder em detalhe.' };

  function pickTopic(text) { const t = deacc(text); return TOPICS.find(x => x.re.test(t)) || null; }
  function suggest(c, mode) {
    const pendText = c.pend.map(m => m.text).join('\n');
    let topic = pickTopic(pendText);
    if (!topic) topic = pickTopic(c.msgs.slice(-8).map(m => m.text).join('\n'));
    if (mode === 'promise') topic = TOPICS.find(t => t.id === 'devolutiva');
    topic = topic || DEFAULT_TOPIC;
    const nome = c.clientName;
    const tb = typeof topic.body === 'function' ? topic.body() : topic.body;
    let body = tb;
    if (mode === 'await') body = 'Ficamos no aguardo das informações para darmos continuidade ao atendimento.' + (topic.id !== 'geral' && topic.id !== 'devolutiva' ? '\n\n' + tb : '');
    if (mode === 'promise') body = 'Conforme combinamos, passamos para dar um retorno sobre a sua solicitação: [descreva aqui a posição do setor responsável]. ' + 'Assim que houver qualquer novidade, informaremos aqui no grupo.';
    const text = `${saud()}, @${nome}! Tudo bem?\n\n${body}\n\nQualquer dúvida, estamos à disposição!`;
    return { text, topic: topic.id, kb: mode === 'promise' ? false : topic.kb, src: topic.src || '', note: mode === 'promise' ? 'Preencha com a posição real do setor responsável antes de enviar.' : (topic.note || '') };
  }

  // ------------------------------------------------------------------ BASE DE CONHECIMENTO (aprende com perguntas e respostas já dadas)
  // Cada item: { id, group, q, qTs, a, aTs, who, resolved, status: 'auto'|'approved'|'rejected', uses }
  const LS_KB = 'ilevaSup.kb.v1';
  let kb = lsGet(LS_KB, []);
  if (!Array.isArray(kb)) kb = [];
  let kbDirty = false, kbSaveTimer = 0;
  function mergeKb() {
    const stored = lsGet(LS_KB, []);
    if (!Array.isArray(stored)) return;
    const byId = new Map(kb.map(x => [x.id, x]));
    for (const y of stored) {
      const x = byId.get(y.id);
      if (!x) { kb.push(y); byId.set(y.id, y); continue; }
      if (x.status === 'auto' && y.status !== 'auto') x.status = y.status; // validação/rejeição feita em outra aba
      if ((y.uses || 0) > (x.uses || 0)) x.uses = y.uses;
    }
  }
  function saveKb() { kbDirty = true; clearTimeout(kbSaveTimer); kbSaveTimer = setTimeout(() => { mergeKb(); lsSet(LS_KB, kb); kbDirty = false; idfCache = null; }, 800); }
  setInterval(() => { if (!kbDirty) { const n = kb.length; mergeKb(); if (kb.length !== n) idfCache = null; } }, 60 * 1000);

  // ------------------------------------------------------------------ BASE CADASTRADA (informações do sistema inseridas pela equipe)
  // Cada item: { id, manual: true, title, q (perguntas, uma por linha), a, tags, imgs: [ids], qTs, upd, uses }
  // Texto fica no localStorage; imagens ficam no IndexedDB (cabem bem mais).
  const LS_MAN = 'ilevaSup.manual.v1';
  let man = lsGet(LS_MAN, []);
  if (!Array.isArray(man)) man = [];
  let manVer = 0;
  function saveMan() { manVer++; idfCache = null; lsSet(LS_MAN, man.map(({ _v, ...r }) => r)); }
  let idbP = null;
  function idb() {
    if (!idbP) idbP = new Promise((res, rej) => { const r = indexedDB.open('ilevaSupBase', 1); r.onupgradeneeded = () => r.result.createObjectStore('imgs'); r.onsuccess = () => res(r.result); r.onerror = () => { idbP = null; rej(r.error); }; });
    return idbP;
  }
  async function idbDo(mode, fn) {
    const db = await idb();
    return new Promise((res, rej) => { const t = db.transaction('imgs', mode); const st = t.objectStore('imgs'); const rq = fn(st); t.oncomplete = () => res(rq ? rq.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  }
  const imgPut = (id, d) => idbDo('readwrite', st => st.put(d, id));
  const imgGet = id => idbDo('readonly', st => st.get(id)).catch(() => null);
  const imgDel = id => idbDo('readwrite', st => st.delete(id)).catch(() => { });
  // reduz o tamanho da imagem (prints ficam nítidos e leves)
  function shrinkImage(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file); const im = new Image();
      im.onload = () => {
        const max = 1600, k = Math.min(1, max / Math.max(im.width, im.height));
        const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        let d = c.toDataURL('image/webp', 0.88); if (!d.startsWith('data:image/webp')) d = c.toDataURL('image/jpeg', 0.88);
        res(d);
      };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('imagem inválida')); };
      im.src = url;
    });
  }
  async function copyImg(id, btn) {
    let ok = false;
    try {
      const d = await imgGet(id); const im = new Image(); im.src = d; await im.decode();
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0);
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); ok = true;
    } catch (e) { ok = false; }
    if (btn) { const o = btn.textContent; btn.textContent = ok ? '✓ Copiada (Ctrl+V no WhatsApp)' : 'Falhou'; setTimeout(() => { btn.textContent = o; }, 2000); }
  }

  const STOP = new Set(('a o os as um uma uns umas de do da dos das em no na nos nas por pelo pela pelos pelas para pra pro com sem e ou que se ja nao sim mas mais muito muita ' +
    'eu tu ele ela nos voces voce vc vcs eles elas me te lhe meu minha seu sua nosso nossa isso isto esse essa este esta aquele aquela aqui ali la ' +
    'bom dia boa tarde noite pessoal oi ola tudo bem obrigado obrigada por favor gentileza gostaria queria preciso precisamos poderia podem pode ' +
    'tem ter tinha estou esta estao foi ser sao era fica ficou fazer faz faco como onde qual quais quando porque pq porque entao ai ate tambem so ' +
    'consigo consegue conseguimos conseguem ajuda ajudar duvida alguem algum alguma hoje agora ainda vez la ileva sistema').split(' '));
  function stem(w) {
    return w.replace(/(mente|coes|cao|oes|ões|ais|eis|ados|adas|ado|ada|ando|endo|indo|ar|er|ir|ou|am|em|s)$/, '') || w;
  }
  function tokens(text) {
    return [...new Set(deacc(text).replace(/https?:\/\/\S+/g, ' ').replace(/@\S+/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/)
      .filter(w => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w)).map(stem).filter(w => w.length > 2))];
  }
  const QUESTION_RE = /\?|^(como|onde|qual|quais|quando|por que|porque|tem como|da pra|da para|consigo|consegue|e possivel|existe|preciso|gostaria|queria|me (ajuda|lembr|explic)|nao (consig|esta|aparece|carrega|funciona|abre|gera)|esta dando|deu erro|erro|problema)/;
  const NON_ANSWER_RE = /(encaminh|vamos verificar|vou verificar|verificando|analis|setor responsavel|assim que tivermos|retornamos|retornaremos|daremos retorno|aguard|um momento|so um minuto|ja vejo|vou ver|irei verificar)/;
  // Só aprende o que for sobre o sistema Ileva (menus, telas, cadastros, financeiro, eventos etc.)
  const SYS_RE = /(boleto|fechament|rateio|vistori|evento|sinistr|associad|veiculo|placa|plano|beneficio|aplicativo|\bapp\b|consultor|indicador|termo|fipe|filtro|relatorio|cadastr|usuario|senha|login|acesso|link|menu|tela|botao|aba\b|campo|integra|asaas|sicoob|sicred|banco|remessa|retorno banc|cota|lead|funil|proposta|cotac|ordem de compra|fornecedor|oficina|orcament|regulagem|regional|filial|situac|serasa|spc|titularidade|isenc|carne|mensalidade|notificac|regua|disparo|webhook|\bapi\b|sistema|configurac|permiss|grupo de usuario|exportar|planilha|importa|financeiro|lancamento|categoria|centro de custo|contrato|desfilia|inadimpl|ativac|ativar|inativ|dashboard|painel|ileva)/;
  const RESOLVED_RE = /(deu certo|funcionou|resolvido|resolveu|consegui|perfeito|show|otimo|ok obrigad|obrigad|valeu|certinho|entendi)/;

  function cleanAnswer(text) {
    let t = norm(text)
      .replace(/^(bom dia|boa tarde|boa noite|ola|olá|oi)(?![\p{L}])[,!]?\s*/iu, '')
      .replace(/^@[^,!?\n]{1,40}?[,!]\s*/, '').replace(/^@\S+\s*/, '')
      .replace(/^(bom dia|boa tarde|boa noite|ola|olá|oi)(?![\p{L}])[,!]?\s*/iu, '')
      .replace(/^(tudo bem|espero que (esteja|estejam) bem)[?!.,]?\s*/iu, '')
      .replace(/^tudo bem\??\s*/i, '')
      .replace(/\s*(qualquer (duvida|dúvida|coisa)[^.!]*[.!]?)\s*$/i, '')
      .trim();
    // aplica as correções de português e informalidade
    for (const [re, rep] of SLANG) { re.lastIndex = 0; t = t.replace(re, mm => rep ? matchCase(mm.trim(), rep) + (/\s$/.test(mm) ? ' ' : '') : ''); }
    for (const [re, rep] of PT_FIX) { re.lastIndex = 0; t = t.replace(re, rep); }
    t = t.replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  }

  // Lê as mensagens guardadas de um grupo e extrai pares pergunta -> resposta da equipe
  function learnGroup(name) {
    const g = data.groups[name];
    if (!g || !g.msgs || g.msgs.length < 2) return 0;
    const msgs = g.msgs.filter(m => m.text && !/^\[.*\]$/.test(m.text)).slice().sort((a, b) => a.ts - b.ts)
      .map(m => Object.assign({}, m, { role: m.role === 'team' || isTeam(m.sender) ? 'team' : 'client' }));
    let added = 0;
    for (let i = 0; i < msgs.length; i++) {
      const q = msgs[i];
      if (q.role !== 'client' || isTrivial(q.text) || q.text.length < 15) continue;
      const qd = deacc(q.text);
      const looksQuestion = QUESTION_RE.test(qd) || /(presumi|achei que|pensei que|nao (encontr|localiz|achei|vejo|aparece)|gostaria de saber|tenho uma duvida|duvida|ajuda|e possivel|seria possivel)/.test(qd) || q.text.length >= 60;
      if (!looksQuestion) continue;
      if (/(algum|alguma|tem|teve|ha) (retorno|novidade|posicao|resposta|previsao|atualizacao)|devolutiva|conseguiu(ram)? (ver|verificar)/.test(qd) && qd.length < 80) continue; // cobrança de status não é conhecimento
      if (!SYS_RE.test(qd) && !(msgs[i + 1] && SYS_RE.test(deacc(msgs.slice(i + 1, i + 5).filter(m => m.role === 'team').map(m => m.text).join(' '))))) continue;
      // junta perguntas seguidas do cliente (até a primeira resposta da equipe)
      let qText = q.text, j = i + 1;
      while (j < msgs.length && msgs[j].role === 'client' && msgs[j].ts - msgs[j - 1].ts < 10 * MIN) { if (!isTrivial(msgs[j].text)) qText += ' ' + msgs[j].text; j++; }
      // respostas da equipe em até 8 h, até o cliente voltar a falar algo relevante
      const ans = []; let k = j, aTs = 0, who = '';
      while (k < msgs.length && msgs[k].ts - q.ts < 8 * HOUR) {
        const m = msgs[k];
        if (m.role === 'client' && !isTrivial(m.text)) break;
        if (m.role === 'team' && !isTrivial(m.text)) {
          const md = deacc(m.text);
          const onlyStall = NON_ANSWER_RE.test(md) && m.text.length < 160;
          if (!onlyStall) { ans.push(m.text); aTs = aTs || m.ts; who = who || shortName(m.sender); }
        }
        k++;
        if (ans.length >= 3) break;
      }
      if (!ans.length) continue;
      const a = cleanAnswer(ans.join('\n'));
      if (a.length < 50) continue;
      if (!SYS_RE.test(deacc(qText + ' ' + a))) continue; // só assuntos do sistema
      // resolvido? cliente agradece / confirma depois da resposta
      let resolved = false;
      for (let r = k; r < msgs.length && msgs[r].ts - aTs < DAY; r++) {
        if (msgs[r].role === 'client') { resolved = RESOLVED_RE.test(deacc(msgs[r].text)); break; }
      }
      if (!resolved && data.final && data.final[name] && data.final[name].ts > aTs) resolved = true;
      const id = `${name}|${q.ts}`;
      const ex = kb.find(x => x.id === id);
      if (ex) {
        if (ex.status === 'auto' && (a.length > ex.a.length || (resolved && !ex.resolved))) { ex.a = a.slice(0, 1500); ex.resolved = ex.resolved || resolved; saveKb(); }
        continue;
      }
      const ctx = msgs.slice(Math.max(0, i - 2), Math.min(msgs.length, k + 2)).map(m => `${m.role === 'team' ? 'EQUIPE' : 'CLIENTE'} ${shortName(m.sender)}: ${norm(m.text).slice(0, 400)}`);
      kb.push({ id, group: name, q: norm(qText).slice(0, 600), qTs: q.ts, a: a.slice(0, 1500), aTs, who, resolved, status: 'auto', uses: 0, ctx, curated: false });
      added++;
    }
    if (added) {
      if (kb.length > 900) { // mantém os validados e os mais recentes
        kb.sort((x, y) => (y.status === 'approved') - (x.status === 'approved') || y.qTs - x.qTs);
        kb = kb.slice(0, 900);
      }
      saveKb();
    }
    return added;
  }
  function learnAll() { let n = 0; for (const name of Object.keys(data.groups)) if (isClientGroup(name)) n += learnGroup(name); return n; }

  // Procura perguntas parecidas já respondidas
  let idfCache = null, idfAt = 0;
  function allItems() { return man.length ? man.concat(kb) : kb; }
  function itemVariants(x) {
    if (!x.manual) return [x._t || (x._t = tokens(x.q))];
    if (x._v) return x._v;
    const tg = tokens(x.tags || '');
    x._v = [x.title, ...String(x.q || '').split('\n')].map(t => (t || '').trim()).filter(Boolean).map(t => [...new Set([...tokens(t), ...tg])]).filter(v => v.length);
    if (!x._v.length) x._v = [tokens((x.a || '').slice(0, 300))];
    return x._v;
  }
  function idf() {
    const key = kb.length + ':' + manVer;
    if (idfCache && Date.now() - idfAt < 60 * 1000 && idfCache.key === key) return idfCache;
    const df = new Map();
    for (const x of allItems()) { if (x.status === 'rejected') continue; for (const t of new Set(itemVariants(x).flat())) df.set(t, (df.get(t) || 0) + 1); }
    idfCache = { df, n: kb.length + man.length, key }; idfAt = Date.now();
    return idfCache;
  }
  function findSimilar(text, excludeGroupTs) {
    const qt = tokens(text);
    if (qt.length < 2 || !kb.length) return [];
    const { df } = idf();
    const N = Math.max(1, kb.length + man.length);
    const w = t => Math.log(1 + N / (1 + (df.get(t) || 0)));
    const qw = qt.reduce((s, t) => s + w(t), 0);
    const res = [];
    for (const x of allItems()) {
      if (x.status === 'rejected') continue;
      if (excludeGroupTs && x.id === excludeGroupTs) continue;
      let score = 0;
      for (const xt of itemVariants(x)) {
        const set = new Set(xt);
        let inter = 0; for (const t of qt) if (set.has(t)) inter += w(t);
        if (!inter) continue;
        const xw = xt.reduce((s, t) => s + w(t), 0);
        score = Math.max(score, inter / Math.sqrt(qw * xw));
      }
      if (!score) continue;
      if (x.manual) score *= 1.4;
      else if (x.status === 'approved') score *= 1.25;
      if (x.resolved) score *= 1.1;
      if (score >= 0.32) res.push({ item: x, score: Math.min(1, score) });
    }
    res.sort((a, b) => b.score - a.score);
    // evita repetir a mesma resposta
    const seen = new Set(), out = [];
    for (const r of res) { const k = r.item.a.slice(0, 80); if (seen.has(k)) continue; seen.add(k); out.push(r); if (out.length >= 2) break; }
    return out;
  }
  function kbReply(item, clientName) {
    return `${saud()}, @${clientName}! Tudo bem?\n\n${item.a}\n\nQualquer dúvida, estamos à disposição!`;
  }
  function kbSet(id, status) { const x = kb.find(y => y.id === id); if (x) { x.status = status; idfCache = null; saveKb(); render(true); } }

  // "Aprender histórico": rola a conversa aberta para cima para carregar mensagens antigas (somente leitura)
  function chatScroller() {
    const main = document.querySelector('#main');
    if (!main) return null;
    const row = main.querySelector('[role="row"]');
    let el = row ? row.parentElement : null;
    while (el && el !== main) { const cs = getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 10) return el; el = el.parentElement; }
    return main.querySelector('[tabindex="0"][role="application"]') || null;
  }
  async function learnHistory(name, steps) {
    if (name && currentChatName() !== name && !(await openChat(name))) return 0;
    const sc = chatScroller();
    if (!sc) { ingestOpenChat(); return learnGroup(currentChatName()); }
    let prevH = -1;
    for (let i = 0; i < (steps || 12); i++) {
      if (abortRound) break;
      ingestOpenChat(); learnGroup(currentChatName());
      sc.scrollTop = 0;
      await sleep(1300);
      if (sc.scrollHeight === prevH) break;
      prevH = sc.scrollHeight;
    }
    ingestOpenChat();
    const n = learnGroup(currentChatName());
    sc.scrollTop = sc.scrollHeight; // volta para o fim da conversa
    return n;
  }
  async function learnHistoryAll() {
    if (rounding) return;
    rounding = true; manualRound = true; abortRound = false;
    let total = 0;
    try {
      const original = currentChatName();
      roundInfo = '📚 Aprendendo: listando grupos…'; render(true);
      const all = await sweepList();
      const names = all.filter(n => { const pv = data.groups[n] && data.groups[n].preview; return pv && pv.ts && Date.now() - pv.ts < 30 * DAY; });
      for (let i = 0; i < names.length; i++) {
        if (abortRound) break;
        roundInfo = `📚 Aprendendo histórico: ${i + 1}/${names.length} — ${names[i]} (${total} novas)`; render(true);
        total += await learnHistory(names[i], 6);
      }
      if (original && currentChatName() !== original) await openChat(original);
    } catch (e) { console.warn('[Supervisor Ileva] aprender', e); }
    finally { rounding = false; roundInfo = ''; save(); lsSet(LS_KB, kb); render(true); }
    return total;
  }

  // ------------------------------------------------------------------ CONSOLIDAÇÃO
  function computeAll() {
    const now = Date.now();
    const groups = [];
    for (const n of Object.keys(data.groups)) { if (!isClientGroup(n)) continue; const c = computeGroup(n); if (c) groups.push(c); }
    // Em tempo real só entram conversas de HOJE; pendências antigas ficam na aba "Início do dia" (leitura das 08:15)
    const today0 = startOfToday();
    const sinceOf = g => g.pend[0] ? g.pend[0].ts : (g.lastRel ? g.lastRel.ts : 0);
    const winStart = bizWindowStart(now);
    const isToday = g => (sinceOf(g) >= today0 && !g.approx) || (sinceOf(g) >= winStart && g.afterHours); // hoje + fora do expediente desde o último dia útil
    const open = groups.filter(g => g.status === 'open' && isToday(g)).sort((a, b) => b.wait - a.wait);
    const waiting = groups.filter(g => g.status === 'await' && isToday(g)).sort((a, b) => b.wait - a.wait);
    const promises = groups.filter(g => g.promise && g.promise.since >= today0).sort((a, b) => a.promise.since - b.promise.since);
    // pendências da leitura da manhã que AINDA estão pendentes
    const byName = new Map(groups.map(g => [g.name, g]));
    const mItems = (data.morning && data.morning.date === dayKey() && !data.morning.pending) ? data.morning.items : [];
    const morning = [], morningDone = [];
    for (const it of mItems) {
      const g = byName.get(it.name);
      const still = g && !g.finalized && ((it.kind === 'promise' && g.promise) || ((it.kind === 'open' || it.kind === 'await') && (g.status === 'open' || g.status === 'await') && sinceOf(g) < today0));
      (still ? morning : morningDone).push({ it, g });
    }
    const tone = [];
    for (const g of groups) g.msgs.forEach((m, i) => {
      if (m.role !== 'team' || m.approx || now - m.ts > DAY) return;
      const r = analyzeTone(g, i);
      if (r) { r.key = `${g.name}|${m.ts}|${(m.text || '').slice(0, 40)}`; if (!data.dismissed[r.key]) tone.push(r); }
    });
    tone.sort((a, b) => b.ts - a.ts);
    const perCollab = {};
    tone.forEach(t => { perCollab[t.who] = (perCollab[t.who] || 0) + 1; });
    const reds = open.filter(g => g.level === 'red');
    const editable = tone.filter(t => now - t.ts < 15 * MIN);
    const finalized = groups.filter(g => g.finalized && now - g.finalized.ts < DAY).sort((a, b) => b.finalized.ts - a.finalized.ts);
    return { now, groups, open, waiting, promises, tone, perCollab, reds, editable, finalized, morning, morningDone, morningInfo: data.morning && data.morning.date === dayKey() && !data.morning.pending ? data.morning : null };
  }

  // ------------------------------------------------------------------ RELATÓRIO EM TEXTO
  const LV = { green: '🟢', yellow: '🟡', red: '🔴' };
  function buildTextReport(st) {
    const L = [];
    L.push(`SUPERVISOR ILEVA — ronda de ${fmtTime(st.now)}`);
    L.push('', '🚨 ALERTAS URGENTES');
    const al = [];
    st.reds.forEach(g => al.push(`🔴 ${g.name} — ${g.clientName} aguardando há ${g.approx ? 'mais de ' : ''}${fmtDur(g.wait)}`));
    st.promises.forEach(g => al.push(`⏳ ${g.name} — retorno prometido por ${g.promise.who} (${fmtTime(g.promise.since)}) ainda não dado`));
    st.editable.forEach(t => al.push(`✏️ DÁ PARA EDITAR AINDA — ${t.who} em ${t.group} (${fmtTime(t.ts)}), restam ${Math.max(0, 15 - Math.floor((st.now - t.ts) / MIN))} min`));
    st.tone.filter(t => st.now - t.ts >= 15 * MIN && st.now - t.ts < HOUR).forEach(t => al.push(`🗣️ Tom: ${t.who} em ${t.group} (${fmtTime(t.ts)}) — ${[...new Set(t.issues.map(i => i.cat))].join(', ')}`));
    L.push(...(al.length ? al : ['Nenhum alerta no momento.']));
    if (st.morningInfo) {
      L.push('', `🌅 PENDÊNCIAS DO INÍCIO DO DIA (leitura às ${fmtTime(st.morningInfo.at)})`);
      if (!st.morning.length) L.push('Nenhuma pendência de dias anteriores.');
      st.morning.forEach(({ it, g }) => L.push(`${g.name} | ${it.kind === 'promise' ? 'retorno prometido' : it.kind === 'await' ? 'aguardando cliente' : 'cliente sem resposta'} desde ${it.label ? it.label : fmtTime(it.since) + ` (${fmtDur(st.now - it.since)})`}`));
    }
    L.push('', '📋 ATENDIMENTOS EM ABERTO (HOJE)', 'Grupo | Cliente | Última msg | Espera | Status');
    const rows = [...st.open, ...st.waiting];
    if (!rows.length) L.push('Nenhum atendimento em aberto.');
    rows.forEach(g => L.push(`${g.name} | ${g.clientName} | "${(g.lastRel.text || '').slice(0, 70)}" (${fmtTime(g.lastRel.ts, g.lastRel.approxLabel)}) | ${g.approx ? '+' : ''}${fmtDur(g.wait)} | ${g.status === 'await' ? '⏳ aguardando o cliente' : LV[g.level]}${g.partial ? ' (só prévia)' : ''}`));
    L.push('', '✍️ RESPOSTAS SUGERIDAS');
    const sug = [...st.open.map(g => [g, 'open']), ...st.waiting.map(g => [g, 'await']), ...st.promises.map(g => [g, 'promise'])];
    if (!sug.length) L.push('Nenhuma resposta pendente.');
    sug.forEach(([g, mode]) => { const { s, sims } = bestSuggestion(g, mode); L.push('', `▶ ${g.name}${mode === 'promise' ? ' (retorno prometido)' : ''}`, s.text); if (!s.kb || s.note) L.push(`⚠️ ${s.note || 'Confirme com o setor responsável.'}`); if (s.src) L.push(`Base: ${s.src}`); sims.forEach(r => L.push(`💡 Parecido já respondido em ${r.item.group} (${fmtTime(r.item.qTs)}, ${Math.round(r.score * 100)}%): ${r.item.a.slice(0, 200)}`)); });
    L.push('', '🗣️ REVISÃO DE TOM DA EQUIPE (24h)');
    if (!st.tone.length) L.push('Nenhuma mensagem com problema nas conversas lidas.');
    st.tone.forEach(t => { L.push('', `${t.who} — ${t.group} — ${fmtTime(t.ts)}${st.now - t.ts < 15 * MIN ? '  ✏️ DÁ PARA EDITAR AINDA' : ''}`, `Original: ${t.original}`, `Problema: ${t.issues.map(i => `${i.cat}: ${i.text}`).join('; ')}`, `Corrigida: ${t.fixed}`); });
    L.push('', '📊 RESUMO');
    L.push(`Total em aberto: ${st.open.length} (+${st.waiting.length} aguardando o cliente, ${st.promises.length} retorno(s) prometido(s))`);
    const max = st.open[0];
    L.push(`Maior espera: ${max ? `${max.name} — ${max.approx ? '+' : ''}${fmtDur(max.wait)}` : '—'}`);
    const pc = Object.entries(st.perCollab).sort((a, b) => b[1] - a[1]);
    L.push(`Mensagens com problema: ${pc.length ? pc.map(([k, v]) => `${k} ${v}`).join(', ') : 'nenhuma'}`);
    return L.join('\n');
  }
  function buildClaudeExport(st) {
    const out = { geradoEm: new Date(st.now).toLocaleString('pt-BR'), grupos: st.groups.map(g => ({
      grupo: g.name, status: g.status, historicoCompletoLido: !g.partial,
      mensagens24h: g.msgs.filter(m => st.now - m.ts < DAY).map(m => ({ hora: fmtTime(m.ts, m.approxLabel), remetente: m.sender, equipe: m.role === 'team', texto: m.text }))
    })) };
    return 'Você é o supervisor de atendimento da Ileva Gestão. Use os treinamentos do projeto "Base de conhecimento Ileva". ' +
      'Com os dados abaixo (coletados do WhatsApp Web), entregue: 🚨 alertas urgentes; 📋 tabela de atendimentos em aberto (Grupo | Cliente | Última msg | Espera | Status 🟢≤10min 🟡10–15 🔴>15); ' +
      '✍️ respostas sugeridas prontas para copiar (sem inventar funcionalidades; se não estiver nos treinamentos, indique o setor responsável); ' +
      '🗣️ revisão de tom da equipe (gírias, imperativo seco, falta de empatia, falta de saudação/nome, português, informação técnica contrária aos treinamentos) com versão corrigida; 📊 resumo. ' +
      'Equipe: Lucas, Adriel, Richard, Stony, Akim, Francisco e mensagens "Você". Não envie nada no WhatsApp.\n\nDADOS:\n' + JSON.stringify(out, null, 1);
  }

  // ------------------------------------------------------------------ UI (Shadow DOM, sem innerHTML)
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (k === 'open') el.open = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat(Infinity)) { if (k == null || k === false) continue; el.append(k instanceof Node ? k : document.createTextNode(String(k))); }
    return el;
  }
  async function copy(text, btn) {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
      try { const ta = h('textarea', { style: 'position:fixed;left:-9999px' }); ta.value = text; shadow.append(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); } catch (e2) { ok = false; }
    }
    if (btn) { const o = btn.textContent; btn.textContent = ok ? '✓ Copiado' : 'Falhou'; setTimeout(() => { btn.textContent = o; }, 1500); }
  }

  // preferências de tela (lembradas neste navegador)
  const LS_UI = 'ilevaSup.ui.v1';
  const ui = Object.assign({ open: false, tab: 'atend', width: 400, filter: null }, lsGet(LS_UI, {}));
  const saveUi = () => lsSet(LS_UI, ui);
  if (!['reun', 'rx', 'lemb', 'tar', 'chat'].includes(ui.tab)) ui.tab = 'atend'; if (ui.filter && !['red', 'prazo', 'retorno'].includes(ui.filter)) ui.filter = null;
  if (!IS_WA) ui.open = false;
  const WIDTHS = [340, 400, 480];

  const CSS = `
  :host{all:initial}
  :host(.eco) *,:host(.eco) *::before,:host(.eco) *::after{animation-duration:.001s!important;animation-iteration-count:1!important;animation-delay:0s!important}
  *{box-sizing:border-box;font-family:Segoe UI,Helvetica Neue,Helvetica,Arial,sans-serif}
  @keyframes blink{0%,100%{background:#3a1418;border-color:#f15c6d}50%{background:#111b21;border-color:#5a2a30}}
  @keyframes blinkPill{0%,100%{background:#f15c6d;color:#fff}50%{background:#5a2a30;color:#ffb3bc}}
  @keyframes blinkFab{0%,100%{background:#f15c6d;box-shadow:0 0 0 2px #7d42c8,0 0 0 2px rgba(241,92,109,.7)}50%{background:#b8323f;box-shadow:0 0 0 2px #7d42c8,0 0 0 12px rgba(241,92,109,0)}}
  .fab{position:fixed;right:18px;bottom:76px;touch-action:none;user-select:none;z-index:2147483646;background:#00a884;color:#0b141a;border:2px solid #0b141a;border-radius:24px;padding:8px 14px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 0 0 2px #7d42c8,0 4px 14px rgba(0,0,0,.45);display:flex;gap:8px;align-items:center}
  .fab.alarm{animation:blinkFab 1s ease-in-out infinite;color:#fff}
  .fab .mn{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,.28);color:#fff;font-size:15px;line-height:1;margin-left:-2px;margin-right:-6px;cursor:pointer}
  .fab .mn:hover{background:rgba(0,0,0,.55)}
  .fab .lg{display:inline-flex;width:19px;height:19px;flex:none}
  .fab .lg svg{width:100%;height:100%;display:block}
  .fab.mini .lg{width:24px;height:24px;margin-left:2px}
  .fab.mini{width:40px;height:40px;padding:0;border-radius:50%;justify-content:center;gap:0;font-size:18px}
  .fab.mini .mb{position:absolute;top:-7px;right:-7px;min-width:18px;height:18px;padding:0 5px;box-sizing:border-box;border-radius:9px;background:#0b141a;color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;border:1.5px solid #7d42c8}
  .fab.mini.alarm .mb{background:#d93a4c}
  .fab{opacity:var(--op,1);transition:opacity .15s}
  .fab:hover:not(.adj){opacity:1}
  .pq.show{opacity:var(--op,1);transition:opacity .15s}.pq.show:hover:not(.adj){opacity:1}
  .meetbar .mt{opacity:var(--op,1);transition:opacity .15s}
  .meetbar:hover:not(.adj) .mt{opacity:1}
  .masc{position:fixed;width:90px;height:90px;z-index:2147483647;cursor:pointer;transition:left .6s cubic-bezier(.3,1.4,.5,1),top .6s cubic-bezier(.3,1.4,.5,1),opacity .2s;opacity:var(--op,1);filter:drop-shadow(0 4px 6px rgba(0,0,0,.5))}
  .masc:hover{opacity:1}
  .masc.flip>svg{scale:-1 1}
  .masc svg{width:90px;height:90px;overflow:visible}
  .masc .all{transform-box:view-box;transform-origin:250px 444px;animation:mBob 3.2s ease-in-out infinite}
  .masc .eyes{transform-box:fill-box;transform-origin:center;animation:mBlink 4.2s infinite}
  .masc .pup{transition:transform .3s}
  .masc .hat{transform-box:view-box;transform-origin:214px 100px;animation:mHat 3.2s ease-in-out infinite}
  .masc .mo,.masc .brow,.masc .clock,.masc .spark,.masc .sirenH{display:none}
  /* sirene erguida na mão (cliente urgente e reunião começando) */
  .masc .sirenH{transform-box:view-box;transform-origin:146px 238px;animation:mRaise 1.6s ease-in-out infinite}

  /* ================= MODO CORPORATIVO ================= */
  :host(.corp){--c-bg:#111720;--c-bg2:#151c27;--c-bd:#1f2733;--c-bd2:#273244;--c-tx:#e7e9ee;--c-mu:#8a94a6;--c-ac:#8b5cf6;--c-ac2:#7c4ddb;--c-r:#ef5b6b;--c-a:#f4c060;--c-g:#2fbf71}
  :host(.corp) .panel{background:var(--c-bg);border-left:1px solid var(--c-bd);font-family:Inter,"Segoe UI",system-ui,sans-serif}
  :host(.corp) .hd,:host(.corp) .tabs{background:var(--c-bg);border-color:var(--c-bd)}
  :host(.corp) .ttl .brand{color:var(--c-ac)}
  :host(.corp) .chip{background:var(--c-bg2);border:1px solid var(--c-bd);text-align:left;padding:8px 10px}
  :host(.corp) .chip .n{font-size:19px;font-weight:700;color:var(--c-tx)}
  :host(.corp) .chip .l{color:var(--c-mu)}
  :host(.corp) .chip.red .n{color:#ff8a96}:host(.corp) .chip.yellow .n{color:var(--c-a)}:host(.corp) .chip.purple .n{color:#c4b0ff}:host(.corp) .chip.blue .n{color:#8fc7ff}
  :host(.corp) .chip.red.on{animation:none;border-color:rgba(239,91,107,.5)}
  :host(.corp) .chip.sel{border-color:var(--c-ac);box-shadow:none;background:#1d1530}
  :host(.corp) .tab{color:var(--c-mu);font-weight:500}:host(.corp) .tab.on{color:var(--c-tx);border-bottom-color:var(--c-ac);font-weight:600}
  :host(.corp) .tab .c{background:rgba(239,91,107,.16);color:#ff8a96}:host(.corp) .tab .c.g{background:#232c3a;color:#c9d0dc}
  :host(.corp) .bd{background:var(--c-bg)}
  :host(.corp) .grp{color:#6f7a8c;font-weight:600;letter-spacing:.8px;font-size:10.5px}
  :host(.corp) .card{background:#131a24;border:1px solid #1d2532;border-left:3px solid #2b3445;border-radius:10px}
  :host(.corp) .card.red{border-left-color:var(--c-r)}:host(.corp) .card.yellow{border-left-color:var(--c-a)}:host(.corp) .card.green{border-left-color:var(--c-g)}:host(.corp) .card.blue{border-left-color:#4aa3ff}:host(.corp) .card.purple{border-left-color:var(--c-ac)}
  :host(.corp) .card.red.blink,:host(.corp) .pill.red.blink{animation:none}
  :host(.corp) .pill{border-radius:999px;font-weight:600;padding:1px 8px}
  :host(.corp) .pill.red{background:rgba(239,91,107,.14);color:#ff8a96}:host(.corp) .pill.yellow{background:rgba(244,192,96,.14);color:var(--c-a)}:host(.corp) .pill.green{background:rgba(47,191,113,.14);color:#6fd99f}:host(.corp) .pill.blue{background:rgba(74,163,255,.14);color:#8fc7ff}:host(.corp) .pill.purple{background:rgba(139,92,246,.16);color:#c4b0ff}
  :host(.corp) .quote{background:#0f141c;border:1px solid #1d2532;color:#d3d8e2}
  :host(.corp) .who{color:var(--c-mu)}
  :host(.corp) .btn{border-radius:8px;border:1px solid var(--c-bd2);background:transparent;color:#d6dbe4}
  :host(.corp) .btn.pri,:host(.corp) .btn.ok{background:var(--c-ac2);border-color:var(--c-ac2);color:#fff}
  :host(.corp) .undo{background:#151c27;border-color:var(--c-bd2);color:#c9d0dc}
  /* barra flutuante */
  :host(.corp) .fab{background:var(--c-bg);color:var(--c-tx);border:1px solid var(--c-bd2);box-shadow:0 12px 30px rgba(0,0,0,.45);font-weight:500;font-size:13px;padding:6px 8px 6px 12px;gap:10px;font-family:Inter,"Segoe UI",system-ui,sans-serif}
  :host(.corp) .fab.alarm{animation:none;color:var(--c-tx)}
  :host(.corp) .fab .sep{display:inline-block;width:1px;height:16px;background:var(--c-bd2)}
  :host(.corp) .fab .stx{display:inline-flex;align-items:center;gap:7px;color:#6fd99f}
  :host(.corp) .fab .stx.r{color:#ff8a96}
  :host(.corp) .fab .sdot{position:relative;width:8px;height:8px;border-radius:50%;background:var(--c-g)}
  :host(.corp) .fab .stx.r .sdot{background:var(--c-r);animation:cDot 2s ease-in-out infinite}
  :host(.corp) .fab .stx.r .sdot:after{content:"";position:absolute;inset:-1px;border-radius:50%;border:2px solid var(--c-r);animation:cRing 2s ease-out infinite}
  :host(.corp) .fab .ab{color:#9aa4b5}
  :host(.corp) .fab .mn,:host(.corp) .fab .lu{background:transparent;color:#9aa4b5}
  :host(.corp) .fab .mn:hover,:host(.corp) .fab .lu:hover{background:#1b2230}
  :host(.corp) .fab.lv2{animation:cBreath 2.4s ease-in-out infinite}
  :host(.corp) .fab.lv3{background:#3a1219;border-color:var(--c-r);animation:cAlarm 1.2s ease-in-out infinite}
  :host(.corp) .fab.lv3 .stx{color:#fff;font-weight:600}:host(.corp) .fab.lv3 .ab{color:#f3c3c8}
  :host(.corp) .fab.mini{width:auto;height:auto;padding:6px 10px;border-radius:999px;gap:6px}
  :host(.corp) .fab.mini .mb{position:static;border:0;background:var(--c-r)}
  :host(.corp) .fab.mini:not(.alarm) .mb{background:#2a3445}
  @keyframes cDot{0%,100%{transform:scale(1)}15%{transform:scale(1.35)}}
  @keyframes cRing{0%{transform:scale(1);opacity:.9}100%{transform:scale(3.2);opacity:0}}
  @keyframes cBreath{0%,100%{border-color:#4a2530;box-shadow:0 12px 30px rgba(0,0,0,.4),0 0 0 0 rgba(239,91,107,0)}50%{border-color:#ef5b6b;box-shadow:0 12px 30px rgba(0,0,0,.4),0 0 0 4px rgba(239,91,107,.18)}}
  @keyframes cAlarm{0%,100%{box-shadow:0 12px 30px rgba(0,0,0,.4),0 0 0 0 rgba(239,91,107,0);background:#3a1219}50%{box-shadow:0 12px 30px rgba(0,0,0,.4),0 0 0 6px rgba(239,91,107,.25);background:#5a1822}}
  /* notificação no canto (no lugar do balão do mascote) */
  .ctoast{position:fixed;z-index:2147483646;width:360px;max-width:calc(100vw - 24px);display:none;gap:12px;background:#111720;border:1px solid #273244;border-left:3px solid #8b5cf6;border-radius:12px;padding:12px 14px;box-shadow:0 14px 34px rgba(0,0,0,.5);color:#e7e9ee;font:13px/1.4 Inter,"Segoe UI",system-ui,sans-serif;animation:ctIn .35s cubic-bezier(.2,1.2,.4,1)}
  .ctoast.show{display:flex}.ctoast.out{animation:ctOut .3s ease-in forwards}
  @keyframes ctIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}} @keyframes ctOut{to{opacity:0;transform:translateY(8px)}}
  .ctoast .lgq{position:relative;width:36px;height:36px;border-radius:10px;background:#1b1430;border:1px solid #3b2a66;display:flex;align-items:center;justify-content:center;flex:none}
  .ctoast .lgq .lg{width:21px;height:21px}
  .ctoast .bdg{position:absolute;right:-5px;bottom:-5px;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #111720;color:#fff}
  .ctoast .who2{font-size:11px;color:#8a94a6}.ctoast .tt{font-weight:600;font-size:13px}.ctoast .tx{font-size:12.5px;color:#aab3c2;margin-top:2px}
  .ctoast .bb{display:flex;gap:6px;margin-top:9px;flex-wrap:wrap}
  .ctoast .cb{font:12px Inter,"Segoe UI",system-ui,sans-serif;border-radius:8px;border:1px solid #273244;background:transparent;color:#d6dbe4;padding:6px 11px;cursor:pointer}
  .ctoast .cb.pri{background:#7c4ddb;border-color:#7c4ddb;color:#fff}
  .ctoast .cx{position:absolute;right:8px;top:6px;background:none;border:0;color:#6f7a8c;cursor:pointer;font-size:14px}
  .ctoast.k-cli{border-left-color:#ef5b6b}.ctoast.k-cli.soft{border-left-color:#f4c060}.ctoast.k-cob{border-left-color:#2fbf71}.ctoast.k-after{border-left-color:#4aa3ff}
  /* alerta de reunião em níveis */
  :host(.corp) .mt{background:#111720;border:1px solid #2b2140;border-left:3px solid #8b5cf6;border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,.45);font-family:Inter,"Segoe UI",system-ui,sans-serif;animation:none;color:#e7e9ee}
  :host(.corp) .mt .mh{color:#c4b0ff;font-size:11px;letter-spacing:.6px}
  :host(.corp) .mt .cd,:host(.corp) .mt .mcd{color:#c4b0ff;font-variant-numeric:tabular-nums}
  :host(.corp) .mt.warn.near{animation:cmBreath 2.4s ease-in-out infinite}
  :host(.corp) .mt.go{border-color:#8b5cf6;animation:cmHot 1.1s ease-in-out infinite}
  :host(.corp) .mt.go .cd,:host(.corp) .mt.go .mcd{color:#fff}
  :host(.corp) .mt.go.late{background:#2a1450;border-color:#a77bf0;animation:cmHot .8s ease-in-out infinite}
  :host(.corp) .mt.go.late .cd,:host(.corp) .mt.go.late .mcd{color:#ffd279}
  :host(.corp) .mt.ack{border-color:#2b2140;border-left-color:#8b5cf6}
  :host(.corp) .mt.run,:host(.corp) .mt.live,:host(.corp) .mt.done{background:#111720;border-color:#1f3a2c;border-left-color:#2fbf71}
  :host(.corp) .mt.run .mh,:host(.corp) .mt.live .mh,:host(.corp) .mt.done .mh{color:#6fd99f}
  :host(.corp) .mt.run .cd,:host(.corp) .mt.live .cd,:host(.corp) .mt.live .mcd,:host(.corp) .mt.done .cd{color:#6fd99f}
  :host(.corp) .mt .btn{border-radius:8px;padding:6px 10px;font-size:12px}
  :host(.corp) .mt:not(.mini) .mb{display:flex!important;flex-direction:row!important;flex-wrap:wrap;justify-content:flex-end;gap:6px;max-width:330px}
  :host(.corp) .mt .cd{font-size:22px}
  :host(.corp) .fab .lg{filter:brightness(1.9) saturate(1.2)}
  :host(.corp) .ctoast .lg{filter:brightness(1.9) saturate(1.2)}
  :host(.corp) .mt.mini{border-radius:999px;border:1px solid #2b2140}
  @keyframes cmBreath{0%,100%{border-color:#2b2140;border-left-color:#8b5cf6;box-shadow:0 12px 30px rgba(0,0,0,.4),0 0 0 0 rgba(139,92,246,0)}50%{border-color:#8b5cf6;box-shadow:0 12px 30px rgba(0,0,0,.4),0 0 0 4px rgba(139,92,246,.2)}}
  @keyframes cmHot{0%,100%{background:#1a1230;box-shadow:0 0 0 0 rgba(139,92,246,0),0 12px 30px rgba(0,0,0,.4)}50%{background:#2d1a52;box-shadow:0 0 0 6px rgba(139,92,246,.28),0 12px 30px rgba(0,0,0,.4)}}
  .lbcard{background:#131a24;border:1px solid #1d2532;border-left:3px solid #8b5cf6;border-radius:10px;padding:10px 12px;margin:0 0 8px}
  .lbcard.due{border-left-color:#f4c060}.lbcard.late{border-left-color:#ef5b6b}.lbcard.done{border-left-color:#2fbf71;opacity:.75}
  .lbcard .lt{font-weight:600;font-size:13.5px}.lbcard .lm{font-size:12px;color:#8a94a6;margin-top:3px}
  .lbcard .lw{float:right;font-size:11.5px;padding:2px 8px;border-radius:999px;background:rgba(139,92,246,.15);color:#c4b0ff}
  .lbcard.due .lw{background:rgba(244,192,96,.14);color:#f4c060}.lbcard.late .lw{background:rgba(239,91,107,.14);color:#ff8a96}.lbcard.done .lw{background:rgba(47,191,113,.14);color:#6fd99f}
  .lbcard .lo{font-size:12px;color:#aab3c2;margin-top:4px;white-space:pre-wrap}
  .lbcard .actions{margin-top:8px}
  .lbform label{display:block;margin-top:8px}
  .lbform select{width:100%;box-sizing:border-box;height:34px;background:#1d2532;border:1px solid #2a3442;border-radius:8px;color:#e7e9ee;padding:0 8px;font:13px Inter,"Segoe UI",system-ui,sans-serif;margin-top:4px}.lbform select option{background:#111720;color:#e7e9ee}
  .lbtoast{border-left-color:#f4c060}
  .eod{border-left-color:#2fbf71}.eod .nums{display:flex;gap:6px;margin-top:8px}.eod .nums div{flex:1;background:#18202c;border:1px solid #1d2532;border-radius:8px;padding:6px 8px;font-size:11px;color:#8a94a6}.eod .nums b{display:block;font-size:17px;color:#e7e9ee;font-weight:600}
  .eod .xm{margin-top:8px;font-size:12px;color:#c4b0ff;display:flex;align-items:center;gap:6px}
  .neon{position:fixed;z-index:2147483646;display:flex;align-items:flex-end;gap:6px;cursor:pointer;opacity:0;transform:translateY(8px);transition:opacity .5s,transform .6s cubic-bezier(.2,1.3,.4,1);font-family:Inter,"Segoe UI",system-ui,sans-serif;pointer-events:auto}
  .neon.on{opacity:1;transform:none}.neon.off{opacity:0;transform:translateY(6px);transition:opacity .8s,transform .8s}
  .neon svg{width:48px;height:56px;display:block;overflow:visible;flex:none}
  .neon .ln{fill:none;stroke:#39ff88;stroke-width:4;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;filter:drop-shadow(0 0 2px #39ff88) drop-shadow(0 0 6px #19e070);animation:nDraw 1.7s cubic-bezier(.6,.1,.3,1) forwards}
  .neon .ln.g{stroke-width:3;opacity:.85;animation-delay:1.5s;animation-duration:.9s}
  .neon .ln.t{animation-delay:1.2s;animation-duration:.6s}
  .neon .orn{opacity:0;filter:drop-shadow(0 0 3px currentColor);animation:nPop .35s ease-out forwards,nTw 1.6s ease-in-out 3s infinite}
  .neon .star{fill:#f6f3ff;opacity:0;transform-origin:75px 14px;filter:drop-shadow(0 0 4px #c9a8ff) drop-shadow(0 0 10px #8b5cf6);animation:nStar .7s cubic-bezier(.2,1.6,.4,1) 2.3s forwards,nTw 2s ease-in-out 3.2s infinite}
  .neon .nt{opacity:0;animation:nFlick 1.1s linear 2.6s forwards;padding-bottom:4px;white-space:nowrap}
  .neon .nt b{display:block;font-size:15px;font-weight:700;color:#e6fff0;letter-spacing:.2px;text-shadow:0 0 3px #39ff88,0 0 9px #19e070,0 0 18px rgba(25,224,112,.8),0 1px 2px rgba(0,0,0,.9)}
  .neon .nt span{display:block;font-size:10px;font-weight:600;color:#b8f5d2;letter-spacing:1.4px;text-transform:uppercase;margin-top:1px;text-shadow:0 0 6px rgba(57,255,136,.7),0 1px 2px rgba(0,0,0,.9)}
  @keyframes nDraw{to{stroke-dashoffset:0}}
  @keyframes nPop{from{opacity:0;transform:scale(.2)}to{opacity:1;transform:none}}
  @keyframes nTw{50%{opacity:.45}}
  @keyframes nStar{from{opacity:0;transform:scale(.2) rotate(-90deg)}to{opacity:1;transform:none}}
  @keyframes nFlick{0%{opacity:0}10%{opacity:.9}14%{opacity:.1}22%{opacity:1}30%{opacity:.3}38%,100%{opacity:1}}
  .mt .mi{min-width:230px}.mt .mrl{font-size:12.5px;color:#c4b0ff;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mt .mrl b{color:#fff;font-weight:700}
  .mt.mini>span:first-child{white-space:nowrap}
  .slg{display:grid;grid-template-columns:72px 1fr 1fr 30px;gap:5px 6px;align-items:stretch;margin-top:4px}
  .slg .sh{font-size:10.5px;letter-spacing:.8px;text-transform:uppercase;color:#6f7a8c;text-align:center;padding-bottom:2px}
  .slg .sd{font-size:12px;color:#8a94a6;display:flex;align-items:center}.slg .sd b{color:#e7e9ee;font-weight:600;margin-right:4px}
  .slg .c{font:12px Inter,"Segoe UI",system-ui,sans-serif;border-radius:8px;height:34px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:0;padding:0 6px;border:1px solid transparent}
  .slg .c.free{background:rgba(47,191,113,.09);border-color:#24432f;color:#7fe0aa;cursor:pointer}.slg .c.free:hover{border-color:#2fbf71}
  .slg .c.sel{background:#7c4ddb;border-color:#7c4ddb;color:#fff}
  .slg .c.busy{background:#151a22;border-color:#232a35;color:#9aa4b5;cursor:pointer;line-height:1.15}
  .slg .c.busy small{font-size:10px;color:#6f7a8c;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.slg .c.busy span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .slg .c.busy.fin{background:rgba(47,191,113,.07);border-color:#24432f;color:#8fd9b0;cursor:default}.slg .c.busy.fin small{color:#2fbf71;font-weight:600}.slg .c.busy.fin span{text-decoration:line-through;text-decoration-color:rgba(143,217,176,.45)}
  .slg .c.busy.live{background:rgba(47,191,113,.12);border-color:#2fbf71;color:#e7e9ee}.slg .c.busy.live small{color:#6fd99f;font-weight:600}
  .slg .c.free.ofr{background:rgba(244,192,96,.08);border-color:#5a4520;color:#f4c060;line-height:1.15}.slg .c.free.ofr small{font-size:10px;color:#c9a35a}.slg .c.free.ofr.sel{background:#7c4ddb;border-color:#7c4ddb;color:#fff}
  .ofw{margin-top:10px;background:rgba(244,192,96,.07);border:1px solid rgba(244,192,96,.35);border-radius:10px;padding:10px 12px}.ofw .wt{font-size:12.5px;color:#f4d58f;line-height:1.45}.ofw .wt b{color:#ffe2a3}.ofw textarea{width:100%;box-sizing:border-box;margin-top:8px;min-height:120px;background:#0f1520;border:1px solid #2a3442;border-radius:8px;color:#e7e9ee;padding:8px;font:12.5px/1.45 Inter,'Segoe UI',sans-serif}
  .ofmine{font-size:12px;color:#8a94a6;margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
  .slg .c.past{color:#3d4654;background:transparent;border-color:#1a212c}
  .slg .add{height:34px;border-radius:8px;border:1px dashed #2a3442;background:transparent;color:#6f7a8c;cursor:pointer;font-size:15px}.slg .add:hover{color:#c4b0ff;border-color:#5b3aa3}
  .slg .ex{grid-column:2 / 4;display:flex;flex-wrap:wrap;gap:5px}
  .slg .ex .c.busy{flex:1 1 100%;flex-direction:row;justify-content:flex-start;gap:8px;height:26px;padding:0 10px}
  .slg .ex .c.busy small{font-size:11px;color:#9aa4b5;font-weight:600}
  .slg .dv{grid-column:1 / 5;height:1px;background:#1a212c}
  .slday{display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid #1a212c}.slday:last-child{border-bottom:0}
  .slday .sd{width:86px;flex:none;font-size:12px;color:#aab3c2}.slday .sd b{color:#e7e9ee;font-weight:600}
  .slot{font:12px Inter,"Segoe UI",system-ui,sans-serif;border-radius:8px;padding:5px 9px;border:1px solid #2a3a30;background:rgba(47,191,113,.08);color:#7fe0aa;cursor:pointer;white-space:nowrap}
  .slot:hover{border-color:#2fbf71}.slot.sel{background:#7c4ddb;border-color:#7c4ddb;color:#fff}
  .slot.busy{border-color:#2a2f3a;background:#151a22;color:#6f7a8c;cursor:default;max-width:150px;overflow:hidden;text-overflow:ellipsis}
  .slot.past{opacity:.35;cursor:default}
  /* ===== Tarefas ===== */
  .tk{background:#0f1722;border:1px solid #1d2a3a;border-radius:12px;padding:11px 12px 10px;margin:0 0 9px;position:relative;overflow:hidden;--c:#38bdf8}
  .tk::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--c)}
  .tk .t{font-weight:600;font-size:13.5px;padding-right:100px}.tk .m{font-size:11.8px;color:#8a94a6;margin-top:3px;line-height:1.45}.tk .m b{color:#c9d0dc;font-weight:600}
  .tk .det{font-size:12px;color:#aab3c2;margin-top:4px;white-space:pre-wrap}
  .tk .cd2{position:absolute;right:10px;top:9px;text-align:right}.tk .cd2 .v{font-size:15px;font-weight:700;color:var(--c);font-variant-numeric:tabular-nums;white-space:nowrap}.tk .cd2 .l{font-size:10px;color:#6f7a8c}
  .tk .pb{height:5px;border-radius:9px;background:#1b2533;margin:9px 0 7px;overflow:hidden}.tk .pb i{display:block;height:100%;border-radius:9px;background:var(--c)}
  .tk .due{font-size:11px;color:#8a94a6;display:flex;justify-content:space-between;gap:8px;margin-bottom:6px}
  .tk.tw{--c:#f4c060}.tk.tl8{--c:#ef5b6b;background:#1a1218;border-color:#3a1f27}.tk.tq{--c:#a78bfa}.tk.tdone{--c:#2fbf71;opacity:.85}
  .tk .t{color:#e7e9ee;min-height:36px}.tk .m{font-weight:400}
  .tk .exe{display:inline-block;font-size:11px;border-radius:999px;padding:3px 9px;background:rgba(56,189,248,.12);color:#7dd3fc;border:1px solid rgba(56,189,248,.3);margin-top:6px}
  .tk .chs{display:inline-block;font-size:10.5px;border-radius:999px;padding:2px 8px;margin:6px 4px 0 0;background:rgba(47,191,113,.12);color:#6fd99f}.tk .chs.n{background:rgba(244,192,96,.12);color:#f4c060}.tk .chs.r{background:rgba(239,91,107,.12);color:#ff8a96}
  button.btn.tpri,:host(.corp) button.btn.tpri{background:#0ea5e9;border-color:#0ea5e9;color:#fff;font-weight:600}button.btn.tok,:host(.corp) button.btn.tok{background:#16a34a;border-color:#16a34a;color:#fff;font-weight:600}button.btn.texe,:host(.corp) button.btn.texe{border-color:#0ea5e9;color:#7dd3fc;background:transparent}
  .tkform label{display:block;margin-top:8px}
  .tstp{display:flex;align-items:center;gap:10px;margin-top:4px}.tstp .g{display:flex}.tstp button{width:34px;height:34px;background:#1a2230;border:1px solid #273244;color:#e7e9ee;font-size:16px;cursor:pointer}.tstp .g button:first-child{border-radius:8px 0 0 8px}.tstp .n{width:56px;height:34px;display:flex;align-items:center;justify-content:center;background:#1a2230;border-top:1px solid #273244;border-bottom:1px solid #273244;font-weight:600;font-size:14px}.tstp .g button:last-child{border-radius:0 8px 8px 0}
  .tarq{margin-top:8px;font-size:12px;background:rgba(239,91,107,.08);border:1px solid rgba(239,91,107,.35);color:#ffb4bd;border-radius:8px;padding:8px 10px}.tarq b{color:#ff8a96}
  button.btn.tpri:disabled{opacity:.45;cursor:not-allowed}
  .tcalc{margin-top:8px;font-size:12px;background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.25);color:#bae6fd;border-radius:8px;padding:8px 10px}
  .tfin .q{margin-top:12px;font-size:13px;font-weight:600}.tfin .ops{display:flex;gap:6px;margin-top:6px}.tfin .op{flex:1;font:12.5px Inter,"Segoe UI",sans-serif;padding:9px 6px;border-radius:9px;border:1px solid #2a3442;background:transparent;color:#c9d0dc;cursor:pointer}.tfin .op.sel{background:rgba(47,191,113,.14);border-color:#2fbf71;color:#8ee6b4;font-weight:600}.tfin .op.selw{background:rgba(244,192,96,.12);border-color:#f4c060;color:#f4c060;font-weight:600}.tfin .op.selr{background:rgba(239,91,107,.12);border-color:#ef5b6b;color:#ff8a96;font-weight:600}
  .ttoast{position:fixed;z-index:2147483646;width:400px;max-width:calc(100vw - 24px);border-radius:14px;padding:2px;background:linear-gradient(135deg,#38bdf8,#8b5cf6,#38bdf8);background-size:200% 200%;box-shadow:0 0 0 1px rgba(56,189,248,.3),0 0 28px rgba(56,189,248,.35),0 18px 40px rgba(0,0,0,.55);font:13px/1.4 Inter,"Segoe UI",system-ui,sans-serif;color:#e7e9ee;display:none;animation:ttIn .7s cubic-bezier(.2,1.4,.4,1),ttBg 4s linear infinite}
  .ttoast.show{display:block}.ttoast.late{background:linear-gradient(135deg,#ef5b6b,#8b5cf6,#ef5b6b);background-size:200% 200%;box-shadow:0 0 0 1px rgba(239,91,107,.35),0 0 30px rgba(239,91,107,.45),0 18px 40px rgba(0,0,0,.55);animation:ttIn .7s cubic-bezier(.2,1.4,.4,1),ttBg 4s linear infinite,ttLate 1.2s ease-in-out infinite}
  .ttoast .in2{background:#0c1622;border-radius:12px;padding:12px 14px;position:relative}
  .ttoast .ttop{display:flex;align-items:center;gap:8px;justify-content:flex-start;text-align:left}.ttoast .ico{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;background:rgba(56,189,248,.15);color:#7dd3fc;border:1px solid rgba(56,189,248,.35)}
  .ttoast.late .ico{background:rgba(239,91,107,.15);color:#ff8a96;border-color:rgba(239,91,107,.4)}
  .ttoast .k{font-size:10.5px;letter-spacing:1.3px;text-transform:uppercase;color:#7dd3fc;font-weight:700}.ttoast.late .k{color:#ff8a96}.ttoast .who{font-size:11px;color:#6f7a8c}
  .ttoast .tl{font-size:15px;font-weight:700;margin-top:9px}.ttoast .mm{font-size:12px;color:#9aa4b5;margin-top:3px}
  .ttoast .big{display:flex;align-items:flex-end;gap:10px;margin-top:10px}.ttoast .big .v{font-size:28px;font-weight:800;color:#7dd3fc;font-variant-numeric:tabular-nums;line-height:1}.ttoast.late .big .v{color:#ff8a96}.ttoast .big .l{font-size:12px;color:#8a94a6;padding-bottom:3px}
  .ttoast .seg{display:flex;gap:4px;margin-top:9px}.ttoast .seg i{flex:1;height:7px;border-radius:3px;background:#1b2533}.ttoast .seg i.f{background:#38bdf8;box-shadow:0 0 8px rgba(56,189,248,.6)}.ttoast.late .seg i{background:#ef5b6b}
  .ttoast .bb{margin-top:11px;display:flex;flex-wrap:wrap;gap:6px}.ttoast .cb{font:12px Inter,"Segoe UI",sans-serif;border-radius:8px;border:1px solid #2a3442;background:transparent;color:#d6dbe4;padding:6px 10px;cursor:pointer}.ttoast .cb.ok{background:#16a34a;border-color:#16a34a;color:#fff;font-weight:600}.ttoast .cb.ex{border-color:#0ea5e9;color:#7dd3fc}
  .ttoast .cx{position:absolute;right:10px;top:8px;background:none;border:0;color:#6f7a8c;cursor:pointer;font-size:14px}
  @keyframes ttIn{0%{opacity:0;transform:translateX(60px)}60%{opacity:1;transform:translateX(-8px) rotate(-1deg)}80%{transform:translateX(3px) rotate(.6deg)}100%{transform:none}}
  @keyframes ttBg{0%{background-position:0% 50%}100%{background-position:200% 50%}}
  @keyframes ttLate{50%{box-shadow:0 0 0 1px rgba(239,91,107,.6),0 0 44px rgba(239,91,107,.7),0 18px 40px rgba(0,0,0,.55)}}
  .fab .tc{display:inline-flex;align-items:center;gap:4px;color:#7dd3fc;font-size:12.5px;cursor:pointer;padding:2px 8px;border-radius:999px;background:rgba(56,189,248,.1);border:1px solid rgba(56,189,248,.25);white-space:nowrap}.fab .tc b{font-weight:700;font-variant-numeric:tabular-nums}
  .fab .tc.hot{color:#f4c060;background:rgba(244,192,96,.1);border-color:rgba(244,192,96,.3)}.fab .tc.r{color:#ff8a96;background:rgba(239,91,107,.12);border-color:rgba(239,91,107,.4);animation:tcBlink 1.2s ease-in-out infinite}
  @keyframes tcBlink{50%{background:rgba(239,91,107,.3)}}
  .pq{position:fixed;z-index:2147483645;width:310px;max-width:calc(100vw - 24px);display:none;background:#111720;border:1px solid #273244;border-radius:12px;box-shadow:0 14px 34px rgba(0,0,0,.5);color:#e7e9ee;font:12.5px/1.35 Inter,"Segoe UI",system-ui,sans-serif;overflow:hidden;cursor:default}
  .pq.show{display:block;animation:ctIn .35s cubic-bezier(.2,1.2,.4,1)}
  .pq .ph{display:flex;align-items:center;gap:8px;padding:9px 12px 7px;border-bottom:1px solid #1d2532}
  .pq .ph .pd{width:8px;height:8px;border-radius:50%;background:#f4c060;flex:none}
  .pq.r .ph .pd{background:#ef5b6b;animation:pqDot 1s ease-in-out infinite}
  .pq .ph b{font-weight:600;font-size:12.5px;flex:1;min-width:0}
  .pq .ph small{color:#8a94a6;font-size:11px;white-space:nowrap}
  .pq .pr{display:flex;align-items:center;gap:9px;padding:7px 12px;border-left:3px solid transparent;cursor:pointer}
  .pq .pr:hover{background:#18202c}
  .pq .pr.red{border-left-color:#ef5b6b;background:rgba(239,91,107,.07);animation:pqRow 1.6s ease-in-out infinite}
  .pq .pr.yellow{border-left-color:#f4c060}.pq .pr.green{border-left-color:#2fbf71}
  .pq .pr .pn{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .pq .pr .pn em{display:block;font-style:normal;font-size:11px;color:#8a94a6;overflow:hidden;text-overflow:ellipsis}
  .pq .pr .pt{font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap}
  .pq .pr.red .pt{color:#ff8a96}.pq .pr.yellow .pt{color:#f4c060}.pq .pr.green .pt{color:#6fd99f}
  .pq .pm{padding:6px 12px 8px;color:#8a94a6;font-size:11.5px;cursor:pointer}
  @keyframes pqDot{50%{opacity:.25}}
  @keyframes pqRow{50%{background:rgba(239,91,107,.16)}}
  .m-alarm .sirenH,.m-meetNow .sirenH,.m-late .sirenH{display:block}
  .m-late .armL{display:none}
  .lunch{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 40%,rgba(43,22,78,.94),rgba(6,8,14,.97));backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);font-family:inherit;color:#fff;animation:luIn .5s ease-out}
  .lunch.out{animation:luOut .45s ease-in forwards}
  @keyframes luIn{from{opacity:0}to{opacity:1}} @keyframes luOut{to{opacity:0}}
  .lunch .lbox{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;max-width:560px;padding:0 16px}
  .lunch .lstage{position:relative;width:340px;height:340px}
  .lunch .lstage .masc{position:absolute!important;z-index:1!important;left:40px;top:44px;width:260px;height:260px;filter:drop-shadow(0 10px 18px rgba(0,0,0,.55))}
  .lunch .lstage .masc .m3d,.lunch .lstage .masc>svg{width:260px!important;height:260px!important}
  .lunch .ltable{position:absolute;z-index:2;left:0;top:200px;width:340px;height:140px}
  .lunch .larm{position:absolute;left:0;top:0;width:340px;height:340px;z-index:3;pointer-events:none;overflow:visible}
  .lunch .larm .la{transform-box:view-box;transform-origin:99px 167px;animation:luArm 3.2s ease-in-out infinite}
  @keyframes luArm{0%,18%,100%{transform:rotate(52deg)}38%,52%{transform:rotate(-11deg)}70%{transform:rotate(52deg)}}
  .lunch .lsteam path{animation:luSteam 2.4s ease-in-out infinite;opacity:0}
  .lunch .lsteam path:nth-child(2){animation-delay:.8s} .lunch .lsteam path:nth-child(3){animation-delay:1.6s}
  @keyframes luSteam{0%{opacity:0;transform:translateY(8px)}40%{opacity:.7}100%{opacity:0;transform:translateY(-22px)}}
  .lunch .lbub{position:absolute;z-index:4;right:-150px;top:24px;background:#fff;color:#2a1f3d;font-weight:800;font-size:15px;line-height:1.3;border-radius:16px;padding:10px 14px;max-width:190px;box-shadow:0 0 0 3px #00a884,0 10px 24px rgba(0,0,0,.4);animation:luBub 2.6s ease-in-out infinite}
  .lunch .lbub:after{content:'';position:absolute;left:-10px;top:26px;border:8px solid transparent;border-right-color:#fff;border-left:0}
  @keyframes luBub{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
  .lunch h2{margin:0;font-size:28px;letter-spacing:.3px}
  .lunch .lsub{font-size:16px;color:#d9ccf5}
  .lunch .ltime{font-size:46px;font-weight:900;font-variant-numeric:tabular-nums;letter-spacing:1px;color:#5fe0bd;text-shadow:0 0 18px rgba(95,224,189,.45)}
  .lunch .lhold{position:relative;overflow:hidden;margin-top:6px;border:0;border-radius:999px;padding:14px 28px;font-size:17px;font-weight:800;color:#0b141a;background:#25d366;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:none;box-shadow:0 8px 22px rgba(0,0,0,.35)}
  .lunch .lhold i{position:absolute;left:0;top:0;bottom:0;width:0;background:rgba(255,255,255,.55);pointer-events:none}
  .lunch .lhold span{position:relative}
  .lunch .lhint{font-size:12.5px;color:#a99cc8}
  .lunch .lcancel{background:none;border:0;color:#a99cc8;text-decoration:underline;cursor:pointer;font-size:12.5px}
  .lunch.late{animation:luIn .5s ease-out,luLate 1s ease-in-out infinite}
  @keyframes luLate{0%,100%{background:radial-gradient(circle at 50% 40%,rgba(74,24,140,.95),rgba(8,6,16,.97))}50%{background:radial-gradient(circle at 50% 40%,rgba(150,80,235,.96),rgba(30,10,60,.97))}}
  .lunch.late .ltime{color:#ffd279;text-shadow:0 0 22px rgba(255,210,121,.7);animation:luPulse .8s ease-in-out infinite}
  .lunch.late h2{color:#ffd279;animation:luShake .5s ease-in-out infinite}
  .lunch.late .lbub{box-shadow:0 0 0 3px #9b5cf0,0 0 26px rgba(170,110,255,.85);color:#5a1fa8}
  .lunch.late .ltable,.lunch.late .larm{display:none}
  .lunch.late .lstage .masc{top:10px}
  @keyframes luPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
  @keyframes luShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
  .lunch.cl{background:rgba(8,11,16,.86);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);font-family:Inter,"Segoe UI",system-ui,sans-serif}
  .lunch.cl .lcard{width:400px;max-width:calc(100vw - 32px);background:#111720;border:1px solid #273244;border-radius:16px;padding:22px 24px 20px;box-shadow:0 30px 80px rgba(0,0,0,.55);text-align:center;color:#e7e9ee}
  .lunch.cl .lhead{display:flex;align-items:center;gap:8px;font-size:12px;color:#8a94a6;margin-bottom:16px}
  .lunch.cl .lhead .lg{width:18px;height:18px;filter:brightness(1.9) saturate(1.2)}
  .lunch.cl .lhead .lst{margin-left:auto;font-size:11px;padding:3px 9px;border-radius:999px;background:rgba(139,92,246,.15);color:#c4b0ff;font-weight:600}
  .lunch.cl .lring{position:relative;width:190px;height:190px;margin:4px auto 14px}
  .lunch.cl .lring>svg{width:100%;height:100%;transform:rotate(-90deg)}
  .lunch.cl .lring .bg{stroke:#1f2733}.lunch.cl .lring .fg{stroke:#8b5cf6;stroke-linecap:round;transition:stroke-dashoffset .9s linear}
  .lunch.cl .lring .ctr{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
  .lunch.cl .lring .ico{color:#a77bf0}
  .lunch.cl .ltime{font-size:30px;font-weight:700;color:#e7e9ee;text-shadow:none;letter-spacing:0;font-variant-numeric:tabular-nums}
  .lunch.cl .lrl{font-size:11.5px;color:#8a94a6}
  .lunch.cl h2{font-size:18px;font-weight:650;margin:0}
  .lunch.cl .lsub{font-size:13px;color:#aab3c2;margin-top:4px}
  .lunch.cl .lhold{margin-top:16px;width:100%;border-radius:10px;background:#7c4ddb;color:#fff;font-size:14px;font-weight:600;padding:12px 18px;box-shadow:none}
  .lunch.cl .lhold i{background:rgba(255,255,255,.28)}
  .lunch.cl .lhint{margin-top:8px;font-size:11.5px;color:#6f7a8c}
  .lunch.cl .lcancel{margin-top:6px;color:#8a94a6;font-size:11.5px}
  .lunch.cl.late{animation:luIn .5s ease-out}
  /* tela cheia (monitor principal) */
  .lunch.cl.fs{background:linear-gradient(135deg,#07030f 0%,#110726 38%,#1f0b48 72%,#33136e 100%);backdrop-filter:none;-webkit-backdrop-filter:none}
  .lunch.cl.fs .ltop{position:absolute;left:48px;right:48px;top:4.5vh;display:flex;align-items:center;gap:12px;color:#8a94a6;font-size:14px}
  .lunch.cl.fs .ltop .lg{width:34px;height:34px;display:inline-grid;filter:drop-shadow(0 0 6px rgba(192,107,255,.45))}.lunch.cl.fs .ltop .lg svg{width:100%;height:100%}
  .lunch.cl.fs .ltop b{color:#e7e9ee;font-weight:600;font-size:15px}
  .lunch.cl.fs .ltop .lst{margin-left:14px;font-size:12px;padding:4px 11px;border-radius:999px;background:rgba(139,92,246,.18);color:#d9c9ff;font-weight:600}
  .lunch.cl.fs .ltop .lclk{margin-left:auto;font-variant-numeric:tabular-nums;font-size:15px;color:#aab3c2}
  .lunch.cl.fs .lcard{width:620px;background:transparent;border:0;box-shadow:none;padding:0}
  .lunch.cl.fs .lhead{display:none}
  .lunch.cl.fs .lring{width:min(44vh,360px);height:min(44vh,360px);margin:0 auto 4vh;filter:drop-shadow(0 0 30px rgba(124,77,219,.35))}
  .lunch.cl.fs .lring .bg{stroke:rgba(255,255,255,.07)}
  .lunch.cl.fs .lring .fg{stroke:url(#lgRing)}
  .lunch.cl.fs .lring .ico svg{width:30px;height:30px}
  .lunch.cl.fs .ltime{font-size:clamp(44px,7vh,68px);letter-spacing:-1px}
  .lunch.cl.fs .lrl{font-size:14px;letter-spacing:1.4px;text-transform:uppercase}
  .lunch.cl.fs h2{font-size:clamp(26px,3.6vh,38px);font-weight:700;letter-spacing:-.4px}
  .lunch.cl.fs .lsub{font-size:17px;margin-top:10px;color:#aab3c2}
  .lunch.cl.fs .lhold{width:420px;max-width:100%;margin:4.5vh auto 0;display:block;font-size:16px;padding:16px 22px;border-radius:12px;box-shadow:0 10px 30px rgba(124,77,219,.35)}
  .lunch.cl.fs .lhint{font-size:13px;margin-top:12px}.lunch.cl.fs .lcancel{font-size:13px}
  .lunch.cl.fs.late .lcard{animation:none}
  .lunch.cl.fs.late .lring{animation:clLate 1.4s ease-in-out infinite;border-radius:50%}
  .lunch.cl.fs.late .lring .fg{stroke:#c4b0ff}
  .lunch.cl.fs.late .ltop .lst{background:rgba(255,210,121,.14);color:#ffd279}
  /* espera (outros monitores) */
  .lunch.cl.sb{background:radial-gradient(700px 500px at 50% 45%,rgba(106,47,224,.16),transparent 70%),#030306;backdrop-filter:none;-webkit-backdrop-filter:none;cursor:default}
  .lunch.cl.sb .lsbx{width:420px;max-width:calc(100vw - 40px);text-align:center;padding:0}
  .lunch.cl.sb .sbtop{display:flex;align-items:center;justify-content:center;gap:10px}
  .lunch.cl.sb .lsbx .lg{width:30px;height:30px;display:inline-grid;filter:brightness(1.9) saturate(1.2) drop-shadow(0 0 8px rgba(192,107,255,.55))}.lunch.cl.sb .lsbx .lg svg{width:100%;height:100%}
  .lunch.cl.sb .sbpill{font-size:11.5px;font-weight:600;letter-spacing:.4px;padding:4px 11px;border-radius:999px;background:rgba(139,92,246,.16);color:#d9c9ff;border:1px solid rgba(139,92,246,.3)}
  .lunch.cl.sb.late .sbpill{background:rgba(255,210,121,.12);color:#ffd279;border-color:rgba(255,210,121,.3)}
  .lunch.cl.sb .sbclk{font-size:clamp(64px,12vh,104px);font-weight:200;color:#eef0f4;letter-spacing:-3px;font-variant-numeric:tabular-nums;margin-top:14px;line-height:1;text-shadow:0 0 40px rgba(124,77,219,.35)}
  .lunch.cl.sb .sbt{font-size:15px;color:#aab3c2;margin-top:12px}.lunch.cl.sb .sbt b{color:#fff;font-weight:600}
  .lunch.cl.sb .sbbar{height:6px;border-radius:9px;background:rgba(255,255,255,.07);margin:20px 0 8px;overflow:hidden}
  .lunch.cl.sb .sbbar i{display:block;height:100%;width:0;border-radius:9px;background:linear-gradient(90deg,#6a2fe0,#c06bff);box-shadow:0 0 12px rgba(192,107,255,.6);transition:width 1s linear}
  .lunch.cl.sb.late .sbbar i{background:linear-gradient(90deg,#c06bff,#ffd279);animation:sbPulse 1.4s ease-in-out infinite}
  .lunch.cl.sb .sbc{display:flex;justify-content:space-between;font-size:12.5px;color:#8a94a6;font-variant-numeric:tabular-nums}.lunch.cl.sb .sbc b{color:#c4b0ff;font-weight:600}
  .lunch.cl.sb.late .sbc b{color:#ffd279}
  .lunch.cl.sb .lhold{margin:22px auto 0;display:block;width:100%;font-size:13.5px;font-weight:600;padding:12px 16px;background:rgba(124,77,219,.22);border:1px solid rgba(139,92,246,.45);border-radius:12px;color:#ecdfff}
  .lunch.cl.sb .lhold:hover{background:rgba(124,77,219,.34)}
  .lunch.cl.sb .sbh{margin-top:12px;font-size:11.5px;color:#4f5868}
  @keyframes sbPulse{50%{opacity:.55}}
  /* Natal nas telas de almoço */
  .lsnow{position:absolute;inset:0;overflow:hidden;pointer-events:none}
  .lsnow i{position:absolute;top:-12px;width:var(--s,4px);height:var(--s,4px);border-radius:50%;background:#fff;opacity:var(--o,.35);filter:blur(.4px);animation:lsFall var(--d,14s) linear var(--w,0s) infinite}
  @keyframes lsFall{0%{transform:translate(0,-10px)}50%{transform:translate(var(--x,20px),50vh)}100%{transform:translate(0,105vh)}}
  .lxm{display:flex;align-items:center;gap:14px;text-align:left}
  .lunch.cl.fs .lxm{position:absolute;right:48px;bottom:4.5vh}
  .lunch.cl.sb .lxm{justify-content:center;margin-top:26px}
  .lxm svg{width:54px;height:62px;overflow:visible;flex:none}
  .lunch.cl.sb .lxm svg{width:40px;height:46px}
  .lxm .t{fill:none;stroke:#39ff88;stroke-width:4;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;filter:drop-shadow(0 0 2px #39ff88) drop-shadow(0 0 7px #19e070);animation:lxDraw 2.2s cubic-bezier(.6,.1,.3,1) .4s forwards}
  .lxm .g{stroke-width:3;opacity:.8;animation-delay:2s;animation-duration:1s}
  .lxm .o{opacity:0;filter:drop-shadow(0 0 3px currentColor);animation:lxPop .4s ease-out forwards,lxTw 1.8s ease-in-out infinite}
  .lxm .st{fill:#fff;opacity:0;transform-origin:75px 14px;filter:drop-shadow(0 0 4px #e2b8ff) drop-shadow(0 0 10px #8b5cf6);animation:lxStar .7s cubic-bezier(.2,1.6,.4,1) 2.8s forwards,lxTw 2.4s ease-in-out 3.5s infinite}
  .lxm .n{font-size:40px;font-weight:700;line-height:1;color:#e6fff0;font-variant-numeric:tabular-nums;text-shadow:0 0 6px #39ff88,0 0 18px rgba(25,224,112,.6)}
  .lunch.cl.sb .lxm .n{font-size:28px}
  .lxm .l1{font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:#9fe9bf;font-weight:600}
  .lxm .l2{font-size:13px;color:#8a94a6;margin-top:3px}
  .lunch.cl.sb .lxm .l2{font-size:12px}
  @keyframes lxDraw{to{stroke-dashoffset:0}}
  @keyframes lxPop{from{opacity:0;transform:scale(.2)}to{opacity:1;transform:none}}
  @keyframes lxTw{50%{opacity:.4}}
  @keyframes lxStar{from{opacity:0;transform:scale(.2) rotate(-90deg)}to{opacity:1;transform:none}}
  @keyframes sbDrift{0%{transform:translate(-6vw,-4vh)}50%{transform:translate(5vw,3vh)}100%{transform:translate(-3vw,5vh)}}
  .lunch.cl.late .lcard{border-color:#8b5cf6;animation:clLate 1.4s ease-in-out infinite}
  @keyframes clLate{0%,100%{box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 0 0 rgba(139,92,246,0)}50%{box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 0 8px rgba(139,92,246,.25)}}
  .lunch.cl.late .lring .fg{stroke:#c4b0ff}
  .lunch.cl.late .ltime{color:#ffd279;animation:none}
  .lunch.cl.late h2{color:#e7e9ee;animation:none}
  .lunch.cl.late .lhead .lst{background:rgba(255,210,121,.14);color:#ffd279}
  .m-lunch .m3d .pL{display:none}
  .m-lunch .m3db{animation:luChew .32s ease-in-out infinite alternate}
  @keyframes luChew{from{transform:translateY(0) scaleY(1)}to{transform:translateY(-1.2%) scaleY(.985)}}
  .m-lunch .m3d .pup3{animation:luLook 3.2s ease-in-out infinite}
  @keyframes luLook{0%,18%,70%,100%{transform:translate(-1px,4px)}38%,52%{transform:translate(1px,0)}}
  .m-lunch .m3d .pR{animation:pSway 2s ease-in-out infinite alternate}
  .m-late .m3db{animation:m3dShake .4s ease-in-out infinite}
  .m-late .m3d .pL{display:none}
  .m-late .m3d .gL{animation:pStepL .45s ease-in-out infinite} .m-late .m3d .gR{animation:pStepR .45s ease-in-out infinite}
  .m-late .m3d .pR{animation:pWave .3s ease-in-out infinite}
  .m-late .m3d .pup3{animation:pLookFast .5s ease-in-out infinite}
  .fab .lu{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,.28);font-size:11px;cursor:pointer;margin-right:-4px}
  .fab .lu:hover{background:rgba(0,0,0,.55)}
  .m-alarm .armL,.m-meetNow .armL{display:none}
  .masc .armL{transform-box:view-box;transform-origin:140px 262px;animation:mSway 3.4s ease-in-out infinite alternate-reverse}
  .masc .armR{transform-box:view-box;transform-origin:392px 258px;animation:mSway 3s ease-in-out infinite alternate}
  .masc .legL{transform-box:view-box;transform-origin:236px 340px}
  .masc .legR{transform-box:view-box;transform-origin:300px 318px}
  .masc .clock .hand{transform-box:view-box;transform-origin:446px 196px;animation:mTick 4s steps(8) infinite}
  .masc .dome{animation:mSiren .5s steps(1) infinite}
  .masc .ray{animation:mFlash .5s steps(1) infinite}
  /* tudo em dia: joinha balançando */
  .masc .thumb{display:none;transform-box:view-box;transform-origin:150px 226px}
  .m-happy .thumb{display:block;animation:mThumb .9s ease-out 1 both}
  .m-happy .armL{display:none}
  .masc .clap{display:none}
  .masc .shh,.masc .phones{display:none}
  /* reunião acontecendo: fone de ouvido, faz "shhh" e acena com a cabeça, ouvindo */
  .m-live .shh,.m-live .phones{display:block}
  .m-live .armL{display:none}
  .m-live .all{animation:mNod 2.4s ease-in-out infinite}
  .m-live .eyes{animation:mBlinkSlow 5s infinite}
  .masc .zz{animation:mFlash 1.6s ease-in-out infinite}
  .m-cheer .clap{display:block}
  .m-cheer .armL,.m-cheer .armR{display:none}
  .masc .cL{animation:mClapL .42s ease-in-out infinite}
  .masc .cR{animation:mClapR .42s ease-in-out infinite}
  .masc .burst{animation:mBurst .42s ease-in-out infinite}
  .m-cheer .grin,.m-cheer .spark{display:block}
  .m-cheer .all{animation:mJump 1.4s ease-in-out 2,mBob 2.8s ease-in-out 2.8s infinite}
  .m-cheer .spark{animation:mFlash 1s infinite}
  /* atendimentos em aberto: olha de um lado para o outro e bate o pé */
  .m-attentive .pup{animation:mLook 3s ease-in-out infinite alternate}
  .m-attentive .legR{animation:mTap 1.6s ease-in-out infinite}
  /* cliente esperando +15 min: sirene, sobrancelhas, boca de susto, tremendo */
  .m-alarm .brow,.m-alarm .oh{display:block}
  .m-alarm .all{animation:mShake 1.4s ease-in-out infinite}
  /* reunião: segura o relógio e olha para ele */
  .m-meetSoon .clock,.m-meetNow .clock,.m-run .clock{display:block}
  .m-meetSoon .armR,.m-meetNow .armR,.m-run .armR{display:none}
  .m-meetSoon .pup,.m-meetNow .pup,.m-run .pup{transform:translate(9px,5px)}
  .m-meetSoon .legL{animation:mTap 1s ease-in-out infinite}
  .m-meetSoon .oh{display:block}
  /* barra vermelha: sirene na cabeça e pulando */

  .m-meetNow .all{animation:mJump 1.3s ease-in-out infinite}
  /* finalizada: comemora */
  .m-happy .spark,.m-happy .grin{display:block}
  .m-happy .all{animation:mJump 1.4s ease-in-out 2,mBob 2.8s ease-in-out 2.8s infinite}
  .m-happy .spark{animation:mFlash 1s infinite}
  .mbub{position:absolute;bottom:calc(100% + 6px);right:-4px;background:#fff;color:#1b1f24;font-size:12.5px;font-weight:500;line-height:1.35;border-radius:14px;padding:8px 11px;white-space:normal;width:max-content;max-width:230px;box-shadow:0 6px 18px rgba(0,0,0,.4);display:none;animation:mPop .35s cubic-bezier(.3,1.4,.5,1);transform-origin:85% 100%;cursor:pointer}
  .mbub .att{color:#d93a4c;font-weight:800}
  .mbub.meet .att{color:#6c31b4}
  .ahtag{font-size:11.5px;color:#c9a4ff;margin-top:3px}
  .mbub.night{box-shadow:0 0 0 2px #6c31b4,0 0 14px rgba(108,49,180,.5),0 6px 18px rgba(0,0,0,.4)}
  .mbub.night .att{color:#5a24a0}
  .mbub.cob{box-shadow:0 0 0 2px #00a884,0 0 14px rgba(0,168,132,.5),0 6px 18px rgba(0,0,0,.4)}
  .mbub.cob .att{color:#00805f}
  .cobtx{font-size:12px;color:#c7d0d6;line-height:1.45;margin-top:6px}
  .cobok{color:#25d366;font-weight:700}
  .mbub.rxr{box-shadow:0 0 0 2px #ffb020,0 0 14px rgba(255,176,32,.5),0 6px 18px rgba(0,0,0,.4)}
  .mbub.rxr .att{color:#b26a00}
  .mbub.xmas{box-shadow:0 0 0 2px #00a884,0 0 18px rgba(255,210,121,.55),0 6px 18px rgba(0,0,0,.4);background:linear-gradient(180deg,#ffffff,#f3fff9)}
  .mbub.xmas .att{color:#00896c}
  .mbub.xmas .xd{color:#6c31b4;font-size:14px;display:inline-block;margin:0 3px;animation:xPulse 1s ease-in-out infinite}
  .masc.festa .all{animation:mJump 1.2s ease-in-out 3,mBob 3.2s ease-in-out 3.6s infinite}
  .masc.festa .armR{animation:mWaveR .45s ease-in-out infinite alternate}
  .xfx{position:absolute;left:50%;top:45%;width:0;height:0;pointer-events:none}
  .xfx.end{opacity:0;transition:opacity .8s}
  .xi{position:absolute;left:0;top:0;width:var(--sz);height:var(--sz);margin:calc(var(--sz) / -2);opacity:0;animation:xFly 3.2s cubic-bezier(.2,.8,.3,1) infinite;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))}
  .xi svg{width:100%;height:100%;display:block}
  @keyframes xFly{0%{transform:translate(0,0) scale(.2) rotate(0);opacity:0}15%{opacity:1}70%{opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(1) rotate(var(--rot));opacity:0}}
  .sleigh{position:fixed;left:0;top:16vh;width:470px;height:150px;z-index:2147483646;pointer-events:none;animation:slFly 11s linear forwards;will-change:transform}
  .sleigh .slb{position:absolute;inset:0;animation:slBob 1.3s ease-in-out infinite}
  .sleigh svg.sls{position:absolute;left:0;top:0;width:470px;height:150px;overflow:visible}
  .sleigh .slm{position:absolute;left:112px;top:10px;width:86px;height:86px}
  .sleigh .slm svg{width:100%;height:100%}
  .sleigh .slm .clock,.sleigh .slm .sirenH,.sleigh .slm .clap,.sleigh .slm .shh,.sleigh .slm .phones,.sleigh .slm .armR{display:none}
  .sleigh .slban{position:absolute;right:calc(100% - 18px);top:58px;white-space:nowrap;background:#fff;color:#4b1b8a;font:800 15px/1.2 system-ui,Segoe UI,sans-serif;padding:8px 14px;border-radius:14px;box-shadow:0 0 0 2px #00a884,0 6px 18px rgba(0,0,0,.35)}
  .sleigh .slban b{color:#00896c;font-size:17px}
  .sleigh .slban:after{content:'';position:absolute;right:-26px;top:50%;width:26px;border-top:2px dashed #ffd279}
  .sleigh .slst{position:absolute;font-size:14px;opacity:0;animation:slStar 1.6s ease-out infinite}
  .sleigh .slleg{animation:slRun .45s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:50% 0}
  .sleigh .slleg.b{animation-delay:-.22s}
  @keyframes slFly{0%{transform:translateX(-520px) translateY(30px) rotate(-3deg)}50%{transform:translateX(calc(50vw - 160px)) translateY(-10px) rotate(0)}100%{transform:translateX(calc(100vw + 40px)) translateY(20px) rotate(3deg)}}
  @keyframes slBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
  @keyframes slRun{from{transform:rotate(-22deg)}to{transform:rotate(22deg)}}
  @keyframes slStar{0%{opacity:0;transform:translate(0,0) scale(.6)}20%{opacity:1}100%{opacity:0;transform:translate(-60px,26px) scale(1.1)}}
  @keyframes xPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
  @keyframes mWaveR{0%{transform:rotate(0)}100%{transform:rotate(-40deg)}}
  .mbub.meet{box-shadow:0 0 0 2px #7d42c8,0 6px 18px rgba(0,0,0,.4)}
  .m-alarm .mbub{box-shadow:0 0 0 2px #f15c6d,0 6px 18px rgba(0,0,0,.4)}
  .mbub.out{animation:mOut .3s ease-in forwards}
  @keyframes mOut{to{transform:scale(.6);opacity:0}}
  .mbub::after{content:'';position:absolute;bottom:-6px;right:24px;border:6px solid transparent;border-top-color:#fff;border-bottom:0}
  .mbub.below{bottom:auto;top:calc(100% + 6px);transform-origin:85% 0}
  .mbub.lft{right:auto;left:-6px}
  .mbub.lft::after{right:auto;left:24px}
  .mbub.below::after{bottom:auto;top:-6px;border-top-color:transparent;border-bottom:6px solid #fff;border-top:0}
  @keyframes mBob{0%,100%{transform:translateY(0) scale(1,1)}50%{transform:translateY(-9px) scale(1.008,.994)}}
  @keyframes mJump{0%,100%{transform:translateY(0) scale(1,1)}15%{transform:translateY(0) scale(1.03,.97)}45%{transform:translateY(-28px) scale(.985,1.02)}75%{transform:translateY(0) scale(1.02,.98)}}
  @keyframes mShake{0%,100%{transform:rotate(0)}20%{transform:rotate(-3deg)}40%{transform:rotate(2.5deg)}60%{transform:rotate(-1.5deg)}80%{transform:rotate(1deg)}}
  @keyframes mBlink{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.12)}}
  @keyframes mLook{0%,35%{transform:translateX(-7px)}65%,100%{transform:translateX(7px)}}
  @keyframes mWave{0%{transform:rotate(0)}100%{transform:rotate(-55deg)}}
  @keyframes mFlash{0%,100%{opacity:1}50%{opacity:.25}}
  @keyframes mSiren{0%{fill:#ffb020}50%{fill:#53bdeb}}
  @keyframes mTick{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
  @keyframes mThumb{0%{transform:rotate(14deg) scale(.9)}18%{transform:rotate(-6deg) scale(1.04)}30%,100%{transform:rotate(0) scale(1)}}
  @keyframes mSway{0%{transform:rotate(-2deg)}100%{transform:rotate(2.5deg)}}
  @keyframes mTap{0%,60%,100%{transform:rotate(0)}30%{transform:rotate(-5deg)}}
  @keyframes mRaise{0%,100%{transform:rotate(0)}50%{transform:rotate(-7deg)}}
  @keyframes mClapL{0%,100%{transform:translateX(-12px)}50%{transform:translateX(17px)}}
  @keyframes mClapR{0%,100%{transform:translateX(12px)}50%{transform:translateX(-17px)}}
  @keyframes mBurst{0%,40%{opacity:0}50%,70%{opacity:1}100%{opacity:0}}
  @keyframes mHat{0%,100%{transform:rotate(0)}50%{transform:rotate(-3deg)}}
  @keyframes mNod{0%,100%{transform:rotate(0) translateY(0)}25%{transform:rotate(-2.5deg) translateY(4px)}50%{transform:rotate(0) translateY(0)}75%{transform:rotate(-1.5deg) translateY(3px)}}
  @keyframes mBlinkSlow{0%,88%,100%{transform:scaleY(1)}92%,96%{transform:scaleY(.15)}}
  @keyframes mPop{0%{transform:scale(.6);opacity:0}100%{transform:scale(1);opacity:1}}
  :host(.pip) .fab{right:12px !important;bottom:12px !important}
  :host(.pip) .meetbar{left:8px !important;top:8px !important;transform:none !important;width:calc(100vw - 16px) !important}
  :host(.pip:not(.pipopen)) .panel{display:none !important}
  :host(.pip.pipopen) .panel{width:100vw !important;border-left:0 !important}
  :host(.pip.pipopen) .fab,:host(.pip.pipopen) .pq{display:none !important}
  :host(.pip.pnf) .pq,:host(.pip.pnr) .meetbar,:host(.pip.pnt) .ttoast,:host(.pip.pnl) .lbtoast{display:none !important}
  :host(.pip) .mt{padding:8px 10px;gap:6px 10px}
  :host(.pip) .mt:not(.mini){flex-wrap:wrap}
  :host(.pip) .mt:not(.mini) .mi{flex:1 1 60%}
  :host(.pip) .mt:not(.mini) .mb{flex-direction:row;flex-wrap:wrap;width:100%;gap:5px}
  :host(.pip) .mt .mb .btn{padding:4px 8px;font-size:11.5px}
  :host(.pip) .mc{white-space:normal}
  :host(.pip) .mcd{font-size:18px}
  :host(.pip) .mbub{max-width:min(230px,calc(100vw - 40px))}
  .wel{position:fixed;inset:0;z-index:2147483647;background:rgba(6,10,14,.62);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;animation:wIn .35s ease-out;font-family:"Segoe UI",Helvetica,Arial,sans-serif}
  .wel.out{animation:wOut .35s ease-in forwards}
  .wel.saver.silent,.wel.saver.silent *{animation:none !important}
  .wel.wfull{background:linear-gradient(135deg,#07030f 0%,#110726 38%,#1f0b48 72%,#33136e 100%);backdrop-filter:none;align-items:stretch;justify-content:stretch;font-family:Inter,"Segoe UI",system-ui,sans-serif;color:#e7e9ee}
  .wf{position:relative;z-index:1;width:100%;max-width:1180px;margin:0 auto;padding:6vh 48px 4vh;display:flex;flex-direction:column;min-height:100%;box-sizing:border-box}
  .wf .top{display:flex;align-items:center;gap:12px;color:#8a94a6;font-size:14px}
  .wf .top .lg{width:36px;height:36px;display:inline-grid;filter:drop-shadow(0 0 6px rgba(192,107,255,.45))}
  .wf .top .lg svg{width:100%;height:100%}
  .wf .top .clk{margin-left:auto;font-variant-numeric:tabular-nums;font-size:15px;color:#aab3c2}
  .wf .hi{margin-top:5vh;font-size:clamp(34px,4.6vw,58px);font-weight:700;letter-spacing:-.8px;line-height:1.05;animation:wfUp .7s cubic-bezier(.2,1,.3,1) both}
  .wf .hi em{font-style:normal;background:linear-gradient(90deg,#c06bff,#7c4ddb);-webkit-background-clip:text;background-clip:text;color:transparent}
  .wf .dt{margin-top:12px;font-size:17px;color:#8a94a6;animation:wfUp .7s .08s cubic-bezier(.2,1,.3,1) both}
  .wf .qt{position:relative;margin-top:4.5vh;padding:30px 40px 30px 92px;border-radius:20px;background:linear-gradient(135deg,rgba(124,77,219,.22),rgba(124,77,219,.06) 55%,rgba(47,191,113,.06));border:1px solid rgba(192,107,255,.35);box-shadow:0 0 0 1px rgba(124,77,219,.08),0 20px 60px rgba(124,77,219,.18);animation:wfUp .7s .16s cubic-bezier(.2,1,.3,1) both}
  .wf .qt::before{content:"“";position:absolute;left:26px;top:4px;font:700 110px/1 Georgia,serif;background:linear-gradient(180deg,#c06bff,#7c4ddb);-webkit-background-clip:text;background-clip:text;color:transparent}
  .wf .qt .ql{font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:#c4b0ff;font-weight:600}
  .wf .qt .qx{margin-top:10px;font-size:clamp(22px,2.5vw,32px);line-height:1.35;font-weight:600;color:#fff;letter-spacing:-.2px;text-wrap:balance}
  .wf .kp{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-top:6vh;animation:wfUp .7s .24s cubic-bezier(.2,1,.3,1) both}
  .wf .k{background:rgba(10,8,22,.62);border:1px solid rgba(192,107,255,.16);backdrop-filter:blur(6px);border-radius:14px;padding:18px 18px 16px;position:relative;overflow:hidden}
  .wf .k::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--kc,#8b5cf6)}
  .wf .k .kl{font-size:12px;letter-spacing:.9px;text-transform:uppercase;color:#6f7a8c}
  .wf .k .kv{font-size:34px;font-weight:700;margin-top:8px;font-variant-numeric:tabular-nums;line-height:1}
  .wf .k .ks{font-size:13px;color:#8a94a6;margin-top:8px;line-height:1.4}.wf .k .ks b{color:#d6dbe4;font-weight:600}
  .wf .k.r{--kc:#ef5b6b}.wf .k.r .kv{color:#ff8a96}.wf .k.g{--kc:#2fbf71}.wf .k.g .kv{color:#6fd99f}.wf .k.a{--kc:#f4c060}.wf .k.b{--kc:#4aa3ff}
  .wf .ft{margin-top:auto;padding-top:5vh;display:flex;align-items:center;gap:18px;flex-wrap:wrap;animation:wfUp .7s .32s cubic-bezier(.2,1,.3,1) both}
  .wf .go{font:600 16px Inter,"Segoe UI",system-ui,sans-serif;background:#7c4ddb;color:#fff;border:0;border-radius:12px;padding:14px 28px;cursor:pointer;box-shadow:0 10px 30px rgba(124,77,219,.35)}.wf .go:hover{background:#8b5cf6}
  .wf .hint{font-size:13px;color:#6f7a8c}
  .wf .xm{margin-left:auto;font-size:14px;color:#9fe9bf;text-shadow:0 0 8px rgba(57,255,136,.5);display:flex;align-items:center;gap:8px}
  .wf .wname{margin-top:0}.wf .wch{color:#8a94a6;font-size:13px;cursor:pointer;text-decoration:underline}
  .wf .wnq{font-size:14px;color:#c9d0dc;margin-bottom:6px}.wf .wnr{display:flex;gap:8px}.wf .wnr input{background:#151c27;border:1px solid #273244;border-radius:10px;color:#e7e9ee;padding:10px 12px;font:14px Inter,sans-serif;width:220px}.wf .wns{background:#1d1530;border:1px solid #5b3aa3;color:#d9c9ff;border-radius:10px;padding:0 16px;cursor:pointer;font:600 13px Inter,sans-serif}
  @keyframes wfUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
  .wbox{position:relative;display:flex;align-items:center;gap:6px;max-width:min(860px,calc(100vw - 32px));padding:10px}
  .wel .masc.wbig{position:relative;left:auto;top:auto;width:250px;height:250px;flex:none;opacity:1;filter:drop-shadow(0 10px 18px rgba(0,0,0,.55));cursor:default;animation:wMascIn .8s cubic-bezier(.3,1.5,.5,1)}
  .wel .masc.wbig svg{width:250px;height:250px}
  .m3d{position:relative;width:90px;height:90px}
  .m3db{position:absolute;inset:0;transform-origin:50% 96%;animation:m3dBob 3.2s ease-in-out infinite}
  .m3db>img,.m3db>.e3d{position:absolute;left:3.2%;top:3.3%;width:93.6%;height:auto;pointer-events:none;user-select:none}
  .m3db>.e3d{aspect-ratio:1/1}
  .m3db>svg:not(.e3d){position:absolute;left:0;top:0;width:100%!important;height:100%!important}
  .m3d .all{animation:none!important}
  .m3d .bodyg,.m3d .eyes,.m3d .legL,.m3d .legR,.m3d .armL,.m3d .armR,.m3d .thumb,.m3d .clap,.m3d .shh,.m3d .brow,.m3d .mo,.m3d .smile,.m3d .all>ellipse{display:none!important}
  .m3d .hat{translate:22px -6px}
  .m3d .sirenH{translate:-6px 10px}
  .m3d .phones{translate:18px 4px}
  .masc.flip .m3d{scale:-1 1}
  .m3d .pL{transform-origin:20.6% 46.9%;animation:pThumb 4s ease-in-out infinite}
  .m3d .pR{transform-origin:91% 53%;animation:pSway 3s ease-in-out infinite alternate}
  .m3d .gL{transform-origin:40% 77%}
  .m3d .gR{transform-origin:62% 66%}
  .m3d .pup3{animation:pLook 7s ease-in-out infinite}
  .m3d .lid{transform-box:fill-box;transform-origin:50% 0;transform:scaleY(0);animation:pBlink 4.2s infinite}
  .m3d .lid.b{animation-delay:.04s}
  @keyframes m3dBob{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-3%) rotate(-1.5deg)}}
  @keyframes m3dShake{0%,100%{transform:rotate(0)}25%{transform:rotate(-6deg)}75%{transform:rotate(6deg)}}
  @keyframes m3dJump{0%,100%{transform:translateY(0) scale(1,1)}15%{transform:translateY(0) scale(1.06,.94)}45%{transform:translateY(-14%) scale(.97,1.04)}75%{transform:translateY(0) scale(1.04,.96)}}
  @keyframes m3dSway{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
  @keyframes m3dTilt{0%,100%{transform:rotate(0)}50%{transform:rotate(-7deg) translateY(-2%)}}
  @keyframes pThumb{0%,70%,100%{transform:rotate(0)}78%{transform:rotate(-14deg)}86%{transform:rotate(4deg)}92%{transform:rotate(-8deg)}}
  @keyframes pPump{0%,100%{transform:rotate(6deg)}50%{transform:rotate(-22deg)}}
  @keyframes pSway{from{transform:rotate(-5deg)}to{transform:rotate(7deg)}}
  @keyframes pWave{0%,100%{transform:rotate(10deg)}50%{transform:rotate(-38deg)}}
  @keyframes pStepL{0%,100%{transform:rotate(0) translateY(0)}25%{transform:rotate(7deg) translateY(-3%)}50%{transform:rotate(0) translateY(0)}}
  @keyframes pStepR{0%,100%,50%{transform:rotate(0) translateY(0)}75%{transform:rotate(-7deg) translateY(-3%)}}
  @keyframes pTap{0%,100%{transform:rotate(0)}50%{transform:rotate(-9deg)}}
  @keyframes pLook{0%,18%,100%{transform:translate(0,0)}24%,40%{transform:translate(-3px,1px)}46%,62%{transform:translate(3px,-1px)}68%,82%{transform:translate(1px,3px)}}
  @keyframes pLookR{0%,100%{transform:translate(3px,0)}50%{transform:translate(4px,-2px)}}
  @keyframes pLookFast{0%,100%{transform:translate(-3px,0)}50%{transform:translate(3px,0)}}
  @keyframes pBlink{0%,92%,100%{transform:scaleY(0)}95%{transform:scaleY(1)}}
  .m-alarm .m3db,.m-meetNow .m3db{animation:m3dShake .45s ease-in-out infinite}
  .m-alarm .m3d .pL,.m-meetNow .m3d .pL{display:none}
  .m-alarm .m3d .gL,.m-meetNow .m3d .gL{animation:pStepL .5s ease-in-out infinite}
  .m-alarm .m3d .gR,.m-meetNow .m3d .gR{animation:pStepR .5s ease-in-out infinite}
  .m-alarm .m3d .pR,.m-meetNow .m3d .pR{animation:pWave .35s ease-in-out infinite}
  .m-alarm .m3d .pup3,.m-meetNow .m3d .pup3{animation:pLookFast .6s ease-in-out infinite}
  .m-happy .m3db,.m-cheer .m3db,.m-welcome .m3db{animation:m3dJump .8s ease-in-out infinite}
  .m-happy .m3d .pL,.m-cheer .m3d .pL,.m-welcome .m3d .pL{animation:pPump .4s ease-in-out infinite}
  .m-happy .m3d .pR,.m-cheer .m3d .pR,.m-welcome .m3d .pR{animation:pWave .5s ease-in-out infinite}
  .m-happy .m3d .gL,.m-cheer .m3d .gL{animation:pStepL .8s ease-in-out infinite}
  .m-happy .m3d .gR,.m-cheer .m3d .gR{animation:pStepR .8s ease-in-out infinite}
  .m-live .m3db{animation:m3dSway 2.6s ease-in-out infinite}
  .m-meetSoon .m3db,.m-run .m3db{animation:m3dTilt 1.4s ease-in-out infinite}
  .m-meetSoon .m3d .gR,.m-run .m3d .gR{animation:pTap .35s ease-in-out infinite}
  .m-meetSoon .m3d .pup3,.m-run .m3d .pup3{animation:pLookR 1.4s ease-in-out infinite}
  .wel .masc.wbig .m3d{width:250px;height:250px}
  .sleigh .slm .m3d{width:100%;height:100%}
  .m-welcome .thumb{display:block;animation:mThumb .9s ease-out 1.2s both}
  .m-welcome .armL{display:none}
  .m-welcome .grin,.m-welcome .spark{display:block}
  .m-welcome .spark{animation:mFlash 1.2s infinite}
  .m-welcome .armR{animation:mWaveR .5s ease-in-out infinite alternate}
  .m-welcome .all{animation:mJump 1.4s ease-in-out 2,mBob 3.2s ease-in-out 2.8s infinite}
  .wcard{position:relative;background:#fff;color:#1b1f24;border-radius:22px;padding:24px 26px 20px;max-width:470px;box-shadow:0 0 0 3px #7d42c8,0 20px 50px rgba(0,0,0,.5);animation:wCard .6s .25s cubic-bezier(.3,1.4,.5,1) both}
  .wcard::before{content:'';position:absolute;left:-14px;top:46%;border:14px solid transparent;border-right-color:#7d42c8;border-left:0}
  .wcard::after{content:'';position:absolute;left:-9px;top:calc(46% + 3px);border:11px solid transparent;border-right-color:#fff;border-left:0}
  .wh{font-size:21px;font-weight:800;color:#5a24a0;line-height:1.25}
  .wd{font-size:13px;color:#6b7280;margin:4px 0 14px}
  .wq{font-size:17px;line-height:1.5;color:#1b1f24;font-weight:600;background:linear-gradient(135deg,#f6f0ff,#eefcf7);border-left:4px solid #00a884;border-radius:10px;padding:12px 14px;margin-bottom:12px}
  .wi{font-size:13.5px;color:#374151;margin:4px 0}
  .wi.wah{background:#f4edff;border-radius:8px;padding:6px 8px;color:#3b1d6e}
  .wbtn{margin-top:16px;width:100%;background:linear-gradient(135deg,#7d42c8,#5a24a0);color:#fff;border:0;border-radius:12px;padding:11px;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 6px 16px rgba(90,36,160,.4);transition:transform .15s}
  .wbtn:hover{transform:translateY(-2px)}
  .wname{margin-top:10px;font-size:12.5px;color:#6b7280;text-align:center}
  .wnq{font-weight:700;color:#5a24a0;margin-bottom:6px;font-size:13.5px}
  .wnr{display:flex;gap:6px}
  .wnr input[type=text]{flex:1;min-width:0;width:auto;border:2px solid #d9cdf0;border-radius:10px;padding:8px 10px;font-size:14px;outline:none;color:#1b1f24;background:#fff}
  .wnr input[type=text]:focus{border-color:#7d42c8}
  .wns{background:#00a884;color:#fff;border:0;border-radius:10px;padding:8px 14px;font-weight:700;cursor:pointer}
  .wch{cursor:pointer;text-decoration:underline;color:#7d42c8}
  .wsp{position:absolute;font-size:26px;left:30px;top:20px;animation:wTw 1.6s ease-in-out infinite}
  .wsp.s2{left:210px;top:0;font-size:20px;animation-delay:.5s}.wsp.s3{left:6px;top:200px;font-size:18px;animation-delay:1s}
  @keyframes wIn{from{opacity:0}to{opacity:1}}
  @keyframes wOut{to{opacity:0}}
  @keyframes wMascIn{from{transform:translateY(60px) scale(.6);opacity:0}to{transform:none;opacity:1}}
  @keyframes wCard{from{transform:translateX(-20px) scale(.92);opacity:0}to{transform:none;opacity:1}}
  @keyframes wTw{0%,100%{transform:scale(.7);opacity:.4}50%{transform:scale(1.15);opacity:1}}
  @media (max-width:640px){.wbox{flex-direction:column}.wcard::before,.wcard::after{display:none}.wel .masc.wbig,.wel .masc.wbig svg{width:170px;height:170px}}
  .card.purple{border-color:#a77bff}
  .rxrow{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
  .rxn{flex:1;min-width:80px}
  .rxn label{margin:6px 0 3px}
  .rxn input[type=number],.rxn input[type=text],.rxn input[type=time],.rxn select{width:100%;background:#202c33;color:#e9edef;border:1px solid #2a3942;border-radius:8px;padding:6px;font-size:13px;color-scheme:dark}
  .rxn.r input{border-color:#f15c6d}.rxn.g input{border-color:#25d366}.rxn.b input{border-color:#53bdeb}
  .rxn.tot{display:flex;flex-direction:column}
  .rxt{font-size:22px;color:#e9edef;padding:2px 4px}
  .escala summary{font-weight:700;color:#e9edef}
  .escala td{padding:4px 4px}
  .escala tr.hoje td{background:#0f2a22;color:#9fe3c9;font-weight:700}
  .rxhora{background:#202c33;border:1px dashed #2a3942;border-radius:8px;padding:7px 6px;font-size:12.5px;color:#aebac1}
  .rxcl{margin-top:8px;background:#111b21;border-radius:10px;padding:6px 8px}
  .rxg{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:5px 0;border-bottom:1px solid #2a3942}
  .rxgn{font-size:12.5px;min-width:0;flex:1}
  .rxgb{display:flex;gap:3px;flex:none}
  .rxk{background:#202c33;color:#aebac1;border:1px solid #2a3942;border-radius:6px;padding:2px 6px;font-size:11px;cursor:pointer}
  .rxk.open.on{background:#f15c6d;color:#fff;border-color:#f15c6d}
  .rxk.and.on{background:#53bdeb;color:#0b141a;border-color:#53bdeb}
  .rxk.fin.on{background:#25d366;color:#0b141a;border-color:#25d366}
  .optip{position:fixed;z-index:2147483647;background:#111b21;color:#e9edef;border:1px solid #00a884;border-radius:8px;padding:3px 8px;font-size:12px;font-weight:700;pointer-events:none;display:none}
  .opbox{background:#182229;border-radius:10px;padding:8px 10px;font-size:12px}
  .oprow{display:flex;align-items:center;gap:8px;margin:2px 0}
  .opl{width:130px;color:#e9edef}
  .oprow input[type=range]{flex:1;accent-color:#00a884}
  .opv{width:38px;text-align:right;color:#aebac1;font-variant-numeric:tabular-nums}
  .fab.drag{cursor:grabbing;opacity:.85}
  .fab .b{background:rgba(0,0,0,.35);color:#fff;border-radius:12px;padding:1px 8px;font-size:12px}
  .panel{position:fixed;top:0;right:0;height:100vh;z-index:2147483647;background:#0b141a;color:#e9edef;border-left:1px solid #2a3942;display:flex;flex-direction:column}
  .hd{padding:10px 12px;border-bottom:1px solid #2a3942;background:#111b21;display:flex;flex-direction:column;gap:8px}
  .ttl{display:flex;justify-content:space-between;align-items:center;gap:6px}
  .ttl b{font-size:14px}.ttl small{color:#8696a0;font-size:11px;display:block}
  .icons{display:flex;gap:2px;align-items:center}
  .ttl b{white-space:nowrap}.ttl small{white-space:nowrap}
  .hmw{position:relative}
  .hmenu{display:none;position:absolute;right:0;top:34px;z-index:5;min-width:220px;background:#151c27;border:1px solid #273244;border-radius:10px;padding:5px;box-shadow:0 14px 34px rgba(0,0,0,.5)}
  .hmenu.show{display:block}
  .hmenu .mi{display:flex;align-items:center;gap:10px;width:100%;background:none;border:0;color:#d6dbe4;font:13px Inter,"Segoe UI",system-ui,sans-serif;padding:8px 10px;border-radius:7px;cursor:pointer;text-align:left}
  .hmenu .mi:hover{background:#1d2532}.hmenu .mi.on{color:#ffb4bd}.hmenu .mi.on span{color:#ef5b6b}.hmenu .mi span{display:inline-grid;color:#8a94a6}
  button.ic{background:none;border:0;color:#aebac1;cursor:pointer;width:30px;height:30px;padding:0;border-radius:8px;display:inline-grid;place-items:center;transition:background .15s,color .15s}
  button.ic:hover{background:#202c33;color:#e9edef}
  button.ic:active{transform:scale(.94)}
  button.ic svg{display:block}
  .ttl b{display:inline-flex;align-items:center;gap:6px}
  .ttl .brand{color:#00a884;display:inline-grid}
  .ttl .brand.lgb{width:22px;height:22px;filter:brightness(1.9) saturate(1.2)}
  .ttl .brand.lgb svg{width:100%;height:100%;display:block}
  button.ic:hover{background:#202c33;color:#fff}
  .chips{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
  .chip{background:#202c33;border-radius:10px;padding:6px 4px;text-align:center;cursor:pointer;border:1px solid transparent}
  .chip:hover{border-color:#3b4a54}
  .chip .n{font-size:20px;font-weight:800;line-height:1.1;font-variant-numeric:tabular-nums}
  .chip .l{font-size:10.5px;color:#aebac1}
  .chip.red .n{color:#f15c6d}.chip.yellow .n{color:#ffd279}.chip.blue .n{color:#53bdeb}.chip.purple .n{color:#c9a4ff}
  .chip.red.on{animation:blink 1s ease-in-out infinite}
  .chip.sel{border-color:#00a884;box-shadow:0 0 0 2px #00a884 inset}
  .filt{display:flex;justify-content:space-between;align-items:center;gap:8px;background:#182229;border-radius:10px;padding:8px 10px;margin-bottom:8px;font-size:12.5px}
  .tabs{display:flex;gap:2px;border-bottom:1px solid #2a3942;padding:0 8px;background:#111b21;overflow-x:auto;scrollbar-width:thin}
  .sim{border-top:1px dashed #2a3942;padding-top:6px;margin-top:6px}
  .tab{background:none;border:0;color:#aebac1;padding:9px 7px;font-size:12.5px;cursor:pointer;border-bottom:3px solid transparent;white-space:nowrap}
  .tab.on{color:#e9edef;border-bottom-color:#00a884;font-weight:700}
  .tab .c{background:#f15c6d;color:#fff;border-radius:10px;padding:0 6px;font-size:11px;margin-left:4px}
  .tab .c.g{background:#2a3942;color:#aebac1}
  .bd{overflow:auto;padding:10px 12px 40px;flex:1;font-size:13px;line-height:1.45}
  .grp{font-size:11.5px;text-transform:uppercase;letter-spacing:.6px;color:#8696a0;margin:14px 0 6px;font-weight:700}
  .card{background:#111b21;border:1px solid #2a3942;border-left-width:5px;border-radius:10px;padding:10px;margin:0 0 8px}
  .card.red{border-color:#f15c6d}.card.red.blink{animation:blink 1s ease-in-out infinite}
  .card.yellow{border-color:#d9a400}.card.green{border-color:#25d366}.card.blue{border-color:#53bdeb}.card.purple{border-color:#a77bff}
  .top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
  .gname{font-weight:700;font-size:13.5px}
  .wait{font-size:18px;font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums}
  .wait.red{color:#f15c6d}.wait.yellow{color:#ffd279}.wait.green{color:#25d366}.wait.blue{color:#53bdeb}
  .pill{display:inline-block;border-radius:6px;padding:1px 7px;font-size:11px;font-weight:700;margin-right:6px;vertical-align:1px}
  .pill.red{background:#f15c6d;color:#fff}.pill.red.blink{animation:blinkPill 1s ease-in-out infinite}
  .pill.yellow{background:#d9a400;color:#111}.pill.green{background:#25d366;color:#0b141a}.pill.blue{background:#53bdeb;color:#0b141a}.pill.purple{background:#a77bff;color:#0b141a}
  .who{color:#aebac1;font-size:12px;margin-top:2px}
  .quote{background:#202c33;border-radius:8px;padding:6px 8px;margin:6px 0;font-size:12.5px;color:#d1d7db;word-break:break-word}
  .actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
  button.btn{background:#202c33;color:#e9edef;border:1px solid #2a3942;border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer}
  button.btn:hover{background:#2a3942}
  button.btn.pri{background:#00a884;color:#0b141a;border-color:#00a884;font-weight:700}
  button.btn.ok{border-color:#25d366;color:#9fe3c9}
  button.btn.ok:hover{background:#0f2a22}
  .undo{display:flex;justify-content:space-between;align-items:center;gap:8px;background:#0f2a22;border:1px solid #1e5a46;color:#9fe3c9;border-radius:10px;padding:8px 10px;margin-bottom:8px;font-size:12.5px}
  details{margin-top:6px}
  summary{cursor:pointer;color:#53bdeb;font-size:12px;list-style:none}
  summary::-webkit-details-marker{display:none}
  summary::before{content:'▸ ';}details[open] summary::before{content:'▾ ';}
  pre{white-space:pre-wrap;word-break:break-word;background:#202c33;border-radius:8px;padding:8px;margin:6px 0;font-size:12.5px;font-family:inherit;color:#e9edef}
  pre.fix{border-left:3px solid #25d366}
  .warn{color:#ffd279;font-size:12px;margin-top:4px}
  .src{color:#53bdeb;font-size:11px}
  .edit{background:#f15c6d;color:#fff;font-weight:800;border-radius:6px;padding:3px 8px;display:inline-block;margin-bottom:6px;font-size:12px;animation:blinkPill 1s ease-in-out infinite}
  ul.iss{margin:4px 0 0 0;padding-left:18px;color:#ffd279;font-size:12px}
  .lbl{color:#8696a0;font-size:11.5px;margin-top:6px}
  .empty{background:#0f2a22;border:1px solid #1e5a46;color:#9fe3c9;border-radius:10px;padding:12px;text-align:center}
  table{width:100%;border-collapse:collapse;font-size:12.5px}
  td{border-bottom:1px solid #2a3942;padding:6px 4px;color:#e9edef}
  td.n{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
  .info{background:#182229;border-radius:8px;padding:8px;color:#8696a0;font-size:12px;margin-top:12px}
  label{display:block;margin:10px 0 4px;color:#8696a0;font-size:12px}
  textarea,input[type=number],input[type=text]{width:100%;background:#202c33;color:#e9edef;border:1px solid #2a3942;border-radius:8px;padding:6px;font-size:12px}
  .chk{display:flex;gap:8px;align-items:center;margin-top:8px;color:#e9edef}
  .seg{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap}
  .seg .btn.on{background:#00a884;color:#0b141a;border-color:#00a884;font-weight:700}
  .kbimgs{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0}
  .kbthumb{display:flex;flex-direction:column;gap:4px;align-items:flex-start}
  .kbimg{max-width:150px;max-height:110px;border-radius:6px;border:1px solid #2a3942;cursor:zoom-in;background:#202c33;min-width:40px;min-height:30px}
  .imgbar{display:flex;gap:4px}
  button.btn.mini{padding:2px 6px;font-size:11px}
  button.btn.danger{background:#f15c6d;border-color:#f15c6d;color:#fff;font-weight:700}
  .drop{border:2px dashed #3b4a54;border-radius:8px;padding:12px;text-align:center;color:#8696a0;font-size:12px;cursor:pointer;outline:none}
  .drop:focus,.drop.over{border-color:#00a884;color:#e9edef}
  .lb{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:2147483647;display:flex;align-items:center;justify-content:center;cursor:zoom-out}
  .lb img{max-width:94vw;max-height:94vh;border-radius:8px;background:#fff}
  .meetbar{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:2147483647;display:flex;flex-direction:column;gap:8px;width:min(620px,calc(100vw - 24px))}
  .mt{display:flex;align-items:center;gap:12px;border-radius:14px;padding:10px 14px;box-shadow:0 8px 28px rgba(0,0,0,.55);border:2px solid;color:#fff;font-family:inherit}
  .mt.warn{background:#7a5600;border-color:#ffd279;animation:blinkMeet 1s ease-in-out infinite}
  .mt.go{background:#8b1d2a;border-color:#f15c6d;animation:blinkMeetGo .6s ease-in-out infinite}
  .mt.ack{background:#111b21;border-color:#ffd279}
  .mt.run{background:#0f2a22;border-color:#25d366}
  .mt.live{background:linear-gradient(135deg,#2a1450,#3a1a6e);border-color:#a77bff}
  .mt .rec{display:inline-block;width:10px;height:10px;border-radius:50%;background:#25d366;box-shadow:0 0 0 0 rgba(37,211,102,.7);animation:recPulse 1.4s ease-in-out infinite;vertical-align:-1px;margin-right:2px}
  @keyframes recPulse{0%,100%{box-shadow:0 0 0 0 rgba(37,211,102,.7)}50%{box-shadow:0 0 0 6px rgba(37,211,102,0)}}
  button.btn.live{border-color:#a77bff;color:#e3d4ff;font-weight:700}
  .mt.done{background:#0f2a22;border-color:#25d366}
  button.btn.fin{border-color:#25d366;color:#9fe3c9;font-weight:700}
  .meetbar{cursor:grab;touch-action:none;user-select:none}
  .meetbar.drag{cursor:grabbing;opacity:.9}
  .meetbar.min{width:auto;max-width:calc(100vw - 24px)}
  .mt.mini{padding:5px 8px 5px 12px;gap:8px;border-radius:22px;font-size:13px;font-weight:700;cursor:pointer;align-items:center}
  .mt.mini .mn{max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mt.mini .mcd{font-size:15px}
  .mi{flex:1;min-width:0}
  .mh{font-size:11.5px;font-weight:800;letter-spacing:.5px;opacity:.9}
  .mc{font-size:16px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ms{font-size:12.5px;opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mcd{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}
  .mb{display:flex;flex-direction:column;gap:4px}
  @keyframes blinkMeet{0%,100%{background:#7a5600;box-shadow:0 0 0 0 rgba(255,210,121,.7)}50%{background:#3d2b00;box-shadow:0 0 0 12px rgba(255,210,121,0)}}
  @keyframes blinkMeetGo{0%,100%{background:#8b1d2a;box-shadow:0 0 0 0 rgba(241,92,109,.8)}50%{background:#3a1418;box-shadow:0 0 0 14px rgba(241,92,109,0)}}
  input[type=date],input[type=time]{width:100%;background:#202c33;color:#e9edef;border:1px solid #2a3942;border-radius:8px;padding:6px;font-size:12px;color-scheme:dark}
  .round{background:#0f2a22;color:#9fe3c9;font-size:12px;border-radius:8px;padding:6px 8px}
  `;

  let cheerUntil = 0, lastFinCount = null;
  const BUB_SHOW = 8000, BUB_EVERY = 2 * 60 * 1000, BUB_MIN_WAIT = 5 * 60 * 1000;
  let bubUntil = 0, bubNextAt = 0, bubIdx = -1, bubName = '', bubKind = '', meetBubNextAt = 0;
  const BUB_MEET_EVERY = 5 * 60 * 1000;
  // ------------------------------------------------------------------ LEMBRETE DO RAIO-X (11:30 e 17:00)
  // Considera feito quando o colaborador clica em "📋 Copiar Raio-X". Se não fizer, lembra de novo a cada 10 min.
  const RX_SLOTS = ['11:30', '17:00'], RX_EVERY = 10 * 60 * 1000, RX_SHOW = 12000;
  const RX_KEY = 'ilevaSup.rxdone.v1';
  let rxNextAt = 0, rxSlotShown = '', rxPreNextAt = 0, ahNextAt = Date.now() + 15000;
  function afterHoursPending() { const st = lastSt; if (!st || !st.open) return []; return st.open.filter(g => g.afterHours && g.status === 'open'); }
  const slotTs = (lab, base) => { const [hh, mm] = lab.split(':').map(Number); const d = new Date(base); d.setHours(hh, mm, 0, 0); return d.getTime(); };
  // ESCALA DO RAIO-X: 2 por dia (11:30 e 17:00), de segunda a sexta, em rodízio entre os 3 colaboradores.
  // O rodízio continua de uma semana para a outra: a cada 3 semanas, cada um faz exatamente 10 Raio-X.
  const RX_TEAM = ['Adriel', 'Francisco', 'Lucas'];
  const RX_ANCHOR = new Date(2026, 10, 9).getTime(); // segunda-feira, 09/11/2026 (começo da escala)
  const DIAS_SEM = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
  function bizIndex(ts) {
    const d = new Date(ts); d.setHours(12, 0, 0, 0);
    const diff = Math.round((d.getTime() - (RX_ANCHOR + 12 * HOUR)) / DAY);
    const dow = ((diff % 7) + 7) % 7; // 0 = segunda ... 6 = domingo
    if (dow >= 5) return null;
    return Math.floor(diff / 7) * 5 + dow;
  }
  function rxResp(ts, slot) {
    const bi = bizIndex(ts); if (bi == null) return '';
    const idx = bi * 2 + (slot === '17:00' ? 1 : 0);
    return RX_TEAM[((idx % RX_TEAM.length) + RX_TEAM.length) % RX_TEAM.length];
  }
  function rxWeek(ts) { // segunda a sexta da semana de ts
    const d = new Date(ts); d.setHours(12, 0, 0, 0); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow);
    return [0, 1, 2, 3, 4].map(i => { const x = new Date(d); x.setDate(d.getDate() + i); return x.getTime(); });
  }
  function rxUpcoming(now) { // horário que começa nos próximos 15 min e ainda não foi feito
    if (bizIndex(now) == null) return null;
    const done = lsGet(RX_KEY, {}), day = dayKey(new Date(now));
    for (const lab of RX_SLOTS) { const t = slotTs(lab, now); if (now < t && t - now <= 15 * MIN && !(done.date === day && done[lab])) return lab; }
    return null;
  }
  function rxPendingSlot(now) {
    if (bizIndex(now) == null) return null; // fim de semana: sem Raio-X
    const done = lsGet(RX_KEY, {});
    const day = dayKey(new Date(now));
    let cur = null;
    for (const lab of RX_SLOTS) if (now >= slotTs(lab, now)) cur = lab; // horário mais recente que já chegou
    if (!cur) return null;
    return done.date === day && done[cur] ? null : cur;
  }
  function rxMarkRemote(day, sl, ts, fromCard) { // Raio-X feito por outro colaborador (ou visto no card do MeisterTask)
    if (day !== dayKey() || !RX_SLOTS.includes(sl)) return false;
    const dn = lsGet(RX_KEY, {}) || {}; const o = dn.date === day ? dn : { date: day };
    if (o[sl]) return false;
    o[sl] = ts || Date.now(); if (!fromCard) o['sh_' + sl] = 1; lsSet(RX_KEY, o);
    rxNextAt = 0; rxPreNextAt = 0; if (bubKind === 'rx' || bubKind === 'rxpre') bubUntil = 0;
    try { render(false); } catch (e) { }
    return true;
  }
  // card "Raio x Diário" aberto no MeisterTask: se o horário de hoje já está preenchido, conta como feito
  function rxScanCard() {
    if (!/(^|\.)meistertask\.com$/.test(location.hostname) || document.querySelector('textarea.kr-view')) return;
    const now = new Date(), dd = twoD(now.getDate()) + '/' + twoD(now.getMonth() + 1);
    const tx = [...document.querySelectorAll('.ml-react-markdown')].map(e => e.innerText || '').find(t => /Hor[aá]rio de realiza/i.test(t) && /TOTAL DE ATENDIMENTOS/i.test(t));
    rxParseCard(tx);
  }
  // lê o texto do card "Raio x Diário": horário de realização preenchido no dia de hoje = Raio-X feito
  function rxParseCard(tx) {
    const now = new Date(), dd = twoD(now.getDate()) + '/' + twoD(now.getMonth() + 1);
    tx = String(tx || '').replace(/[`*_]/g, '');
    if (!tx || !/Hor[aá]rio de realiza/i.test(tx) || !new RegExp('\\|\\s*' + dd.replace('/', '\\/')).test(tx)) return;
    const parts = tx.split(/(?=\b(?:11:30|17:00)\s*-)/);
    for (const p of parts) {
      const m = p.match(/^(11:30|17:00)\s*-/); if (!m) continue;
      const r = p.match(/Hor[aá]rio de realiza[cç][aã]o\s*:\s*(\d{1,2}):(\d{2})/i);
      if (r) { const t = new Date(); t.setHours(+r[1], +r[2], 0, 0); rxMarkRemote(dayKey(), m[1], t.getTime(), true); }
    }
  }
  // lê o card direto pela API do MeisterTask a cada 2 min (não precisa estar aberto; basta uma aba do MeisterTask)
  let rxFetchBusy = false;
  async function rxCardFetch() {
    if (rxFetchBusy || !/(^|\.)meistertask\.com$/.test(location.hostname)) return;
    const dn = lsGet(RX_KEY, {}) || {}; if (dn.date === dayKey() && RX_SLOTS.every(sl => dn[sl])) return; // os dois já feitos
    rxFetchBusy = true;
    try {
      const tok = ((((lsGet(MT_KEY, {}) || {}).url) || MT_DEFAULT).match(/\/task\/([A-Za-z0-9]+)/) || [])[1]; if (!tok) return;
      const d = await mtGql('IlevaRaioX', `query { find_task_by_token(token: "${tok}") { id notes } }`);
      const n = d && d.find_task_by_token && d.find_task_by_token.notes; if (typeof n === 'string') rxParseCard(n);
    } catch (e) { } finally { rxFetchBusy = false; }
  }
  function markRxDone() {
    const now = Date.now(), day = dayKey(new Date(now));
    let cur = null; for (const lab of RX_SLOTS) if (now >= slotTs(lab, now)) cur = lab;
    if (!cur) return;
    const done = lsGet(RX_KEY, {}); const o = done.date === day ? done : { date: day };
    o[cur] = now; lsSet(RX_KEY, o); try { if (CHAT_ON && chatCfg().alerts.rx) chatPost(`✅ Raio-X das ${cur} enviado${userNome() ? ' por *' + userNome() + '*' : ''}.`, `rxok|${day}|${cur}`).catch(() => { }); } catch (e) { } setTimeout(() => { try { syncMeets(); } catch (e) { } }, 500);
    rxNextAt = 0; bubUntil = 0;
    lastAction = { kind: 'info', key: '', label: `Raio-X das ${cur} registrado. Obrigado! 👏`, at: now };
    cheerUntil = now + 6000;
  }
  // ===== Dia de cobrança (card "DIA DE COBRANÇA" do MeisterTask) =====
  const COB_KEY = 'ilevaSup.cob.v1';
  const COB_DEF = { sched: { 1: 'Lucas', 3: 'Francisco', 5: 'Adriel' }, url: 'https://www.meistertask.com/app/task/h3TTfo8o', done: {} };
  const COB_END = 12 * 60; // "parte da manhã": lembretes das 08:00 às 12:00
  const COB_EVERY = 20 * MIN;
  let cobNextAt = Date.now() + 25000, cobNotified = '';
  function cobCfg() { const c = lsGet(COB_KEY, null) || {}; return { sched: Object.assign({}, COB_DEF.sched, c.sched || {}), url: c.url || COB_DEF.url, done: c.done || {} }; }
  function cobSave(patch) { const c = cobCfg(); lsSet(COB_KEY, Object.assign(c, patch)); }
  function cobResp(ts) { const d = new Date(ts).getDay(); if (d < 1 || d > 5) return ''; return (cobCfg().sched[d] || '').trim(); }
  function cobDone(ts) { return !!cobCfg().done[isoDay(new Date(ts))]; }
  function cobMine(resp) { const nome = ((lsGet('ilevaSup.user.v1', {}) || {}).nome || '').trim().toLowerCase(); if (!nome) return true; const r = resp.toLowerCase(); return r.split(/\s*(?:[\/,&]|\be\b)\s*/).some(x => x && (nome.startsWith(x) || x.startsWith(nome.split(' ')[0]))); }
  function cobPending(now) { // responsável de hoje, se ainda é manhã e não foi marcado como feito
    const resp = cobResp(now); if (!resp || cobDone(now)) return '';
    const d = new Date(now), m = d.getHours() * 60 + d.getMinutes();
    if (m < BIZ_OPEN || m >= COB_END) return '';
    return cobMine(resp) ? resp : '';
  }
  function markCobDone(on = true) {
    const c = cobCfg(), k = isoDay(new Date());
    if (on) c.done[k] = Date.now(); else delete c.done[k];
    Object.keys(c.done).sort().slice(0, -30).forEach(x => delete c.done[x]); // guarda só os últimos 30 dias
    lsSet(COB_KEY, c); bubUntil = 0; cobNextAt = Date.now() + COB_EVERY;
    if (on) { lastAction = { kind: 'info', key: '', label: 'Cobrança de hoje registrada. Obrigado! 👏', at: Date.now() }; cheerUntil = Date.now() + 6000; }
    try { render(true); } catch (e) { }
  }
  function cobCard() {
    const now = Date.now(), c = cobCfg(), today = isoDay(new Date(now)), week = rxWeek(now), resp = cobResp(now), done = cobDone(now);
    const rows = week.map((ts, i) => { const d = new Date(ts), isT = isoDay(d) === today, nm = (c.sched[i + 1] || '').trim();
      return h('tr', { class: isT ? 'hoje' : '' }, h('td', {}, `${DIAS_SEM[i]} ${twoD(d.getDate())}/${twoD(d.getMonth() + 1)}`, isT ? ' • hoje' : ''), h('td', { class: 'esc' + (isT ? ' hoje' : '') }, nm || '—', isT && nm && done ? ' ✅' : '')); });
    const ins = [1, 2, 3, 4, 5].map(d => h('input', { type: 'text', value: c.sched[d] || '', placeholder: '(sem cobrança)', style: 'width:100%' }));
    const urlInp = h('input', { type: 'text', value: c.url, style: 'width:100%' });
    const salvar = h('button', { class: 'btn', onclick: () => { const sched = {}; ins.forEach((x, i) => sched[i + 1] = x.value.trim()); cobSave({ sched, url: urlInp.value.trim() || COB_DEF.url }); render(true); } }, '💾 Salvar escala');
    const acts = [];
    if (resp) acts.push(done
      ? h('button', { class: 'btn', onclick: () => markCobDone(false) }, '↩️ Desmarcar')
      : h('button', { class: 'btn pri', onclick: () => markCobDone(true) }, '✅ Cobrança de hoje feita'));
    acts.push(h('button', { class: 'btn', onclick: () => { try { window.open(c.url, '_blank'); } catch (e) { } } }, '📌 Abrir card no MeisterTask'));
    return h('details', { class: 'card blue escala', open: !!resp },
      h('summary', {}, resp ? (done ? `💰 Dia de cobrança: ${resp} · ✅ feita` : `💰 Hoje é dia de cobrança: ${resp}`) : '💰 Dia de cobrança'),
      h('table', {}, h('tbody', {}, rows)),
      h('div', { class: 'cobtx' }, 'Cobrança dos clientes (documentação, tarefas, treinamento) na ', h('b', {}, 'parte da manhã'), '. Sem devolutiva: ligar para o cliente e notificar o comercial dele. Sem contato: avisar o ', h('b', {}, 'Mansur'), '.'),
      h('div', { class: 'actions' }, acts),
      h('details', {}, h('summary', {}, 'Alterar escala / link do card'),
        ...[1, 2, 3, 4, 5].map((d, i) => h('div', {}, h('label', {}, DIAS_SEM[i]), ins[i])),
        h('label', {}, 'Link do card "DIA DE COBRANÇA" no MeisterTask'), urlInp, h('div', { class: 'actions' }, salvar)));
  }
  // contagem para o Natal: aparece 20 s depois de abrir o WhatsApp e depois de 30 em 30 min (até o dia 25/12)
  const XMAS_SHOW = 10000, XMAS_EVERY = 20 * 60 * 1000;
  let xmasNextAt = Date.now() + 20000;
  function xmasDays(now) {
    const d = new Date(now), y = d.getFullYear();
    if (d.getMonth() !== 10 && d.getMonth() !== 11) return null; // só em novembro e dezembro
    const t0 = new Date(y, d.getMonth(), d.getDate()).getTime(), xm = new Date(y, 11, 25).getTime();
    const days = Math.round((xm - t0) / DAY);
    return days >= 0 ? days : null;
  }
  // itens de Natal surgindo em volta do mascote (sem vermelho)
  const XMAS_ITEMS = [
    '<svg viewBox="0 0 24 24"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" stroke="#e8f4ff" stroke-width="2.2" stroke-linecap="round"/><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5" stroke="#e8f4ff" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" fill="#ffd279" stroke="#c99400" stroke-width="1"/></svg>',
    '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="12" rx="2" fill="#00a884"/><rect x="2" y="6" width="20" height="5" rx="1.5" fill="#00c49a"/><rect x="10.5" y="6" width="3" height="15" fill="#ffd279"/><path d="M12 6C9 1 5 3 7.5 6M12 6c3-5 7-3 4.5 0" stroke="#ffd279" stroke-width="2" fill="none"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="M12 3c-4 0-6 3.5-6 8v4l-2 3h16l-2-3v-4c0-4.5-2-8-6-8z" fill="#ffc93c" stroke="#b07800" stroke-width="1"/><circle cx="12" cy="20.5" r="2" fill="#b07800"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="M12 2l5 7h-3l5 6h-3l4 5H4l4-5H5l5-6H7z" fill="#00a884" stroke="#006b55" stroke-width="1"/><rect x="10.5" y="20" width="3" height="3" fill="#8a5a2b"/><circle cx="12" cy="3" r="1.6" fill="#ffd279"/></svg>',
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="4.5" fill="#fff"/><circle cx="12" cy="16" r="6.5" fill="#fff"/><circle cx="10.5" cy="6.3" r=".9" fill="#1b1f24"/><circle cx="13.5" cy="6.3" r=".9" fill="#1b1f24"/><path d="M12 7.5l2.5 1-2.5.5z" fill="#ffb020"/><path d="M8 11h8" stroke="#6c31b4" stroke-width="2"/></svg>'
  ];
  let xfxOn = false;
  // trenó voando pela tela com o mascote anunciando a contagem para o Natal
  const SLEIGH_SVG = '<svg class="sls" viewBox="0 0 470 150" aria-hidden="true"><defs><linearGradient id="slG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9563dc"/><stop offset="1" stop-color="#4b1b8a"/></linearGradient><linearGradient id="slR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a0704c"/><stop offset="1" stop-color="#6f4a2e"/></linearGradient></defs>'
    // rédeas
    + '<path d="M196 92 Q250 70 300 78 M196 96 Q290 92 392 70" fill="none" stroke="#ffd279" stroke-width="2.5"/>'
    // renas (genéricas, marrons)
    + [300, 382].map(x => `<g transform="translate(${x} 52)"><path class="slleg" d="M10 36 L4 58 M16 36 L14 60" stroke="#5a3a22" stroke-width="5" stroke-linecap="round"/><path class="slleg b" d="M46 34 L54 56 M40 36 L44 60" stroke="#5a3a22" stroke-width="5" stroke-linecap="round"/><ellipse cx="28" cy="28" rx="30" ry="14" fill="url(#slR)"/><path d="M50 22 Q60 6 66 -2" stroke="#8a5a3c" stroke-width="11" stroke-linecap="round" fill="none"/><ellipse cx="72" cy="-6" rx="13" ry="9" fill="url(#slR)"/><path d="M68 -14 L64 -30 M64 -24 L56 -30 M74 -14 L80 -30 M78 -24 L86 -28" stroke="#d9b98a" stroke-width="3.5" stroke-linecap="round"/><circle cx="76" cy="-8" r="2.2" fill="#1b1f24"/><circle cx="85" cy="-4" r="3.4" fill="#2a1f3d"/><path d="M2 26 Q-6 22 -4 14" stroke="#8a5a3c" stroke-width="5" stroke-linecap="round" fill="none"/><rect x="18" y="16" width="22" height="7" rx="3.5" fill="#00a884"/><circle cx="29" cy="27" r="4" fill="#ffd279"/></g>`).join('')
    // trenó
    + '<path d="M70 70 Q66 112 104 116 L206 116 Q222 116 222 100 L222 86 Q222 76 210 78 L180 82 Q150 84 132 70 Z" fill="url(#slG)" stroke="#3a1268" stroke-width="3"/>'
    + '<path d="M86 84 Q130 98 214 88" fill="none" stroke="#ffd279" stroke-width="4" stroke-linecap="round"/>'
    + '<path d="M56 128 L214 128 Q240 128 236 110" fill="none" stroke="#ffd279" stroke-width="5" stroke-linecap="round"/><path d="M100 116 L96 128 M180 116 L184 128" stroke="#ffd279" stroke-width="4"/>'
    // presentes
    + '<rect x="70" y="50" width="34" height="28" rx="3" fill="#00a884"/><rect x="84" y="50" width="6" height="28" fill="#ffd279"/><rect x="58" y="60" width="22" height="20" rx="3" fill="#6c31b4"/><rect x="66" y="60" width="5" height="20" fill="#ffd279"/>'
    + '</svg>';
  let sleighOn = false;
  // ---- Modo corporativo: árvore de Natal em neon verde se desenhando + dias que faltam
  let neonEl = null;
  function neonTree(d) {
    if (!shadow || ui.mini || isPresenting() || lunchOn() || (neonEl && shadow.contains(neonEl))) return false;
    const orn = [[52, 74, '#39ff88'], [96, 70, '#c9a8ff'], [66, 104, '#f6f3ff'], [104, 108, '#39ff88'], [40, 112, '#c9a8ff'], [84, 140, '#f6f3ff'], [56, 146, '#39ff88'], [112, 144, '#c9a8ff']];
    const svg = `<svg viewBox="0 0 150 175"><path class="ln" pathLength="1" d="M75 26 L44 66 L58 66 L32 104 L48 104 L20 150 L130 150 L102 104 L118 104 L92 66 L106 66 Z"/>`
      + `<path class="ln t" pathLength="1" d="M66 150 V166 H84 V150"/>`
      + `<path class="ln g" pathLength="1" d="M50 80 Q76 92 100 74"/><path class="ln g" pathLength="1" d="M38 118 Q78 132 112 112"/>`
      + orn.map(([x, y, c], i) => `<circle class="orn" cx="${x}" cy="${y}" r="3.6" fill="${c}" style="color:${c};transform-origin:${x}px ${y}px;animation-delay:${(1.9 + i * .09).toFixed(2)}s,${(3 + i * .2).toFixed(1)}s"/>`).join('')
      + `<path class="star" d="M75 2 L79 11 L89 12 L81.5 18.5 L84 28 L75 23 L66 28 L68.5 18.5 L61 12 L71 11 Z"/></svg>`;
    neonEl = h('div', { class: 'neon', title: 'Clique para fechar' });
    setHTML(neonEl, svg);
    neonEl.append(h('div', { class: 'nt' }, ...(d === 0 ? [h('b', {}, 'Feliz Natal'), h('span', {}, 'Boas festas da Ileva')] : [h('b', {}, d === 1 ? 'Falta 1 dia' : `Faltam ${d} dias`), h('span', {}, 'para o Natal')])));
    const fr = fab && fab.style.display !== 'none' && fab.offsetWidth ? fab.getBoundingClientRect() : null;
    neonEl.style.right = (ui.open && panel && panel.offsetWidth ? panel.offsetWidth + 14 : (fr ? Math.max(12, VW() - fr.right) : 18)) + 'px';
    neonEl.style.bottom = ((fr ? Math.max(12, VH() - fr.top + 6) : 18) + (ui.open ? 0 : pqH())) + 'px';
    shadow.append(neonEl);
    const el = neonEl;
    const bye = () => { el.classList.add('off'); setTimeout(() => { el.remove(); if (neonEl === el) neonEl = null; }, 900); };
    el.addEventListener('click', e => { e.stopPropagation(); bye(); });
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
    setTimeout(bye, 11000);
    return true;
  }
  function sleighFly(d) {
    if (isCorp()) return neonTree(d);
    if (!shadow || sleighOn || ui.mascot === false || ui.mini || isPresenting()) return false;
    sleighOn = true;
    const sl = h('div', { class: 'sleigh' }), bob = h('div', { class: 'slb' });
    setHTML(bob, SLEIGH_SVG);
    const m = h('div', { class: 'slm masc m-happy' }); setHTML(m, mascotHTML()); bob.append(m);
    bob.append(h('div', { class: 'slban' }, ...(d === 0 ? ['🎄 ', h('b', {}, 'Feliz Natal!'), ' Ho ho ho! ✨'] : ['🎄 Ho ho ho! ', d === 1 ? 'Falta ' : 'Faltam ', h('b', {}, d === 1 ? '1 dia' : d + ' dias'), ' para o Natal! ✨'])));
    ['✨', '⭐', '❄️', '✨', '⭐'].forEach((t, i) => { const st = h('span', { class: 'slst' }, t); st.style.left = (40 + i * 22) + 'px'; st.style.top = (96 + (i % 2) * 18) + 'px'; st.style.animationDelay = (i * .3) + 's'; bob.append(st); });
    sl.append(bob); shadow.append(sl);
    if (mascot) mascot.style.visibility = 'hidden'; // o mascote "sai" para voar no trenó
    try { beep(false); } catch (e) { }
    setTimeout(() => { sl.remove(); sleighOn = false; if (mascot) mascot.style.visibility = ''; }, 11200);
    return true;
  }
  function xmasFx(on) {
    if (!mascot || on === xfxOn) return;
    xfxOn = on;
    let box = mascot.querySelector('.xfx');
    if (!on) { if (box) box.classList.add('end'); mascot.classList.remove('festa'); setTimeout(() => { const b2 = mascot.querySelector('.xfx.end'); if (b2) b2.remove(); }, 900); return; }
    if (box) box.remove();
    box = h('div', { class: 'xfx' });
    for (let i = 0; i < 14; i++) {
      const it = h('span', { class: 'xi' });
      setHTML(it, XMAS_ITEMS[i % XMAS_ITEMS.length]);
      // espalham para os lados e para baixo do mascote, sem cobrir o balão
      const side = i % 2 ? 1 : -1, ang = (side > 0 ? -25 + (i * 50 / 13) : 155 + (i * 50 / 13)) * Math.PI / 180, dist = 50 + (i % 4) * 18;
      it.style.setProperty('--dx', Math.round(Math.cos(ang) * dist) + 'px');
      it.style.setProperty('--dy', Math.round(Math.sin(ang) * dist + 6) + 'px');
      it.style.setProperty('--rot', ((i % 2 ? 1 : -1) * (90 + i * 15)) + 'deg');
      it.style.setProperty('--sz', (14 + (i % 3) * 4) + 'px');
      it.style.animationDelay = (i * 0.32) + 's';
      box.append(it);
    }
    mascot.append(box); mascot.classList.add('festa');
  }
  // nome do cliente = parte do nome do grupo antes do "&" (ou "/"), sem o "Ileva"
  function clientLabel(name) {
    const parts = String(name || '').split(/\s*[&\/]\s*/).map(x => x.trim()).filter(Boolean);
    const c = parts.find(x => !/^ileva\b/i.test(x)) || parts[0] || name;
    return c.replace(/\s*\|.*$/, '').trim();
  }
  // ícones de linha do cabeçalho do painel (no lugar dos emojis)
  const ICO = {
    shield: '<path d="M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
    ronda: '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/>',
    relatorio: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
    claude: '<path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M18.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    transp: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor" stroke="none"/>',
    largura: '<path d="M3 12h18"/><path d="M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    bloq: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
    mais: '<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',
    config: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    minimizar: '<path d="M6 12h12"/>',
    almoco: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17 21V3c-2 1-3 3.5-3 7 0 2 1 3 3 3"/>'
  };
  const icoSvg = (k, sz) => `<svg viewBox="0 0 24 24" width="${sz || 18}" height="${sz || 18}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[k]}</svg>`;
  // ===== Bloqueio de YouTube e Spotify (ligado/desligado pelo gestor, vale para a versão da equipe) =====
  const BLOCK_KEY = 'ilevaSup.block.v1';
  const EQUIPE = /-equipe$/.test(VERSION);
  const BLOCK_HOSTS = /(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com|spotify\.com)$/i;
  const blockState = () => lsGet(BLOCK_KEY, {}) || {};
  function blockLabel() { const b = blockState(); return b.on ? 'YouTube/Spotify: BLOQUEADOS — liberar' : 'Bloquear YouTube e Spotify da equipe'; }
  function blockLabelRefresh() { try { const bt = panel && panel.querySelector('.mi[data-i=bloq]'); if (!bt) return; const tn = [...bt.childNodes].find(n => n.nodeType === 3); if (tn) tn.textContent = blockLabel(); else bt.append(blockLabel()); bt.classList.toggle('on', !!blockState().on); } catch (e) { } }
  async function blockToggle() {
    const b = blockState(), on = !b.on, now = Date.now();
    const nb = { on, by: userNome() || 'gestor', at: now };
    lsSet(BLOCK_KEY, nb); hmClose(); blockLabelRefresh();
    lastAction = { kind: 'info', key: '', label: on ? 'YouTube e Spotify bloqueados para a equipe (chega em até 1 minuto).' : 'YouTube e Spotify liberados para a equipe.', at: now };
    render(true);
    try { if (SHARED_URL) await gmGet({ action: 'cfgset', data: JSON.stringify({ block: nb }) }); }
    catch (e) { lastAction = { kind: 'info', key: '', label: 'Não consegui avisar a planilha: ' + e.message + '. Atualize o script da planilha.', at: Date.now() }; render(true); }
  }
  let blkHost = null, blkLastFetch = 0;
  function blockTick() {
    try {
      if (!EQUIPE || !BLOCK_HOSTS.test(location.hostname)) return;
      // nas abas do YouTube/Spotify consulta a planilha a cada minuto (não depende do WhatsApp aberto)
      if (SHARED_URL && Date.now() - blkLastFetch > 60000) { blkLastFetch = Date.now(); gmGet({ action: 'cfg' }).then(j => { if (j.cfg && j.cfg.acesso && HAS_GM) gmSetJ(ACESSO_KEY, j.cfg.acesso); if (j.cfg && HAS_GM) gmSetJ('ilevaSup.pipRegra.v1', j.cfg.pipRegra || {}); const b = (j.cfg && j.cfg.block) || { on: false }; lsSet(BLOCK_KEY, { on: !!b.on, by: b.by || '', at: b.at || 0 }); blockTick(); }).catch(() => { }); }
      const b = blockState();
      if (!b.on) { if (blkHost) { blkHost.remove(); blkHost = null; } return; }
      document.querySelectorAll('video,audio').forEach(m => { try { if (!m.paused) m.pause(); m.muted = true; } catch (e) { } });
      if (blkHost && document.documentElement.contains(blkHost)) return;
      blkHost = document.createElement('div'); blkHost.id = 'ileva-bloqueio';
      blkHost.style.cssText = 'position:fixed;inset:0;z-index:2147483647';
      const sr = blkHost.attachShadow({ mode: 'open' });
      const site = /spotify/i.test(location.hostname) ? 'Spotify' : 'YouTube';
      setHTML(sr, `<style>
        .b{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#07030f 0%,#110726 38%,#1f0b48 72%,#33136e 100%);font-family:Inter,"Segoe UI",system-ui,sans-serif;color:#e7e9ee;text-align:center}
        .c{max-width:560px;padding:0 24px}.lg{width:52px;height:52px;display:inline-block;filter:brightness(1.9) saturate(1.2) drop-shadow(0 0 10px rgba(192,107,255,.5))}.lg svg{width:100%;height:100%}
        .ic{width:84px;height:84px;margin:26px auto 0;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(139,92,246,.14);border:1px solid rgba(192,107,255,.35);color:#d9c9ff}
        h1{font-size:34px;margin:22px 0 0;font-weight:700;letter-spacing:-.5px}p{font-size:17px;color:#aab3c2;line-height:1.5;margin:12px 0 0}
        .by{font-size:13px;color:#6f7a8c;margin-top:18px}a{display:inline-block;margin-top:28px;background:#7c4ddb;color:#fff;text-decoration:none;font-weight:600;padding:14px 26px;border-radius:12px;box-shadow:0 10px 30px rgba(124,77,219,.35)}
      </style><div class="b"><div class="c"><span class="lg">${logoShine()}</span>
        <div class="ic"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></svg></div>
        <h1>${site} bloqueado</h1><p>O gestor bloqueou o YouTube e o Spotify neste momento. Volte ao WhatsApp para continuar os atendimentos.</p>
        <div class="by">Bloqueado${b.by ? ' por ' + b.by.replace(/[<>&]/g, '') : ''}${b.at ? ' às ' + hhmm(b.at) : ''} · Supervisor Ileva</div>
        <a href="https://web.whatsapp.com/">Voltar ao WhatsApp</a></div></div>`);
      document.documentElement.append(blkHost);
    } catch (e) { }
  }
  function hmClose() { try { panel.querySelectorAll('.hmenu.show').forEach(m => m.classList.remove('show')); } catch (e) { } }
  function applyHeaderIcons() {
    try {
      panel.querySelectorAll('button.mi[data-i]').forEach(b => { if (b.dataset.done) return; b.dataset.done = '1'; const t = b.textContent; b.textContent = ''; const ic = document.createElement('span'); setHTML(ic, icoSvg(b.dataset.i, 16)); b.append(ic, t); });
      blockLabelRefresh();
      if (!panel.dataset.hm) { panel.dataset.hm = '1'; panel.addEventListener('pointerdown', e => { if (!e.composedPath().some(n => n.classList && n.classList.contains('hmw'))) hmClose(); }); }
      const map = [['Fazer ronda', 'ronda'], ['Copiar relatório', 'relatorio'], ['Copiar dados para análise', 'claude'], ['Transparência', 'transp'], ['Largura', 'largura'], ['Configurações', 'config'], ['Pausa para o almoço', 'almoco'], ['Mais opções', 'mais'], ['Minimizar', 'minimizar']];
      panel.querySelectorAll('button.ic').forEach(b => { const m = map.find(([t]) => (b.title || '').startsWith(t)); if (m) { setHTML(b, icoSvg(m[1])); b.setAttribute('aria-label', b.title); } });
      const tb = panel.querySelector('.ttl b');
      if (tb && /^🛡️\s*/.test(tb.textContent)) { const txt = tb.textContent.replace(/^🛡️\s*/, ''); tb.textContent = ''; const ic = document.createElement('span'); ic.className = 'brand lgb'; setHTML(ic, logoShine()); tb.append(ic, txt); }
    } catch (e) { }
  }
  let opEl, mascot, lastSt = null, mascMood = '', mascText = '', mascBubbleT = 0;
  // mascote 3D (imagem enviada pela Ileva) com os acessórios do desenho por cima: gorro, sirene, fone, relógio, brilhos
  const MASCOT_RIG = ''; // mascote removido na v8.3.0
  function mascotHTML() { return ''; }
  function mascotRebuild() { if (!mascot) return; [...mascot.children].forEach(c => { if (!c.classList.contains('mbub') && !c.classList.contains('xfx')) c.remove(); }); setHTML(mascot, mascotHTML(), 'beforeend'); mascMood = ''; updateMascot(); }
  const MASCOT_SVG = ''; // mascote removido na v8.3.0
  function mascotTalkCalc(now, st, mood) {
    const atFab = !ui.open;
    const canTalk = atFab && !['meetSoon', 'meetNow', 'run', 'happy', 'live'].includes(mood) && !shadow.querySelector('.wel'); // não fala por trás da tela de boas-vindas
    const waiting = (st && st.open) ? st.open.filter(g => g.approx || g.wait >= BUB_MIN_WAIT) : [];
    const today = isoDay(new Date(now));
    const upMeets = meets.filter(m => !m.del && !m.fin && !m.done && m.ts - now > MEET_BEFORE && isoDay(new Date(m.ts)) === today).sort((p, q) => p.ts - q.ts);
    if (!upMeets.length) meetBubNextAt = 0;
    if (!waiting.length) bubNextAt = 0;
    if (!canTalk) bubUntil = 0;
    else if (now >= bubUntil) {
      const rxs = rxPendingSlot(now), rxu = rxs ? null : rxUpcoming(now);
      if (!rxs) rxNextAt = 0;
      if (!rxu) rxPreNextAt = 0;
      if (rxu && now >= rxPreNextAt) { bubKind = 'rxpre'; bubName = rxu; bubUntil = now + RX_SHOW; rxPreNextAt = now + 5 * MIN; }
      else
      if (rxs && now >= rxNextAt) {
        bubKind = 'rx'; bubName = rxs; bubUntil = now + RX_SHOW; rxNextAt = now + RX_EVERY;
        if (rxSlotShown !== rxs + dayKey()) { rxSlotShown = rxs + dayKey(); beep(false); try { const rp = rxResp(now, rxs); if (IS_WA && 'Notification' in window && Notification.permission === 'granted') ilevaNotif('🩻 Hora do Raio-X das ' + rxs + (rp ? ' — ' + rp : ''), { body: 'Abra o Supervisor > aba Raio-X, preencha e envie para o MeisterTask.', tag: 'ileva-rx' }); } catch (e) { } }
      }
      else if (cobPending(now) && now >= cobNextAt) {
        bubKind = 'cob'; bubName = cobPending(now); bubUntil = now + RX_SHOW; cobNextAt = now + COB_EVERY;
        if (cobNotified !== dayKey()) { cobNotified = dayKey(); beep(false); try { if (IS_WA && 'Notification' in window && Notification.permission === 'granted') ilevaNotif('💰 Dia de cobrança — ' + bubName, { body: 'Realize a cobrança dos clientes na parte da manhã. Card DIA DE COBRANÇA no MeisterTask.', tag: 'ileva-cob' }); } catch (e) { } }
      }
      else if (afterHoursPending().length && now >= ahNextAt && inBiz(now)) { bubKind = 'after'; bubUntil = now + RX_SHOW; ahNextAt = now + 10 * MIN; }
      else if (upMeets.length && now >= meetBubNextAt) { bubKind = 'meet'; bubName = upMeets[0].id; bubUntil = now + BUB_SHOW; meetBubNextAt = now + BUB_MEET_EVERY; if (bubNextAt && bubNextAt < bubUntil + 5000) bubNextAt = bubUntil + 5000; }
      else if (waiting.length && now >= bubNextAt) { bubKind = 'cli'; bubIdx = (bubIdx + 1) % waiting.length; bubName = waiting[bubIdx].name; bubUntil = now + BUB_SHOW; bubNextAt = now + BUB_SHOW + BUB_EVERY; }
      else if (xmasDays(now) !== null && now >= xmasNextAt) { bubKind = 'xmas'; xmasNextAt = now + XMAS_EVERY; bubUntil = sleighFly(xmasDays(now)) ? now + 11200 + XMAS_SHOW : now + XMAS_SHOW; }
    }
    let content = null, key = '', gSel = null;
    if (canTalk && now < bubUntil) {
      if (bubKind === 'meet') {
        const m = meets.find(x => x.id === bubName) || upMeets[0];
        if (m && !m.fin && !m.del) {
          key = 'm|' + m.id + '|' + Math.ceil((m.ts - now) / MIN);
          content = () => [h('b', { class: 'att' }, '📅 Atenção' + (m.resp ? ', ' + m.resp : '') + '!'), ' A reunião agendada com o cliente ', h('b', {}, m.cliente), ` inicia em ${fmtDur(Math.max(0, m.ts - now) + MIN - 1)} (às ${hhmm(m.ts)}).`];
        }
      } else if (bubKind === 'after') {
        const L = afterHoursPending();
        if (L.length) {
          key = 'a|' + L.map(g => g.name).join(',');
          const nomes = L.slice(0, 4).map(g => clientLabel(g.name)).join(', ') + (L.length > 4 ? ` e mais ${L.length - 4}` : '');
          content = () => [h('b', { class: 'att' }, '🌙 Fora do expediente!'), ` ${L.length} atendimento${L.length > 1 ? 's chegaram' : ' chegou'} depois do horário e ${L.length > 1 ? 'estão' : 'está'} sem resposta: `, h('b', {}, nomes), '.'];
        }
      } else if (bubKind === 'cob') {
        const resp = cobPending(now);
        if (resp) {
          const fim = new Date(now).getHours() >= 11;
          key = 'b|' + resp + '|' + fim;
          content = () => fim
            ? [h('b', { class: 'att' }, '💰 ' + resp + ', a manhã está acabando!'), ' A ', h('b', {}, 'cobrança de hoje'), ' ainda não foi marcada como feita. Clique aqui.']
            : [h('b', { class: 'att' }, '💰 Hoje é seu dia de cobrança, ' + resp + '!'), ' Cobre os clientes (documentação, tarefas, treinamento) ainda pela manhã. Clique aqui ao terminar.'];
        }
      } else if (bubKind === 'rxpre') {
        const resp = rxResp(now, bubName), falta = Math.max(1, Math.ceil((slotTs(bubName, now) - now) / MIN));
        key = 'p|' + bubName + '|' + falta;
        content = () => [h('b', { class: 'att' }, '⏰ Raio-X daqui a ' + falta + ' min!'), ' Às ', h('b', {}, bubName), ' é a vez ', resp ? h('span', {}, 'do(a) ', h('b', {}, resp)) : 'do responsável', '.'];
      } else if (bubKind === 'rx') {
        const late = now - slotTs(bubName, now) > 2 * 60 * 1000, resp = rxResp(now, bubName);
        key = 'r|' + bubName + '|' + late;
        content = () => late
          ? [h('b', { class: 'att' }, '🩻 Lembrete' + (resp ? ', ' + resp : '') + '!'), ' O ', h('b', {}, 'Raio-X das ' + bubName), ' ainda não foi feito. Clique aqui para fazer agora.']
          : [h('b', { class: 'att' }, '🩻 Hora do Raio-X' + (resp ? ', ' + resp : '') + '!'), ' São ', h('b', {}, bubName), '. Abra a aba Raio-X, preencha e envie para o MeisterTask. Clique aqui.'];
      } else if (bubKind === 'xmas') {
        const d = xmasDays(now);
        if (d !== null) {
          key = 'x|' + d;
          content = () => d === 0
            ? [h('b', { class: 'att' }, '🎄 Feliz Natal!'), ' Ho ho ho! Um ótimo Natal para toda a equipe Ileva! ✨']
            : [h('b', { class: 'att' }, '🎄 Ho ho ho!'), d === 1 ? ' Falta ' : ' Faltam ', h('b', { class: 'xd' }, d === 1 ? '1 dia' : d + ' dias'), ' para o Natal! ✨'];
        }
      } else {
        const g = waiting.find(x => x.name === bubName) || waiting[0];
        gSel = g;
        if (g) {
          key = 'c|' + g.name + '|' + Math.floor(g.wait / MIN);
          content = () => [h('b', { class: 'att' }, '⚠️ Atenção!'), ' Cliente ', h('b', {}, clientLabel(g.name)), ` está aguardando há ${g.approx ? 'mais de ' : ''}${fmtDur(g.wait)}.`];
        }
      }
    }
    return { content, key, g: gSel };
  }
  // ---- Modo corporativo: avisos no canto (mesmas regras dos balões do mascote)
  let ctoastEl = null, ctoastKey = '', ctoastSnooze = {};
  const CT_ICO = { alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', pulse: '<path d="M3 12h4l2-6 4 12 2-6h6"/>', check: '<path d="M20 6 9 17l-5-5"/>', moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>' };
  function ctoastHide() { if (ctoastEl && ctoastEl.classList.contains('show') && !ctoastEl.classList.contains('out')) { ctoastEl.classList.add('out'); setTimeout(() => { if (ctoastEl) ctoastEl.classList.remove('show', 'out'); }, 300); } ctoastKey = ''; }
  function ctoastPlace() {
    if (!ctoastEl || !fab) return;
    const r = (fab.style.display !== 'none' && fab.offsetWidth) ? fab.getBoundingClientRect() : null;
    const W = Math.min(360, VW() - 24);
    let right = r ? Math.max(12, VW() - r.right) : 18, bottom = r ? Math.max(12, VH() - r.top + 10) : 18;
    if (ui.open && panel && panel.offsetWidth) { right = panel.offsetWidth + 14; bottom = 18; } else bottom += pqH();
    ctoastEl.style.right = right + 'px'; ctoastEl.style.bottom = bottom + 'px'; ctoastEl.style.width = W + 'px';
  }
  function ctoastShow(kind, key, nodes, extra) {
    if (!shadow) return;
    if (!ctoastEl || !shadow.contains(ctoastEl)) { ctoastEl = h('div', { class: 'ctoast' }); shadow.append(ctoastEl); }
    ctoastPlace();
    if (key === ctoastKey && ctoastEl.classList.contains('show')) return;
    ctoastKey = key;
    const tmp = h('div', {}, ...nodes);
    const first = tmp.firstChild && tmp.firstChild.nodeType === 1 ? tmp.firstChild : null;
    let title = first ? first.textContent : '', body = (tmp.textContent || '').slice(title.length);
    title = noEmoji(title).replace(/[!:]+\s*$/, '').trim(); body = body.replace(/\s*Clique aqui[^.]*\.?/gi, '').trim();
    const ico = { cli: 'alert', meet: 'clock', rx: 'pulse', rxpre: 'pulse', cob: 'check', after: 'moon' }[kind] || 'alert';
    const bg = { cli: extra && extra.soft ? '#f4c060' : '#ef5b6b', meet: '#8b5cf6', rx: '#7c4ddb', rxpre: '#7c4ddb', cob: '#2fbf71', after: '#4aa3ff' }[kind] || '#8b5cf6';
    const lq = h('div', { class: 'lgq' }); const lgS = h('span', { class: 'lg' }); setHTML(lgS, LOGO_SVG.replace(/ilvLg/g, 'ilvLgT')); lq.append(lgS);
    const bd = h('span', { class: 'bdg', style: 'background:' + bg }); setHTML(bd, `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${CT_ICO[ico]}</svg>`); lq.append(bd);
    const btns = (extra && extra.btns || []).map((b, i) => h('button', { class: 'cb' + (i === 0 ? ' pri' : ''), onclick: e => { e.stopPropagation(); try { b[1](); } catch (er) { } ctoastHide(); } }, b[0]));
    ctoastEl.className = 'ctoast show k-' + kind + (extra && extra.soft ? ' soft' : '');
    ctoastEl.replaceChildren(lq, h('div', { style: 'flex:1;min-width:0' }, h('div', { class: 'who2' }, 'Supervisor Ileva · agora'), h('div', { class: 'tt' }, title), body ? h('div', { class: 'tx' }, body) : null, btns.length ? h('div', { class: 'bb' }, btns) : null),
      h('button', { class: 'cx', title: 'Fechar', onclick: e => { e.stopPropagation(); ctoastSnooze[kind] = Date.now() + 5 * MIN; ctoastHide(); } }, '×'));
  }
  function corpTalk(now, st, mood) {
    try {
      // mesmas regras dos balões: reaproveita o cálculo do mascote
      const res = mascotTalkCalc(now, st, mood);
      if (!res || !res.content || (ctoastSnooze[bubKind] && now < ctoastSnooze[bubKind])) { ctoastHide(); return; }
      const open = () => { if (!IS_WA) { try { window.focus(); } catch (e) { } return; } setOpen(true); };
      let extra = {};
      if (bubKind === 'cli' && pqEl && pqEl.classList.contains('show')) { ctoastHide(); return; }
      if (bubKind === 'cli') { const g = res.g; extra = { soft: g && g.level !== 'red', btns: [['Abrir conversa', () => { if (IS_WA && g) openChat(g.name); else open(); }], ['Depois', () => { ctoastSnooze.cli = Date.now() + 5 * MIN; }]] }; }
      else if (bubKind === 'meet') extra = { btns: [['Ver reunião', () => { open(); if (IS_WA) setTab('reun'); }]] };
      else if (bubKind === 'rx' || bubKind === 'rxpre') extra = { btns: [['Fazer Raio-X', () => { open(); if (IS_WA) setTab('rx'); }], ['Depois', () => { ctoastSnooze[bubKind] = Date.now() + 5 * MIN; }]] };
      else if (bubKind === 'cob') extra = { btns: [['Feito', () => markCobDone(true)], ['Abrir card', () => { try { window.open(cobCfg().url, '_blank'); } catch (e) { } }]] };
      else if (bubKind === 'after') extra = { btns: [['Ver lista', () => { open(); if (IS_WA) setTab('atend'); }]] };
      else if (bubKind === 'xmas') { ctoastHide(); return; } // no corporativo o Natal fica só no trenó
      let nodes = res.content();
      if (bubKind === 'cli' && res.g) { const g = res.g, lr = g.lastRel || (g.pend && g.pend[0]); nodes = [h('b', {}, `Cliente aguardando há ${g.approx ? 'mais de ' : ''}${fmtDur(g.wait)}`), `${clientLabel(g.name)}${lr && lr.sender ? ' · última mensagem de ' + shortName(lr.sender) + (lr.ts ? ' às ' + hhmm(lr.ts) : '') : ''}`]; }
      else if (bubKind === 'meet') { const m = meets.find(x => x.id === bubName); if (m) nodes = [h('b', {}, `Reunião hoje às ${hhmm(m.ts)}`), `${m.cliente}${m.resp ? ' · com ' + m.resp : ''} · faltam ${fmtDur(Math.max(0, m.ts - now) + MIN - 1)}`]; }
      ctoastShow(bubKind, res.key, nodes, extra);
    } catch (e) { }
  }
  // ---- Modo corporativo: fila de prioridade fixa acima da barra (substitui o balão constante do mascote)
  let pqEl = null, pqSig = '';
  function pqHide() { if (pqEl) pqEl.classList.remove('show'); pqSig = ''; }
  function pqUpdate(now, st) {
    try {
      if (!shadow || !fab) return;
      const fabVis = fab.style.display !== 'none' && fab.offsetWidth;
      const list = (st && st.open || []).slice().sort((a, b) => (b.level === 'red') - (a.level === 'red') || (b.wait || 0) - (a.wait || 0));
      if (!isCorp() || ui.open || ui.mini || !fabVis || !list.length || lunchOn()) { pqHide(); return; }
      if (pipWin && pipPref().modo === 'aviso' && !list.some(g => g.level === 'red')) { pqHide(); return; }
      if (!pqEl || !shadow.contains(pqEl)) { pqEl = h('div', { class: 'pq' }); pqEl.addEventListener('wheel', e => wheelOp(e, 'pqOp', pqEl), { passive: false }); shadow.append(pqEl); pqSig = ''; applyOp(); }
      const reds = list.filter(g => g.level === 'red').length, nome = (userNome() || '').split(' ')[0];
      const tm = g => (g.approx ? '+' : '') + fmtDur(g.wait || 0);
      const sig = list.slice(0, 4).map(g => g.name + '|' + g.level + '|' + tm(g)).join(';') + '#' + list.length + nome;
      if (sig !== pqSig) {
        pqSig = sig;
        const head = reds ? `${nome ? nome + ', ' : ''}${reds} cliente${reds > 1 ? 's' : ''} aguardando resposta` : `${list.length} atendimento${list.length > 1 ? 's' : ''} em aberto`;
        const rows = list.slice(0, 4).map(g => {
          const lr = g.lastRel || (g.pend && g.pend[0]);
          return h('div', { class: 'pr ' + (g.level || 'green'), title: 'Abrir conversa', onclick: e => { e.stopPropagation(); if (IS_WA) openChat(g.name); else { try { window.focus(); } catch (er) { } } } },
            h('div', { class: 'pn' }, clientLabel(g.name), lr && lr.sender ? h('em', {}, 'última de ' + shortName(lr.sender) + (lr.ts ? ' às ' + hhmm(lr.ts) : '')) : null),
            h('span', { class: 'pt' }, tm(g)));
        });
        pqEl.className = 'pq show' + (reds ? ' r' : '');
        pqEl.replaceChildren(...[h('div', { class: 'ph' }, h('span', { class: 'pd' }), h('b', {}, head), h('small', {}, 'prioridade')), ...rows,
          list.length > 4 ? h('div', { class: 'pm', onclick: e => { e.stopPropagation(); if (IS_WA) { setOpen(true); setTab('atend'); } } }, `+ ${list.length - 4} outro${list.length - 4 > 1 ? 's' : ''} em aberto · ver todos`) : null].filter(Boolean));
      }
      const r = fab.getBoundingClientRect();
      pqEl.style.width = Math.min(310, VW() - 24) + 'px';
      pqEl.style.right = Math.max(12, VW() - r.right) + 'px';
      pqEl.style.bottom = Math.max(12, VH() - r.top + 10) + 'px';
    } catch (e) { }
  }
  const pqH = () => (pqEl && pqEl.classList.contains('show') ? pqEl.offsetHeight + 10 : 0);
  function corpApply() {
    if (!host) return;
    host.classList.toggle('corp', isCorp());
    mascMood = ''; ctoastHide(); meetKey = '';
    try { render(true); updateMascot(); meetTick(); } catch (e) { }
  }
  // ------------------------------------------------------------------ MASCOTE (reage aos alertas e acompanha o botão / o alerta de reunião)
  function updateMascot() {
    try {
      if (!mascot || !fab) return;
      const corp = isCorp();
      const on = ui.mascot !== false && !ui.mini && !corp;
      mascot.style.display = on ? 'block' : 'none';
      if (!on && !(corp && !ui.mini)) { ctoastHide(); pqHide(); return; }
      if (corp) pqUpdate(Date.now(), lastSt); else pqHide();
      const now = Date.now(), act = activeMeets(now), st = lastSt;
      const mf = act.find(m => m.fin), mlive = act.find(m => !m.fin && m.live), mnow = act.find(m => !m.fin && !m.live && now >= m.ts && now <= m.ts + MEET_AFTER && !m.ack),
        msoon = act.find(m => !m.fin && !m.live && now < m.ts), mrun = act.find(m => !m.fin && !m.live && now >= m.ts);
      const reds = st ? st.reds.length : 0, open = st ? st.open.length : 0;
      let mood, text;
      if (mf) { mood = 'happy'; text = `✅ Reunião com ${mf.cliente} finalizada!`; }
      else if (mlive) { mood = 'live'; text = `🎥 Reunião com ${mlive.cliente} acontecendo`; }
      else if (mnow) { mood = 'meetNow'; text = `📅 Reunião com ${mnow.cliente} começou!`; }
      else if (msoon) { mood = 'meetSoon'; text = `⏰ ${fmtCountdown(msoon.ts - now).replace('faltam ', '')} para a reunião`; }
      else if (reds) { mood = 'alarm'; text = `🚨 ${reds} cliente${reds > 1 ? 's' : ''} esperando há +15 min!`; }
      else if (now < cheerUntil) { mood = 'cheer'; text = '👏 Atendimento finalizado!'; }
      else if (mrun) { mood = 'run'; text = `🟢 Reunião em andamento`; }
      else if (open) { mood = 'attentive'; text = `👀 ${open} atendimento${open > 1 ? 's' : ''} em aberto`; }
      else { mood = 'calm'; text = '😊 Tudo em dia!'; }
      const bub = mascot.firstChild;
      if (corp) { mascMood = mood; return corpTalk(now, st, mood); }
      if (mood !== mascMood) { mascot.className = 'masc m-' + mood; mascMood = mood; }
      if (text !== mascText) { mascot.title = text + ' (clique para abrir)'; mascText = text; }
      // posição: ao lado do alerta de reunião (se estiver na tela), senão ao lado do botão / do painel
      const S = 90;
      let x, y, op = opOf('fabOp'), flip = false;
      if (false) { // (antes ficava ao lado do alerta de reunião; agora fica sempre em cima da barra do Supervisor)
        const r = meetBar.getBoundingClientRect(); op = opOf('meetOp');
        const first = meetBar.firstElementChild ? meetBar.firstElementChild.getBoundingClientRect() : r;
        // lado esquerdo da barra, virado para ela (se não couber, vai para a direita)
        y = first.top + first.height / 2 - S / 2 - 2;
        x = r.left - S - 16; flip = false;
        if (x < 4) { x = r.right + 16; flip = true; }
      } else if (ui.open && panel && panel.offsetWidth) {
        const r = panel.getBoundingClientRect(); x = r.left - S - 6; y = VH() - S - 14;
      } else {
        // em pé em cima da barra do Supervisor, no canto esquerdo dela
        const r = fab.getBoundingClientRect();
        x = r.right - S - 6; y = r.top - S + 4; flip = false; // pés apoiados no anel roxo
        if (y < 4) y = r.bottom - 6;
      }
      x = Math.min(Math.max(4, x), VW() - S - 4); y = Math.min(Math.max(4, y), VH() - S - 4);
      mascot.style.left = Math.round(x) + 'px'; mascot.style.top = Math.round(y) + 'px';
      mascot.style.setProperty('--op', op);
      mascot.classList.toggle('flip', flip); // de frente para a barra
      // balão do lado de dentro da tela
      // balão de fala: aparece por alguns segundos e volta de tempos em tempos
      //  - reunião de hoje que ainda vai começar (antes do alerta de 10 min): a cada 5 min
      //  - cliente aguardando há mais de 5 min: a cada 2 min
      const { content, key } = mascotTalkCalc(now, st, mood);
      if (content) {
        if (bub.dataset.k !== key) { bub.dataset.k = key; bub.replaceChildren(...content()); }
        bub.classList.toggle('meet', bubKind === 'meet');
        bub.classList.toggle('rxr', bubKind === 'rx' || bubKind === 'rxpre');
        bub.classList.toggle('night', bubKind === 'after');
        bub.classList.toggle('cob', bubKind === 'cob');
        bub.classList.toggle('xmas', bubKind === 'xmas');
        if (bubKind === 'xmas') xmasFx(true);
        if (bub.style.display !== 'block') { bub.style.display = 'block'; bub.classList.remove('out'); }
      }
      if (!content || bubKind !== 'xmas') xmasFx(false);
      if (!content && bub.style.display === 'block' && !bub.classList.contains('out')) {
        bub.classList.add('out'); setTimeout(() => { if (bub.classList.contains('out')) { bub.style.display = 'none'; bub.classList.remove('out'); } }, 350);
      }
      bub.classList.toggle('below', y < 90);
      bub.classList.toggle('lft', x < 250);
    } catch (e) { }
  }
  let host, shadow, fab, panel, bodyEl, statusEl, chipsEl, tabsEl, roundEl, view = 'main';
  function mountUI() {
    if (host && (document.documentElement.contains(host) || (pipWin && pipWin.document.body.contains(host)))) return;
    host = h('div', { id: 'ileva-supervisor-host' });
    shadow = host.attachShadow({ mode: 'open' });
    let styled = false;
    try { const sheet = new CSSStyleSheet(); sheet.replaceSync(CSS); shadow.adoptedStyleSheets = [sheet]; styled = true; } catch (e) { }
    if (!styled) { const s = document.createElement('style'); s.textContent = CSS; shadow.append(s); }
    fab = h('button', { class: 'fab', title: 'Abrir o Supervisor de Atendimento (arraste para mudar de lugar)', onclick: () => { if (fabDragged) { fabDragged = false; return; } if (ui.mini) { setMini(false); return; } if (!IS_WA) { satHint(fab); return; } if (pipWin) { setOpen(!ui.open); return; } setOpen(true); } });
    fab.addEventListener('pointerdown', fabDown);
    placeFab();
    statusEl = h('small', {});
    opEl = buildOpacityBox();
    chipsEl = h('div', { class: 'chips' });
    tabsEl = h('div', { class: 'tabs' });
    roundEl = h('div', { class: 'round', style: 'display:none' });
    bodyEl = h('div', { class: 'bd' });
    panel = h('div', { class: 'panel', style: 'display:none' },
      h('div', { class: 'hd' },
        h('div', { class: 'ttl' },
          h('div', {}, h('b', {}, '🛡️ Alertas Ileva'), statusEl),
          h('div', { class: 'icons' },
            !pode('ronda') ? null : h('button', { class: 'ic', title: 'Fazer ronda agora (lê o histórico dos grupos com atividade recente)', onclick: () => { if (rounding) abortRound = true; else round(true); } }, '🔄'),
            h('button', { class: 'ic', title: 'Pausa para o almoço (1h15)', onclick: () => lunchStart() }, '🍽️'),
            h('div', { class: 'hmw' },
              h('button', { class: 'ic', title: 'Mais opções', onclick: e => { e.stopPropagation(); const m = e.currentTarget.nextSibling; m.classList.toggle('show'); } }, '⋯'),
              h('div', { class: 'hmenu' },
            h('button', { class: 'mi', 'data-i': 'transp', title: 'Transparência do botão do Supervisor e do alerta de reunião', onclick: () => { opEl.style.display = opEl.style.display === 'none' ? 'block' : 'none'; hmClose(); } }, 'Transparência e exibição'),
            h('button', { class: 'mi', 'data-i': 'sol', title: 'Mostrar a tela de bom dia', onclick: () => { hmClose(); setOpen(false); showWelcome(); } }, 'Ver tela de bom dia'),
            h('button', { class: 'mi', 'data-i': 'transp', title: 'Abre a barra, a fila e os avisos numa janela que fica por cima de qualquer programa, mesmo com o navegador minimizado', onclick: () => { hmClose(); togglePip(); } }, 'Janela flutuante (por cima de tudo)'),
            h('button', { class: 'mi', 'data-i': 'transp', title: 'Esconde o Supervisor em todas as abas e na janela flutuante, para tirar print ou gravar a tela. Atalho: Ctrl+Shift+9 (de novo para mostrar)', onclick: () => { hmClose(); esconderPor(5); } }, 'Esconder por 5 minutos (Ctrl+Shift+9)'),
            h('button', { class: 'mi', 'data-i': 'largura', title: 'Largura do painel', onclick: () => { const i = WIDTHS.indexOf(ui.width); ui.width = WIDTHS[(i + 1) % WIDTHS.length]; saveUi(); render(true); } }, 'Largura do painel'),
            IS_EXT ? h('button', { class: 'mi', 'data-i': 'config', title: 'Abrir a página de Configurações da extensão', onclick: () => { hmClose(); try { chrome.runtime.sendMessage({ t: 'ilv-open-options' }); } catch (e) { } } }, 'Página de Configurações') : null,
              )),
            h('button', { class: 'ic', title: 'Minimizar (o WhatsApp volta a ocupar a tela toda)', onclick: () => setOpen(false) }, '—'))),
        opEl, chipsEl, roundEl),
      tabsEl, bodyEl);
    meetBar = h('div', { class: 'meetbar', style: 'display:none', title: 'Arraste para mudar de lugar' }); meetKey = '';
    meetBar.addEventListener('pointerdown', meetDown); placeMeetBar();
    fab.addEventListener('wheel', e => wheelOp(e, 'fabOp', fab), { passive: false });
    meetBar.addEventListener('wheel', e => wheelOp(e, 'meetOp', meetBar), { passive: false });
    applyOp();
    mascot = h('div', { class: 'masc m-calm', title: 'Clique para abrir o Supervisor' }, h('div', { class: 'mbub' }));
    setHTML(mascot, mascotHTML(), 'beforeend');
    mascot.addEventListener('click', () => { if (bubKind === 'cob' && Date.now() < bubUntil) { if (!IS_WA) { satHint(mascot, 'Abra a aba do WhatsApp > Supervisor > 🩻 Raio-X > 💰 Dia de cobrança'); return; } bubUntil = 0; setOpen(true); setTab('rx'); return; } if (bubKind === 'rx' && Date.now() < bubUntil) { if (!IS_WA) { satHint(mascot, 'Abra a aba do WhatsApp > Supervisor > 🩻 Raio-X'); return; } bubUntil = 0; setOpen(true); setTab('rx'); return; } if (meetMinOn() && meetBar && meetBar.style.display !== 'none') setMeetMin(false); else if (!IS_WA) satHint(mascot); else setOpen(true); });
    shadow.append(fab, panel, meetBar); // mascote removido
    host.classList.toggle('corp', isCorp());
    applyHeaderIcons();
    document.body.append(host);
    fsFix();
  }
  // ------------------------------------------------------------------ TRANSPARÊNCIA (botão do Supervisor e alerta de reunião)
  // Fica transparente onde estiver; ao passar o mouse volta a ficar 100% visível. Ajuste: botão 🌓 do painel ou rodinha do mouse.
  const opOf = k => { const v = Number(ui[k]); return v >= 0.15 && v <= 1 ? v : 1; };
  function applyOp() {
    if (fab) fab.style.setProperty('--op', opOf('fabOp'));
    if (meetBar) meetBar.style.setProperty('--op', opOf('meetOp'));
    if (pqEl) pqEl.style.setProperty('--op', opOf('pqOp'));
  }
  let opTipT = 0;
  function opTip(el, v) {
    let t = shadow.querySelector('.optip');
    if (!t) { t = h('div', { class: 'optip' }); shadow.append(t); }
    const r = el.getBoundingClientRect();
    t.textContent = `Visibilidade: ${Math.round(v * 100)}%`;
    t.style.left = Math.max(4, Math.min(VW() - 150, r.left)) + 'px';
    t.style.top = (r.top > 40 ? r.top - 30 : r.bottom + 6) + 'px';
    t.style.display = 'block';
    clearTimeout(opTipT); opTipT = setTimeout(() => { t.style.display = 'none'; el.classList.remove('adj'); }, 1500);
  }
  function setOp(k, v, el) {
    v = Math.round(Math.min(1, Math.max(0.15, v)) * 100) / 100;
    ui[k] = v; saveUi(); applyOp();
    if (el) { el.classList.add('adj'); opTip(el, v); }
    if (opEl) opEl.querySelectorAll('input[data-k]').forEach(i => { if (i.dataset.k === k) { i.value = Math.round(v * 100); i.nextSibling.textContent = Math.round(v * 100) + '%'; } });
  }
  function wheelOp(e, k, el) { e.preventDefault(); setOp(k, opOf(k) + (e.deltaY > 0 ? -0.1 : 0.1), el); }
  function buildOpacityBox() {
    const row = (k, label) => {
      const val = h('span', { class: 'opv' }, Math.round(opOf(k) * 100) + '%');
      const r = h('input', { type: 'range', min: '15', max: '100', step: '5', value: String(Math.round(opOf(k) * 100)), 'data-k': k });
      r.addEventListener('input', () => setOp(k, r.value / 100, k === 'fabOp' ? fab : k === 'pqOp' ? (pqEl && pqEl.classList.contains('show') ? pqEl : null) : (meetBar && meetBar.style.display !== 'none' ? meetBar : null)));
      return h('div', { class: 'oprow' }, h('span', { class: 'opl' }, label), r, val);
    };
    return h('div', { class: 'opbox', style: 'display:none' },
      row('fabOp', 'Botão do Supervisor'), row('pqOp', 'Fila de prioridade'), row('meetOp', 'Alerta de reunião'),
      (() => { const c = h('input', { type: 'checkbox', checked: saverHere(), 'data-ssv': '1' }); c.addEventListener('change', () => setSaverHere(c.checked)); return h('label', { class: 'chk', style: 'margin:6px 0 2px', title: 'A tela de bom dia aparece depois de 5 min sem mexer no mouse/teclado. Desmarque no monitor onde roda vídeo.' }, c, ' Proteção de tela neste monitor (bom dia após 5 min parado)'); })(),
      (() => { const c = h('input', { type: 'checkbox', checked: meetSoundOn(), 'data-snd': '1' }); c.addEventListener('change', () => setMeetSound(c.checked)); return h('label', { class: 'chk', style: 'margin:6px 0 2px' }, c, ' Som dos alertas (atendimentos, reuniões, Raio-X, tarefas, lembretes e almoço)'); })(),
      (() => {
        if (EQUIPE) { miniInfoEl = h('div', { class: 'who', style: 'margin:8px 0 2px' }); miniInfoPaint(); return miniInfoEl; }
        const sel = h('select', { style: 'margin-left:6px;background:#1d2532;border:1px solid #2a3442;border-radius:6px;color:#e7e9ee;padding:3px 6px' }, MINI_OPTS.map(v => h('option', { value: String(v), selected: miniMax() === v * MIN }, v < 60 ? v + ' min' : '1 hora')));
        sel.addEventListener('change', async () => {
          ui.miniMin = Number(sel.value); ui.miniMinAt = Date.now(); saveUi(); syncMini(); try { render(false); } catch (e) { }
          try { if (SHARED_URL) { await gmGet({ action: 'cfgset', data: JSON.stringify({ miniMin: ui.miniMin, miniMinAt: ui.miniMinAt }) }); lastAction = { kind: 'info', key: '', label: `Tempo de minimizar: ${ui.miniMin} min, enviado para toda a equipe (chega em até 1 minuto).`, at: Date.now() }; render(true); } } catch (e) { }
        });
        return h('label', { class: 'chk', style: 'margin:8px 0 2px' }, 'Ao minimizar, volta sozinho depois de', sel, h('span', { class: 'who', style: 'margin-left:6px' }, '(vale para toda a equipe)')); })(),
      h('div', { class: 'actions', style: 'margin:6px 0 2px' },
        h('button', { class: 'btn', title: 'Só no monitor onde esta janela está', onclick: () => setMini(true) }, 'Minimizar só nesta tela'),
        h('button', { class: 'btn', title: 'Em todos os monitores', onclick: () => setMini(true, true) }, 'Minimizar em todas as telas')),
      h('div', { class: 'who' }, 'Dica: também dá para ajustar girando a rodinha do mouse em cima do botão, da fila de prioridade ou do alerta. Ao passar o mouse, ele volta a ficar 100% visível.'));
  }
  // posição do botão minimizado: arrastável e salva (padrão: acima da caixa de mensagem, sem cobrir o botão de enviar)
  let fabDragged = false;
  function placeFab() {
    if (!fab) return;
    if (pipWin) { fab.style.right = ''; fab.style.bottom = ''; return; } // na janela flutuante a posição é fixa
    const p = posGet('fabPos');
    if (!p) { fab.style.right = ''; fab.style.bottom = ''; return; }
    const w = fab.offsetWidth || 220, hh = fab.offsetHeight || 40;
    const r = Math.min(Math.max(4, p.right), Math.max(4, VW() - w - 4));
    const b = Math.min(Math.max(4, p.bottom), Math.max(4, VH() - hh - 4));
    fab.style.right = r + 'px'; fab.style.bottom = b + 'px';
  }
  function fabDown(e) {
    if (pipWin) return;
    if (e.button !== 0) return;
    const rect = fab.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY, r0 = VW() - rect.right, b0 = VH() - rect.bottom;
    let moved = false;
    const mv = ev => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 6) return;
      moved = true; fab.classList.add('drag');
      posSet('fabPos', { right: r0 - dx, bottom: b0 - dy }); placeFab();
    };
    const up = () => {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      fab.classList.remove('drag');
      if (moved) { fabDragged = true; saveUi(); setTimeout(() => { fabDragged = false; }, 300); }
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }
  addEventListener('resize', () => placeFab());
  function setOpen(v) { if (v && 'Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) { } } ui.open = !!v; pipOpenSync(); saveUi(); render(true); }
  function setTab(t, filter) { t = ['reun', 'rx', 'lemb', 'tar', 'chat'].includes(t) ? t : 'atend'; ui.tab = t; ui.filter = filter || null; view = 'main'; saveUi(); render(true); if (bodyEl) bodyEl.scrollTop = 0; }

  // Encolhe o WhatsApp para o painel ficar AO LADO da conversa, sem cobrir nada
  let dockedW = null;
  function applyDock() {
    const app = document.getElementById('app');
    if (!app) return;
    const want = ui.open ? ui.width : null;
    if (want === dockedW && (!want || app.style.width)) return;
    if (want) { app.style.setProperty('width', `calc(100% - ${want}px)`, 'important'); app.style.setProperty('right', 'auto', 'important'); }
    else { app.style.removeProperty('width'); app.style.removeProperty('right'); }
    dockedW = want;
    window.dispatchEvent(new Event('resize'));
  }

  let notified = new Set();
  function notifyReds(st) {
    const keyOf = g => g.name + '|' + (g.pend[0] ? g.pend[0].ts : '');
    if (cfg.notify && 'Notification' in window && Notification.permission === 'granted') {
      st.reds.forEach(g => { if (!notified.has(keyOf(g))) { try { ilevaNotif('🔴 ' + g.name, { body: `${g.clientName} aguardando há ${fmtDur(g.wait)}: ${(g.lastRel.text || '').slice(0, 90)}`, tag: 'ileva-' + g.name }); } catch (e) { } } });
    }
    notified = new Set(st.reds.map(keyOf));
  }

  // ------------------------------------------------------------------ REUNIÕES AGENDADAS (alerta na tela 10 min antes)
  // Cada item: { id, cliente, ts, resp, assunto, ack, done, n10, n0 }
  const LS_MEET = 'ilevaSup.meet.v1';
  // Agenda compartilhada (planilha Google da Ileva). Endereço do "App da Web" do Apps Script:
  const SHARED_URL = 'https://script.google.com/macros/s/AKfycbxSfMpAR30PfPqJs4hbabmQ1NSwqED-njzugGlysOQraIRzg3RhE0LT0jiUnD-pk_De7A/exec';
  const SHARED_KEY = 'E8jLhSxPN7hvnW-PpVzQVNFR';
  let sync = { ok: null, at: 0, err: '', busy: false };
  function gmGet(params) {
    return new Promise((res, rej) => {
      const url = SHARED_URL + '?' + new URLSearchParams(Object.assign({ key: SHARED_KEY, t: Date.now() }, params)).toString();
      const gx = typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : null;
      if (!gx) { rej(new Error('Atualize o script no Tampermonkey (falta permissão de conexão).')); return; }
      gx({ method: 'GET', url, timeout: 20000, anonymous: true,
        onload: r => { try { const j = JSON.parse(r.responseText); j.ok ? res(j) : rej(new Error(j.err || 'erro na planilha')); } catch (e) { rej(new Error('resposta inválida da planilha')); } },
        onerror: () => rej(new Error('sem conexão com a planilha')), ontimeout: () => rej(new Error('a planilha demorou para responder')) });
    });
  }
  const pub = m => ({ id: m.id, cliente: m.cliente, ts: m.ts, resp: m.resp || '', assunto: m.assunto || '', upd: m.upd || 0, del: m.del ? 1 : 0, fin: m.fin || 0, finBy: m.finBy || '', live: m.live || 0 });
  // reunião igual = mesmo id, ou mesmo cliente no mesmo horário (cópia criada pelo painel e outra lida do card)
  const sameMeet = (a, b) => a.id === b.id || (reunNorm(a.cliente) === reunNorm(b.cliente) && Math.abs(a.ts - b.ts) < MIN);
  function meetDelete(m) {
    const now = Date.now();
    for (const x of meets.filter(y => !y.del && sameMeet(y, m))) { if (x !== m && x.mtHead && !m.mtHead) mtReunQueue(x, 'remove'); Object.assign(x, { del: true, pending: !!SHARED_URL, upd: now, done: true }); }
  }
  function meetDedupe() {
    const groups = new Map();
    for (const m of meets) { if (m.del) continue; const k = reunNorm(m.cliente) + '|' + Math.round(m.ts / MIN); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); }
    let ch = false;
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      g.sort((a, b) => (b.fin ? 1 : 0) - (a.fin ? 1 : 0) || (b.live ? 1 : 0) - (a.live ? 1 : 0) || (/^r/.test(b.id) ? 1 : 0) - (/^r/.test(a.id) ? 1 : 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      const keep = g[0];
      for (const m of g.slice(1)) {
        if (m.fin && !keep.fin) { keep.fin = m.fin; keep.finBy = m.finBy; }
        if (m.live && !keep.live) keep.live = m.live;
        if (m.mtHead && !keep.mtHead) keep.mtHead = m.mtHead;
        if (m.ack) keep.ack = true; if (m.n10) keep.n10 = 1; if (m.n0) keep.n0 = 1; if (m.finSeen) keep.finSeen = 1;
        if (m.pending && !keep.pending) keep.pending = true;
        m._dup = 1; ch = true;
      }
    }
    if (ch) { meets = meets.filter(m => !m._dup); meetKey = ''; }
    return ch;
  }
  function mergeRemote(items, dels) {
    // excluídas por outro colaborador: some daqui também (inclusive cópias com outro id)
    if (Array.isArray(dels)) for (const d of dels) {
      if (!d || !d.id) continue;
      for (const m of meets) if (!m.del && sameMeet(m, d) && !(m.pending && (m.upd || 0) > (d.upd || 0))) { Object.assign(m, { del: true, pending: m.id !== d.id && !!SHARED_URL, shared: true, upd: m.id !== d.id ? Date.now() : (d.upd || Date.now()), done: true }); meetKey = ''; } // cópia com outro id: apaga na planilha também
      if (!meets.some(m => m.id === d.id)) meets.push({ id: d.id, cliente: d.cliente, ts: d.ts, del: true, shared: true, upd: d.upd || Date.now(), done: true });
    }
    const byId = new Map(meets.map(m => [m.id, m]));
    const seen = new Set();
    for (const r of items) {
      seen.add(r.id);
      const m = byId.get(r.id);
      if (!m) { if (meets.some(x => x.del && sameMeet(x, r) && (x.upd || 0) >= (r.upd || 0))) continue; const n = Object.assign({ shared: true }, r); if (n.fin) n.finSeen = 1; meets.push(n); continue; }
      if (m.del) continue; // excluída aqui: não ressuscita
      if (m.pending) { if (r.fin && !m.fin) { m.fin = r.fin; m.finBy = r.finBy || ''; m.pending = false; meetFinished(m, false); } continue; } // alteração local ainda não enviada (finalização de outro colaborador vale sempre)
      if (m.ts !== r.ts) Object.assign(m, { ack: false, done: false, n10: 0, n0: 0 });
      const wasFin = m.fin;
      Object.assign(m, { cliente: r.cliente, ts: r.ts, resp: r.resp, assunto: r.assunto, upd: r.upd, shared: true });
      if (r.fin) { m.fin = r.fin; m.finBy = r.finBy || ''; }
      if (r.live && !m.live) { m.live = r.live; m.ack = true; meetKey = ''; meetNotify(m, '🎥 Reunião acontecendo agora'); }
      if (m.fin && !wasFin) meetFinished(m, false); // outro colaborador finalizou
    }
    // cópias da mesma reunião (mesmo cliente e horário, ids diferentes — ex.: criada no painel e lida do card):
    // fica UMA só, escolhida do mesmo jeito em todos os computadores, e ela recebe o estado das outras
    meetDedupe();
    // some quem foi excluído por outro colaborador
    // (mantém o que foi salvo nos últimos 5 min, caso a planilha ainda não devolva)
    meets = meets.filter(m => m.pending || !m.shared || seen.has(m.id) || m.del || Date.now() - (m.upd || 0) < 5 * 60000 || Date.now() - m.ts > 2 * DAY);
  }
  async function syncMeets() {
    if (!SHARED_URL || sync.busy) return;
    sync.busy = true;
    try {
      for (const m of meets.filter(x => x.pending)) {
        await gmGet({ action: 'save', data: JSON.stringify(pub(m)) });
        m.pending = false; m.shared = true;
      }
      // finalizações de atendimento: valem para toda a equipe
      let fq = (lsGet(FIN_Q, []) || []).filter(f => Date.now() - f.ts < 2 * DAY);
      // Raio-X feito neste computador: avisa a equipe (para o lembrete parar em todos)
      { const dn = lsGet(RX_KEY, {}) || {}, day = dayKey();
        if (dn.date === day) { let ch = false; for (const sl of RX_SLOTS) if (dn[sl] && !dn['sh_' + sl]) { fq.push({ name: `__rx|${day}|${sl}`, ts: Number(dn[sl]) || Date.now(), by: ((lsGet('ilevaSup.user.v1', {}) || {}).nome) || '', del: 0 }); dn['sh_' + sl] = 1; ch = true; }
          if (ch) { lsSet(RX_KEY, dn); lsSet(FIN_Q, fq); } } }
      // uma vez: envia também o que já tinha sido finalizado neste computador antes da atualização
      const bf = !lsGet('ilevaSup.finBackfill.v1', false);
      if (bf && data && data.final) for (const [name, f] of Object.entries(data.final)) if (f && !f.shared && Date.now() - f.ts < DAY && !fq.some(x => x.name === name)) fq.push({ name, ts: f.ts, by: f.by && f.by !== 'Supervisor' ? f.by : (((lsGet('ilevaSup.user.v1', {}) || {}).nome) || ''), del: 0 });
      while (fq.length) {
        const r = await gmGet({ action: 'fin', data: JSON.stringify(fq[0]) });
        if (!Array.isArray(r.fins)) { fq = null; break; } // planilha antiga: tenta de novo depois
        fq.shift(); lsSet(FIN_Q, fq);
      }
      if (bf && fq && !fq.length) lsSet('ilevaSup.finBackfill.v1', Date.now());
      meets = meets.filter(m => !m.del || Date.now() - (m.upd || 0) < 3 * DAY || m.ts > Date.now() - DAY);
      const j = await gmGet({ action: 'list' });
      mergeRemote(j.items || [], j.dels);
      if (Array.isArray(j.fins)) mergeFins(j.fins);
      if (j.cfg && typeof j.cfg === 'object' && MINI_OPTS.includes(Number(j.cfg.miniMin)) && Number(ui.miniMin) !== Number(j.cfg.miniMin) && !(ui.miniMinAt && ui.miniMinAt > (j.cfg.miniMinAt || 0))) { ui.miniMin = Number(j.cfg.miniMin); ui.miniMinAt = j.cfg.miniMinAt || 0; saveUi(); syncMini(); }
      if (j.cfg && typeof j.cfg === 'object' && j.cfg.acesso && HAS_GM) gmSetJ(ACESSO_KEY, j.cfg.acesso);
      if (j.cfg && typeof j.cfg === 'object' && HAS_GM) gmSetJ('ilevaSup.pipRegra.v1', j.cfg.pipRegra || {});
      if (j.cfg && typeof j.cfg === 'object') { const b = j.cfg.block || { on: false }; const cur = lsGet(BLOCK_KEY, {}) || {}; if (cur.on !== !!b.on || cur.at !== b.at) { lsSet(BLOCK_KEY, { on: !!b.on, by: b.by || '', at: b.at || 0 }); blockLabelRefresh(); } }
      // tarefas compartilhadas
      if (Array.isArray(j.tars)) {
        for (const it of tarAll().filter(x => x.pending)) {
          const r = await gmGet({ action: 'tar', data: JSON.stringify(Object.assign({}, it, { pending: undefined })) });
          if (!Array.isArray(r.tars)) break;
          const L = tarAll(); const x = L.find(y => y.id === it.id); if (x && x.upd === it.upd) { x.pending = false; tarSave(L); }
        }
        tarMerge(j.tars);
      }
      // lembretes compartilhados
      if (Array.isArray(j.lembs)) {
        for (const it of lembAll().filter(x => x.pending)) {
          const r = await gmGet({ action: 'lemb', data: JSON.stringify(Object.assign({}, it, { pending: undefined, alertAt: undefined })) });
          if (!Array.isArray(r.lembs)) break;
          const L = lembAll(); const x = L.find(y => y.id === it.id); if (x && x.upd === it.upd) { x.pending = false; lembSave(L); }
        }
        lembMerge(j.lembs);
      }
      lsSet(LS_MEET, meets);
      sync = { ok: true, at: Date.now(), err: '', busy: false };
    } catch (e) {
      sync = { ok: false, at: sync.at, err: e.message, busy: false };
    }
    meetKey = ''; meetTick();
    if (ui.open && ui.tab === 'reun') render(false);
  }
  const MEET_BEFORE = 10 * 60 * 1000, MEET_AFTER = 15 * 60 * 1000, MEET_MAX = 4 * 60 * 60 * 1000, MEET_FIN_SHOW = 2 * 60 * 1000;
  let meets = lsGet(LS_MEET, []);
  if (!Array.isArray(meets)) meets = [];
  const saveMeets = () => { meets = meets.filter(m => Date.now() - m.ts < 7 * 24 * 3600 * 1000); lsSet(LS_MEET, meets); };
  const pad2 = n => String(n).padStart(2, '0');
  const isoDay = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const hhmm = ts => { const d = new Date(ts); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
  const dayLabel = ts => { const d = new Date(ts), t = new Date(); if (isoDay(d) === isoDay(t)) return 'Hoje'; t.setDate(t.getDate() + 1); if (isoDay(d) === isoDay(t)) return 'Amanhã'; return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }); };
  function fmtCountdown(ms) {
    if (ms <= 0) { const m = Math.floor(-ms / 60000); return m < 1 ? 'COMEÇANDO AGORA' : `começou há ${m} min`; }
    const sec = Math.ceil(ms / 1000), hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
    if (hh >= 24) return `faltam ${Math.floor(hh / 24)}d ${hh % 24}h`;
    if (hh) return `faltam ${hh}h ${pad2(mm)}min`;
    return `faltam ${pad2(mm)}:${pad2(ss)}`;
  }
  let meetForm = null, meetBar = null, meetKey = '', lastBeep = 0;
  // ---- apresentando a tela no Google Meet: esconde mascote, barra, alertas, sons e notificações
  const PRES_KEY = 'ilevaSup.pres.v1';
  function isPresenting() { if (!HAS_GM) return false; const t = gmGetJ(PRES_KEY, 0); return !!t && Date.now() - t < 6000; }
  function ilevaNotif(title, opt) { if (isPresenting() || (lunchOn() && !(opt && opt.lunch))) return { close() { } }; return new window.Notification(title, opt); }
  function presApply() {
    try {
      if (!host) return;
      const pipOn = !IS_WA && Date.now() - (gmGetJ('ilevaSup.pipAt', 0) || 0) < 15000;
      const hide = pipOn || escondido() || (isPresenting() && pipPref().apresentando !== false);
      if ((host.style.display === 'none') !== hide) host.style.display = hide ? 'none' : '';
    } catch (e) { }
  }
  let presWas = false, presBeat = 0;
  function meetPresScan() { // só roda na aba do Google Meet
    let on = false;
    try {
      const re = /parar (a )?apresenta|parar de apresentar|voc[eê] est[aá] apresentando|stop presenting|you are presenting|you're presenting/i;
      for (const el of document.querySelectorAll('button,[role="button"],[aria-live],[role="status"],[role="alert"]')) {
        const t = (el.getAttribute('aria-label') || '') + ' ' + (el.childElementCount < 6 ? (el.textContent || '') : '');
        if (re.test(t)) { on = true; break; }
      }
    } catch (e) { }
    const now = Date.now();
    if (on && (!presWas || now - presBeat > 2000)) { gmSetJ(PRES_KEY, now); presBeat = now; }
    if (!on && presWas) gmSetJ(PRES_KEY, 0);
    presWas = on; presApply();
  }
  function beep(urgent, force) {
    if (isPresenting()) return;
    if (ui.meetSound === false) return; // som de todos os alertas desligado
    if (!force && lunchOn()) return;
    if (document.visibilityState !== 'visible') {
      if (!IS_WA || !HAS_GM) return;
      if (Date.now() - (+GM_getValue('ilevaSup.satVisible', 0) || 0) < 4000) return; // outra aba visível já tocou
    }
    try {
      const A = window.AudioContext || window.webkitAudioContext; const ac = beep.ac || (beep.ac = new A());
      if (ac.state === 'suspended') ac.resume();
      [0, 0.25, 0.5].slice(0, urgent ? 3 : 2).forEach(t => {
        const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = urgent ? 1046 : 880; o.type = 'sine';
        g.gain.setValueAtTime(0.0001, ac.currentTime + t); g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t + 0.2);
        o.connect(g); g.connect(ac.destination); o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.22);
      });
    } catch (e) { }
  }
  // som do alerta de reunião (liga/desliga pelo botão do alerta ou em Transparência e exibição)
  const meetSoundOn = () => ui.meetSound !== false;
  function setMeetSound(on) { ui.meetSound = !!on; saveUi(); meetKey = ''; meetTick(); try { render(false); } catch (e) { } try { const c = opEl && opEl.querySelector('input[data-snd]'); if (c) c.checked = !!on; } catch (e) { } lastAction = { kind: 'info', key: '', label: on ? 'Som dos alertas ligado.' : 'Som de todos os alertas desligado (atendimentos, reuniões, Raio-X, tarefas, lembretes e almoço). A notificação do Windows continua.', at: Date.now() }; try { render(true); } catch (e) { } }
  const sndBtn = mini => h('button', { class: 'btn' + (mini ? ' mini' : ''), title: meetSoundOn() ? 'Desligar o som de todos os alertas' : 'Ligar o som dos alertas', onclick: e => { e.stopPropagation(); setMeetSound(!meetSoundOn()); } }, meetSoundOn() ? '🔔' : '🔕');
  function meetNotify(m, title) {
    if (!IS_WA) return; // notificação do Windows só pela aba do WhatsApp (evita repetir)
    try { if ('Notification' in window && Notification.permission === 'granted') ilevaNotif(title, { body: `${m.cliente} · ${hhmm(m.ts)}${m.resp ? ' · com ' + m.resp : ''}${m.assunto ? '\n' + m.assunto : ''}`, tag: 'ileva-meet-' + m.id, requireInteraction: true }); } catch (e) { }
  }
  // alerta arrastável (posição salva) e minimizável
  let meetDragged = false;
  function placeMeetBar() {
    if (!meetBar) return;
    if (pipWin) { meetBar.style.left = ''; meetBar.style.top = ''; meetBar.style.transform = ''; return; }
    const p = posGet('meetPos');
    if (!p) { meetBar.style.left = ''; meetBar.style.top = ''; meetBar.style.transform = ''; return; }
    const w = meetBar.offsetWidth || 300, hh = meetBar.offsetHeight || 60;
    meetBar.style.transform = 'none';
    meetBar.style.left = Math.min(Math.max(4, p.left), Math.max(4, VW() - w - 4)) + 'px';
    meetBar.style.top = Math.min(Math.max(4, p.top), Math.max(4, VH() - hh - 4)) + 'px';
  }
  function meetDown(e) {
    if (pipWin) return;
    if (e.button !== 0 || e.target.closest('button')) return;
    const r = meetBar.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
    let moved = false;
    const mv = ev => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 6) return;
      moved = true; meetBar.classList.add('drag');
      posSet('meetPos', { left: r.left + dx, top: r.top + dy }); placeMeetBar();
    };
    const up = () => {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      meetBar.classList.remove('drag');
      if (moved) { meetDragged = true; saveUi(); setTimeout(() => { meetDragged = false; }, 300); }
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }
  addEventListener('resize', () => placeMeetBar());
  // minimizar / ocultar o alerta de reunião: vale só para o monitor onde foi clicado
  function meetMinOn() { const m = ui.meetMinMon; return !!(m && typeof m === 'object' && m[monId()]); }
  function setMeetMin(v) { ui.meetMinMon = Object.assign({}, (ui.meetMinMon && typeof ui.meetMinMon === 'object') ? ui.meetMinMon : {}, { [monId()]: v ? 1 : 0 }); saveUi(); meetKey = ''; meetTick(); }
  function meetHidden(m) { const hm = ui.meetHideMon && ui.meetHideMon[monId()]; return !!(hm && hm[m.id + '|' + (m.fin ? 'f' : m.live ? 'l' : 'a')]); }
  function hideMeetHere(m) {
    const all = Object.assign({}, (ui.meetHideMon && typeof ui.meetHideMon === 'object') ? ui.meetHideMon : {}), now = Date.now();
    const mine = Object.assign({}, all[monId()] || {});
    Object.keys(mine).forEach(k => { if (now - mine[k] > DAY) delete mine[k]; });
    mine[m.id + '|' + (m.fin ? 'f' : m.live ? 'l' : 'a')] = now; all[monId()] = mine;
    ui.meetHideMon = all; saveUi(); meetKey = ''; meetTick();
  }
  function activeMeets(now) {
    return meets.filter(m => !m.del && (m.fin
      ? (!m.finSeen && now - m.fin < MEET_FIN_SHOW)
      : (!m.done && ((m.live && now - m.live <= 2 * MEET_MAX) || (now >= m.ts - MEET_BEFORE && now <= m.ts + MEET_MAX))))).sort((a, b) => a.ts - b.ts);
  }
  const fmtDurMin = ms => { const m = Math.max(1, Math.round(ms / 60000)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`; };
  let meetFinArm = null, meetFinArmT = 0;
  function meetFinished(m, mine) {
    meetKey = '';
    if (mine) { m.finSeen = 0; meetNotify(m, `✅ Reunião finalizada às ${hhmm(m.fin)}`); return; }
    // finalizada por outro colaborador: o alerta fecha sozinho aqui, só com um aviso rápido
    m.finSeen = 1;
    if (HAS_GM) gmSetJ('ilevaSup.mtClean.v1', Date.now());
    const by = m.finBy && m.finBy !== 'painel' ? m.finBy : 'a equipe';
    quickToast('Reunião encerrada', `${m.cliente} · finalizada por ${by} às ${hhmm(m.fin)}${m.fin > m.ts ? ' · duração ' + fmtDurMin(m.fin - m.ts) : ''}`);
    try { if (IS_WA && 'Notification' in window && Notification.permission === 'granted') ilevaNotif(`✅ Reunião com ${m.cliente} encerrada`, { body: `Finalizada por ${by} às ${hhmm(m.fin)}.`, tag: 'ileva-meet-' + m.id }); } catch (e) { }
  }
  function quickToast(title, text) {
    if (!shadow) return;
    const lq = h('div', { class: 'lgq' }); const lgS = h('span', { class: 'lg' }); setHTML(lgS, LOGO_SVG.replace(/ilvLg/g, 'ilvLgQ' + Date.now())); lq.append(lgS);
    const bd = h('span', { class: 'bdg', style: 'background:#2fbf71' }); setHTML(bd, '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'); lq.append(bd);
    const el = h('div', { class: 'ctoast show', style: 'border-left-color:#2fbf71;left:50%;top:14px;transform:translateX(-50%)' }, lq, h('div', { style: 'flex:1;min-width:0' }, h('div', { class: 'who2' }, 'Supervisor Ileva · agora'), h('div', { class: 'tt' }, title), h('div', { class: 'tx' }, text)));
    el.style.width = Math.min(380, VW() - 24) + 'px';
    shadow.append(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, 7000);
  }
  const fmtLive = ms => { const sec = Math.max(0, Math.floor(ms / 1000)), hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60; return (hh ? hh + ':' + pad2(mm) : pad2(mm)) + ':' + pad2(ss); };
  function startMeet(m) {
    const now = Date.now();
    Object.assign(m, { live: now, upd: now, pending: !!SHARED_URL, ack: true, done: false });
    saveMeets(); meetKey = ''; meetTick(); syncMeets();
    lastAction = { kind: 'info', key: '', label: `Reunião com ${m.cliente} marcada como acontecendo.`, at: now };
    if (ui.open && ui.tab === 'reun') render(true);
  }
  function finishMeet(m) {
    if (!podeFinalizar(m)) { quickToast('Sem permissão', 'Só o responsável pela reunião ou quem o gestor autorizou pode finalizá-la.'); return; }
    const now = Date.now();
    Object.assign(m, { fin: now, finBy: userNome() || 'painel', upd: now, pending: !!SHARED_URL, ack: true });
    meetFinArm = null; saveMeets(); meetFinished(m, true); meetTick(); syncMeets();
    if (HAS_GM) gmSetJ('ilevaSup.mtClean.v1', Date.now());
    lastAction = { kind: 'info', key: '', label: `Reunião com ${m.cliente} finalizada às ${hhmm(now)}.`, at: now };
    if (ui.open && ui.tab === 'reun') render(true);
  }
  function meetTick() {
    try {
      if (!shadow || !meetBar) return;
      if (meetDedupe()) saveMeets();
      const now = Date.now(), act = activeMeets(now);
      if (meetFinArm && now - meetFinArmT > 5000) { meetFinArm = null; meetKey = ''; }
      let changed = false;
      for (const m of act) {
        if (m.fin) continue;
        if (!m.n10) { m.n10 = 1; changed = true; meetNotify(m, '📅 Reunião em 10 minutos'); if (meetSoundOn()) beep(false); lastBeep = now; }
        if (now >= m.ts && !m.n0) { m.n0 = 1; m.ack = false; changed = true; meetNotify(m, '🔴 Reunião começando agora'); if (meetSoundOn()) beep(true); lastBeep = now; }
      }
      if (changed) saveMeets();
      // insiste com som a cada 60 s enquanto ninguém clicar em "Ciente" (até 15 min depois do início)
      const nagging = act.filter(m => !m.fin && !m.live && !m.ack && now <= m.ts + MEET_AFTER);
      if (nagging.length && meetSoundOn() && now - lastBeep > 60000) { beep(nagging.some(m => now >= m.ts)); lastBeep = now; }
      const phase = m => m.fin ? 'f' : m.live ? 'l' : now < m.ts ? 'b' : now <= m.ts + MEET_AFTER ? 's' : 'r';
      const mNear = m => phase(m) === 'b' && m.ts - now <= 5 * MIN, mLate = m => phase(m) === 's' && !m.ack && now - m.ts > 2 * MIN;
      const key = (meetSoundOn() ? '' : 'mute:') + (meetMinOn() ? 'min:' : '') + (isCorp() ? 'c:' : '') + monId() + ':' + act.filter(m => !meetHidden(m)).map(m => m.id + phase(m) + (mNear(m) ? 'n' : '') + (mLate(m) ? 'L' : '') + (m.ack ? 'a' : '') + (meetFinArm === m.id ? 'x' : '')).join('|');
      if (key !== meetKey) {
        meetKey = key;
        const shown = act.filter(m => !meetHidden(m));
        meetBar.style.display = shown.length ? 'flex' : 'none';
        meetBar.classList.toggle('min', meetMinOn());
        meetBar.replaceChildren(...shown.map(m => {
          const ph = phase(m), started = ph === 's' || ph === 'r';
          const okBtn = (cls) => h('button', { class: cls, title: 'Tirar o aviso da tela', onclick: () => { m.finSeen = 1; saveMeets(); meetKey = ''; meetTick(); } }, cls.includes('mini') ? '✕' : '✔ OK');
          const finBtn = (mini) => !podeFinalizar(m) ? null : meetFinArm === m.id
            ? h('button', { class: 'btn danger' + (mini ? ' mini' : ''), title: 'Confirma que a reunião terminou (avisa toda a equipe)', onclick: () => finishMeet(m) }, mini ? '✅ Confirmar' : '✅ Confirmar finalização')
            : h('button', { class: 'btn fin' + (mini ? ' mini' : ''), title: 'Marca a reunião como finalizada para toda a equipe', onclick: () => { meetFinArm = m.id; meetFinArmT = Date.now(); meetKey = ''; meetTick(); } }, mini ? '✅' : '✅ Reunião finalizada');
          // aviso de reunião finalizada
          if (ph === 'f') {
            const txt = `${m.cliente} · finalizada às ${hhmm(m.fin)}${m.fin > m.ts ? ' · duração ' + fmtDurMin(m.fin - m.ts) : ''}`;
            if (meetMinOn()) return h('div', { class: 'mt done mini' }, h('span', {}, '✅'), h('span', { class: 'mn' }, txt), okBtn('btn mini'));
            return h('div', { class: 'mt done' },
              h('div', { class: 'mi' }, h('div', { class: 'mh' }, noEmoji('✅ REUNIÃO FINALIZADA')), h('div', { class: 'mc' }, m.cliente),
                h('div', { class: 'ms' }, [`Finalizada às ${hhmm(m.fin)}`, m.fin > m.ts ? 'duração ' + fmtDurMin(m.fin - m.ts) : '', m.assunto].filter(Boolean).join(' · '))),
              h('div', { class: 'mb' }, okBtn('btn')));
          }
          const liveBtn = (mini) => h('button', { class: 'btn live' + (mini ? ' mini' : ''), title: 'Informa para toda a equipe que a reunião começou e está acontecendo agora', onclick: () => startMeet(m) }, mini ? '🎥' : '🎥 Reunião acontecendo');
          // reunião acontecendo agora
          if (ph === 'l') {
            if (meetMinOn()) return h('div', { class: 'mt live mini', title: `${m.cliente}${m.assunto ? ' · ' + m.assunto : ''}${m.resp ? ' · com ' + m.resp : ''}\nClique para abrir · arraste para mover`,
                onclick: e => { if (meetDragged || e.target.closest('button')) return; setMeetMin(false); } },
              h('span', { class: 'rec' }), h('span', { class: 'mn' }, m.cliente + (m.resp ? ' · ' + m.resp : '')),
              h('span', { class: 'cd mcd', 'data-live': String(m.live) }, fmtLive(now - m.live)),
              finBtn(true), sndBtn(true), h('button', { class: 'btn mini', title: 'Abrir o alerta completo', onclick: () => setMeetMin(false) }, '▢'));
            return h('div', { class: 'mt live' },
              h('div', { class: 'mi' },
                h('div', { class: 'mh' }, h('span', { class: 'rec' }), ' REUNIÃO ACONTECENDO · desde ', hhmm(m.live)),
                h('div', { class: 'mc' }, m.cliente), m.resp ? h('div', { class: 'mrl' }, 'Ministrando: ', h('b', {}, m.resp)) : null,
                h('div', { class: 'ms' }, m.assunto || '')),
              h('div', { class: 'cd mcd', 'data-live': String(m.live) }, fmtLive(now - m.live)),
              h('div', { class: 'mb' }, finBtn(false),
                sndBtn(false), h('button', { class: 'btn', title: 'Minimiza o alerta só nesta tela', onclick: () => setMeetMin(true) }, '▁ Minimizar'),
                h('button', { class: 'btn', title: 'Tira o alerta só desta tela (as outras telas e a equipe continuam vendo; não finaliza a reunião)', onclick: () => hideMeetHere(m) }, '✕ Ocultar')));
          }
          const cls = 'mt' + (ph === 'r' ? ' run' : m.ack ? ' ack' : started ? ' go' : ' warn') + (mNear(m) ? ' near' : '') + (mLate(m) ? ' late' : '');
          const head = noEmoji(ph === 'b' ? '📅 REUNIÃO EM BREVE' : ph === 's' ? (mLate(m) ? '🔴 NINGUÉM CONFIRMOU · JÁ DEVIA TER COMEÇADO' : '🔴 COMEÇANDO AGORA') : '🟢 REUNIÃO EM ANDAMENTO');
          if (meetMinOn()) return h('div', { class: cls + ' mini', title: `${m.cliente}${m.assunto ? ' · ' + m.assunto : ''}${m.resp ? ' · com ' + m.resp : ''}\nClique para abrir · arraste para mover`,
              onclick: e => { if (meetDragged || e.target.closest('button')) return; setMeetMin(false); } },
            h('span', {}, (ph === 'b' ? '📅 ' : ph === 's' ? '🔴 ' : '🟢 ') + hhmm(m.ts)),
            h('span', { class: 'mn' }, m.cliente + (m.resp ? ' · ' + m.resp : '')),
            h('span', { class: 'cd mcd', 'data-ts': String(m.ts) }, fmtCountdown(m.ts - now)),
            m.ack || ph === 'r' ? null : h('button', { class: 'btn mini', title: 'Para de piscar e de tocar', onclick: () => { m.ack = true; saveMeets(); meetTick(); } }, '👍'),
            liveBtn(true),
            started ? finBtn(true) : null,
            sndBtn(true), h('button', { class: 'btn mini', title: 'Abrir o alerta completo', onclick: () => setMeetMin(false) }, '▢'));
          return h('div', { class: cls },
            h('div', { class: 'mi' },
              h('div', { class: 'mh' }, head, ' · ', hhmm(m.ts)),
              h('div', { class: 'mc' }, m.cliente), m.resp ? h('div', { class: 'mrl' }, 'Ministrando: ', h('b', {}, m.resp)) : null,
              h('div', { class: 'ms' }, m.assunto || '')),
            h('div', { class: 'cd mcd', 'data-ts': String(m.ts) }, fmtCountdown(m.ts - now)),
            h('div', { class: 'mb' },
              m.ack || ph === 'r' ? null : h('button', { class: 'btn', title: 'Para de piscar e de tocar (o contador continua na tela)', onclick: () => { m.ack = true; saveMeets(); meetTick(); } }, '👍 Ciente'),
              liveBtn(false),
              started ? finBtn(false) : null,
              sndBtn(false), h('button', { class: 'btn', title: 'Minimiza o alerta só nesta tela (continua mostrando cliente e contagem)', onclick: () => setMeetMin(true) }, '▁ Minimizar'),
              h('button', { class: 'btn', title: 'Tira o alerta só desta tela (as outras telas e a equipe continuam vendo; não finaliza a reunião)', onclick: () => hideMeetHere(m) }, '✕ Ocultar')));
        }));
        if (shown.length) requestAnimationFrame(placeMeetBar);
      }
      shadow.querySelectorAll('.cd[data-ts]').forEach(el => { el.textContent = fmtCountdown(+el.dataset.ts - now); });
      shadow.querySelectorAll('.cd[data-live]').forEach(el => { el.textContent = fmtLive(now - +el.dataset.live); });
      updateMascot();
    } catch (e) { console.warn('[Supervisor Ileva] reuniões', e); }
  }
  function openMeetForm(m) {
    const d = m ? new Date(m.ts) : new Date();
    meetForm = { id: m ? m.id : null, cliente: m ? m.cliente : '', dia: isoDay(d), hora: m ? hhmm(m.ts) : '', resp: m ? m.resp : '', assunto: m ? m.assunto : '', contato: m ? (m.contato || '') : '', mt: mtReunCfg().auto !== false, err: '' };
    render(true); if (bodyEl) bodyEl.scrollTop = 0;
  }
  function saveMeet() {
    const f = meetForm; f.err = '';
    const ts = new Date(`${f.dia}T${f.hora || 'x'}:00`).getTime();
    if (!f.cliente.trim()) f.err = 'Informe o nome do cliente.';
    else if (!f.dia || !f.hora || isNaN(ts)) f.err = 'Informe a data e o horário da reunião.';
    else if (!f.id && ts < Date.now() - 60000) f.err = 'Esse horário já passou.';
    else if (!f.force) {
      const cf = busyList().filter(b => Math.abs(b.ts - ts) < SLOT_GAP && !(f.id && meets.some(m => m.id === f.id && Math.abs(m.ts - b.ts) < MIN && reunNorm(m.cliente) === reunNorm(b.cliente))));
      if (cf.length) { f.err = 'Já existe reunião perto desse horário: ' + cf.map(c => `${dayLabel(c.ts).toLowerCase()} às ${hhmm(c.ts)} — ${c.cliente}${c.resp ? ' (' + c.resp + ')' : ''}`).join('; ') + '. Escolha outro horário ou confirme abaixo.'; f.conflict = true; }
    }
    if (f.err) { render(true); return; }
    f.force = false; f.conflict = false;
    const old = f.id ? meets.find(m => m.id === f.id) : null;
    const item = old || { id: 'r' + Date.now().toString(36) };
    if (old && old.ts !== ts) Object.assign(item, { ack: false, done: false, n10: 0, n0: 0 });
    Object.assign(item, { cliente: f.cliente.trim(), ts, resp: f.resp.trim(), assunto: f.assunto.trim(), contato: (f.contato || '').trim(), upd: Date.now(), pending: !!SHARED_URL });
    if (!old) meets.push(item);
    const lancar = f.mt !== false;
    saveMeets(); meetForm = null; meetKey = ''; syncMeets();
    if (lancar) mtReunQueue(item, item.mtHead ? 'update' : 'add');
    if ('Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) { } }
    lastAction = { kind: 'info', key: '', label: old ? 'Reunião atualizada.' : `Reunião agendada: ${item.cliente}, ${dayLabel(ts).toLowerCase()} às ${hhmm(ts)}.`, at: Date.now() };
    meetTick(); render(true);
  }
  let meetDelArm = null;
  // ===== Chat da equipe (Google Chat) =====
  const CHAT_ON = false; // aba 💬 Equipe desligada por enquanto (falta liberar webhook no Google Chat)
  const CHAT_KEY = 'ilevaSup.chat.v1';
  const CHAT_DEF = { url: 'https://chat.google.com/app/chat/AAQA2eZZbAQ', alerts: { urg: true, meet: true, rx: true, cob: true } };
  const CHAT_ALERTS = [['urg', '🚨 Cliente esperando há mais de 15 min'], ['meet', '📅 Reunião começando em 10 min'], ['rx', '🩻 Hora do Raio-X e Raio-X enviado'], ['cob', '💰 Dia de cobrança (de manhã)']];
  function chatCfg() { const c = lsGet(CHAT_KEY, null) || {}; return { url: c.url || CHAT_DEF.url, alerts: Object.assign({}, CHAT_DEF.alerts, c.alerts || {}) }; }
  let chatState = { msg: '', sending: false, info: '', ok: null };
  const userNome = () => ((lsGet('ilevaSup.user.v1', {}) || {}).nome || '').trim();
  // ===== Permissões por perfil (definidas pelo gestor na página de Configurações da extensão) =====
  // Sem equipe cadastrada, nada muda: todos têm o acesso de antes.
  const ACESSO_KEY = 'ilevaSup.acesso.v1';
  const PERM_PADRAO = {
    colaborador: { ver_atendimentos: 1, raiox: 1, ver_relatorios: 0, revisao_tom: 0, excluir_de_outros: 0, finalizar_reuniao_de_outros: 0, ronda: 0, chat_equipe: 1, bloqueios_e_frases: 0 },
    supervisor: { ver_atendimentos: 1, raiox: 1, ver_relatorios: 0, revisao_tom: 1, excluir_de_outros: 1, finalizar_reuniao_de_outros: 1, ronda: 1, chat_equipe: 1, bloqueios_e_frases: 0 },
  };
  const acessoCfg = () => { const a = HAS_GM ? gmGetJ(ACESSO_KEY, null) : null; return a && Array.isArray(a.membros) && a.membros.length ? a : null; };
  function meuCadastro() { const a = acessoCfg(), n = deacc(userNome()); return a && n ? a.membros.find(x => deacc(x.nome || '') === n) || null : null; }
  function pode(k) {
    const a = acessoCfg(); if (!a) return true;
    const m = meuCadastro(); const perfil = m && m.ativo !== false ? m.perfil : 'colaborador';
    if (perfil === 'gestor') return true;
    if (k === 'administracao') return false;
    if (m && m.ativo !== false && m.extra && Object.prototype.hasOwnProperty.call(m.extra, k)) return !!m.extra[k];
    return !!(PERM_PADRAO[perfil] || PERM_PADRAO.colaborador)[k];
  }
  // registro "é meu": criado por mim ou eu sou o responsável
  const souDono = (...nomes) => { const me = deacc(userNome()); return !me || nomes.some(n => n && deacc(String(n)).includes(me)); };
  const podeFinalizar = m => souDono(m.resp) || pode('finalizar_reuniao_de_outros');
  const TAB_PERM = { tom: 'revisao_tom', base: 'revisao_tom', resumo: 'ver_relatorios', manha: 'ronda', chat: 'chat_equipe' };
  // ===== Janela flutuante: preferências pessoais (Configurações > Telas e monitores) + regra do gestor =====
  const PIP_DEF = { usar: true, modo: 'sempre', fila: true, reun: true, tar: true, lemb: true, lembrar: true, apresentando: true };
  function pipPref() {
    const pr = Object.assign({}, PIP_DEF, ((HAS_GM ? gmGetJ('ilevaExt.prefs', {}) : {}) || {}).pip || {});
    const rg = (HAS_GM ? gmGetJ('ilevaSup.pipRegra.v1', {}) : {}) || {};
    pr.obrigatoria = !!rg.obrigatoria; if (pr.obrigatoria) { pr.usar = true; pr.lembrar = true; }
    return pr;
  }
  // esconder o Supervisor por alguns minutos (para print ou gravação de tela): menu ou Ctrl+Shift+9 em qualquer programa
  const HIDE_KEY = 'ilevaExt.hideUntil';
  const escondido = () => (HAS_GM ? Number(gmGetJ(HIDE_KEY, 0)) || 0 : 0) > Date.now();
  function esconderPor(min) { if (HAS_GM) gmSetJ(HIDE_KEY, min ? Date.now() + min * MIN : 0); presApply(); }
  let pipAskEl = null, pipAskOff = false;
  // painel completo dentro da janela flutuante: a janela cresce ao abrir e volta ao tamanho da barra ao minimizar
  function pipOpenSync() {
    try {
      if (!host) return;
      host.classList.toggle('pipopen', !!(pipWin && ui.open));
      if (!pipWin) return;
      if (ui.open) pipWin.resizeTo(Math.max(480, (Number(ui.width) || 400) + 40), Math.min((screen.availHeight || 900) - 40, 900));
      else pipWin.resizeTo(460, 620);
    } catch (e) { }
  }
  // abrir uma conversa a partir da janela flutuante: traz a janela do WhatsApp para a frente
  function pipFocusWa() { if (!pipWin) return; try { if (IS_EXT) chrome.runtime.sendMessage({ t: 'ilv-focus' }); else window.focus(); } catch (e) { } }
  function pipTick() {
    try {
      if (!host || !shadow) return;
      const pr = pipPref();
      host.classList.toggle('pnf', !pr.fila); host.classList.toggle('pnr', !pr.reun); host.classList.toggle('pnt', !pr.tar); host.classList.toggle('pnl', !pr.lemb);
      if (pipWin && escondido()) { try { pipWin.close(); } catch (e) { } }
      if (!pipWin && host.classList.contains('pipopen')) host.classList.remove('pipopen');
      const want = IS_WA && !pipWin && pr.usar && pr.lembrar && !pipAskOff && !escondido() && !lunchOn() && 'documentPictureInPicture' in window && document.visibilityState === 'visible';
      if (!want) { if (pipAskEl) pipAskEl.style.display = 'none'; return; }
      if (!pipAskEl || !shadow.contains(pipAskEl)) {
        pipAskEl = h('div', { style: 'position:fixed;right:16px;bottom:74px;z-index:2147483645;display:flex;align-items:center;gap:8px;background:#111722;border:1px solid #273042;border-radius:10px;padding:8px 10px 8px 12px;color:#e7e9ee;font:13px Segoe UI,Helvetica,Arial,sans-serif;box-shadow:0 10px 28px rgba(0,0,0,.45)' });
        shadow.append(pipAskEl);
      }
      pipAskEl.replaceChildren(
        h('button', { style: 'background:#6d28d9;border:0;color:#fff;border-radius:7px;padding:6px 10px;font:600 12.5px Segoe UI,sans-serif;cursor:pointer', title: 'A barra, a fila e os avisos ficam por cima de qualquer programa, mesmo com o navegador minimizado', onclick: () => togglePip() }, '⧉ Abrir janela flutuante'),
        pr.obrigatoria ? h('span', { style: 'color:#8a93a3;font-size:11.5px' }, 'definido pelo gestor') : h('button', { style: 'background:none;border:0;color:#8a93a3;cursor:pointer;font-size:14px', title: 'Agora não', onclick: () => { pipAskOff = true; pipTick(); } }, '✕'));
      pipAskEl.style.display = 'flex';
    } catch (e) { }
  }
  // ===== Modo econômico: sem animações decorativas (definido em Configurações > Alertas e notificações) =====
  function ecoTick() {
    try {
      if (!host || !shadow) return;
      const on = !!((HAS_GM ? gmGetJ('ilevaExt.prefs', {}) : {}) || {}).eco;
      host.classList.toggle('eco', on);
      if (on || host.dataset.ecoWas) shadow.querySelectorAll('svg').forEach(sv => { try { on ? sv.pauseAnimations() : sv.unpauseAnimations(); } catch (e) { } });
      host.dataset.ecoWas = on ? '1' : '';
    } catch (e) { }
  }
  async function chatPost(text, key) {
    if (!CHAT_ON) throw new Error('chat desligado');
    if (!SHARED_URL) throw new Error('planilha compartilhada não configurada');
    const r = await gmGet({ action: 'chat', text: String(text).slice(0, 1500), ckey: key || '' });
    if (!r.chat) throw new Error('a planilha ainda está com o código antigo (veja o passo a passo abaixo)');
    return r.chat;
  }
  function chatOpen() {
    const url = chatCfg().url;
    try { const w = Math.min(520, screen.availWidth / 3) | 0; window.open(url, 'ilevaChatEquipe', `popup=yes,width=${w},height=${Math.min(820, screen.availHeight - 60) | 0},left=${screen.availWidth - w - 10},top=20`); } catch (e) { window.open(url, '_blank'); }
  }
  // avisos automáticos: todos os computadores tentam, a planilha manda só uma vez (pela chave)
  const chatSent = new Set();
  function chatAuto() {
    if (!CHAT_ON || !IS_WA || !SHARED_URL) return;
    const c = chatCfg(), now = Date.now(), st = lastSt, out = [];
    if (c.alerts.urg && st && st.reds && inBiz(now)) for (const g of st.reds) { const since = g.pend && g.pend[0] ? g.pend[0].ts : now - g.wait; if (g.approx) continue; out.push([`urg|${g.name}|${Math.round(since / MIN)}`, `🚨 *${g.name}* está aguardando resposta há ${fmtDur(g.wait)}.`]); }
    if (c.alerts.meet) for (const m of meets) if (!m.del && !m.fin && m.ts - now > 0 && m.ts - now <= MEET_BEFORE) out.push([`m10|${m.id}|${m.ts}`, `📅 Reunião com *${m.cliente}* começa às ${hhmm(m.ts)}${m.resp ? ' — com ' + m.resp : ''}${m.assunto ? ' (' + m.assunto + ')' : ''}.`]);
    if (c.alerts.rx) { const sl = rxPendingSlot(now); if (sl && now - slotTs(sl, now) < 30 * MIN) { const r = rxResp(now, sl); out.push([`rx|${dayKey()}|${sl}`, `🩻 Hora do Raio-X das ${sl}${r ? ' — vez do(a) *' + r + '*' : ''}.`]); } }
    if (c.alerts.cob) { const r = cobResp(now), d = new Date(now), mi = d.getHours() * 60 + d.getMinutes(); if (r && !cobDone(now) && mi >= BIZ_OPEN && mi < COB_END) out.push([`cob|${dayKey()}`, `💰 Hoje é dia de cobrança: *${r}* (na parte da manhã).`]); }
    for (const [k, t] of out) { if (chatSent.has(k)) continue; chatSent.add(k); chatPost(t, k).catch(() => chatSent.delete(k)); }
  }
  function renderChat() {
    const c = chatCfg();
    const ta = h('textarea', { rows: 3, placeholder: 'Escreva um recado para a equipe…', style: 'width:100%' }); ta.value = chatState.msg;
    ta.addEventListener('input', () => { chatState.msg = ta.value; });
    const send = async () => {
      const t = ta.value.trim(); if (!t || chatState.sending) return;
      const nome = userNome();
      chatState.sending = true; chatState.info = 'Enviando…'; chatState.ok = null; render(true);
      try { await chatPost(`*${nome || 'Supervisor'}:* ${t}`); chatState.msg = ''; chatState.info = '✅ Enviado para o chat da equipe.'; chatState.ok = true; }
      catch (e) { chatState.info = '⚠️ Não enviou: ' + e.message; chatState.ok = false; }
      chatState.sending = false; render(true);
    };
    ta.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); });
    const alerts = CHAT_ALERTS.map(([k, l]) => { const cb = h('input', { type: 'checkbox', checked: c.alerts[k] !== false }); cb.addEventListener('change', () => { const g = lsGet(CHAT_KEY, null) || {}; g.alerts = Object.assign({}, c.alerts, g.alerts || {}, { [k]: cb.checked }); lsSet(CHAT_KEY, g); }); return h('label', { class: 'chk' }, cb, ' ' + l); });
    const urlInp = h('input', { type: 'text', value: c.url, style: 'width:100%' });
    urlInp.addEventListener('change', () => { const g = lsGet(CHAT_KEY, null) || {}; g.url = urlInp.value.trim() || CHAT_DEF.url; lsSet(CHAT_KEY, g); });
    return [
      h('div', { class: 'card blue' },
        h('div', { class: 'gname' }, '💬 Chat da equipe (Google Chat)'),
        h('div', { class: 'cobtx' }, 'A conversa acontece no Google Chat: no computador e no celular, com arquivos, prints e notificações.'),
        h('div', { class: 'actions' }, h('button', { class: 'btn pri', onclick: chatOpen }, '💬 Abrir o chat da equipe'))),
      h('div', { class: 'card' },
        h('div', { class: 'gname' }, '✉️ Recado rápido'),
        h('div', { class: 'cobtx' }, userNome() ? `Vai como "${userNome()}". Ctrl+Enter envia.` : 'Informe seu nome na aba 🩻 Raio-X para o recado sair com ele.'),
        ta,
        h('div', { class: 'actions' }, h('button', { class: 'btn pri', onclick: send }, chatState.sending ? 'Enviando…' : '📨 Enviar para a equipe')),
        chatState.info ? h('div', { class: chatState.ok === false ? 'warn' : 'who' }, chatState.info) : null),
      h('div', { class: 'card purple' },
        h('div', { class: 'gname' }, '🔔 Avisos automáticos no chat'),
        h('div', { class: 'cobtx' }, 'O Supervisor publica sozinho no chat da equipe (cada aviso sai uma vez só, mesmo com vários computadores ligados):'),
        ...alerts,
        h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: async e => { const b = e.currentTarget; b.textContent = 'Enviando…'; try { await chatPost(`✅ Teste do Supervisor Ileva${userNome() ? ' — enviado por ' + userNome() : ''}. Os avisos automáticos estão funcionando!`); b.textContent = '✅ Teste enviado'; } catch (err) { b.textContent = '⚠️ ' + err.message; } } }, '🧪 Enviar mensagem de teste'))),
      h('details', { class: 'card' }, h('summary', {}, '⚙️ Como ligar (uma vez só, feito pelo gestor)'),
        h('div', { class: 'cobtx' },
          h('div', {}, h('b', {}, '1.'), ' No Google Chat, abra o espaço da equipe, clique no nome do espaço (no topo) > ', h('b', {}, 'Apps e integrações'), ' > ', h('b', {}, 'Webhooks'), ' > ', h('b', {}, 'Adicionar webhook'), '. Nome: Supervisor Ileva. Salve e ', h('b', {}, 'copie o link'), '.'),
          h('div', {}, h('b', {}, '2.'), ' Na planilha da agenda: ', h('b', {}, 'Extensões > Apps Script'), '. Na linha ', h('code', {}, "const CHAT_WEBHOOK = ''"), ' cole o link entre as aspas e salve.'),
          h('div', {}, h('b', {}, '3.'), ' ', h('b', {}, 'Implantar > Gerenciar implantações > ✏️ > Nova versão > Implantar'), '. Se o Google pedir autorização, clique em Permitir.'),
          h('div', {}, h('b', {}, '4.'), ' Volte aqui e clique em ', h('b', {}, '🧪 Enviar mensagem de teste'), '.')),
        h('label', {}, 'Link do espaço da equipe no Google Chat'), urlInp)
    ];
  }
  // ===== Tarefas com prazo em dias úteis (segunda a sexta, expediente 08:00–18:00) =====
  const TAR_KEY = 'ilevaSup.tar.v1', TAR_SEEN = 'ilevaSup.tarSeen.v1', BIZ_DAY_MS = (BIZ_CLOSE - BIZ_OPEN) * MIN;
  const TAR_CLIP = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/></svg>';
  let tarForm = null, tarFin = null, tarMineOnly = false, tarShowDone = false;
  function tarAll() { const l = lsGet(TAR_KEY, []); return Array.isArray(l) ? l : []; }
  function tarSave(L) { lsSet(TAR_KEY, L.filter(x => !(x.del && Date.now() - (x.upd || 0) > 7 * DAY)).filter(x => !(x.status === 'concluida' && Date.now() - (x.done || 0) > 30 * DAY)).slice(-400)); }
  function tarUpsert(it) { const L = tarAll(); const i = L.findIndex(x => x.id === it.id); const c = Object.assign({}, it); delete c._delArm; c.upd = Date.now(); c.pending = !!SHARED_URL; if (i >= 0) L[i] = c; else L.push(c); tarSave(L); tarMtQueue(c.id); setTimeout(() => { try { syncMeets(); } catch (e) { } }, 400); }
  // início do prazo: o momento do cadastro (fora do expediente, conta a partir da próxima abertura)
  function tarStart(ts) { return nextOpen(ts); }
  // data de entrega: N dias úteis depois do início, no mesmo horário (pula sábado e domingo)
  function tarDue(start, dias) { const d = new Date(start); let n = Math.max(0, Number(dias) || 0); while (n > 0) { d.setDate(d.getDate() + 1); if (isBizDay(d)) n--; } return d.getTime(); }
  // tempo útil entre dois momentos (só segunda a sexta, 08:00–18:00)
  function bizMs(a, b) {
    if (b === a) return 0;
    if (b < a) return -bizMs(b, a);
    let t = 0; const d = new Date(a); d.setHours(0, 0, 0, 0);
    for (let k = 0; k < 400 && d.getTime() < b; k++, d.setDate(d.getDate() + 1)) {
      if (!isBizDay(d)) continue;
      const o = d.getTime() + BIZ_OPEN * MIN, c = d.getTime() + BIZ_CLOSE * MIN;
      const s0 = Math.max(o, a), e0 = Math.min(c, b); if (e0 > s0) t += e0 - s0;
    }
    return t;
  }
  function fmtBiz(ms) {
    const late = ms < 0; ms = Math.abs(ms);
    const days = Math.floor(ms / BIZ_DAY_MS), rest = ms - days * BIZ_DAY_MS, hh = Math.floor(rest / HOUR), mm = Math.floor((rest % HOUR) / MIN);
    let txt;
    if (days >= 1) txt = `${days} dia${days > 1 ? 's' : ''}${hh ? ' ' + hh + ' h' : ''}`;
    else if (hh >= 1) txt = `${hh} h${mm ? ' ' + twoD(mm) + ' min' : ''}`;
    else txt = `${Math.max(1, mm)} min`;
    return late ? '+' + txt : txt;
  }
  const WDF = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  function dueTxt(ts) { const d = new Date(ts), now = new Date(); const dd = isoDay(d) === isoDay(now) ? 'hoje' : isoDay(d) === isoDay(new Date(Date.now() + DAY)) ? 'amanhã' : `${WDF[d.getDay()]} ${twoD(d.getDate())}/${twoD(d.getMonth() + 1)}`; return `${dd} às ${hhmm(ts)}`; }
  function tarMine(it) { const me = userNome().toLowerCase(); const r = (it.resp || '').trim().toLowerCase(); return !r || !me || r.split(/\s*[\/,&]\s*|\s+e\s+/).some(x => x && (me.startsWith(x) || x.startsWith(me.split(' ')[0]))); }
  const tarOpen = it => !it.del && it.status !== 'concluida';
  const execToday = it => !!(it.exec && it.exec.day === isoDay(new Date()));
  function tarState(it, now = Date.now()) {
    if (it.status === 'concluida') return 'ok';
    if (it.status === 'aguardando') return 'wait';
    const rem = bizMs(now, it.due);
    if (rem <= 0) return 'late';
    if (rem <= BIZ_DAY_MS) return 'warn';
    return 'go';
  }
  function tarNames() { const s = new Set([userNome()]); tarAll().forEach(x => x.resp && s.add(x.resp)); meets.forEach(m => m.resp && m.resp.split(/\s*\/\s*/).forEach(n => s.add(n))); return [...s].filter(Boolean).sort(); }
  function tarExec(it, on) { it.exec = on ? { by: userNome() || it.resp || '', at: Date.now(), day: isoDay(new Date()) } : null; tarUpsert(it); tarToastHide(); render(true); }
  let tarDelArm = '';
  function renderCloseKb() {
    const kb = closeKbAll(), list = Object.entries(kb).filter(([, e]) => !e.del).sort((a, b) => b[1].ids.length - a[1].ids.length || b[1].at - a[1].at);
    const out = [h('div', { class: 'card purple' }, h('div', { class: 'gname' }, 'Frases de encerramento aprendidas'),
      h('div', { class: 'who' }, `Quando alguém clica em Finalizar, a última mensagem do cliente entra aqui. Com ${CLOSE_MIN} ou mais finalizações, a frase passa a encerrar o atendimento sozinha (depois de uma resposta da equipe e sem pergunta pendente).`),
      h('div', { class: 'actions', style: 'margin-top:8px' }, h('button', { class: 'btn', onclick: () => setTab('atend') }, '← Voltar aos atendimentos')))];
    if (!list.length) out.push(h('div', { class: 'card' }, h('div', { class: 'who' }, 'Ainda não há frases. Elas aparecem conforme a equipe finaliza atendimentos.')));
    for (const [key, e] of list) {
      const on = e.ids.length >= CLOSE_MIN;
      out.push(h('div', { class: 'card ' + (on ? 'green' : '') },
        h('div', { class: 'top' }, h('div', { class: 'gname', style: 'font-weight:600' }, `“${e.text}”`), h('span', { class: 'chs' + (on ? '' : ' n'), style: 'white-space:nowrap' }, on ? 'Encerra sozinho' : `Aprendendo ${e.ids.length}/${CLOSE_MIN}`)),
        h('div', { class: 'who' }, `${e.ids.length} finaliza${e.ids.length > 1 ? 'ções' : 'ção'} · por ${e.by.join(', ') || 'equipe'} · última ${dayLabel(e.at).toLowerCase()} às ${hhmm(e.at)}`),
        h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => { closeKbAdd(e.text, '', userNome(), Date.now(), true); const q = lsGet(FIN_Q, []) || []; q.push({ name: `__close|x|${e.text}`, ts: Date.now(), by: userNome(), del: 1 }); lsSet(FIN_Q, q.slice(-200)); setTimeout(() => { try { syncMeets(); } catch (er) { } }, 300); render(true); } }, 'Remover da base'))));
    }
    return out;
  }
  function renderTar() {
    const now = Date.now(), all = tarAll().filter(x => !x.del), out = [];
    const f = tarForm;
    if (tarFin) {
      const it = all.find(x => x.id === tarFin.id);
      if (it) {
        const F = tarFin, op = (k, v, t, cls) => h('button', { class: 'op' + (F[k] === v ? ' ' + (cls || 'sel') : ''), onclick: () => { F[k] = v; F.err = ''; render(true); } }, t);
        const obs = h('textarea', { rows: '2', placeholder: 'Ex.: aprovado por áudio no grupo' }, F.obs || ''); obs.addEventListener('input', () => { F.obs = obs.value; }); obs.addEventListener('keydown', e => e.stopPropagation());
        const concluir = () => {
          if (!F.entregue || !F.aprov) { F.err = 'Responda as duas perguntas.'; render(true); return; }
          Object.assign(it, { entregue: F.entregue, aprov: F.aprov, finObs: (F.obs || '').trim(), exec: null });
          if (F.aprov === 'ajuste' || F.entregue === 'nao') { it.status = 'aberta'; if (F.aprov === 'ajuste') it.ajustes = (it.ajustes || 0) + 1; }
          else if (F.aprov === 'aguardando') { it.status = 'aguardando'; it.entregueAt = Date.now(); }
          else { it.status = 'concluida'; it.done = Date.now(); it.doneBy = userNome(); it.noPrazo = Date.now() <= it.due; }
          tarUpsert(it); tarFin = null; tarToastHide();
          lastAction = { kind: 'info', key: '', label: it.status === 'concluida' ? `Tarefa concluída${it.noPrazo ? ' no prazo' : ' (fora do prazo)'}: ${it.titulo}.` : it.status === 'aguardando' ? 'Tarefa entregue, aguardando aprovação do solicitante.' : 'Tarefa continua aberta.', at: Date.now() };
          render(true);
        };
        out.push(h('div', { class: 'card tfin' }, h('div', { class: 'gname' }, 'Finalizar tarefa'), h('div', { class: 'who' }, `${it.titulo} · ${it.assoc}${it.solic ? ' · ' + it.solic : ''}`),
          h('div', { class: 'q' }, 'A tarefa foi entregue ao cliente?'), h('div', { class: 'ops' }, op('entregue', 'sim', 'Sim, entregue'), op('entregue', 'nao', 'Ainda não', 'selw')),
          h('div', { class: 'q' }, `O solicitante${it.solic ? ' (' + it.solic + ')' : ''} aprovou?`), h('div', { class: 'ops' }, op('aprov', 'sim', 'Aprovou'), op('aprov', 'aguardando', 'Aguardando', 'selw'), op('aprov', 'ajuste', 'Pediu ajuste', 'selr')),
          h('label', {}, 'Observação (opcional)'), obs,
          F.err ? h('div', { class: 'warn' }, F.err) : null,
          h('div', { class: 'actions', style: 'margin-top:10px' }, h('button', { class: 'btn tok', onclick: concluir }, 'Concluir'), h('button', { class: 'btn', onclick: () => { tarFin = null; render(true); } }, 'Cancelar')),
          h('div', { class: 'who', style: 'margin-top:6px' }, '"Aguardando" deixa a tarefa em espera (lembrete mais espaçado) até o solicitante aprovar. "Pediu ajuste" reabre a tarefa.')));
      } else tarFin = null;
    }
    if (f) {
      const bind = (el, k) => { el.addEventListener('input', () => { f[k] = el.value; }); el.addEventListener('change', () => { f[k] = el.value; }); el.addEventListener('keydown', e => e.stopPropagation()); return el; };
      const dl = h('datalist', { id: 'tarNomes' }, tarNames().map(n => h('option', { value: n })));
      const start = f.start || tarStart(now), due = tarDue(start, f.dias);
      const save = () => {
        if (!f.titulo.trim()) { f.err = 'Descreva a tarefa.'; render(true); return; }
        if (!f.assoc.trim()) { f.err = 'Informe a associação que solicitou.'; render(true); return; }
        if (!f.resp.trim()) { f.err = 'Indique o colaborador responsável.'; render(true); return; }
        if (f.arq !== 'sim') { f.err = f.arq === 'nao' ? 'Coloque os arquivos na pasta da associação no servidor e depois marque “Sim”. Só assim a tarefa pode ser criada.' : 'Informe se os arquivos já estão na pasta da associação no servidor.'; render(true); return; }
        const old = f.id ? tarAll().find(x => x.id === f.id) : null;
        const st0 = old ? old.start : tarStart(Date.now());
        const it = Object.assign(old || { id: 'tk' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), criado: Date.now(), criadoPor: userNome(), status: 'aberta', start: st0 },
          { titulo: f.titulo.trim(), det: f.det.trim(), assoc: f.assoc.trim(), solic: f.solic.trim(), resp: f.resp.trim(), dias: Number(f.dias) || 1, due: tarDue(st0, f.dias), arq: true, arqAt: old && old.arq ? (old.arqAt || Date.now()) : Date.now(), arqBy: old && old.arq ? (old.arqBy || userNome()) : userNome() });
        tarUpsert(it); tarForm = null;
        if (!old) { const sn = gmGetJ(TAR_SEEN, {}) || {}; sn[it.id] = Date.now() - 50 * MIN; gmSetJ(TAR_SEEN, sn); } // 1º aviso ~10 min depois do cadastro
        lastAction = { kind: 'info', key: '', label: `Tarefa salva: entrega até ${dueTxt(it.due)} (${it.dias} dia${it.dias > 1 ? 's' : ''} úteis).`, at: Date.now() };
        render(true);
      };
      out.push(h('div', { class: 'card blue tkform' }, h('div', { class: 'gname' }, f.id ? 'Editar tarefa' : 'Nova tarefa'),
        h('label', {}, 'O que precisa ser feito'), bind(h('input', { type: 'text', value: f.titulo, placeholder: 'Ex.: Ajustar cadastro de 12 veículos' }), 'titulo'),
        h('label', {}, 'Detalhes (opcional)'), bind(h('textarea', { rows: '2', placeholder: 'Ex.: lista enviada pelo cliente no grupo' }, f.det), 'det'),
        h('div', { style: 'display:flex;gap:8px' },
          h('div', { style: 'flex:1' }, h('label', {}, 'Associação'), bind(h('input', { type: 'text', value: f.assoc, placeholder: 'Ex.: AG2' }), 'assoc')),
          h('div', { style: 'flex:1' }, h('label', {}, 'Solicitante na associação'), bind(h('input', { type: 'text', value: f.solic, placeholder: 'Ex.: Jorge' }), 'solic'))),
        h('label', {}, 'Colaborador responsável'), bind(h('input', { type: 'text', value: f.resp, list: 'tarNomes', placeholder: 'Ex.: Adriel' }), 'resp'), dl,
        h('label', {}, 'Os arquivos já estão na pasta da associação no servidor? *'),
        h('div', { class: 'tfin' }, h('div', { class: 'ops' },
          h('button', { class: 'op' + (f.arq === 'sim' ? ' sel' : ''), onclick: () => { f.arq = 'sim'; f.err = ''; render(true); } }, 'Sim, já estão no servidor'),
          h('button', { class: 'op' + (f.arq === 'nao' ? ' selr' : ''), onclick: () => { f.arq = 'nao'; f.err = ''; render(true); } }, 'Não'))),
        f.arq === 'nao' ? h('div', { class: 'tarq' }, h('b', {}, 'Não é possível criar a tarefa ainda. '), `Salve os arquivos na pasta ${f.assoc.trim() ? 'da ' + f.assoc.trim() : 'da associação'} no servidor e depois marque “Sim”.`) : null,
        h('label', {}, 'Prazo informado ao cliente'),
        h('div', { class: 'tstp' }, h('div', { class: 'g' }, h('button', { onclick: () => { f.dias = Math.max(1, (Number(f.dias) || 1) - 1); render(true); } }, '−'), h('span', { class: 'n' }, String(f.dias)), h('button', { onclick: () => { f.dias = Math.min(60, (Number(f.dias) || 1) + 1); render(true); } }, '+')), h('span', {}, 'dias úteis')),
        h('div', { class: 'tcalc' }, 'Entrega até ', h('b', {}, dueTxt(due)), ' · conta só de segunda a sexta (sábado e domingo não contam)' + (start > now + MIN ? ` · o prazo começa no próximo expediente (${dueTxt(start)})` : '')),
        f.err ? h('div', { class: 'warn' }, f.err) : null,
        h('div', { class: 'actions', style: 'margin-top:10px' }, h('button', { class: 'btn tpri', disabled: f.arq !== 'sim', title: f.arq !== 'sim' ? 'Confirme que os arquivos estão na pasta da associação no servidor' : '', onclick: save }, f.id ? 'Salvar alteração' : 'Salvar tarefa'), h('button', { class: 'btn', onclick: () => { tarForm = null; render(true); } }, 'Cancelar'))));
    } else if (!tarFin) {
      out.push(h('div', { class: 'actions', style: 'margin:0 0 6px' },
        h('button', { class: 'btn tpri', onclick: () => { tarForm = { id: null, titulo: '', det: '', assoc: '', solic: '', resp: '', dias: 2, arq: '', err: '' }; render(true); } }, '+ Nova tarefa'),
        h('button', { class: 'btn' + (tarMineOnly ? ' pri' : ''), onclick: () => { tarMineOnly = true; render(true); } }, 'Só as minhas'),
        h('button', { class: 'btn' + (!tarMineOnly ? ' pri' : ''), onclick: () => { tarMineOnly = false; render(true); } }, 'Todas')));
    }
    const list = all.filter(x => !tarMineOnly || tarMine(x));
    const card = it => {
      const st = tarState(it, now), rem = bizMs(now, it.due), tot = Math.max(1, bizMs(it.start, it.due));
      const pct = st === 'ok' ? 100 : Math.min(100, Math.max(2, (1 - rem / tot) * 100));
      const A = (t, fn, cls) => h('button', { class: 'btn' + (cls ? ' ' + cls : ''), onclick: e => { e.stopPropagation(); fn(); } }, t);
      return h('div', { class: 'tk ' + ({ late: 'tl8', warn: 'tw', wait: 'tq', ok: 'tdone' }[st] || 'tg') },
        h('div', { class: 't' }, it.titulo),
        st === 'ok' ? null : h('div', { class: 'cd2' }, h('div', { class: 'v' }, st === 'wait' ? 'entregue' : fmtBiz(rem)), h('div', { class: 'l' }, st === 'late' ? 'atrasada' : st === 'wait' ? 'aguardando' : 'úteis restantes')),
        h('div', { class: 'm' }, h('b', {}, it.assoc), it.solic ? [' · solicitante ', h('b', {}, it.solic)] : '', ' · responsável ', h('b', {}, it.resp || '—')),
        it.det ? h('div', { class: 'det' }, it.det) : null,
        it.arq ? h('div', {}, h('span', { class: 'chs', title: `Confirmado por ${it.arqBy || ''} em ${it.arqAt ? dayLabel(it.arqAt).toLowerCase() + ' às ' + hhmm(it.arqAt) : ''}` }, '✓ Arquivos na pasta do servidor')) : null,
        execToday(it) && st !== 'ok' ? h('div', {}, h('span', { class: 'exe' }, `● Em execução por ${it.exec.by || it.resp} desde ${hhmm(it.exec.at)} · avisos reduzidos hoje`)) : null,
        st === 'ok' ? h('div', {}, h('span', { class: 'chs' }, 'Entregue'), h('span', { class: 'chs' }, `Aprovado${it.solic ? ' por ' + it.solic : ''}`), h('span', { class: 'chs' + (it.noPrazo ? '' : ' r') }, it.noPrazo ? 'No prazo' : 'Fora do prazo'),
          h('div', { class: 'm' }, `Concluída ${dayLabel(it.done).toLowerCase()} às ${hhmm(it.done)} por ${it.doneBy || it.resp}${it.finObs ? ' · ' + it.finObs : ''}`))
          : [h('div', { class: 'pb' }, h('i', { style: `width:${pct.toFixed(0)}%` })),
            h('div', { class: 'due' }, h('span', {}, `Prazo: ${it.dias} dia${it.dias > 1 ? 's' : ''} úteis · ${st === 'late' ? 'venceu' : 'vence'} ${dueTxt(it.due)}`), h('span', {}, `cadastrada ${dayLabel(it.criado).toLowerCase()}`)),
            st === 'wait' ? h('div', {}, h('span', { class: 'chs' }, 'Entregue'), h('span', { class: 'chs n' }, `Aguardando aprovação${it.solic ? ' de ' + it.solic : ''}`)) : null,
            it.ajustes ? h('div', {}, h('span', { class: 'chs r' }, `${it.ajustes} ajuste${it.ajustes > 1 ? 's' : ''} pedido${it.ajustes > 1 ? 's' : ''}`)) : null,
            h('div', { class: 'actions' },
              st !== 'wait' ? (execToday(it) ? A('Pausar execução', () => tarExec(it, false)) : A('▶ Estou executando', () => tarExec(it, true), 'texe')) : null,
              A(st === 'wait' ? 'Registrar aprovação' : 'Finalizar', () => { tarFin = { id: it.id, entregue: st === 'wait' ? 'sim' : '', aprov: '', obs: '' }; render(true); if (bodyEl) bodyEl.scrollTop = 0; }, 'tok'),
              A('Editar', () => { tarForm = { id: it.id, titulo: it.titulo, det: it.det || '', assoc: it.assoc, solic: it.solic || '', resp: it.resp || '', dias: it.dias, start: it.start, arq: it.arq ? 'sim' : '', err: '' }; render(true); if (bodyEl) bodyEl.scrollTop = 0; }),
              !(souDono(it.criadoPor, it.resp) || pode('excluir_de_outros')) ? null : tarDelArm === it.id ? A('Confirmar exclusão', () => { it.del = 1; tarDelArm = ''; tarUpsert(it); render(true); }, 'danger') : A('Excluir', () => { tarDelArm = it.id; render(true); }))]);
    };
    const late = list.filter(x => tarOpen(x) && tarState(x, now) === 'late').sort((a, b) => a.due - b.due);
    const andam = list.filter(x => tarOpen(x) && ['go', 'warn'].includes(tarState(x, now))).sort((a, b) => a.due - b.due);
    const wait = list.filter(x => tarOpen(x) && tarState(x, now) === 'wait').sort((a, b) => a.due - b.due);
    const done = list.filter(x => x.status === 'concluida' && now - (x.done || 0) < 7 * DAY).sort((a, b) => b.done - a.done);
    if (!late.length && !andam.length && !wait.length && !f) out.push(h('div', { class: 'card' }, h('div', { class: 'who' }, tarMineOnly ? 'Você não tem tarefas abertas.' : 'Nenhuma tarefa aberta. Use “+ Nova tarefa” para cadastrar um pedido de associação com prazo.')));
    if (late.length) out.push(h('div', { class: 'grp' }, `Prazo estourado (${late.length})`), ...late.map(card));
    if (andam.length) out.push(h('div', { class: 'grp' }, `Em andamento (${andam.length})`), ...andam.map(card));
    if (wait.length) out.push(h('div', { class: 'grp' }, `Aguardando aprovação (${wait.length})`), ...wait.map(card));
    if (done.length) out.push(h('details', { open: tarShowDone }, h('summary', { onclick: () => { tarShowDone = !tarShowDone; } }, `Concluídas nos últimos 7 dias (${done.length})`), ...done.map(card)));
    return out;
  }
  // aviso próprio (diferente dos lembretes): o intervalo encurta conforme o prazo aperta; "Estou executando" espaça no dia
  function tarEvery(it, now) {
    const st = tarState(it, now), rem = bizMs(now, it.due), ex = execToday(it);
    if (st === 'wait') return 60 * MIN;            // entregue, aguardando aprovação
    if (st === 'late') return 5 * MIN;             // prazo estourado
    if (rem < 2 * HOUR) return ex ? 30 * MIN : 10 * MIN;   // menos de 2 h úteis
    if (rem <= BIZ_DAY_MS) return ex ? 60 * MIN : 20 * MIN; // último dia útil
    return ex ? 90 * MIN : 30 * MIN;               // demais dias
  }
  let tarEl = null, tarShown = '';
  function tarToastHide() { if (tarEl) tarEl.classList.remove('show'); tarShown = ''; }
  function tarSnooze(it, ms) { const sn = gmGetJ(TAR_SEEN, {}) || {}; sn[it.id] = Date.now() + ms - tarEvery(it, Date.now()); gmSetJ(TAR_SEEN, sn); tarToastHide(); }
  function tarFabChip() {
    const mine = tarAll().filter(x => tarOpen(x) && x.status !== 'aguardando' && tarMine(x)); if (!mine.length) return null;
    const late = mine.some(x => tarState(x) === 'late');
    const now = Date.now(), nx = mine.slice().sort((a, b) => a.due - b.due)[0], rem = bizMs(now, nx.due), hot = late || rem <= BIZ_DAY_MS;
    const c = h('span', { class: 'tc' + (late ? ' r' : hot ? ' hot' : ''), title: `Próxima: ${nx.titulo} (${nx.assoc}) · ${late ? 'prazo estourado' : 'faltam ' + fmtBiz(rem) + ' úteis, até ' + dueTxt(nx.due)}\nClique para ver as tarefas`, onclick: e => { e.stopPropagation(); if (IS_WA) { setOpen(true); setTab('tar'); } } }); setHTML(c, TAR_CLIP);
    c.append(` ${mine.length > 1 ? mine.length + ' tarefas · ' : 'Tarefa · '}`, h('b', {}, late ? (mine.filter(x => tarState(x) === 'late').length > 1 ? 'atrasadas' : 'atrasada ' + fmtBiz(rem)) : fmtBiz(rem))); return c;
  }
  function tarTick() {
    try {
      if (!shadow || isPresenting() || lunchOn() || !inBiz(Date.now())) { tarToastHide(); return; }
      const now = Date.now(), sn = gmGetJ(TAR_SEEN, {}) || {};
      const due = tarAll().filter(x => tarOpen(x) && tarMine(x)).filter(x => now - (sn[x.id] || 0) >= tarEvery(x, now));
      if (!due.length) { if (tarShown && tarEl && tarEl.classList.contains('show')) { const it = tarAll().find(x => x.id === tarShown); if (it && tarOpen(it)) tarPaint(it); else tarToastHide(); } return; }
      const it = due.sort((a, b) => bizMs(now, a.due) - bizMs(now, b.due))[0];
      if (tarShown === it.id && tarEl && tarEl.classList.contains('show')) { tarPaint(it); return; }
      sn[it.id] = now; gmSetJ(TAR_SEEN, sn);
      tarShown = it.id; tarPaint(it, true);
      if (IS_WA) { beep(tarState(it, now) === 'late'); try { if ('Notification' in window && Notification.permission === 'granted') ilevaNotif(`Tarefa: ${it.titulo}`, { body: `${it.assoc} · ${tarState(it, now) === 'late' ? 'prazo estourado' : 'faltam ' + fmtBiz(bizMs(now, it.due)) + ' úteis'}`, tag: 'ileva-tar-' + it.id }); } catch (e) { } }
    } catch (e) { }
  }
  function tarPaint(it, fresh) {
    const now = Date.now(), st = tarState(it, now), rem = bizMs(now, it.due);
    if (!tarEl || !shadow.contains(tarEl)) { tarEl = h('div', { class: 'ttoast' }); shadow.append(tarEl); }
    const ico = h('span', { class: 'ico' }); setHTML(ico, TAR_CLIP.replace(/14/g, '16'));
    const B = (t, fn, cls) => h('button', { class: 'cb' + (cls ? ' ' + cls : ''), onclick: e => { e.stopPropagation(); fn(); } }, t);
    const dias = Math.max(1, it.dias || 1), passed = Math.min(dias, Math.max(0, bizMs(it.start, now) / BIZ_DAY_MS));
    const segs = []; for (let i = 0; i < Math.min(dias, 12); i++) segs.push(h('i', { class: st === 'wait' || i < Math.floor(passed) ? '' : 'f' }));
    if (fresh) { tarEl.className = 'ttoast'; void tarEl.offsetWidth; }
    tarEl.className = 'ttoast show' + (st === 'late' ? ' late' : '');
    tarEl.replaceChildren(h('div', { class: 'in2' },
      h('button', { class: 'cx', title: 'Fechar (volta no próximo aviso)', onclick: e => { e.stopPropagation(); tarToastHide(); } }, '×'),
      h('div', { class: 'ttop' }, ico, h('div', {}, h('div', { class: 'k' }, st === 'late' ? 'Prazo estourado' : st === 'wait' ? 'Aguardando aprovação' : 'Tarefa com prazo'), h('div', { class: 'who' }, `Supervisor Ileva · para ${it.resp || userNome()}`))),
      h('div', { class: 'tl' }, it.titulo),
      h('div', { class: 'mm' }, `${it.assoc}${it.solic ? ' · solicitante ' + it.solic : ''} · prazo dado ao cliente: ${it.dias} dia${it.dias > 1 ? 's' : ''} úteis`),
      st === 'wait' ? h('div', { class: 'mm', style: 'margin-top:8px' }, `Entregue${it.entregueAt ? ' às ' + hhmm(it.entregueAt) : ''} · cobre a aprovação de ${it.solic || 'quem solicitou'}.`)
        : h('div', { class: 'big' }, h('span', { class: 'v' }, fmtBiz(rem)), h('span', { class: 'l' }, st === 'late' ? `além do prazo (era ${dueTxt(it.due)})` : `úteis até ${dueTxt(it.due)}`)),
      h('div', { class: 'seg' }, ...segs),
      execToday(it) ? h('div', { class: 'mm', style: 'margin-top:6px;color:#7dd3fc' }, `● Em execução desde ${hhmm(it.exec.at)} · avisos reduzidos hoje`) : null,
      h('div', { class: 'bb' },
        st !== 'wait' && !execToday(it) ? B('▶ Estou executando', () => tarExec(it, true), 'ex') : null,
        B(st === 'wait' ? 'Registrar aprovação' : 'Finalizar', () => { tarToastHide(); if (IS_WA) { tarFin = { id: it.id, entregue: st === 'wait' ? 'sim' : '', aprov: '', obs: '' }; setOpen(true); setTab('tar'); } }, 'ok'),
        B('Lembrar em 1 h', () => tarSnooze(it, HOUR)))));
    const r = fab && fab.style.display !== 'none' && fab.offsetWidth ? fab.getBoundingClientRect() : null;
    let bottom = (r ? Math.max(12, VH() - r.top + 10) : 18) + (ui.open ? 0 : pqH());
    if (lembEl && lembEl.classList.contains('show')) bottom += lembEl.offsetHeight + 10;
    if (ctoastEl && ctoastEl.classList.contains('show')) bottom += ctoastEl.offsetHeight + 10;
    tarEl.style.right = (ui.open && panel && panel.offsetWidth ? panel.offsetWidth + 14 : (r ? Math.max(12, VW() - r.right) : 18)) + 'px';
    tarEl.style.bottom = Math.max(12, Math.min(bottom, VH() - 280)) + 'px';
  }
  function tarMerge(rem) {
    if (!Array.isArray(rem)) return;
    const L = tarAll(); let ch = false;
    for (const r of rem) { if (!r || !r.id) continue; const i = L.findIndex(x => x.id === r.id); if (i < 0) { L.push(Object.assign({}, r, { pending: false })); ch = true; } else if (!L[i].pending && (r.upd || 0) > (L[i].upd || 0)) { L[i] = Object.assign({}, r, { pending: false }); ch = true; } }
    if (ch) { tarSave(L); if (ui.open && ui.tab === 'tar') render(false); }
  }
  // ===== Tarefas -> MeisterTask (coluna TAREFAS; concluída vai para "Tarefas Entregues") =====
  const TAR_MT_Q = 'ilevaSup.tarMtQ.v1', MT_SEC_TAR = 30982067, MT_SEC_TAR_OK = 34945559;
  function tarMtQueue(id) { if (!HAS_GM) return; const q = gmGetJ(TAR_MT_Q, []) || []; const e = q.find(o => o.id === id); if (e) { e.at = Date.now(); e.tries = 0; } else q.push({ id, at: Date.now(), tries: 0 }); gmSetJ(TAR_MT_Q, q); }
  function tarPatch(id, patch) { const L = tarAll(); const x = L.find(y => y.id === id); if (!x) return; Object.assign(x, patch, { upd: Date.now(), pending: !!SHARED_URL }); tarSave(L); }
  const fmtDH = ts => { const d = new Date(ts); return `${twoD(d.getDate())}/${twoD(d.getMonth() + 1)} às ${hhmm(ts)}`; };
  function tarMtName(it) { return `${it.assoc} - ${it.titulo}`.slice(0, 250); }
  function tarMtNotes(it) {
    const L = [];
    if (it.det) L.push(it.det, '');
    L.push(`Solicitante: ${it.solic || '—'}`, `Responsável: ${it.resp || '—'}`,
      `Prazo informado ao cliente: ${it.dias} dia${it.dias > 1 ? 's' : ''} úteis — entrega até ${fmtDH(it.due)}`,
      `Arquivos na pasta do servidor: ${it.arq ? 'Sim' + (it.arqBy ? ' (confirmado por ' + it.arqBy + ')' : '') : 'Não informado'}`);
    if (it.exec && it.status !== 'concluida') L.push(`Em execução por ${it.exec.by || it.resp} desde ${fmtDH(it.exec.at)}`);
    if (it.status === 'aguardando') L.push('', `Entregue ao cliente${it.entregueAt ? ' em ' + fmtDH(it.entregueAt) : ''} — aguardando aprovação${it.solic ? ' de ' + it.solic : ''}.`);
    if (it.status === 'concluida') L.push('', `Concluída em ${fmtDH(it.done)} por ${it.doneBy || it.resp} — entregue e aprovado${it.solic ? ' por ' + it.solic : ''} (${it.noPrazo ? 'no prazo' : 'fora do prazo'}).`);
    if (it.ajustes) L.push(`Ajustes pedidos pelo cliente: ${it.ajustes}`);
    if (it.finObs) L.push(`Obs.: ${it.finObs}`);
    L.push('', `Cadastrada por ${it.criadoPor || '—'} no Supervisor Ileva em ${fmtDH(it.criado)}`);
    return L.join('\n');
  }
  async function mtTopSeq(sec) {
    const d = await mtGql('IlevaSec', `query { find_section(id: ${sec}) { tasks { id sequence status } } }`);
    const ts = ((d && d.find_section && d.find_section.tasks) || []).filter(t => t.status === 1 || t.status === 2).map(t => Number(t.sequence) || 0);
    return (ts.length ? Math.min(...ts) : 0) - 15000;
  }
  let tarMtBusy = false;
  async function tarMtRun() {
    if (tarMtBusy || !HAS_GM || !/(^|\.)meistertask\.com$/.test(location.hostname)) return;
    let q = gmGetJ(TAR_MT_Q, []) || []; if (!q.length) return;
    tarMtBusy = true;
    try {
      for (const o of q.slice()) {
        const it = tarAll().find(x => x.id === o.id);
        let ok = false;
        try {
          if (!it) ok = true;
          else if (it.del) { if (it.mtId) await mtUpdTask({ id: Number(it.mtId), status: 8 }); ok = true; }
          else {
            let mtId = it.mtId;
            if (!mtId) {
              const c = await mtGql('CreateTask', 'mutation CreateTask($task: TaskCreateInput!) { create_task(task: $task) { task { id token } } }', { task: { name: tarMtName(it), section_id: MT_SEC_TAR } });
              const t = c && c.create_task && c.create_task.task; if (!t) throw new Error('não criou');
              mtId = t.id; const seq = await mtTopSeq(MT_SEC_TAR);
              await mtUpdTask({ id: Number(mtId), notes: tarMtNotes(it), sequence: seq });
              tarPatch(it.id, { mtId: String(mtId), mtToken: t.token, mtName: tarMtName(it) });
              mtToast(`📋 Supervisor Ileva: tarefa "${tarMtName(it)}" lançada no topo da coluna TAREFAS.`, true);
            } else {
              await mtUpdTask({ id: Number(mtId), notes: tarMtNotes(it) });
              if (it.mtName !== tarMtName(it)) { try { await mtUpdTask({ id: Number(mtId), name: tarMtName(it) }); } catch (e) { } tarPatch(it.id, { mtName: tarMtName(it) }); } // nome: só quando mudou
            }
            if (it.status === 'concluida' && !it.mtDone) {
              const seq = await mtTopSeq(MT_SEC_TAR_OK);
              await mtUpdTask({ id: Number(mtId), notes: tarMtNotes(it), status: 2, section_id: MT_SEC_TAR_OK, sequence: seq });
              tarPatch(it.id, { mtDone: Date.now() });
              mtToast(`✅ Supervisor Ileva: tarefa "${tarMtName(it)}" concluída e movida para Tarefas Entregues.`, true);
            } else if (it.status !== 'concluida' && it.mtDone) { // reaberta
              await mtUpdTask({ id: Number(mtId), status: 1, section_id: MT_SEC_TAR, sequence: await mtTopSeq(MT_SEC_TAR) });
              tarPatch(it.id, { mtDone: 0 });
            }
            ok = true;
          }
        } catch (e) { o.tries = (o.tries || 0) + 1; o.err = String(e && e.message || e); }
        q = (gmGetJ(TAR_MT_Q, []) || []);
        if (ok || o.tries >= 8) q = q.filter(x => !(x.id === o.id && x.at <= o.at)); else q = q.map(x => x.id === o.id ? o : x);
        gmSetJ(TAR_MT_Q, q);
      }
    } finally { tarMtBusy = false; }
  }
  // ===== Lembretes de cobrança (pedidos feitos a outras equipes) =====
  const LEMB_KEY = 'ilevaSup.lemb.v1';
  const LEMB_REP = [[0, 'Não repetir'], [60, 'A cada 1 hora'], [120, 'A cada 2 horas'], [240, 'A cada 4 horas'], [1440, 'Todo dia']];
  let lembForm = null, lembShowDone = false;
  function lembAll() { const l = lsGet(LEMB_KEY, []); return Array.isArray(l) ? l : []; }
  function lembSave(list) { lsSet(LEMB_KEY, list.filter(x => !(x.del && Date.now() - (x.upd || 0) > 7 * DAY)).slice(-300)); }
  function lembUpsert(it) { const L = lembAll(); const i = L.findIndex(x => x.id === it.id); it.upd = Date.now(); it.pending = !!SHARED_URL; if (i >= 0) L[i] = it; else L.push(it); lembSave(L); setTimeout(() => { try { syncMeets(); } catch (e) { } }, 400); }
  function lembMine(it) { const me = userNome().toLowerCase(); const r = (it.resp || '').trim().toLowerCase(); return !r || !me || r.split(/\s*[\/,&]\s*|\s+e\s+/).some(x => x && (me.startsWith(x) || x.startsWith(me.split(' ')[0]))); }
  function lembDue(now = Date.now()) { return lembAll().filter(x => !x.del && !x.done && x.quando <= now); }
  function lembMsg(it) {
    const d = new Date(it.criado || Date.now());
    return `Olá${it.equipe ? ', ' + it.equipe : ''}! Tudo bem? Passando para saber como está o andamento da solicitação: "${it.titulo}"${it.cliente ? ' (cliente ' + it.cliente + ')' : ''}, feita em ${twoD(d.getDate())}/${twoD(d.getMonth() + 1)}. Conseguem nos passar uma previsão? Obrigado!`;
  }
  function lembWhen(it, now) {
    if (it.done) return 'Resolvido ' + dayLabel(it.done).toLowerCase() + ' às ' + hhmm(it.done);
    const dlt = it.quando - now;
    if (dlt <= 0) return -dlt < MIN ? 'cobrar agora' : 'atrasado há ' + fmtDur(-dlt);
    return (isoDay(new Date(it.quando)) === isoDay(new Date(now)) ? 'hoje' : dayLabel(it.quando).toLowerCase()) + ' às ' + hhmm(it.quando);
  }
  function lembNext(it, base) { const rp = Number(it.repetir) || 0; let t = (base || Date.now()) + (rp ? rp * MIN : DAY); if (!rp) { const d = new Date(t); d.setHours(9, 0, 0, 0); t = d.getTime(); } return t; }
  function lembAct(it, act) {
    const now = Date.now();
    if (act === 'done') { it.done = now; it.doneBy = userNome(); }
    else if (act === 'reopen') { it.done = 0; it.quando = now + 30 * MIN; }
    else if (act === 'h1') it.quando = now + HOUR;
    else if (act === 'tom') { const d = new Date(now + DAY); d.setHours(9, 0, 0, 0); while (!isBizDay(d)) d.setDate(d.getDate() + 1); it.quando = d.getTime(); }
    else if (act === 'cobrei') { it.cobrancas = (it.cobrancas || 0) + 1; it.ultCob = now; it.quando = lembNext(it, now); }
    else if (act === 'del') { it.del = 1; }
    it.alertAt = 0;
    lembUpsert(it); lembToastHide(); render(true);
  }
  function renderLemb() {
    const now = Date.now(), L = lembAll().filter(x => !x.del);
    const f = lembForm;
    const out = [];
    if (f) {
      const bind = (el, k) => { el.addEventListener('input', () => { f[k] = el.value; }); el.addEventListener('change', () => { f[k] = el.value; }); el.addEventListener('keydown', e => e.stopPropagation()); return el; };
      const rep = h('select', {}, LEMB_REP.map(([v, t]) => h('option', { value: String(v), selected: Number(f.repetir) === v }, t))); bind(rep, 'repetir');
      const save = () => {
        const ts = new Date(`${f.dia}T${f.hora || '09:00'}:00`).getTime();
        if (!f.titulo.trim()) { f.err = 'Descreva o que foi solicitado.'; render(true); return; }
        if (isNaN(ts)) { f.err = 'Informe a data e o horário da cobrança.'; render(true); return; }
        const old = f.id ? lembAll().find(x => x.id === f.id) : null;
        const it = Object.assign(old || { id: 'lb' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), criado: now, criadoPor: userNome() }, { titulo: f.titulo.trim(), equipe: f.equipe.trim(), cliente: f.cliente.trim(), quando: ts, repetir: Number(f.repetir) || 0, resp: f.resp.trim(), obs: f.obs.trim(), alertAt: 0 });
        lembUpsert(it); lembForm = null;
        lastAction = { kind: 'info', key: '', label: `Lembrete salvo: cobrar ${it.equipe || 'a equipe'} ${lembWhen(it, Date.now())}.`, at: Date.now() };
        render(true);
      };
      out.push(h('div', { class: 'card purple lbform' },
        h('div', { class: 'gname' }, f.id ? 'Editar lembrete' : 'Novo lembrete de cobrança'),
        h('label', {}, 'O que foi solicitado'), bind(h('input', { type: 'text', value: f.titulo, placeholder: 'Ex.: Ajuste no boleto da associada' }), 'titulo'),
        h('div', { style: 'display:flex;gap:8px' },
          h('div', { style: 'flex:1' }, h('label', {}, 'Cobrar de quem (equipe/pessoa)'), bind(h('input', { type: 'text', value: f.equipe, placeholder: 'Ex.: Financeiro · Richard' }), 'equipe')),
          h('div', { style: 'flex:1' }, h('label', {}, 'Cliente (opcional)'), bind(h('input', { type: 'text', value: f.cliente, placeholder: 'Ex.: AG2' }), 'cliente'))),
        h('div', { style: 'display:flex;gap:8px' },
          h('div', { style: 'flex:1' }, h('label', {}, 'Cobrar em'), bind(h('input', { type: 'date', value: f.dia }), 'dia')),
          h('div', { style: 'flex:1' }, h('label', {}, 'Horário'), bind(h('input', { type: 'time', value: f.hora }), 'hora')),
          h('div', { style: 'flex:1.3' }, h('label', {}, 'Repetir cobrança'), rep)),
        h('label', {}, 'Responsável por cobrar'), bind(h('input', { type: 'text', value: f.resp, placeholder: 'Ex.: Lucas' }), 'resp'),
        h('label', {}, 'Observação (opcional)'), bind(h('textarea', { rows: '2', placeholder: 'Ex.: pedido aberto no ClickUp #1234' }, f.obs), 'obs'),
        f.err ? h('div', { class: 'warn' }, f.err) : null,
        h('div', { class: 'actions', style: 'margin-top:10px' }, h('button', { class: 'btn pri', onclick: save }, f.id ? 'Salvar alteração' : 'Salvar lembrete'), h('button', { class: 'btn', onclick: () => { lembForm = null; render(true); } }, 'Cancelar'))));
    } else {
      out.push(h('div', { class: 'actions', style: 'margin:0 0 10px' }, h('button', { class: 'btn pri', onclick: () => { const d = new Date(now + 2 * HOUR); d.setMinutes(0, 0, 0); lembForm = { id: null, titulo: '', equipe: '', cliente: '', dia: isoDay(d), hora: `${twoD(d.getHours())}:00`, repetir: '0', resp: userNome(), obs: '', err: '' }; render(true); } }, '+ Novo lembrete')));
    }
    const card = it => {
      const due = !it.done && it.quando <= now, late = due && now - it.quando > HOUR;
      const meta = [it.equipe ? 'Cobrar: ' + it.equipe : '', it.cliente ? 'Cliente: ' + it.cliente : '', it.resp ? 'Responsável: ' + it.resp : '', 'Pedido em ' + dayLabel(it.criado || now).toLowerCase(), it.cobrancas ? `${it.cobrancas} cobrança${it.cobrancas > 1 ? 's' : ''}` : '', it.repetir ? (LEMB_REP.find(r => r[0] === Number(it.repetir)) || [0, ''])[1].toLowerCase() : ''].filter(Boolean).join(' · ');
      const A = (t, a, pri) => h('button', { class: 'btn' + (pri ? ' pri' : ''), onclick: e => { e.stopPropagation(); lembAct(it, a); } }, t);
      return h('div', { class: 'lbcard' + (it.done ? ' done' : late ? ' late' : due ? ' due' : '') },
        h('span', { class: 'lw' }, lembWhen(it, now)), h('div', { class: 'lt' }, it.titulo), h('div', { class: 'lm' }, meta),
        it.obs ? h('div', { class: 'lo' }, it.obs) : null,
        h('div', { class: 'actions' },
          it.done ? [A('Reabrir', 'reopen'), (souDono(it.criadoPor, it.resp) || pode('excluir_de_outros') ? A('Excluir', 'del') : null)] : [
            h('button', { class: 'btn pri', onclick: e => { copy(lembMsg(it), e.currentTarget); } }, 'Copiar cobrança'),
            A('Cobrei', 'cobrei'), A('Resolvido', 'done'), A('+1 h', 'h1'), A('Amanhã 9h', 'tom'),
            h('button', { class: 'btn', onclick: () => { const d = new Date(it.quando); lembForm = { id: it.id, titulo: it.titulo, equipe: it.equipe || '', cliente: it.cliente || '', dia: isoDay(d), hora: `${twoD(d.getHours())}:${twoD(d.getMinutes())}`, repetir: String(it.repetir || 0), resp: it.resp || '', obs: it.obs || '', err: '' }; render(true); } }, 'Editar'),
            (souDono(it.criadoPor, it.resp) || pode('excluir_de_outros') ? A('Excluir', 'del') : null)]));
    };
    const ab = L.filter(x => !x.done).sort((a, b) => a.quando - b.quando);
    const agora = ab.filter(x => x.quando <= now), prox = ab.filter(x => x.quando > now);
    const feitos = L.filter(x => x.done && now - x.done < 7 * DAY).sort((a, b) => b.done - a.done);
    if (!ab.length && !f) out.push(h('div', { class: 'card' }, h('div', { class: 'who' }, 'Nenhum lembrete pendente. Use “+ Novo lembrete” quando pedir algo a outra equipe — o Supervisor avisa na hora de cobrar.')));
    if (agora.length) out.push(h('div', { class: 'grp' }, `Cobrar agora (${agora.length})`), ...agora.map(card));
    if (prox.length) out.push(h('div', { class: 'grp' }, `Próximos (${prox.length})`), ...prox.map(card));
    if (feitos.length) out.push(h('details', { open: lembShowDone }, h('summary', { onclick: () => { lembShowDone = !lembShowDone; } }, `Resolvidos nos últimos 7 dias (${feitos.length})`), ...feitos.map(card)));
    return out;
  }
  // aviso no canto quando chega a hora de cobrar (para o responsável)
  let lembEl = null, lembShown = '';
  function lembToastHide() { if (lembEl) { lembEl.classList.remove('show'); } lembShown = ''; }
  function lembTick() {
    try {
      if (!shadow || isPresenting() || lunchOn()) { lembToastHide(); return; }
      const now = Date.now(), due = lembDue(now).filter(lembMine).filter(x => !x.alertAt || now - x.alertAt > 10 * MIN || lembShown === x.id);
      if (!due.length) { if (lembShown && !lembDue(now).some(x => x.id === lembShown)) lembToastHide(); return; }
      const it = due.sort((a, b) => a.quando - b.quando)[0];
      if (lembShown === it.id && lembEl && lembEl.classList.contains('show')) return;
      // marca o horário do aviso (repete a cada 10 min até alguém agir)
      const L = lembAll(); const x = L.find(y => y.id === it.id); if (x) { x.alertAt = now; lsSet(LEMB_KEY, L); }
      if (!lembEl || !shadow.contains(lembEl)) { lembEl = h('div', { class: 'ctoast lbtoast' }); shadow.append(lembEl); }
      lembShown = it.id;
      const lq = h('div', { class: 'lgq' }); const lgS = h('span', { class: 'lg' }); setHTML(lgS, LOGO_SVG.replace(/ilvLg/g, 'ilvLgR')); lq.append(lgS);
      const bd = h('span', { class: 'bdg', style: 'background:#f4c060' }); setHTML(bd, `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#111" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`); lq.append(bd);
      const B = (t, fn, pri) => h('button', { class: 'cb' + (pri ? ' pri' : ''), onclick: e => { e.stopPropagation(); fn(e); } }, t);
      lembEl.className = 'ctoast lbtoast show';
      lembEl.replaceChildren(lq, h('div', { style: 'flex:1;min-width:0' }, h('div', { class: 'who2' }, 'Supervisor Ileva · lembrete'), h('div', { class: 'tt' }, `Cobrar ${it.equipe || 'a equipe'}`), h('div', { class: 'tx' }, `${it.titulo}${it.cliente ? ' · ' + it.cliente : ''} · pedido ${dayLabel(it.criado || now).toLowerCase()}`),
        h('div', { class: 'bb' }, B('Copiar cobrança', e => copy(lembMsg(it), e.currentTarget), true), B('Cobrei', () => lembAct(it, 'cobrei')), B('Resolvido', () => lembAct(it, 'done')), B('+1 h', () => lembAct(it, 'h1')))),
        h('button', { class: 'cx', title: 'Fechar (lembra de novo em 10 min)', onclick: e => { e.stopPropagation(); lembToastHide(); } }, '×'));
      // posição: acima do outro aviso / da barra
      const r = fab && fab.style.display !== 'none' && fab.offsetWidth ? fab.getBoundingClientRect() : null;
      let bottom = (r ? Math.max(12, VH() - r.top + 10) : 18) + (ui.open ? 0 : pqH()); if (ctoastEl && ctoastEl.classList.contains('show')) bottom += ctoastEl.offsetHeight + 10;
      lembEl.style.right = (ui.open && panel && panel.offsetWidth ? panel.offsetWidth + 14 : (r ? Math.max(12, VW() - r.right) : 18)) + 'px'; lembEl.style.bottom = bottom + 'px'; lembEl.style.width = Math.min(360, VW() - 24) + 'px';
      if (IS_WA) { beep(false); try { if ('Notification' in window && Notification.permission === 'granted') ilevaNotif(`Lembrete: cobrar ${it.equipe || 'a equipe'}`, { body: it.titulo + (it.cliente ? ' · ' + it.cliente : ''), tag: 'ileva-lemb-' + it.id }); } catch (e) { } }
    } catch (e) { }
  }
  // ---- Encerramento do dia (18h): números do dia + contagem para o Natal (opção H)
  const EOD_KEY = 'ilevaSup.eod.v1'; let eodEl = null;
  function eodTick() {
    try {
      if (!shadow || !IS_WA || !isCorp() || isPresenting() || lunchOn()) return;
      const now = Date.now(), d = new Date(now), hm = d.getHours() * 60 + d.getMinutes();
      if (hm < 18 * 60 || hm > 18 * 60 + 40 || !isBizDay(d)) return;
      if (lsGet(EOD_KEY, '') === isoDay(d)) return;
      if (eodEl && eodEl.classList.contains('show')) return;
      lsSet(EOD_KEY, isoDay(d));
      const st = lastSt || computeAll(), r = rxData(st);
      const xd = xmasDays(now), nome = (userNome() || '').split(' ')[0];
      if (!eodEl || !shadow.contains(eodEl)) { eodEl = h('div', { class: 'ctoast eod' }); shadow.append(eodEl); }
      const lq = h('div', { class: 'lgq' }); const lgS = h('span', { class: 'lg' }); setHTML(lgS, LOGO_SVG.replace(/ilvLg/g, 'ilvLgE')); lq.append(lgS);
      const bd = h('span', { class: 'bdg', style: 'background:#2fbf71' }); setHTML(bd, `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`); lq.append(bd);
      const close = () => { eodEl.classList.add('out'); setTimeout(() => eodEl && eodEl.classList.remove('show', 'out'), 300); };
      eodEl.className = 'ctoast eod show';
      eodEl.replaceChildren(lq, h('div', { style: 'flex:1;min-width:0' },
        h('div', { class: 'who2' }, 'Supervisor Ileva · encerramento do dia'),
        h('div', { class: 'tt' }, `Bom trabalho hoje${nome ? ', ' + nome : ''}`),
        h('div', { class: 'nums' }, h('div', {}, h('b', {}, String(r.finalizados.length)), 'finalizados'), h('div', {}, h('b', {}, String(r.andamento.length)), 'em andamento'), h('div', {}, h('b', {}, String(r.aberto.length)), 'em aberto')),
        r.aberto.length ? h('div', { class: 'tx', style: 'margin-top:6px' }, `Antes de sair, confira ${r.aberto.length > 1 ? 'os ' + r.aberto.length + ' atendimentos em aberto' : 'o atendimento em aberto'}.`) : null,
        xd != null && xd > 0 ? h('div', { class: 'xm' }, `Faltam ${xd} dia${xd > 1 ? 's' : ''} para o Natal`) : xd === 0 ? h('div', { class: 'xm' }, 'Feliz Natal! A Ileva deseja boas festas a você e à sua família.') : null,
        h('div', { class: 'bb' }, h('button', { class: 'cb pri', onclick: e => { e.stopPropagation(); close(); } }, 'Até amanhã'), r.aberto.length ? h('button', { class: 'cb', onclick: e => { e.stopPropagation(); close(); setOpen(true); setTab('atend'); } }, 'Ver em aberto') : null)),
        h('button', { class: 'cx', title: 'Fechar', onclick: e => { e.stopPropagation(); close(); } }, '×'));
      const fr = fab && fab.style.display !== 'none' && fab.offsetWidth ? fab.getBoundingClientRect() : null;
      eodEl.style.right = (ui.open && panel && panel.offsetWidth ? panel.offsetWidth + 14 : (fr ? Math.max(12, VW() - fr.right) : 18)) + 'px';
      eodEl.style.bottom = ((fr ? Math.max(12, VH() - fr.top + 10) : 18) + (ui.open ? 0 : pqH())) + 'px';
      eodEl.style.width = Math.min(360, VW() - 24) + 'px';
      beep(false);
    } catch (e) { }
  }
  function lembMerge(rem) {
    if (!Array.isArray(rem)) return;
    const L = lembAll(); let ch = false;
    for (const r of rem) { if (!r || !r.id) continue; const i = L.findIndex(x => x.id === r.id); if (i < 0) { L.push(Object.assign({}, r, { pending: false })); ch = true; } else if (!L[i].pending && (r.upd || 0) > (L[i].upd || 0)) { L[i] = Object.assign({}, r, { pending: false, alertAt: L[i].alertAt }); ch = true; } }
    if (ch) { lembSave(L); if (ui.open && ui.tab === 'lemb') render(false); }
  }
  // ===== Horários livres para oferecer ao cliente (seg a sex, 09:30 e 14:30) =====
  const SLOT_TIMES = ['09:30', '14:30'], SLOT_DAYS = 10, SLOT_GAP = 60 * MIN, MTAG_KEY = 'ilevaSup.mtAgenda.v1';
  let slotSel = [], slotOpen = true;
  const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'], WDL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  function busyList() {
    const ag = lsGet(MTAG_KEY, null), out = meets.filter(m => !m.del).map(m => ({ ts: m.ts, cliente: m.cliente, resp: m.resp, fin: m.fin || 0, live: m.live || 0 }));
    if (ag && Array.isArray(ag.list)) for (const x of ag.list) if (!meets.some(m => m.del && sameMeet(m, Object.assign({ id: '' }, x))) && !out.some(m => Math.abs(m.ts - x.ts) < MIN && reunNorm(m.cliente) === reunNorm(x.cliente)) && !meets.some(m => reunNorm(m.cliente) === reunNorm(x.cliente) && (m.upd || 0) > ag.at && isoDay(new Date(m.ts)) === isoDay(new Date(x.ts)))) out.push(x); // reunião remarcada aqui e o card ainda não foi relido
    return out;
  }
  function freeSlots(now = Date.now()) {
    const busy = busyList(), days = [], d = new Date(now); d.setHours(12, 0, 0, 0);
    for (let i = 0; days.length < SLOT_DAYS && i < 30; i++, d.setDate(d.getDate() + 1)) {
      if (!isBizDay(d)) continue;
      days.push({ d: new Date(d), slots: SLOT_TIMES.map(t => {
        const [H, M] = t.split(':').map(Number), ts = new Date(d.getFullYear(), d.getMonth(), d.getDate(), H, M).getTime();
        const occ = busy.filter(b => Math.abs(b.ts - ts) < SLOT_GAP);
        return { ts, t, occ, past: ts < now + 30 * MIN };
      }) });
    }
    return days;
  }
  function slotTxt(ts) { const d = new Date(ts); return `${WDL[d.getDay()].replace(/^./, c => c.toUpperCase())}, ${twoD(d.getDate())}/${twoD(d.getMonth() + 1)} às ${hhmm(ts)}`; }
  // ===== Horários oferecidos ao cliente (compartilhado com a equipe) =====
  const OFFER_KEY = 'ilevaSup.offers.v1', OFFER_TTL = DAY;
  let offerWarn = null; // { list, others, text }
  function offersAll() { const o = lsGet(OFFER_KEY, {}); return o && typeof o === 'object' ? o : {}; }
  function offerSet(id, v) { const o = offersAll(); o[id] = v; for (const k of Object.keys(o)) if (Date.now() - (o[k].at || 0) > 3 * DAY) delete o[k]; lsSet(OFFER_KEY, o); }
  // oferta aberta: não expirou, não foi liberada e nenhum dos horários foi agendado depois dela
  function offerOpen(of) {
    if (!of || of.del || Date.now() - of.at > OFFER_TTL) return false;
    return !(of.slots || []).some(ts => meets.some(m => !m.del && Math.abs(m.ts - ts) < 60 * MIN && (m.upd || 0) >= of.at - MIN));
  }
  function offersOpen() { return Object.entries(offersAll()).map(([id, v]) => Object.assign({ id }, v)).filter(offerOpen); }
  function offerBySlot(ts, exceptMe) { const me = userNome(); return offersOpen().filter(of => (of.slots || []).includes(ts) && !(exceptMe && of.by && me && of.by === me)); }
  function offerRegister(list) {
    const id = 'of' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), by = userNome() || 'equipe', at = Date.now();
    offerSet(id, { by, at, slots: list.slice() });
    const q = lsGet(FIN_Q, []) || []; q.push({ name: `__offer|${id}|${list.join(',')}`, ts: at, by, del: 0 }); lsSet(FIN_Q, q.slice(-200));
    setTimeout(() => { try { syncMeets(); } catch (e) { } }, 300);
  }
  function offerRelease(of) {
    offerSet(of.id, Object.assign({}, of, { del: Date.now() }));
    const q = lsGet(FIN_Q, []) || []; q.push({ name: `__offer|${of.id}|${(of.slots || []).join(',')}`, ts: Date.now(), by: of.by, del: 1 }); lsSet(FIN_Q, q.slice(-200));
    setTimeout(() => { try { syncMeets(); } catch (e) { } }, 300); render(true);
  }
  function offerMerge(f) { const pp = f.name.split('|'); const id = pp[1], slots = (pp[2] || '').split(',').map(Number).filter(Boolean); const cur = offersAll()[id]; if (f.del) { if (cur && !cur.del) offerSet(id, Object.assign({}, cur, { del: f.ts })); else if (!cur) offerSet(id, { by: f.by, at: f.ts, slots, del: f.ts }); } else if (!cur) offerSet(id, { by: f.by, at: f.ts, slots }); }
  function copySlots(list, btn) {
    const others = []; for (const ts of list) for (const of of offerBySlot(ts, true)) if (!others.includes(of)) others.push(of);
    if (!others.length) { copy(slotsMsg(list), btn); offerRegister(list); offerWarn = null; lastAction = { kind: 'info', key: '', label: `${list.length} horário${list.length > 1 ? 's' : ''} copiado${list.length > 1 ? 's' : ''}. A equipe verá que você ofereceu esses horários até alguém agendar.`, at: Date.now() }; render(true); return; }
    offerWarn = { list: list.slice(), others, text: slotsMsg(list) }; render(true);
  }
  function slotsMsg(list) { return 'Olá! Temos os seguintes horários disponíveis para a reunião:\n' + list.map(ts => '• ' + slotTxt(ts)).join('\n') + '\nQual fica melhor para vocês?'; }
  function renderSlots() {
    const now = Date.now(), days = freeSlots(now), ag = lsGet(MTAG_KEY, null);
    const free = days.flatMap(x => x.slots).filter(s => !s.occ.length && !s.past).map(s => s.ts);
    slotSel = slotSel.filter(ts => free.includes(ts));
    const busyAll = busyList();
    const grid = [h('div', {}), ...SLOT_TIMES.map(t => h('div', { class: 'sh' }, t)), h('div', {})];
    days.forEach((x, n) => {
      const dk = isoDay(x.d);
      const dayMeets = busyAll.filter(b => isoDay(new Date(b.ts)) === dk).sort((a, b) => a.ts - b.ts);
      const edit = o => meets.find(m => !m.del && Math.abs(m.ts - o.ts) < MIN && reunNorm(m.cliente) === reunNorm(o.cliente));
      const busyCell = o => { const mm = edit(o), st = o.fin ? 'fin' : o.live ? 'live' : '';
        const tip = `${hhmm(o.ts)} ${o.cliente}${o.resp ? ' (' + o.resp + ')' : ''}` + (o.fin ? `\nConcluída às ${hhmm(o.fin)}${o.fin > o.ts ? ' · duração ' + fmtDurMin(o.fin - o.ts) : ''}` : o.live ? '\nAcontecendo agora' : '') + (mm && !o.fin ? '\nClique para editar / mudar o horário' : '');
        return h('div', { class: 'c busy' + (st ? ' ' + st : ''), title: tip, onclick: mm && !o.fin ? () => openMeetForm(mm) : null },
          h('small', {}, o.fin ? '✓ Concluída' + (o.resp ? ' · ' + o.resp : '') : o.live ? '● Acontecendo' : hhmm(o.ts) + (o.resp ? ' · ' + o.resp : '')), h('span', {}, o.cliente)); };
      if (n) grid.push(h('div', { class: 'dv' }));
      grid.push(h('div', { class: 'sd' }, h('b', {}, WD[x.d.getDay()]), twoD(x.d.getDate()) + '/' + twoD(x.d.getMonth() + 1)));
      const used = new Set();
      x.slots.forEach(s2 => {
        if (s2.occ.length) { const o = s2.occ.slice().sort((a, b) => Math.abs(a.ts - s2.ts) - Math.abs(b.ts - s2.ts))[0]; used.add(o.ts + '|' + reunNorm(o.cliente)); grid.push(busyCell(o)); }
        else if (s2.past) grid.push(h('div', { class: 'c past' }, '—'));
        else { const ofs = offerBySlot(s2.ts, false), sel = slotSel.includes(s2.ts);
          grid.push(h('div', { class: 'c free' + (ofs.length ? ' ofr' : '') + (sel ? ' sel' : ''), title: ofs.length ? ofs.map(o => `Oferecido por ${o.by} às ${hhmm(o.at)} — ainda sem agendamento`).join('\n') + '\nClique para selecionar' : 'Clique para selecionar', onclick: () => { slotSel = sel ? slotSel.filter(v => v !== s2.ts) : slotSel.concat(s2.ts).sort((a, b) => a - b); offerWarn = null; render(true); } },
            sel ? 'Selecionado' : ofs.length ? [h('small', {}, 'Oferecido · ' + ofs[0].by.split(' ')[0]), h('span', {}, 'Livre')] : 'Livre')); }
      });
      grid.push(h('button', { class: 'add', title: 'Agendar neste dia em outro horário (encaixe)', onclick: () => { meetForm = Object.assign(meetForm || {}, { dia: dk, hora: '', err: '' }); render(true); try { const sc = shadow.querySelector('.card.blue'); if (sc) sc.scrollIntoView({ block: 'start' }); } catch (e) { } } }, '+'));
      const extra = dayMeets.filter(o => !used.has(o.ts + '|' + reunNorm(o.cliente)));
      if (extra.length) grid.push(h('div', {}), h('div', { class: 'ex' }, ...extra.map(o => { const mm = edit(o); return h('div', { class: 'c busy' + (o.fin ? ' fin' : o.live ? ' live' : ''), title: `${hhmm(o.ts)} ${o.cliente}${o.resp ? ' (' + o.resp + ')' : ''} — fora do horário padrão` + (o.fin ? `\nConcluída às ${hhmm(o.fin)}` : '') + (mm && !o.fin ? '\nClique para editar / mudar o horário' : ''), onclick: mm && !o.fin ? () => openMeetForm(mm) : null }, h('small', {}, (o.fin ? '✓ ' : o.live ? '● ' : '') + hhmm(o.ts)), h('span', {}, o.cliente + (o.resp ? ' · ' + o.resp : ''))); })), h('div', {}));
    });
    const rows = [h('div', { class: 'slg' }, ...grid)];
    const toCopy = slotSel.length ? slotSel : free.filter(ts => !offerBySlot(ts, true).length).slice(0, 4); // sem escolha: pula os já oferecidos por outro colaborador
    const info = ag && ag.at ? `Card do MeisterTask lido às ${hhmm(ag.at)}${isoDay(new Date(ag.at)) !== isoDay(new Date()) ? ' de ' + dayLabel(ag.at).toLowerCase() : ''}` : 'O card do MeisterTask é lido sozinho quando o MeisterTask estiver aberto em alguma aba.';
    return h('details', { class: 'card green', open: slotOpen }, h('summary', { onclick: e => { e.preventDefault(); slotOpen = !slotOpen; render(true); } }, `Horários disponíveis para oferecer (${free.length})`),
      h('div', { class: 'who', style: 'margin:2px 0 6px' }, 'Clique em “Livre” para escolher o que oferecer. Em cinza, reuniões já marcadas (clique para mudar). “+” agenda outro horário no dia. ' + info + '.'),
      ...rows,
      h('div', { class: 'actions', style: 'margin-top:8px' },
        h('button', { class: 'btn pri', disabled: !toCopy.length, onclick: e => copySlots(toCopy, e.currentTarget) }, slotSel.length ? `Copiar ${slotSel.length} horário${slotSel.length > 1 ? 's' : ''} para o cliente` : `Copiar os próximos ${toCopy.length} livres`),
        slotSel.length === 1 ? h('button', { class: 'btn', onclick: () => { const d = new Date(slotSel[0]); meetForm = Object.assign(meetForm || {}, { dia: isoDay(d), hora: hhmm(slotSel[0]), err: '' }); slotSel = []; render(true); if (bodyEl) bodyEl.scrollTop = 0; } }, 'Agendar neste horário') : null,
        slotSel.length ? h('button', { class: 'btn', onclick: () => { slotSel = []; offerWarn = null; render(true); } }, 'Limpar') : null),
      offerWarn ? (() => {
        const W = offerWarn, names = [...new Set(W.others.map(o => o.by))];
        const ta = h('textarea', {}, W.text); ta.addEventListener('input', () => { W.text = ta.value; }); ta.addEventListener('keydown', e => e.stopPropagation());
        return h('div', { class: 'ofw' },
          h('div', { class: 'wt' }, ...W.others.map((o, i) => h('div', { style: i ? 'margin-top:4px' : '' }, '⚠ ', h('b', {}, o.by), ` disponibilizou ${o.slots.length > 1 ? 'estes horários' : 'este horário'} às ${hhmm(o.at)} e ainda não realizou agendamento (${o.slots.filter(t => W.list.includes(t)).map(t => slotTxt(t).replace(/^[^,]+, /, '')).join('; ')}).`)),
            h('div', { style: 'margin-top:6px' }, `Por favor, verifique com ${names.join(' e ')} se o cliente já escolheu horário. Você pode editar a mensagem abaixo antes de copiar.`)),
          ta,
          h('div', { class: 'actions', style: 'margin-top:8px' },
            h('button', { class: 'btn pri', onclick: e => { copy(W.text, e.currentTarget); offerRegister(W.list); offerWarn = null; lastAction = { kind: 'info', key: '', label: 'Mensagem copiada. A equipe verá que você também ofereceu esses horários.', at: Date.now() }; render(true); } }, 'Copiar mensagem editada'),
            h('button', { class: 'btn', onclick: () => { offerWarn = null; render(true); } }, 'Cancelar')));
      })() : null,
      (() => { const me = userNome(), mine = offersOpen().filter(o => o.by && me && o.by === me); if (!mine.length) return null;
        return h('div', { class: 'ofmine' }, 'Você ofereceu:', ...mine.map(o => h('span', {}, `${o.slots.length} horário${o.slots.length > 1 ? 's' : ''} às ${hhmm(o.at)} `, h('button', { class: 'btn', style: 'padding:3px 8px;font-size:11.5px', title: 'O cliente não vai usar esses horários: libera para a equipe', onclick: () => offerRelease(o) }, 'Liberar')))); })());
  }
  // lê o card "Treinamentos/Reuniões" direto pela API do MeisterTask (em qualquer aba do MeisterTask aberta)
  let mtAgBusy = false;
  // limpa o card: tira reuniões de dias que já passaram e as finalizadas no Supervisor (fica só o que vai acontecer)
  function reunCleanText(text, now = Date.now()) {
    const NL = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const markRe = /^\s*`?\s*•?\s*(OFERTAR|DOM|SEG|TER|QUA|QUI|SEX|S[AÁ]B)\s*:?\s*`?\s*$/i;
    const headRe = /^\s*[*_]*\s*(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2})[:h](\d{2})\s*-\s*(.*)$/;
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const y0 = today.getFullYear(), removed = [];
    let i = 0;
    while (i < lines.length) {
      const m = lines[i].match(headRe);
      if (!m) { i++; continue; }
      const [dd, mm, HH, MI] = [+m[1], +m[2], +m[3], +m[4]];
      const cliente = m[5].replace(/[*_`]/g, '').trim();
      const ts = [y0 - 1, y0, y0 + 1].map(y => new Date(y, mm - 1, dd, HH, MI).getTime()).sort((a, b) => Math.abs(a - now) - Math.abs(b - now))[0];
      const past = ts < today.getTime();
      const fin = meets.some(x => !x.del && x.fin && reunNorm(x.cliente) === reunNorm(cliente) && Math.abs(x.ts - ts) < MIN);
      if (!past && !fin) { i++; continue; }
      let e = i + 1; while (e < lines.length && lines[e].trim() !== '' && !markRe.test(lines[e]) && !headRe.test(lines[e])) e++;
      if (e < lines.length && lines[e].trim() === '') e++; // leva junto a linha em branco que separa
      removed.push(`${twoD(dd)}/${twoD(mm)} ${twoD(HH)}:${twoD(MI)} ${cliente}`);
      lines.splice(i, e - i);
    }
    return { text: lines.join(NL), removed };
  }
  let mtCleanBusy = false, mtCleanLast = 0;
  async function mtReunClean(force) {
    if (mtCleanBusy || !HAS_GM || !/(^|\.)meistertask\.com$/.test(location.hostname)) return;
    if (document.querySelector('textarea.kr-view')) return; // alguém editando: espera
    const flag = gmGetJ('ilevaSup.mtClean.v1', 0) || 0;
    if (!force && !(flag > mtCleanLast) && Date.now() - mtCleanLast < 5 * MIN) return;
    mtCleanBusy = true; mtCleanLast = Date.now();
    try {
      const tok = ((mtReunCfg().url || MTR_URL_PADRAO).match(/\/task\/([A-Za-z0-9]+)/) || [])[1]; if (!tok) return;
      const d = await mtGql('IlevaAgenda', `query { find_task_by_token(token: "${tok}") { id notes } }`);
      const t = d && d.find_task_by_token; if (!t || typeof t.notes !== 'string') return;
      const r = reunCleanText(t.notes);
      if (!r.removed.length || r.text === t.notes) return;
      await mtUpdTask({ id: t.id, notes: r.text });
      gmSetJ('ilevaSup.mtClean.v1', 0);
      mtToast(`🧹 Supervisor Ileva: ${r.removed.length > 1 ? r.removed.length + ' reuniões concluídas foram retiradas' : 'a reunião ' + r.removed[0] + ' foi retirada'} do card Treinamentos/Reuniões.`, true);
    } catch (e) { } finally { mtCleanBusy = false; }
  }
  async function mtAgendaFetch() {
    if (mtAgBusy || !/(^|\.)meistertask\.com$/.test(location.hostname)) return;
    const ag = lsGet(MTAG_KEY, null); if (ag && Date.now() - ag.at < 90 * 1000) return; // outra aba já leu
    mtAgBusy = true;
    try {
      const tok = ((mtReunCfg().url || MTR_URL_PADRAO).match(/\/task\/([A-Za-z0-9]+)/) || [])[1]; if (!tok) return;
      const d = await mtGql('IlevaAgenda', `query { find_task_by_token(token: "${tok}") { id notes } }`);
      const notes = d && d.find_task_by_token && d.find_task_by_token.notes; if (typeof notes !== 'string') return;
      const list = reunParse(notes).filter(x => x.ts > Date.now() - DAY).map(x => ({ ts: x.ts, cliente: x.cliente, resp: x.resp }));
      lsSet(MTAG_KEY, { at: Date.now(), list });
      try { reunImport(notes); } catch (e) { }
    } catch (e) { } finally { mtAgBusy = false; }
  }
  function renderMeet() {
    const now = Date.now();
    const f = meetForm || (meetForm = { id: null, cliente: '', dia: isoDay(new Date()), hora: '', resp: '', assunto: '', contato: '', mt: mtReunCfg().auto !== false, err: '' });
    const bind = (el, k) => { el.addEventListener('input', () => { f[k] = el.value; if ((k === 'dia' || k === 'hora') && f.conflict) { f.conflict = false; f.err = ''; } }); el.addEventListener('change', () => { f[k] = el.value; }); return el; };
    const form = h('div', { class: 'card blue' },
      h('div', { class: 'gname' }, f.id ? '✏️ Editar reunião' : '➕ Agendar reunião'),
      h('label', {}, 'Cliente'), bind(h('input', { type: 'text', value: f.cliente, placeholder: 'Nome do cliente / associação' }), 'cliente'),
      h('div', { style: 'display:flex;gap:8px' },
        h('div', { style: 'flex:1' }, h('label', {}, 'Data'), bind(h('input', { type: 'date', value: f.dia }), 'dia')),
        h('div', { style: 'flex:1' }, h('label', {}, 'Horário'), (() => { const el = bind(h('input', { type: 'time', value: f.hora }), 'hora'); el.addEventListener('change', () => render(true)); return el; })())),
      h('div', { class: 'actions', style: 'margin-top:6px' },
        h('button', { class: 'btn', title: 'Reunião em cima da hora, fora dos horários padrão', onclick: () => { const t = new Date(Date.now() + 10 * MIN); t.setMinutes(Math.ceil(t.getMinutes() / 5) * 5, 0, 0); f.dia = isoDay(t); f.hora = hhmm(t.getTime()); render(true); } }, 'Encaixe agora (+10 min)'),
        h('button', { class: 'btn', onclick: () => { const t = new Date(Date.now() + 60 * MIN); t.setMinutes(Math.ceil(t.getMinutes() / 15) * 15, 0, 0); f.dia = isoDay(t); f.hora = hhmm(t.getTime()); render(true); } }, 'Daqui a 1 hora')),
      (() => {
        const ts = new Date(`${f.dia}T${f.hora || 'x'}:00`).getTime(); if (isNaN(ts)) return null;
        const msgs = [], dd = new Date(ts);
        if (!SLOT_TIMES.includes(f.hora) || !isBizDay(dd)) msgs.push('Fora do horário padrão (seg a sex, 09:30 e 14:30): será agendada como encaixe.');
        const cf = busyList().filter(b => Math.abs(b.ts - ts) < SLOT_GAP && !(f.id && meets.some(m => m.id === f.id && Math.abs(m.ts - b.ts) < MIN)));
        if (cf.length && !f.conflict) msgs.push('Atenção: já existe reunião perto desse horário — ' + cf.map(c => `${hhmm(c.ts)} ${c.cliente}${c.resp ? ' (' + c.resp + ')' : ''}`).join(', ') + '.');
        return msgs.length ? h('div', { class: 'warn', style: 'margin-top:6px' }, msgs.join(' ')) : null;
      })(),
      h('label', {}, 'Quem vai ministrar'), bind(h('input', { type: 'text', value: f.resp, placeholder: 'Ex.: Carolina' }), 'resp'),
      h('label', {}, 'Contato no cliente (quem vai participar)'), bind(h('input', { type: 'text', value: f.contato || '', placeholder: 'Ex.: Jorge' }), 'contato'),
      h('label', {}, 'Assunto / motivo'), bind(h('input', { type: 'text', value: f.assunto, placeholder: 'Ex.: Integração com a Lógica' }), 'assunto'),
      (() => { const c = h('input', { type: 'checkbox', checked: f.mt !== false }); c.addEventListener('change', () => { f.mt = c.checked; const g = mtReunCfg(); g.auto = c.checked; lsSet(MTR_KEY, g); }); return h('label', { class: 'chk' }, c, '📌 Lançar no card "Treinamentos/Reuniões" do MeisterTask'); })(),
      f.err ? h('div', { class: 'warn' }, '⚠️ ' + f.err) : null,
      h('div', { class: 'actions', style: 'margin-top:10px' },
        h('button', { class: 'btn pri', onclick: () => { f.force = false; saveMeet(); } }, f.id ? '💾 Salvar alteração' : '💾 Agendar'),
        f.conflict ? h('button', { class: 'btn danger', title: 'Ex.: outra pessoa da equipe vai ministrar', onclick: () => { f.force = true; saveMeet(); } }, 'Agendar mesmo assim') : null,
        f.id ? h('button', { class: 'btn', onclick: () => { meetForm = null; render(true); } }, 'Cancelar') : null),
      h('div', { class: 'who', style: 'margin-top:6px' }, 'O alerta aparece no topo da tela 10 minutos antes, com contagem regressiva, som e notificação do Windows, fica na tela durante a reunião e só sai quando alguém clicar em "✅ Reunião finalizada" (toda a equipe é avisada).'));
    const card = m => {
      const started = now >= m.ts, soon = now >= m.ts - MEET_BEFORE;
      if (m.fin) return h('div', { class: 'card green' },
        h('div', { class: 'top' },
          h('div', {}, h('div', { class: 'gname' }, m.cliente), h('div', { class: 'who' }, `${dayLabel(m.ts)} às ${hhmm(m.ts)}${m.resp ? ' · com ' + m.resp : ''}`)),
          h('div', { class: 'who', style: 'text-align:right' }, `✅ finalizada às ${hhmm(m.fin)}`, m.fin > m.ts ? h('div', {}, 'duração ' + fmtDurMin(m.fin - m.ts)) : null)),
        m.assunto ? h('div', { class: 'quote' }, m.assunto) : null);
      return h('div', { class: 'card ' + (m.done ? 'green' : started ? 'red' : soon ? 'yellow' : 'blue') },
        h('div', { class: 'top' },
          h('div', {}, h('div', { class: 'gname' }, m.cliente), h('div', { class: 'who' }, `${dayLabel(m.ts)} às ${hhmm(m.ts)}${m.resp ? ' · com ' + m.resp : ''}`)),
          m.done ? h('div', { class: 'who' }, '✔ encerrada') : m.live ? h('div', { class: 'wait green', style: 'font-size:13px' }, '🎥 acontecendo') : h('div', { class: 'wait ' + (started ? 'red' : soon ? 'yellow' : 'blue') + ' cd', 'data-ts': String(m.ts), style: 'font-size:14px' }, fmtCountdown(m.ts - now))),
        m.assunto ? h('div', { class: 'quote' }, m.assunto) : null,
        h('div', { class: 'actions' },
          !m.live && soon ? h('button', { class: 'btn', title: 'Informa para toda a equipe que a reunião está acontecendo', onclick: () => startMeet(m) }, '🎥 Reunião acontecendo') : null,
          (started || m.live) && podeFinalizar(m) ? h('button', { class: 'btn ok', title: 'Marca a reunião como finalizada para toda a equipe', onclick: () => finishMeet(m) }, '✅ Reunião finalizada') : null,
          h('button', { class: 'btn', onclick: () => openMeetForm(m) }, '✏️ Editar'),
          h('button', { class: 'btn', title: m.mtHead ? 'Atualiza esta reunião no card do MeisterTask' : 'Lança esta reunião no card "Treinamentos/Reuniões" do MeisterTask', onclick: () => mtReunQueue(m, m.mtHead ? 'update' : 'add') }, m.mtHead ? '📌 Atualizar no MeisterTask' : '📌 Lançar no MeisterTask'),
          !(souDono(m.resp) || pode('excluir_de_outros')) ? null : meetDelArm === m.id ? h('button', { class: 'btn danger', onclick: () => { if (m.mtHead) mtReunQueue(m, 'remove'); meetDelete(m); meetDelArm = null; saveMeets(); meetKey = ''; meetTick(); syncMeets(); render(true); } }, '⚠️ Confirmar exclusão')
            : h('button', { class: 'btn', onclick: () => { meetDelArm = m.id; render(true); } }, '🗑️ Excluir')));
    };
    const isNext = m => !m.del && !m.fin && m.ts + MEET_MAX >= now;
    const next = meets.filter(isNext).sort((a, b) => a.ts - b.ts);
    const past = meets.filter(m => !m.del && !isNext(m) && now - m.ts < DAY).sort((a, b) => b.ts - a.ts);
    const syncInfo = !SHARED_URL ? h('div', { class: 'info', style: 'margin-top:0' }, 'ℹ️ Agenda só deste computador (a planilha compartilhada ainda não foi configurada).')
      : sync.ok === false ? h('div', { class: 'warn', style: 'margin:0 0 8px' }, `⚠️ Agenda compartilhada: ${sync.err}. Tentando de novo a cada 30 s.`)
      : h('div', { class: 'who', style: 'margin:0 0 8px' }, sync.at ? `🔄 Agenda compartilhada com a equipe · atualizada às ${hhmm(sync.at)}` : '🔄 Conectando à agenda compartilhada…');
    const mtLink = h('input', { type: 'text', value: mtReunCfg().url || '', placeholder: 'Cole aqui o link do card Treinamentos/Reuniões' });
    mtLink.addEventListener('change', () => { const g = mtReunCfg(); g.url = mtLink.value.trim(); lsSet(MTR_KEY, g); });
    const mtBox = h('details', { class: 'card purple', open: !mtReunCfg().url }, h('summary', {}, '📌 Card de reuniões no MeisterTask'),
      h('div', { class: 'who' }, 'Abra o card "Treinamentos/Reuniões" no MeisterTask, copie o endereço da barra do navegador e cole abaixo (uma vez só).'), mtLink);
    return [syncInfo, renderSlots(), form, mtBox, undoBar(),
      h('div', { class: 'grp' }, `Próximas e em andamento (${next.length})`),
      next.length ? next.map(card) : h('div', { class: 'empty' }, 'Nenhuma reunião agendada.'),
      past.length ? [h('div', { class: 'grp' }, 'Finalizadas / encerradas nas últimas 24 h'), past.map(card)] : null];
  }

  const LEVEL_TXT = { red: 'URGENTE', yellow: 'ATENÇÃO', green: 'NO PRAZO' };
  let lastAction = null; // { kind:'final'|'tone', key, label, at }
  const FIN_Q = 'ilevaSup.finQ.v1';
  function finShare(name, del) {
    const q = lsGet(FIN_Q, []) || [];
    q.push({ name, ts: Date.now(), by: ((lsGet('ilevaSup.user.v1', {}) || {}).nome) || '', del: del ? 1 : 0 });
    lsSet(FIN_Q, q.slice(-200));
    setTimeout(() => { try { syncMeets(); } catch (e) { } }, 300);
  }
  function mergeFins(fins) {
    if (!Array.isArray(fins) || !data || !data.final) return;
    let ch = false;
    for (const f of fins) {
      if (!f || !f.name || !f.ts) continue;
      if (f.name.startsWith('__offer|')) { offerMerge(f); continue; }
      if (f.name.startsWith('__close|')) { const pp = f.name.split('|'); closeKbAdd(pp.slice(2).join('|'), pp[1], f.by, f.ts, !!f.del); continue; }
      if (f.name.startsWith('__rx|')) { const [, day, sl] = f.name.split('|'); if (!f.del) rxMarkRemote(day, sl, f.ts); continue; }
      const loc = data.final[f.name];
      if (f.del) { if (loc && loc.ts <= f.ts) { delete data.final[f.name]; ch = true; } }
      else if (!loc || loc.ts < f.ts) { data.final[f.name] = { ts: f.ts, by: f.by || 'equipe', shared: 1 }; ch = true; }
    }
    if (ch) { lsSet(LS_DATA, data); try { render(false); } catch (e) { } }
  }
  function finalize(name) {
    try { // aprende com a última mensagem do cliente, se ela parecer um encerramento
      const gr = computeGroup(name), msgs = gr ? gr.msgs : [], last = msgs[msgs.length - 1];
      const t = last && last.role === 'client' ? deacc(last.text) : '';
      const teamBefore = last && msgs.some(m => m.role === 'team' && !isTrivial(m.text) && m.ts <= last.ts);
      if (t && teamBefore && !/^\[.*\]$/.test(last.text) && !/\?/.test(t) && !CLOSE_REQ.test(t) && t.length <= 120 && closeKey(last.text).split(' ').length <= 14) {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6), by = userNome() || 'equipe';
        closeKbAdd(last.text, id, by, Date.now());
        const q = lsGet(FIN_Q, []) || []; q.push({ name: `__close|${id}|${String(last.text).slice(0, 140)}`, ts: Date.now(), by, del: 0 }); lsSet(FIN_Q, q.slice(-200));
      }
    } catch (e) { }
    data.final[name] = { ts: Date.now(), by: ((lsGet('ilevaSup.user.v1', {}) || {}).nome) || 'Supervisor' };
    finShare(name, false);
    lastAction = { kind: 'final', key: name, label: `Atendimento de "${name}" finalizado.`, at: Date.now() };
    lsSet(LS_DATA, data); render(true);
  }
  function reopen(name) { delete data.final[name]; finShare(name, true); lsSet(LS_DATA, data); lastAction = null; render(true); }
  function dismissTone(key) {
    data.dismissed[key] = Date.now();
    lastAction = { kind: 'tone', key, label: 'Alerta de tom marcado como revisado.', at: Date.now() };
    lsSet(LS_DATA, data); render(true);
  }
  function undoLast() {
    if (!lastAction) return;
    if (lastAction.kind === 'final') { delete data.final[lastAction.key]; finShare(lastAction.key, true); } else if (lastAction.kind === 'tone') delete data.dismissed[lastAction.key];
    lastAction = null; lsSet(LS_DATA, data); render(true);
  }
  function undoBar() {
    if (!lastAction || Date.now() - lastAction.at > 15000) return null;
    return h('div', { class: 'undo' }, h('span', {}, '✅ ' + lastAction.label), lastAction.kind === 'info' ? null : h('button', { class: 'btn', onclick: undoLast }, '↩ Desfazer'));
  }
  function openBtn(name) { return h('button', { class: 'btn', title: 'Abre o grupo no WhatsApp (só abre, não envia nada)', onclick: () => openChat(name) }, '💬 Abrir conversa'); }

  function imgThumb(id) {
    const im = h('img', { class: 'kbimg', title: 'Clique para ampliar', onclick: () => { if (im.src) showLightbox(im.src); } });
    imgGet(id).then(d => { if (d) im.src = d; });
    return im;
  }
  function showLightbox(src) {
    const lb = h('div', { class: 'lb', title: 'Clique para fechar', onclick: () => lb.remove() }, h('img', { src }));
    shadow.append(lb);
  }
  function imgsBlock(ids, withCopy) {
    if (!ids || !ids.length) return null;
    return h('div', { class: 'kbimgs' }, ids.map(id => h('div', { class: 'kbthumb' }, imgThumb(id),
      withCopy ? h('button', { class: 'btn mini', title: 'Copia a imagem; depois é só colar (Ctrl+V) na conversa', onclick: e => copyImg(id, e.currentTarget) }, '📋 Copiar imagem') : null)));
  }
  function simBlock(g, sims) {
    if (!sims.length) return null;
    return h('details', { open: true },
      h('summary', {}, `💡 Já respondemos algo parecido (${sims.length})`),
      sims.map(({ item, score }) => {
        const txt = kbReply(item, g.clientName);
        if (item.manual) return h('div', { class: 'sim' },
          h('div', { class: 'who' }, `📘 Base Ileva · ${item.title || 'sem título'} · ${Math.round(score * 100)}% parecido`),
          h('pre', {}, txt), imgsBlock(item.imgs, true),
          h('div', { class: 'actions' }, h('button', { class: 'btn pri', onclick: e => { item.uses = (item.uses || 0) + 1; saveMan(); copy(txt, e.currentTarget); } }, '📋 Copiar esta')));
        return h('div', { class: 'sim' },
          h('div', { class: 'who' }, `${item.group} · ${fmtTime(item.qTs)} · respondido por ${item.who || 'equipe'} · ${Math.round(score * 100)}% parecido${item.status === 'approved' ? ' · ✅ validada' : item.resolved ? ' · resolvido' : ''}`),
          h('div', { class: 'quote' }, 'Pergunta: "' + item.q.slice(0, 160) + (item.q.length > 160 ? '…' : '') + '"'),
          h('pre', {}, txt),
          h('div', { class: 'actions' },
            h('button', { class: 'btn pri', onclick: e => { item.uses = (item.uses || 0) + 1; saveKb(); copy(txt, e.currentTarget); } }, '📋 Copiar esta'),
            item.status !== 'approved' ? h('button', { class: 'btn ok', title: 'Marca como resposta boa: ela passa a ter prioridade', onclick: () => kbSet(item.id, 'approved') }, '👍 Validar') : null,
            h('button', { class: 'btn', title: 'Não sugerir mais esta resposta', onclick: () => kbSet(item.id, 'rejected') }, '👎 Não serve')));
      }));
  }
  function bestSuggestion(g, mode) {
    let s = suggest(g, mode);
    const qText = mode === 'promise' ? '' : g.pend.map(m => m.text).join(' ') || (g.lastRel ? g.lastRel.text : '');
    const sims = qText ? findSimilar(qText) : [];
    if (mode === 'open' && sims.length && (((s.topic === 'geral' || s.topic === 'devolutiva') && sims[0].score >= 0.45) || sims[0].score >= 0.55 || (sims[0].item.status === 'approved' && sims[0].score >= 0.45) || (sims[0].item.manual && sims[0].score >= 0.4))) {
      const it = sims[0].item;
      s = { text: kbReply(it, g.clientName), topic: 'kb', kb: true, src: it.manual ? `Base Ileva: ${it.title || ''}` : `Resposta já dada em ${it.group} (${fmtTime(it.qTs)})`, note: it.manual || it.status === 'approved' ? '' : 'Baseada em atendimento anterior: confira se o caso é o mesmo antes de enviar.', imgs: it.manual ? it.imgs : null, man: it.manual ? it : null };
      sims.shift();
    }
    return { s, sims };
  }
  function atendCard(g, mode, st) {
    let color, pill, waitTxt, blink = false;
    const sinceLabel = (g.pend[0] && g.pend[0].approxLabel) || (g.lastRel && g.lastRel.approxLabel);
    const fmtWait = () => g.approx ? 'desde ' + (sinceLabel || 'antes') : fmtDur(g.wait);
    if (mode === 'open') { color = g.level; pill = LEVEL_TXT[g.level]; waitTxt = fmtWait(); blink = g.level === 'red'; }
    else if (mode === 'promise') { color = 'purple'; pill = 'RETORNO PROMETIDO'; waitTxt = fmtDur(st.now - g.promise.since); }
    else { color = 'blue'; pill = 'AGUARDANDO CLIENTE'; waitTxt = fmtWait(); }
    const msg = mode === 'promise' ? g.promise.text : (g.lastRel ? g.lastRel.text : '');
    const msgWho = mode === 'promise' ? `${g.promise.who} (${fmtTime(g.promise.since)})` : `${g.clientName} (${g.lastRel ? fmtTime(g.lastRel.ts, g.lastRel.approxLabel) : ''})`;
    const critical = mode === 'open' && ((g.afterHours ? g.bizWait : g.wait) > 60 * MIN || (g.approx && !g.afterHours)); // fora do expediente: conta só a partir das 08:00
    return h('div', { class: `card ${color}${blink ? ' blink' : ''}` },
      h('div', { class: 'top' },
        h('div', { style: 'min-width:0' },
          h('div', {}, h('span', { class: `pill ${color}${blink ? ' blink' : ''}` }, critical ? 'CRÍTICO' : pill), h('span', { class: 'gname' }, g.name), g.afterHours && mode === 'open' ? h('div', { class: 'ahtag' }, '🌙 Chegou fora do expediente · prazo contado a partir das 08:00') : null),
          h('div', { class: 'who' }, mode === 'promise' ? 'Prometido por ' + msgWho : 'Última mensagem de ' + msgWho)),
        h('div', { class: `wait ${color}`, title: mode === 'promise' ? 'Tempo desde a promessa' : 'Tempo de espera do cliente' }, waitTxt)),
      h('div', { class: 'quote' }, `"${(msg || '').slice(0, 220)}"`),
      g.partial ? h('div', { class: 'warn' }, 'Vimos só a prévia da lista. Abra a conversa para confirmar.') : null,
      h('div', { class: 'actions' },
        openBtn(g.name),
        h('button', { class: 'btn ok', title: 'Use quando o atendimento já foi concluído pela equipe. Se o cliente escrever de novo, ele volta automaticamente.', onclick: () => finalize(g.name) }, '✅ Finalizar')));
  }
  function toneCard(t, st) {
    const editable = st.now - t.ts < 15 * MIN;
    return h('div', { class: 'card ' + (editable ? 'red blink' : 'yellow') },
      editable ? h('div', { class: 'edit' }, `✏️ DÁ PARA EDITAR AINDA — restam ${Math.max(0, 15 - Math.floor((st.now - t.ts) / MIN))} min`) : null,
      h('div', { class: 'top' }, h('div', {}, h('span', { class: 'gname' }, t.who), h('div', { class: 'who' }, `${t.group} · ${fmtTime(t.ts)}`))),
      h('div', { class: 'lbl' }, 'Mensagem enviada:'), h('div', { class: 'quote' }, t.original),
      h('div', { class: 'lbl' }, 'O que ajustar:'),
      h('ul', { class: 'iss' }, t.issues.map(i => h('li', {}, `${i.cat}: ${i.text}`))),
      h('div', { class: 'lbl' }, 'Versão corrigida:'), h('pre', { class: 'fix' }, t.fixed),
      h('div', { class: 'actions' }, h('button', { class: 'btn pri', onclick: e => copy(t.fixed, e.currentTarget) }, '📋 Copiar corrigida'), openBtn(t.group),
        h('button', { class: 'btn ok', title: 'Tira este alerta da lista (já foi tratado com o colaborador ou não é um problema)', onclick: () => dismissTone(t.key) }, '✅ Marcar como revisado')));
  }
  function renderAtend(st) {
    const out = [];
    const reds = st.open.filter(g => g.level === 'red'), others = st.open.filter(g => g.level !== 'red');
    out.push(undoBar());
    const f = ui.filter;
    if (f) {
      const names = { red: '🔴 Urgentes (mais de 15 min)', prazo: '🟡🟢 Em aberto, dentro do prazo', retorno: '🟣🔵 Retorno prometido / aguardando o cliente' };
      out.push(h('div', { class: 'filt' }, h('span', {}, 'Mostrando: ', h('b', {}, names[f])), h('button', { class: 'btn', onclick: () => setTab('atend', null) }, 'Ver todos')));
      let list = [];
      if (f === 'red') list = reds.map(g => atendCard(g, 'open', st));
      if (f === 'prazo') list = others.map(g => atendCard(g, 'open', st));
      if (f === 'retorno') list = [...st.promises.map(g => atendCard(g, 'promise', st)), ...st.waiting.map(g => atendCard(g, 'await', st))];
      return [...out, list.length ? list : h('div', { class: 'empty' }, '✅ Nada nesta lista agora.')];
    }
    if (!st.open.length && !st.promises.length && !st.waiting.length) return [...out, h('div', { class: 'empty' }, '✅ Nenhum atendimento pendente agora.')];
    if (reds.length) out.push(h('div', { class: 'grp', style: 'color:#f15c6d' }, `🔴 Responder já (${reds.length})`), reds.map(g => atendCard(g, 'open', st)));
    if (others.length) out.push(h('div', { class: 'grp' }, `🟡🟢 Em aberto, dentro do prazo (${others.length})`), others.map(g => atendCard(g, 'open', st)));
    if (st.promises.length) out.push(h('div', { class: 'grp' }, `🟣 Retorno prometido e não dado (${st.promises.length})`), st.promises.map(g => atendCard(g, 'promise', st)));
    if (st.waiting.length) out.push(h('div', { class: 'grp' }, `🔵 Aguardando o cliente (${st.waiting.length})`), st.waiting.map(g => atendCard(g, 'await', st)));
    return out;
  }
  function renderTom(st) {
    if (!st.tone.length) return [undoBar(), h('div', { class: 'empty' }, '✅ Nenhuma mensagem da equipe fora do padrão nas conversas lidas (24 h).')];
    const ed = st.tone.filter(t => st.now - t.ts < 15 * MIN), rest = st.tone.filter(t => st.now - t.ts >= 15 * MIN);
    const out = [undoBar()];
    if (ed.length) out.push(h('div', { class: 'grp', style: 'color:#f15c6d' }, `✏️ Ainda dá para editar (${ed.length})`), ed.map(t => toneCard(t, st)));
    if (rest.length) out.push(h('div', { class: 'grp' }, `Últimas 24 h (${rest.length})`), rest.map(t => toneCard(t, st)));
    return out;
  }
  function renderManha(st) {
    const out = [undoBar()];
    const mi = st.morningInfo;
    if (!mi) {
      out.push(h('div', { class: 'card blue' },
        h('div', { class: 'gname' }, `🌅 A leitura de hoje ainda não foi feita`),
        h('div', { class: 'who', style: 'margin-top:4px' }, `Todos os dias às ${cfg.morningTime}, o painel abre os grupos de clientes com atividade nos últimos ${cfg.morningDays} dias e lista aqui o que ficou em aberto. Se o WhatsApp estiver fechado nesse horário, a leitura acontece assim que ele for aberto.`),
        h('div', { class: 'actions' }, h('button', { class: 'btn pri', onclick: () => morningRound(true) }, '🌅 Fazer a leitura agora'))));
      return out;
    }
    out.push(h('div', { class: 'filt' },
      h('span', {}, `Leitura de hoje às ${fmtTime(mi.at)} · `, h('b', {}, `${st.morning.length} pendente${st.morning.length === 1 ? '' : 's'}`), st.morningDone.length ? ` · ${st.morningDone.length} já resolvido${st.morningDone.length === 1 ? '' : 's'}` : ''),
      h('button', { class: 'btn', title: 'Abre de novo todos os grupos e refaz a lista', onclick: () => morningRound(true) }, '🔄 Refazer')));
    if (!st.morning.length) { out.push(h('div', { class: 'empty' }, '✅ Tudo que ficou de ontem já foi tratado.')); return out; }
    const sec = (title, kinds) => {
      const list = st.morning.filter(x => kinds.includes(x.it.kind));
      if (!list.length) return;
      out.push(h('div', { class: 'grp' }, `${title} (${list.length})`));
      list.forEach(({ it, g }) => out.push(atendCard(g, it.kind === 'promise' ? 'promise' : it.kind === 'await' ? 'await' : 'open', st)));
    };
    sec('🔴 Cliente sem resposta', ['open']);
    sec('🟣 Retorno prometido e não dado', ['promise']);
    sec('🔵 Aguardando o cliente', ['await']);
    return out;
  }
  let kbQuery = '';
  let kbView = 'manual', kbForm = null, manQuery = '', kbDelArm = null;
  function renderBase(st) {
    const seg = h('div', { class: 'seg' },
      h('button', { class: 'btn' + (kbView === 'manual' ? ' on' : ''), onclick: () => { kbView = 'manual'; render(true); } }, `📘 Informações do sistema (${man.length})`),
      h('button', { class: 'btn' + (kbView === 'auto' ? ' on' : ''), onclick: () => { kbView = 'auto'; kbForm = null; render(true); } }, '🧠 Aprendidas nos atendimentos'));
    return [seg, kbView === 'manual' ? renderManual() : renderBaseAuto(st)];
  }
  function openForm(x) {
    kbForm = x ? { id: x.id, title: x.title || '', q: x.q || '', a: x.a || '', tags: x.tags || '', imgs: (x.imgs || []).map(id => ({ id })) } : { id: null, title: '', q: '', a: '', tags: '', imgs: [] };
    render(true); if (bodyEl) bodyEl.scrollTop = 0;
  }
  async function addFiles(files) {
    if (!kbForm) return;
    for (const f of files) {
      if (!f || !/^image\//.test(f.type)) continue;
      try { kbForm.imgs.push({ id: 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), data: await shrinkImage(f) }); } catch (e) { kbForm.err = 'Não consegui ler uma das imagens.'; }
    }
    render(true);
  }
  async function saveManual() {
    const f = kbForm;
    f.err = '';
    if (!f.title.trim() && !f.q.trim()) f.err = 'Preencha o assunto ou pelo menos uma pergunta.';
    else if (!f.a.trim() && !f.imgs.length) f.err = 'Escreva a resposta / explicação (ou adicione uma imagem).';
    if (f.err) { render(true); return; }
    try { for (const im of f.imgs) if (im.data) await imgPut(im.id, im.data); }
    catch (e) { f.err = 'Não consegui salvar as imagens (espaço do navegador cheio?).'; render(true); return; }
    const old = f.id ? man.find(x => x.id === f.id) : null;
    const keep = f.imgs.map(i => i.id);
    if (old) for (const id of old.imgs || []) if (!keep.includes(id)) imgDel(id);
    const item = old || { id: 'm' + Date.now().toString(36), manual: true, status: 'approved', group: '📘 Base Ileva', who: 'base cadastrada', qTs: Date.now(), uses: 0 };
    Object.assign(item, { title: f.title.trim(), q: f.q.trim(), a: f.a.trim(), tags: f.tags.trim(), imgs: keep, upd: Date.now() });
    delete item._v;
    if (!old) man.unshift(item);
    saveMan(); kbForm = null;
    lastAction = { kind: 'info', key: '', label: old ? 'Informação atualizada.' : 'Informação adicionada à base.', at: Date.now() };
    render(true);
  }
  function deleteManual(x) {
    for (const id of x.imgs || []) imgDel(id);
    man = man.filter(y => y.id !== x.id); kbDelArm = null; saveMan();
    lastAction = { kind: 'info', key: '', label: 'Informação excluída.', at: Date.now() };
    render(true);
  }
  async function exportManual(btn) {
    const imgs = {};
    for (const x of man) for (const id of x.imgs || []) { const d = await imgGet(id); if (d) imgs[id] = d; }
    const blob = new Blob([JSON.stringify({ type: 'ileva-base', v: 1, at: Date.now(), items: man.map(({ _v, ...r }) => r), imgs })], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `base-ileva-${new Date().toISOString().slice(0, 10)}.json` });
    shadow.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    if (btn) { const o = btn.textContent; btn.textContent = '✓ Arquivo baixado'; setTimeout(() => { btn.textContent = o; }, 2000); }
  }
  function importManual() {
    const inp = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0]; inp.remove(); if (!f) return;
      let n = 0, msg;
      try {
        const j = JSON.parse(await f.text());
        if (!j || j.type !== 'ileva-base' || !Array.isArray(j.items)) throw new Error('formato');
        for (const [id, d] of Object.entries(j.imgs || {})) await imgPut(id, d);
        for (const y of j.items) {
          if (!y || !y.id || !y.manual) continue;
          const i = man.findIndex(x => x.id === y.id);
          if (i < 0) { man.push(y); n++; } else if ((y.upd || 0) > (man[i].upd || 0)) { man[i] = y; n++; }
        }
        saveMan(); msg = `${n} informação(ões) importada(s)/atualizada(s).`;
      } catch (e) { msg = 'Arquivo inválido: use um arquivo exportado pelo botão "Exportar".'; }
      lastAction = { kind: 'info', key: '', label: msg, at: Date.now() }; render(true);
    });
    shadow.append(inp); inp.click();
  }
  function renderManual() {
    if (kbForm) {
      const f = kbForm;
      const bind = (el, k) => { el.addEventListener('input', () => { f[k] = el.value; }); return el; };
      const fileInp = h('input', { type: 'file', accept: 'image/*', multiple: true, style: 'display:none' });
      fileInp.addEventListener('change', () => addFiles([...fileInp.files]));
      const drop = h('div', { class: 'drop', tabindex: '0', onclick: () => fileInp.click() }, '🖼️ Clique para escolher imagens, arraste aqui ou cole um print (Ctrl+V)');
      drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('over'));
      drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); addFiles([...(e.dataTransfer ? e.dataTransfer.files : [])]); });
      const form = h('div', { class: 'card blue' },
        h('div', { class: 'gname' }, f.id ? '✏️ Editar informação' : '➕ Nova informação do sistema'),
        h('label', {}, 'Assunto / título'),
        bind(h('input', { type: 'text', value: f.title, placeholder: 'Ex.: Como gerar 2ª via do boleto' }), 'title'),
        h('label', {}, 'Perguntas que o cliente costuma fazer (uma por linha)'),
        bind(h('textarea', { rows: '4', value: f.q, placeholder: 'Como tiro a segunda via do boleto?\nO associado perdeu o boleto, como reemito?' }), 'q'),
        h('label', {}, 'Resposta / explicação'),
        bind(h('textarea', { rows: '7', value: f.a, placeholder: 'Passo a passo da resposta. A saudação e o "Qualquer dúvida…" são colocados automaticamente.' }), 'a'),
        h('label', {}, 'Palavras-chave (opcional, ajudam a encontrar)'),
        bind(h('input', { type: 'text', value: f.tags, placeholder: 'boleto, 2ª via, financeiro' }), 'tags'),
        h('label', {}, `Imagens (${f.imgs.length})`),
        drop, fileInp,
        f.imgs.length ? h('div', { class: 'kbimgs' }, f.imgs.map((im, i) => h('div', { class: 'kbthumb' },
          im.data ? h('img', { class: 'kbimg', src: im.data, onclick: () => showLightbox(im.data) }) : imgThumb(im.id),
          h('div', { class: 'imgbar' },
            i > 0 ? h('button', { class: 'btn mini', title: 'Mover para a esquerda', onclick: () => { f.imgs.splice(i - 1, 0, f.imgs.splice(i, 1)[0]); render(true); } }, '◀') : null,
            h('button', { class: 'btn mini', title: 'Remover imagem', onclick: () => { f.imgs.splice(i, 1); render(true); } }, '✕ Remover'))))) : null,
        f.err ? h('div', { class: 'warn' }, '⚠️ ' + f.err) : null,
        h('div', { class: 'actions', style: 'margin-top:10px' },
          h('button', { class: 'btn pri', onclick: () => saveManual() }, '💾 Salvar'),
          h('button', { class: 'btn', onclick: () => { kbForm = null; render(true); } }, 'Cancelar')));
      form.addEventListener('paste', e => {
        const files = [...((e.clipboardData && e.clipboardData.files) || [])].filter(x => /^image\//.test(x.type));
        if (files.length) { e.preventDefault(); addFiles(files); }
      });
      return [form];
    }
    const search = h('input', { type: 'text', style: 'flex:1;min-width:0', value: manQuery, placeholder: 'Buscar (ex.: boleto, vistoria, senha)…' });
    search.addEventListener('keydown', e => { if (e.key === 'Enter') { manQuery = search.value; render(true); } });
    let list = man.slice();
    if (manQuery.trim()) {
      const qd = deacc(manQuery); const ids = new Set(findSimilar(manQuery).filter(r => r.item.manual).map(r => r.item.id));
      list = list.filter(x => ids.has(x.id) || deacc([x.title, x.q, x.a, x.tags].join(' ')).includes(qd));
    }
    list.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'pt-BR'));
    return [
      h('div', { class: 'card blue' },
        h('div', { class: 'gname' }, '📘 Informações do sistema Ileva'),
        h('div', { class: 'who', style: 'margin-top:4px' }, 'Cadastre perguntas, respostas e prints de tela. Quando um cliente perguntar algo parecido, a resposta (com as imagens) aparece como sugestão no cartão do atendimento.'),
        h('div', { class: 'actions' },
          h('button', { class: 'btn pri', onclick: () => openForm(null) }, '➕ Nova informação'),
          h('button', { class: 'btn', title: 'Baixa um arquivo com toda a base (texto + imagens) para backup ou para levar a outro computador', onclick: e => exportManual(e.currentTarget) }, '⬇ Exportar'),
          h('button', { class: 'btn', title: 'Importa um arquivo exportado (não apaga o que já existe)', onclick: () => importManual() }, '⬆ Importar'))),
      undoBar(),
      h('div', { style: 'display:flex;gap:6px;margin:8px 0' }, search, h('button', { class: 'btn', onclick: () => { manQuery = search.value; render(true); } }, 'Buscar')),
      list.length ? list.map(x => h('div', { class: 'card green' },
        h('div', { class: 'gname' }, x.title || '(sem título)'),
        x.q ? h('div', { class: 'quote' }, x.q.split('\n').filter(Boolean).map(l => h('div', {}, '❓ ' + l))) : null,
        x.a ? h('pre', { class: 'fix' }, x.a) : null,
        imgsBlock(x.imgs, true),
        h('div', { class: 'who' }, `Atualizado em ${new Date(x.upd || x.qTs).toLocaleDateString('pt-BR')}${x.tags ? ' · 🏷️ ' + x.tags : ''}${x.uses ? ` · usada ${x.uses}x` : ''}`),
        h('div', { class: 'actions' },
          h('button', { class: 'btn', onclick: () => openForm(x) }, '✏️ Editar'),
          x.a ? h('button', { class: 'btn', onclick: e => copy(x.a, e.currentTarget) }, '📋 Copiar texto') : null,
          kbDelArm === x.id
            ? h('button', { class: 'btn danger', onclick: () => deleteManual(x) }, '⚠️ Confirmar exclusão')
            : h('button', { class: 'btn', onclick: () => { kbDelArm = x.id; render(true); } }, '🗑️ Excluir')))) :
        h('div', { class: 'empty' }, man.length ? 'Nada encontrado para essa busca.' : 'Nenhuma informação cadastrada ainda. Clique em "➕ Nova informação".')
    ];
  }
  function renderBaseAuto(st) {
    const appr = kb.filter(x => x.status === 'approved').length, rej = kb.filter(x => x.status === 'rejected').length, res = kb.filter(x => x.resolved).length;
    const search = h('input', { type: 'text', style: 'flex:1;min-width:0', value: kbQuery, placeholder: 'Buscar na base (ex.: boleto, vistoria, senha)…' });
    search.addEventListener('keydown', e => { if (e.key === 'Enter') { kbQuery = search.value; render(true); } });
    let list = kb.filter(x => x.status !== 'rejected');
    if (kbQuery.trim()) { const sims = findSimilar(kbQuery); const ids = new Set(sims.map(r => r.item.id)); const qd = deacc(kbQuery); list = list.filter(x => ids.has(x.id) || deacc(x.q + ' ' + x.a).includes(qd)); }
    list = list.slice().sort((a, b) => (b.status === 'approved') - (a.status === 'approved') || b.qTs - a.qTs).slice(0, 40);
    return [
      h('div', { class: 'card blue' },
        h('div', { class: 'gname' }, '📚 Base de conhecimento dos atendimentos'),
        h('div', { class: 'who', style: 'margin-top:4px' }, `O painel aprende com as perguntas dos clientes e as respostas que a equipe já deu. Quando chega uma pergunta parecida, ele mostra "💡 Já respondemos algo parecido" no cartão do atendimento.`),
        h('div', { style: 'margin-top:6px' }, h('b', {}, String(kb.length - rej)), ' respostas aprendidas · ', h('b', {}, String(appr)), ' validadas · ', h('b', {}, String(res)), ' com cliente satisfeito'),
        h('div', { class: 'actions' },
          h('button', { class: 'btn pri', title: 'Abre cada grupo e rola a conversa para cima para ler o histórico (leva alguns minutos e marca como lidas)', onclick: () => learnHistoryAll() }, rounding ? '⏳ Aprendendo…' : '📚 Aprender histórico de todos os grupos'),
          h('button', { class: 'btn', title: 'Lê o histórico da conversa aberta agora', onclick: async () => { const n = await learnHistory(null, 12); lastAction = { kind: 'info', key: '', label: `${n} nova(s) resposta(s) aprendida(s) nesta conversa.`, at: Date.now() }; render(true); } }, '📖 Aprender desta conversa'))),
      undoBar(),
      h('div', { style: 'display:flex;gap:6px;margin:8px 0' }, search, h('button', { class: 'btn', onclick: () => { kbQuery = search.value; render(true); } }, 'Buscar')),
      list.length ? list.map(x => h('div', { class: 'card ' + (x.status === 'approved' ? 'green' : 'yellow') },
        h('div', { class: 'who' }, `${x.group} · ${fmtTime(x.qTs)} · ${x.who || 'equipe'}${x.status === 'approved' ? ' · ✅ validada' : ''}${x.resolved ? ' · resolvido' : ''}${x.uses ? ` · usada ${x.uses}x` : ''}`),
        h('div', { class: 'lbl' }, 'Pergunta do cliente:'), h('div', { class: 'quote' }, x.q),
        h('div', { class: 'lbl' }, 'Resposta da equipe (já ajustada ao padrão):'), h('pre', { class: 'fix' }, x.a),
        h('div', { class: 'actions' },
          x.status !== 'approved' ? h('button', { class: 'btn ok', onclick: () => kbSet(x.id, 'approved') }, '👍 Validar') : h('button', { class: 'btn', onclick: () => kbSet(x.id, 'auto') }, 'Tirar validação'),
          h('button', { class: 'btn', onclick: () => kbSet(x.id, 'rejected') }, '👎 Não usar')))) :
        h('div', { class: 'empty' }, kb.length ? 'Nada encontrado para essa busca.' : 'Ainda não há respostas aprendidas. Abra conversas ou clique em "Aprender histórico de todos os grupos".')
    ];
  }
  // ------------------------------------------------------------------ RAIO-X DO DIA
  // Regras de "finalizado" do Raio-X (além do botão Finalizar):
  //  - o cliente confirmou depois da resposta da equipe (obrigado, deu certo, ok, 👍…)
  //  - a equipe mandou frase de encerramento (finalizando o atendimento, qualquer dúvida estamos à disposição…)
  //  - a equipe respondeu e o cliente não voltou a escrever por RX_SILENCE
  const RX_SILENCE = 30 * MIN;
  const RX_CLOSING_RE = /((finaliz|encerr)\w* (o |este |esse |seu |nosso )?(atendimento|chamado))|(atendimento (finalizado|encerrado|concluido))|(qualquer (outra )?duvida.{0,30}(disposicao|chamar|falar|acionar))|((estamos|ficamos|fico|seguimos|permanecemos|continuamos) a (sua )?disposicao)/;
  const RX_COURTESY_RE = /(por nada|de nada|disponha|imagina[!. ]|^imagina$|eu (que|quem) agrade|nos (que|quem) agrade|agradecemos (o|a|pelo|pela)|bom trabalho|otimo trabalho|tenha (um|uma) (otim|bo|excelente)|(otimo|bom|excelente|boa) (dia|tarde|noite|fim de semana|final de semana|semana)|ate (mais|logo|a proxima|breve)|estamos juntos|\btmj\b|abraco|sempre a disposicao|qualquer coisa (e so|so) chamar|conte (sempre )?com a gente)/;
  const RX_OK_RE = /^(ok|okk|certo|beleza|blz|tudo certo|combinado|entendido|entendi|ah sim|show|top|perfeito|otimo|maravilha|muito obrigad|obrigad|valeu|grato|grata|agradec)/;
  function rxClientOk(text) {
    const t = deacc(text || '').trim();
    if (!t) return true;
    if (/\?|\bnao\b|\bainda\b|\bmas\b|\bporem\b/.test(t)) return false;
    return isTrivial(text) || RESOLVED_RE.test(t) || RX_OK_RE.test(t);
  }
  // ---- aprendizado com o Raio-X manual
  const RXOV_KEY = 'ilevaSup.rxov.v1', RXLEARN_KEY = 'ilevaSup.rxlearn.v1', RXHIST_KEY = 'ilevaSup.rxhist.v1';
  function rxOv() { const o = lsGet(RXOV_KEY, {}); return o && o.date === dayKey() ? (o.map || {}) : {}; }
  function rxLearn() { const l = lsGet(RXLEARN_KEY, {}) || {}; return { teamClose: l.teamClose || [], clientOk: l.clientOk || [], teamOpen: l.teamOpen || [] }; }
  const learnNorm = t => deacc(t || '').replace(/https?:\/\/\S+/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  function learnedHit(list, text) {
    const t = learnNorm(text); if (!t) return false;
    return list.some(x => x && (t === x || (x.length >= 8 && t.includes(x)) || (t.length >= 8 && x.includes(t) && t.length >= x.length * 0.6)));
  }
  function rxLastMsg(g) { const msgs = g.msgs.filter(m => !m.approx); return msgs[msgs.length - 1] || null; }
  function setRxOverride(g, k) {
    const o = lsGet(RXOV_KEY, {}); const map = o && o.date === dayKey() ? (o.map || {}) : {};
    const last = rxLastMsg(g);
    map[g.name] = { k, at: Date.now(), lastTs: last ? last.ts : 0 };
    lsSet(RXOV_KEY, { date: dayKey(), map });
    // aprende com a frase que encerrou (ou não) o atendimento
    if (last && last.text && !/^\[/.test(last.text)) {
      const L = rxLearn();
      // aprende a frase inteira e também o último trecho dela (ex.: "Liberado! Qualquer coisa me chama" -> "qualquer coisa me chama")
      const partes = String(last.text).split(/[.!?;,\n]+/).map(learnNorm).filter(x => x.split(' ').length >= 2);
      const frases = [...new Set([learnNorm(last.text).slice(0, 80), partes.length ? partes[partes.length - 1].slice(0, 80) : ''].filter(x => x.length >= 3))];
      const add = (arr, rm) => frases.forEach(frase => { if (!arr.includes(frase)) arr.push(frase); rm.forEach(a => { const i = a.indexOf(frase); if (i >= 0) a.splice(i, 1); }); while (arr.length > 200) arr.shift(); });
      if (k === 'fin' && last.role === 'team') add(L.teamClose, [L.teamOpen]);
      else if (k === 'fin' && last.role === 'client') add(L.clientOk, []);
      else if (k === 'and' && last.role === 'team') add(L.teamOpen, [L.teamClose]);
      lsSet(RXLEARN_KEY, L);
    }
  }
  function rxClassify(g, now, t0) {
    const ov = rxOv()[g.name];
    if (ov) { const last = rxLastMsg(g); if (!last || last.ts <= ov.lastTs) return { k: ov.k, why: 'ajustado no Raio-X manual', at: ov.at, ov: true }; }
    const c = rxClassifyAuto(g, now, t0);
    return c;
  }
  function rxClassifyAuto(g, now, t0) {
    if (g.finalized && g.finalized.ts >= t0) return { k: 'fin', why: 'finalizado no painel', at: g.finalized.ts };
    const msgs = g.msgs.filter(m => !m.approx);
    if (!msgs.length) { // só visto pela prévia da lista: conta se o cliente está esperando
      if (g.status === 'open' && g.pend[0] && g.pend[0].ts >= t0) return { k: 'open' };
      return null;
    }
    const last = msgs[msgs.length - 1];
    if (last.ts < t0) return null; // sem movimento desde o fim do último expediente
    const courtesy = m => m.role === 'team' && (isTrivial(m.text) || (m.text.length <= 180 && RX_COURTESY_RE.test(deacc(m.text))));
    // 1) cliente confirmou/agradeceu depois de uma resposta da equipe (e a equipe, se escreveu depois, só agradeceu/despediu)
    let ci = -1;
    for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === 'client') { ci = i; break; }
    if (ci >= 0 && msgs.slice(ci + 1).every(courtesy)) {
      let b = ci; while (b > 0 && msgs[b - 1].role === 'client') b--;
      const block = msgs.slice(b, ci + 1);
      const answered = msgs.slice(0, b).some(m => m.role === 'team' && !isTrivial(m.text));
      const LR = rxLearn();
      if (answered && block.every(m => rxClientOk(m.text) || learnedHit(LR.clientOk, m.text)) && msgs[ci].ts >= t0) return { k: 'fin', why: 'cliente confirmou / agradeceu', at: last.ts };
    }
    if (g.status === 'open') return { k: 'open' };
    if (g.status === 'await') {
      const at = g.lastRel ? g.lastRel.ts : last.ts;
      return now - at >= RX_SILENCE ? { k: 'fin', why: 'aguardando o cliente há mais de 30 min', at } : { k: 'and', why: 'aguardando o cliente', at };
    }
    // 2) última palavra foi da equipe
    let ti = -1;
    for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === 'team' && !isTrivial(msgs[i].text)) { ti = i; break; }
    const tm = ti >= 0 ? msgs[ti] : null;
    if (tm && tm.ts >= t0 && msgs.slice(ti + 1).every(m => m.role === 'team')) {
      const td = deacc(tm.text), LR = rxLearn();
      if (learnedHit(LR.teamOpen, tm.text)) return { k: 'and', why: 'ainda em andamento (aprendido)', at: tm.ts };
      if (learnedHit(LR.teamClose, tm.text)) return { k: 'fin', why: 'encerrado (aprendido no Raio-X manual)', at: tm.ts };
      if (RX_CLOSING_RE.test(td)) return { k: 'fin', why: 'encerrado pela equipe', at: tm.ts };
      if (courtesy(tm)) return { k: 'fin', why: 'encerrado com agradecimento', at: tm.ts };
      // equipe entregou o material (vídeo ou documento; imagem quando tinha prometido enviar) e o cliente não perguntou mais -> resolvido na hora
      // ex.: "Um momento, irei encaminhar um vídeo curto" -> cliente "Ok" -> equipe envia o vídeo
      if (/^\[(video|documento)\]$/.test(td) || (/^\[imagem\]$/.test(td) && msgs.slice(0, ti).some(m => m.role === 'team' && /\b(vou|irei|vamos|iremos|ja) (te |lhe )?(gravar|preparar|montar|encaminhar|enviar|mandar|envio|mando|encaminho)\b/.test(deacc(m.text)))))
        return { k: 'fin', why: 'equipe enviou ' + tm.text.slice(1, -1) + ' com a resposta', at: tm.ts };
      if (PROMISE_RE.test(td) || AWAIT_RE.test(td) || /^(vou|irei|vamos|iremos) (gravar|preparar|fazer|montar|providenciar|encaminhar|analisar|verificar|ajustar|corrigir|te enviar|te mandar|enviar|mandar)/.test(td)) return { k: 'and', why: 'equipe vai dar retorno', at: tm.ts };
      if (now - tm.ts >= RX_SILENCE) return { k: 'fin', why: /^\[(video|vídeo|documento|imagem|audio|áudio)\]$/i.test(tm.text) ? 'equipe enviou ' + tm.text.slice(1, -1) + ', cliente não perguntou mais' : 'respondido, cliente não perguntou mais', at: tm.ts };
      return { k: 'and', why: 'respondido há pouco, aguardando o cliente', at: tm.ts };
    }
    if (g.promise) return { k: 'and', why: 'retorno prometido pela equipe', at: g.promise.since };
    return null;
  }
  function rxData(st) {
    const now = st.now, t0 = bizWindowStart(now); // inclui o que chegou fora do expediente (na segunda: desde sexta 18:00)
    const openSet = new Set(st.open.map(g => g.name));
    const aberto = [], andamento = [], finalizados = [];
    for (const g of st.groups) {
      const c = rxClassify(g, now, t0);
      if (!c) continue;
      if (c.k === 'fin') finalizados.push({ g, why: c.why, at: c.at });
      else if (c.k === 'open') { if (openSet.has(g.name) || c.ov || g.status === 'open') aberto.push(g); }
      else andamento.push({ g, why: c.why, since: c.at });
    }
    aberto.sort((a, b) => b.wait - a.wait);
    andamento.sort((a, b) => a.since - b.since);
    finalizados.sort((a, b) => b.at - a.at);
    return { aberto, andamento, finalizados };
  }
  function rxText(st) {
    const r = rxData(st), d = new Date(st.now);
    const L = [`🩻 *RAIO-X DOS ATENDIMENTOS* — ${d.toLocaleDateString('pt-BR')} às ${hhmm(st.now)}`, '',
      `✅ Finalizados: *${r.finalizados.length}*`, `🔄 Em andamento: *${r.andamento.length}*`, `🔴 Em aberto: *${r.aberto.length}*`];
    L.push('', `*🔴 EM ABERTO (${r.aberto.length})*`);
    r.aberto.length ? r.aberto.forEach(g => L.push(`• ${g.name} — aguardando há ${g.approx ? 'mais de ' : ''}${fmtDur(g.wait)}`)) : L.push('• nenhum');
    L.push('', `*🔄 EM ANDAMENTO (${r.andamento.length})*`);
    r.andamento.length ? r.andamento.forEach(x => L.push(`• ${x.g.name} — ${x.why}`)) : L.push('• nenhum');
    return L.join('\n');
  }
  // ------------------------------------------------------------------ RAIO-X MANUAL (preenche e leva para o MeisterTask)
  const MT_KEY = 'ilevaSup.mt.v1';
  const MT_PENDING = 'ilevaSup.mtPending.v1';
  const MT_DEFAULT = 'https://www.meistertask.com/app/task/1OwYJt7Z/raio-x-diario?view=board';
  let rxForm = null;
  const twoD = n => String(n).padStart(2, '0');
  function rxFormInit(r) {
    const now = new Date(), hm = `${twoD(now.getHours())}:${twoD(now.getMinutes())}`;
    const slot = now.getHours() * 60 + now.getMinutes() >= 14 * 60 ? '17:00' : '11:30';
    rxForm = { slot, nome: rxResp(Date.now(), slot) || ((lsGet('ilevaSup.user.v1', {}) || {}).nome) || '', ab: r.aberto.length, fin: r.finalizados.length, and: r.andamento.length, obsAb: '', obsAnd: '', obs: '', hora: hm, cab: slot === '11:30' };
    rxLoadSent(rxForm);
  }
  // Raio-X já enviado hoje: o formulário volta com o que foi enviado, para corrigir e atualizar no MeisterTask
  const RXSENT_KEY = 'ilevaSup.rxSent.v1';
  function rxSentGet(slot) { const d = lsGet(RXSENT_KEY, {}) || {}; return d.date === dayKey() && d.slots ? d.slots[slot] || null : null; }
  function rxSentSave(f) { const d = lsGet(RXSENT_KEY, {}) || {}; const o = d.date === dayKey() ? d : { date: dayKey(), slots: {} }; o.slots = o.slots || {}; o.slots[f.slot] = { ab: f.ab, fin: f.fin, and: f.and, obs: f.obs || '', obsAb: f.obsAb || '', obsAnd: f.obsAnd || '', hora: f.hora, nome: f.nome || '', cab: !!f.cab, at: Date.now() }; lsSet(RXSENT_KEY, o); }
  function rxLoadSent(f) { const sn = rxSentGet(f.slot); f.corr = !!sn; if (sn) Object.assign(f, { ab: sn.ab, fin: sn.fin, and: sn.and, obs: sn.obs, obsAb: sn.obsAb, obsAnd: sn.obsAnd, hora: sn.hora, nome: sn.nome || f.nome, cab: sn.cab }); return !!sn; }
  // "Aberto:" e "Andamento:" das observações = quantidade + quais atendimentos + o que o colaborador escreveu
  function rxObs(qtd, auto, manual) {
    let out = auto || '';
    if (manual && manual.trim()) out = out ? out + ' · ' + manual.trim() : manual.trim();
    return out;
  }
  function rxAutoObs(r) {
    const nome = g => clientLabel(g.name);
    return {
      ab: r.aberto.map(g => nome(g)).join(', '),
      and: r.andamento.map(x => nome(x.g)).join(', ')
    };
  }
  function rxManualText(f) {
    const n = x => Math.max(0, parseInt(x, 10) || 0);
    const d = new Date(), L = [];
    if (f.cab) L.push(`📆 | ${twoD(d.getDate())}/${twoD(d.getMonth() + 1)}`, '-------------------------');
    L.push(`⏰ ${f.slot}${f.nome ? ' - ' + f.nome : ''}`, `Abertos: ${n(f.ab)}`, `Finalizados: ${n(f.fin)}`, `Andamento: ${n(f.and)}`, '',
      `TOTAL DE ATENDIMENTOS: ${n(f.ab) + n(f.fin) + n(f.and)}`, `Obs: ${f.obs || ''}`.trimEnd(), `Aberto: ${rxObs(f.ab, f.autoAb, f.obsAb)}`.trimEnd(), `Andamento: ${rxObs(f.and, f.autoAnd, f.obsAnd)}`.trimEnd(), `Horário de realização: ${f.hora || ''}`.trimEnd());
    return L.join('\n');
  }
  function rxCheckList(r) {
    const rows = [...r.aberto.map(g => ({ g, k: 'open', why: 'cliente esperando resposta' })), ...r.andamento.map(x => ({ g: x.g, k: 'and', why: x.why })), ...r.finalizados.map(x => ({ g: x.g, k: 'fin', why: x.why }))]
      .sort((a, b) => a.g.name.localeCompare(b.g.name, 'pt-BR'));
    const ov = rxOv();
    const opt = (row, k, lab) => h('button', { class: 'rxk ' + k + (row.k === k ? ' on' : ''), title: 'Marcar como ' + lab, onclick: () => {
      if (row.k === k && !ov[row.g.name]) return;
      setRxOverride(row.g, k);
      const r2 = rxData(computeAll()); rxForm.ab = r2.aberto.length; rxForm.fin = r2.finalizados.length; rxForm.and = r2.andamento.length;
      render(true);
    } }, lab);
    return h('details', { class: 'rxcl', open: true },
      h('summary', {}, `Conferir grupos de hoje (${rows.length}) · corrija o que estiver errado e o automático aprende`),
      rows.length ? rows.map(row => h('div', { class: 'rxg' },
        h('div', { class: 'rxgn' }, row.g.name.replace(/\s*[&\/]\s*ileva\b.*$/i, ''), h('div', { class: 'who' }, (ov[row.g.name] ? '✋ ' : '') + row.why)),
        h('div', { class: 'rxgb' }, opt(row, 'open', 'Aberto'), opt(row, 'and', 'Andamento'), opt(row, 'fin', 'Finalizado')))) : h('div', { class: 'who' }, 'Nenhum grupo com movimento hoje.'),
      rxAccuracy());
  }
  function rxAccuracy() {
    const H = (lsGet(RXHIST_KEY, []) || []).slice(-10);
    if (!H.length) return null;
    const ok = H.filter(x => x.auto.ab === x.man.ab && x.auto.fin === x.man.fin && x.auto.and === x.man.and).length;
    const lastR = H[H.length - 1];
    return h('div', { class: 'who', style: 'margin-top:6px' }, `🎯 Automático igual ao manual em ${ok} de ${H.length} Raio-X recentes. Último (${lastR.date.slice(8)}/${lastR.date.slice(5, 7)} ${lastR.slot}): automático ${lastR.auto.ab}/${lastR.auto.and}/${lastR.auto.fin} × manual ${lastR.man.ab}/${lastR.man.and}/${lastR.man.fin} (aberto/andamento/finalizado).`);
  }
  function renderRxManual(r) {
    if (!rxForm) rxFormInit(r);
    const f = rxForm;
    { const a = rxAutoObs(r); f.autoAb = a.ab; f.autoAnd = a.and; }
    const autoCounts = (() => { const st = computeAll(), t0 = bizWindowStart(Date.now()), openSet = new Set(st.open.map(g => g.name)); const c = { ab: 0, and: 0, fin: 0 };
      for (const g of st.groups) { const x = rxClassifyAuto(g, st.now, t0); if (!x) continue; if (x.k === 'fin') c.fin++; else if (x.k === 'open') { if (openSet.has(g.name)) c.ab++; } else c.and++; } return c; })();
    const n = x => Math.max(0, parseInt(x, 10) || 0);
    const totalEl = h('b', { class: 'rxt' }, String(n(f.ab) + n(f.fin) + n(f.and)));
    const prev = h('pre', {}, rxManualText(f));
    const upd = () => { totalEl.textContent = String(n(f.ab) + n(f.fin) + n(f.and)); prev.textContent = rxManualText(f); };
    const bind = (el, k) => { el.addEventListener('input', () => { f[k] = el.type === 'checkbox' ? el.checked : el.value; upd(); }); el.addEventListener('change', () => { f[k] = el.type === 'checkbox' ? el.checked : el.value; upd(); }); return el; };
    const num = (k, lab, cls) => h('div', { class: 'rxn ' + cls }, h('label', {}, lab), bind(h('input', { type: 'number', min: '0', value: String(f[k]) }), k));
    const slotSel = bind(h('select', {}, ['11:30', '17:00'].map(x => h('option', { value: x, selected: f.slot === x }, x))), 'slot');
    slotSel.addEventListener('change', () => { const rp = rxResp(Date.now(), f.slot); if (rp) f.nome = rp; if (!rxLoadSent(f)) { f.ab = r.aberto.length; f.fin = r.finalizados.length; f.and = r.andamento.length; f.obsAb = f.obsAnd = f.obs = ''; } render(true); });
    const mtUrl = () => ((lsGet(MT_KEY, {}) || {}).url) || MT_DEFAULT;
    const urlInp = h('input', { type: 'text', value: mtUrl() });
    urlInp.addEventListener('change', () => { lsSet(MT_KEY, { url: urlInp.value.trim() || MT_DEFAULT }); });
    const send = async (btn, open) => {
      // horário de realização = momento em que terminou e enviou
      if (!f.corr || !f.hora) { const d1 = new Date(); f.hora = `${twoD(d1.getHours())}:${twoD(d1.getMinutes())}`; } // correção: mantém o horário em que foi realizado
      { const a = rxAutoObs(rxData(computeAll())); f.autoAb = a.ab; f.autoAnd = a.and; }
      const txt = rxManualText(f);
      try {
        const H = lsGet(RXHIST_KEY, []) || [];
        H.push({ date: dayKey(), slot: f.slot, at: Date.now(), man: { ab: n(f.ab), and: n(f.and), fin: n(f.fin) }, auto: { ab: autoCounts.ab, and: autoCounts.and, fin: autoCounts.fin }, ajustes: Object.keys(rxOv()).length });
        while (H.length > 60) H.shift(); lsSet(RXHIST_KEY, H);
      } catch (e) { }
      await copy(txt, btn);
      if (open) {
        const tok = (mtUrl().match(/\/app\/task\/([^/?#]+)/) || [])[1] || '';
        const d0 = new Date();
        if (HAS_GM && tok) gmSetJ(MT_PENDING, { task: tok, at: Date.now(), date: `${twoD(d0.getDate())}/${twoD(d0.getMonth() + 1)}`, slot: f.slot, nome: (f.nome || '').trim(), nomes: { '11:30': rxResp(Date.now(), '11:30'), '17:00': rxResp(Date.now(), '17:00') },
          ab: n(f.ab), fin: n(f.fin), and: n(f.and), total: n(f.ab) + n(f.fin) + n(f.and), obs: f.obs || '', obsAb: rxObs(f.ab, f.autoAb, f.obsAb), obsAnd: rxObs(f.and, f.autoAnd, f.obsAnd), hora: f.hora || '' });
        try { window.open(mtUrl(), '_blank'); } catch (e) { }
      }
      const eraCorr = f.corr;
      if (open) { rxSentSave(f); f.corr = true; }
      markRxDone();
      if (open && eraCorr) { lastAction = { kind: 'info', key: '', label: `✏️ Correção do Raio-X das ${f.slot} enviada: o bloco no MeisterTask será substituído.`, at: Date.now() }; render(true); return; }
      lastAction = { kind: 'info', key: '', label: open ? (HAS_GM ? 'Abrindo o MeisterTask: o Raio-X será preenchido sozinho no card. (O texto também foi copiado, por garantia.)' : 'Raio-X copiado! Na tarefa do MeisterTask, clique na descrição e cole (Ctrl+V).') : 'Raio-X copiado! Cole onde precisar (Ctrl+V).', at: Date.now() };
      render(true);
    };
    return h('div', { class: 'card purple rxm' },
      h('div', { class: 'gname' }, f.corr ? `✏️ Corrigir o Raio-X das ${f.slot}` : '📝 Raio-X manual'),
      f.corr ? h('div', { class: 'cobtx', style: 'background:rgba(255,176,32,.12);border-left:3px solid #ffb020;padding:6px 8px;border-radius:6px;margin:4px 0' }, `Este Raio-X já foi enviado hoje${(rxSentGet(f.slot) || {}).at ? ' às ' + hhmm(rxSentGet(f.slot).at) : ''}. Os números abaixo são os que foram enviados: ajuste o que precisar e clique em `, h('b', {}, '✏️ Atualizar no MeisterTask'), '. O bloco desse horário no card é substituído (o horário de realização continua o mesmo).') : null,
      h('div', { class: 'who' }, 'Confira ou ajuste os números (já vêm preenchidos com o que o painel contou), escreva as observações e envie para o MeisterTask.'),
      h('div', { class: 'rxrow' },
        h('div', { class: 'rxn' }, h('label', {}, 'Horário do Raio-X'), slotSel),
        h('div', { class: 'rxn' }, h('label', {}, 'Colaborador'), bind(h('input', { type: 'text', value: f.nome, placeholder: 'Seu nome' }), 'nome')),
        h('div', { class: 'rxn' }, h('label', {}, 'Realizado às'), h('div', { class: 'rxhora', title: 'Preenchido sozinho com o horário em que o Raio-X for enviado' }, f.corr && f.hora ? '🕒 ' + f.hora : '🕒 na hora do envio'))),
      h('div', { class: 'rxrow' }, num('ab', '🔴 Abertos', 'r'), num('fin', '✅ Finalizados', 'g'), num('and', '🔄 Andamento', 'b'),
        h('div', { class: 'rxn tot' }, h('label', {}, 'Total'), totalEl)),
      rxCheckList(r),
      h('label', {}, 'Obs. extra dos atendimentos em aberto (os nomes dos grupos já entram sozinhos)'), bind(h('textarea', { rows: '2', placeholder: 'Ex.: Aaprovel aguardando retorno do financeiro', value: f.obsAb }), 'obsAb'),
      h('label', {}, 'Obs. extra dos atendimentos em andamento (os nomes dos grupos já entram sozinhos)'), bind(h('textarea', { rows: '2', placeholder: 'Ex.: Precisa Proteção, em análise com o suporte', value: f.obsAnd }), 'obsAnd'),
      h('label', {}, 'Obs. geral'), bind(h('textarea', { rows: '2', value: f.obs }), 'obs'),
      h('label', { class: 'chk' }, bind(h('input', { type: 'checkbox', checked: f.cab }), 'cab'), 'Incluir o cabeçalho com a data (📆 | dd/mm). Use no primeiro Raio-X do dia.'),
      h('div', { class: 'actions', style: 'margin-top:10px' },
        h('button', { class: 'btn pri', title: 'Abre o card do MeisterTask e preenche o bloco deste horário sozinho (o texto também é copiado)', onclick: e => send(e.currentTarget, true) }, f.corr ? '✏️ Atualizar no MeisterTask' : '🚀 Enviar para o MeisterTask'),
        h('button', { class: 'btn', onclick: e => send(e.currentTarget, false) }, '📋 Só copiar'),
        h('button', { class: 'btn', title: 'Volta os números para o que o painel contou agora', onclick: () => { rxFormInit(r); render(true); } }, '↺ Recarregar números')),
      h('details', {}, h('summary', {}, 'Prévia do texto e link da tarefa'),
        prev,
        h('label', {}, 'Link da tarefa no MeisterTask'), urlInp));
  }
  let userEditing = false;
  function userCard() {
    const nome = ((lsGet('ilevaSup.user.v1', {}) || {}).nome || '').trim();
    if (nome && !userEditing) return h('div', { class: 'card', style: 'padding:8px 12px' }, '👤 Este computador é de ', h('b', {}, nome), ' · ',
      h('a', { href: '#', style: 'color:#53bdeb', onclick: e => { e.preventDefault(); userEditing = true; render(true); } }, 'trocar nome'));
    const inp = h('input', { type: 'text', value: nome, placeholder: 'Seu nome (ex.: Adriel)', maxlength: '30', style: 'width:100%' });
    const save = () => { const v = inp.value.trim().replace(/\s+/g, ' ').slice(0, 30); if (!v) { inp.focus(); return; } lsSet('ilevaSup.user.v1', { nome: v }); userEditing = false; cobNextAt = 0; render(true); };
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') save(); });
    return h('div', { class: 'card blue' }, h('div', { class: 'gname' }, '👤 Quem usa este computador?'),
      h('div', { class: 'cobtx' }, 'O nome é usado nos lembretes do Raio-X, do Dia de cobrança e na tela de bom dia. Use o mesmo nome da escala (Adriel, Francisco, Lucas).'),
      inp, h('div', { class: 'actions' }, h('button', { class: 'btn pri', onclick: save }, '💾 Salvar nome'), nome ? h('button', { class: 'btn', onclick: () => { userEditing = false; render(true); } }, 'Cancelar') : null));
  }
  function rxScheduleCard() {
    const now = Date.now(), week = rxWeek(now), today = dayKey(new Date(now));
    const cnt = {}; RX_TEAM.forEach(n => cnt[n] = 0);
    const done = lsGet(RX_KEY, {});
    const rows = week.map((ts, i) => {
      const d = new Date(ts), isT = dayKey(d) === today, a = rxResp(ts, '11:30'), b = rxResp(ts, '17:00');
      if (a) cnt[a]++; if (b) cnt[b]++;
      const cell = (slot, nm) => h('td', { class: 'esc' + (isT ? ' hoje' : '') }, nm || '—', isT && done.date === today && done[slot] ? ' ✅' : '');
      return h('tr', { class: isT ? 'hoje' : '' }, h('td', {}, `${DIAS_SEM[i]} ${twoD(d.getDate())}/${twoD(d.getMonth() + 1)}`, isT ? ' • hoje' : ''), cell('11:30', a), cell('17:00', b));
    });
    return h('details', { class: 'card blue escala', open: true },
      h('summary', {}, '📅 Escala do Raio-X desta semana'),
      h('table', {}, h('tbody', {}, h('tr', {}, h('td', { class: 'who' }, ''), h('td', { class: 'who' }, '⏰ 11:30'), h('td', { class: 'who' }, '⏰ 17:00')), rows)),
      h('div', { class: 'who', style: 'margin-top:6px' }, 'Nesta semana: ' + RX_TEAM.map(n => `${n} ${cnt[n]}`).join(' · ') + '. O rodízio continua na semana seguinte: a cada 3 semanas, todos fazem a mesma quantidade.'));
  }
  function rxPendCard() {
    if (!HAS_GM) return null;
    const p = gmGetJ(MT_PENDING, null);
    if (!p || Date.now() - p.at < 3 * MIN || Date.now() - p.at > 4 * DAY) return null;
    const enviar = () => { p.at = Date.now(); gmSetJ(MT_PENDING, p); try { window.open(((lsGet(MT_KEY, {}) || {}).url) || MT_DEFAULT, '_blank'); } catch (e) { } lastAction = { kind: 'info', key: '', label: 'Abrindo o MeisterTask: o Raio-X pendente será preenchido sozinho.', at: Date.now() }; render(true); };
    return h('div', { class: 'card', style: 'border-color:#ffb020' },
      h('div', { class: 'gname' }, `⚠️ O Raio-X das ${p.slot} de ${p.date}${p.nome ? ' (' + p.nome + ')' : ''} ainda não chegou ao MeisterTask`),
      h('div', { class: 'cobtx' }, `Abertos ${p.ab} · Finalizados ${p.fin} · Andamento ${p.and} · Total ${p.total}. O card não foi aberto a tempo. Clique para enviar agora${p.slot === RX_SLOTS[RX_SLOTS.length - 1] ? ' (e fechar o dia na coluna Raio-X)' : ''}.`),
      h('div', { class: 'actions' }, h('button', { class: 'btn pri', onclick: enviar }, '📤 Enviar agora para o MeisterTask')));
  }
  function renderRx(st) {
    const r = rxData(st);
    const box = (cls, n, l) => h('div', { class: 'chip ' + cls, style: 'cursor:default' }, h('div', { class: 'n' }, String(n)), h('div', { class: 'l' }, l));
    return [
      undoBar(),
      rxPendCard(),
      userCard(),
      cobCard(),
      rxScheduleCard(),
      renderRxManual(r),
      h('div', { class: 'card blue' },
        h('div', { class: 'gname' }, `🩻 Raio-X de hoje · ${hhmm(st.now)}`),
        h('div', { class: 'chips', style: 'grid-template-columns:repeat(3,1fr);margin-top:8px' },
          box('green', r.finalizados.length, 'finalizados'), box('blue', r.andamento.length, 'em andamento'), box('red', r.aberto.length, 'em aberto')),
        h('div', { class: 'actions' }, h('button', { class: 'btn pri', title: 'Copia o Raio-X pronto para colar no WhatsApp', onclick: e => { copy(rxText(computeAll()), e.currentTarget); markRxDone(); } }, '📋 Copiar Raio-X'))),
      h('div', { class: 'grp' }, `🔴 Em aberto — cliente esperando resposta (${r.aberto.length})`),
      r.aberto.length ? h('table', {}, h('tbody', {}, r.aberto.map(g => h('tr', {},
        h('td', {}, g.name, h('div', { class: 'who' }, `${g.clientName} · desde ${fmtTime(g.pend[0] ? g.pend[0].ts : g.lastRel.ts)}`)),
        h('td', { class: 'n' }, h('span', { class: 'wait ' + g.level, style: 'font-size:13px' }, (g.approx ? '+' : '') + fmtDur(g.wait))))))) : h('div', { class: 'empty' }, 'Nenhum atendimento em aberto. 👏'),
      h('div', { class: 'grp' }, `🔄 Em andamento (${r.andamento.length})`),
      r.andamento.length ? h('table', {}, h('tbody', {}, r.andamento.map(x => h('tr', {},
        h('td', {}, x.g.name, h('div', { class: 'who' }, x.why)),
        h('td', { class: 'n', style: 'font-weight:400;color:#aebac1' }, x.since ? fmtTime(x.since) : ''))))) : h('div', { class: 'who' }, 'Nenhum.'),
      h('details', {}, h('summary', {}, `✅ Finalizados hoje (${r.finalizados.length})`),
        r.finalizados.length ? h('table', {}, h('tbody', {}, r.finalizados.map(x => h('tr', {}, h('td', {}, x.g.name, h('div', { class: 'who' }, x.why)), h('td', { class: 'n', style: 'font-weight:400;color:#aebac1' }, 'às ' + hhmm(x.at)))))) : h('div', { class: 'who' }, 'Nenhum.')),
      h('div', { class: 'info' }, 'Em aberto: o cliente escreveu e ninguém da equipe respondeu. Em andamento: a equipe respondeu ou está aguardando o cliente há menos de 30 min, ou prometeu retorno. Finalizados: o cliente confirmou ou agradeceu (obrigado, deu certo, ok…), a equipe encerrou (frase de encerramento ou agradecimento, como "por nada", "bom trabalho"), a equipe respondeu (texto, vídeo, documento) ou ficou aguardando o cliente e ele ficou 30 min sem escrever, ou alguém clicou em "Finalizar". Considera só as conversas de hoje.')
    ];
  }
  function renderResumo(st) {
    const max = st.open[0];
    const pc = Object.entries(st.perCollab).sort((a, b) => b[1] - a[1]);
    return [
      h('div', { class: 'grp' }, 'Atendimentos'),
      h('table', {}, h('tbody', {},
        h('tr', {}, h('td', {}, 'Total em aberto'), h('td', { class: 'n' }, String(st.open.length))),
        h('tr', {}, h('td', {}, '🔴 Mais de 15 min'), h('td', { class: 'n' }, String(st.reds.length))),
        h('tr', {}, h('td', {}, '🟣 Retornos prometidos pendentes'), h('td', { class: 'n' }, String(st.promises.length))),
        h('tr', {}, h('td', {}, '🔵 Aguardando o cliente'), h('td', { class: 'n' }, String(st.waiting.length))),
        h('tr', {}, h('td', {}, 'Maior espera'), h('td', { class: 'n' }, max ? `${max.name} · ${max.approx ? '+' : ''}${fmtDur(max.wait)}` : '—')))),
      h('div', { class: 'grp' }, `Finalizados manualmente nas últimas 24 h (${st.finalized.length})`),
      st.finalized.length ? h('table', {}, h('tbody', {}, st.finalized.map(g => h('tr', {}, h('td', {}, g.name, h('div', { class: 'who' }, 'às ' + fmtTime(g.finalized.ts))), h('td', { class: 'n' }, h('button', { class: 'btn', onclick: () => reopen(g.name) }, '↩ Reabrir')))))) : h('div', { class: 'who' }, 'Nenhum.'),
      h('div', { class: 'grp' }, 'Mensagens com problema de tom (24 h)'),
      pc.length ? h('table', {}, h('tbody', {}, pc.map(([k, v]) => h('tr', {}, h('td', {}, k), h('td', { class: 'n' }, String(v)))))) : h('div', { class: 'empty' }, 'Nenhuma.'),
      h('div', { class: 'actions', style: 'margin-top:12px' },
        h('button', { class: 'btn pri', onclick: e => copy(buildTextReport(computeAll()), e.currentTarget) }, '📄 Copiar relatório completo'),
        h('button', { class: 'btn', onclick: e => copy(buildClaudeExport(computeAll()), e.currentTarget) }, '🤖 Copiar p/ Claude')),
      h('div', { class: 'info' }, `Grupos monitorados: ${st.groups.length} · com histórico lido: ${st.groups.filter(g => !g.partial).length}. ` +
        'Somente leitura: o painel nunca envia, edita ou apaga mensagens. Os grupos marcados como "só prévia" foram vistos apenas na lista; o botão 🔄 lê o histórico deles (e marca como lidos).')
    ];
  }
  function renderCfg() {
    const team = h('textarea', { rows: 6 }); team.value = cfg.team.join('\n');
    const ign = h('textarea', { rows: 4 }); ign.value = cfg.ignoreGroups.join('\n');
    const greg = h('input', { type: 'text', value: cfg.clientGroupRegex });
    const treg = h('input', { type: 'text', value: cfg.teamRegex });
    const auto = h('input', { type: 'checkbox', checked: cfg.autoRound });
    const mauto = h('input', { type: 'checkbox', checked: cfg.morningAuto !== false });
    const notif = h('input', { type: 'checkbox', checked: cfg.notify });
    const idle = h('input', { type: 'number', value: cfg.idleSec, min: 30 });
    const every = h('input', { type: 'number', value: cfg.roundEveryMin, min: 3 });
    const prom = h('input', { type: 'number', value: cfg.promiseHours, min: 1 });
    const morn = h('input', { type: 'text', value: cfg.morningTime });
    const mdays = h('input', { type: 'number', value: cfg.morningDays, min: 1, max: 8 });
    return [
      h('div', { class: 'grp' }, '⚙️ Configurações'),
      h('label', {}, 'Equipe Ileva (um por linha; trecho do nome basta)'), team,
      h('label', {}, 'Regra extra para reconhecer a equipe (regex)'), treg,
      h('label', {}, 'Grupos a ignorar (um por linha; trecho do nome basta)'), ign,
      h('label', {}, 'Regra para reconhecer grupos de clientes (regex)'), greg,
      h('label', { class: 'chk' }, notif, 'Notificação do navegador quando um atendimento ficar 🔴'),
      h('label', { class: 'chk' }, auto, 'Ronda automática quando ninguém mexer no WhatsApp (abre os grupos e marca como lidos)'),
      h('label', {}, 'Considerar "sem mexer" após (segundos)'), idle,
      h('label', {}, 'Intervalo da ronda automática (minutos)'), every,
      h('label', {}, 'Alertar retorno prometido após (horas)'), prom,
      h('label', { class: 'chk' }, mauto, 'Leitura diária automática de todos os grupos (uma vez por dia, no horário abaixo)'),
      h('label', {}, 'Horário da leitura diária de todos os grupos (HH:MM)'), morn,
      h('label', {}, 'Na leitura diária, considerar grupos com atividade nos últimos (dias)'), mdays,
      h('div', { class: 'actions', style: 'margin-top:12px' },
        h('button', { class: 'btn pri', onclick: async () => {
          cfg.team = team.value.split('\n').map(norm).filter(Boolean);
          cfg.ignoreGroups = ign.value.split('\n').map(norm).filter(Boolean);
          cfg.clientGroupRegex = greg.value || DEFAULT_CFG.clientGroupRegex;
          cfg.teamRegex = treg.value || DEFAULT_CFG.teamRegex;
          cfg.autoRound = auto.checked; cfg.morningAuto = mauto.checked; cfg.notify = notif.checked;
          cfg.idleSec = Math.max(30, +idle.value || 120); cfg.roundEveryMin = Math.max(3, +every.value || 10); cfg.promiseHours = Math.max(1, +prom.value || 2);
          cfg.morningTime = /^\d{1,2}:\d{2}$/.test(morn.value.trim()) ? morn.value.trim() : '08:15';
          cfg.morningDays = Math.min(8, Math.max(1, +mdays.value || 7));
          if (cfg.notify && 'Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (e) { } }
          lsSet(LS_CFG, cfg); toneCache.clear(); view = 'main'; render(true);
        } }, 'Salvar'),
        h('button', { class: 'btn', onclick: () => { cfg = Object.assign({}, DEFAULT_CFG); lsSet(LS_CFG, cfg); toneCache.clear(); render(true); } }, 'Restaurar padrão'),
        h('button', { class: 'btn', onclick: () => { data = { groups: {} }; lsSet(LS_DATA, data); toneCache.clear(); view = 'main'; render(true); } }, 'Limpar dados'),
        h('button', { class: 'btn', onclick: () => { view = 'main'; render(true); } }, 'Voltar')),
      h('div', { class: 'info' }, `Versão ${VERSION}. Os dados ficam só neste navegador e são apagados após 48 h.`)
    ];
  }

  let lastRenderSig = '';
  const LOGO_SVG = '<svg viewBox="-2 0 104 100" aria-hidden="true"><defs><linearGradient id="ilvLg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7b2c9e"/><stop offset=".55" stop-color="#3d0f5c"/><stop offset="1" stop-color="#22072f"/></linearGradient></defs><path d="M30.7 5.4 L28.8 5.5 L27.0 6.3 L25.0 8.3 L0.0 61.4 L0.0 63.2 L1.1 64.3 L3.0 64.5 L15.9 62.8 L16.6 62.5 L29.2 61.2 L30.9 60.6 L32.0 59.1 L36.4 36.2 L37.3 34.8 L39.0 33.6 L40.7 33.6 L42.0 34.4 L62.3 49.9 L63.6 51.8 L63.8 54.2 L63.0 55.8 L60.8 57.5 L32.9 60.4 L31.6 61.2 L30.9 63.6 L29.4 72.6 L25.7 90.8 L25.7 92.2 L26.6 93.7 L27.9 94.5 L29.6 94.5 L88.9 64.9 L91.7 63.8 L94.1 62.3 L95.4 61.9 L97.0 61.0 L98.5 59.5 L99.8 56.2 L99.1 52.9 L97.4 50.8 L34.4 6.7 L32.7 5.7Z" fill="url(#ilvLg)"/></svg>';
  const isCorp = () => true; // mascote descontinuado: sempre o visual corporativo
  const noEmoji = t => isCorp() ? String(t).replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '') : t;
  // logo com reflexo de luz passando por dentro (ids únicos para não conflitar entre cópias)
  let lgSeq = 0;
  function logoShine() {
    const k = 'Ls' + (++lgSeq);
    const mp = (LOGO_SVG.match(/<path[^>]*\sd="([^"]+)"/) || [])[1], vb = (LOGO_SVG.match(/viewBox="([^"]+)"/) || [])[1] || '0 0 100 100';
    if (!mp) return LOGO_SVG.replace(/ilvLg/g, k);
    return `<svg viewBox="${vb}" aria-hidden="true"><defs>`
      + `<linearGradient id="${k}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9b4fd0"/><stop offset=".55" stop-color="#5a1e8a"/><stop offset="1" stop-color="#2e0b47"/></linearGradient>`
      + `<linearGradient id="${k}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".40" stop-color="#fff" stop-opacity="0"/><stop offset=".48" stop-color="#f3e6ff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity=".95"/><stop offset=".52" stop-color="#f3e6ff" stop-opacity=".55"/><stop offset=".60" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>`
      + `<animateTransform attributeName="gradientTransform" type="translate" values="-1 -1;-1 -1;1 1" keyTimes="0;.45;1" dur="2.8s" repeatCount="indefinite"/></linearGradient>`
      + `<linearGradient id="${k}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2b8ff" stop-opacity=".35"/><stop offset=".6" stop-color="#e2b8ff" stop-opacity="0"/></linearGradient></defs>`
      + `<path d="${mp}" fill="url(#${k}a)"/><path d="${mp}" fill="url(#${k}g)"><animate attributeName="opacity" values=".4;1;.4" dur="2.8s" repeatCount="indefinite"/></path><path d="${mp}" fill="url(#${k}s)"/></svg>`;
  }
  let fabLogo = null; // a barra é redesenhada a cada 5 s: reaproveita a mesma logo para a animação não reiniciar
  function logoEl() { if (!fabLogo) { fabLogo = h('span', { class: 'lg' }); setHTML(fabLogo, logoShine()); } return fabLogo; }
  const MINI_OPTS = [5, 10, 15, 20, 30, 45, 60];
  const miniMax = () => (MINI_OPTS.includes(Number(ui.miniMin)) ? Number(ui.miniMin) : 5) * MIN; // minimizado volta sozinho depois do tempo escolhido
  function miniCheck() { const mo = monId(); if (lastMon && mo !== lastMon) { try { placeFab(); meetKey = ''; meetTick(); placeMeetBar(); const c = opEl && opEl.querySelector('input[data-ssv]'); if (c) c.checked = saverHere(); } catch (e) { } } lastMon = mo; if (syncMini()) { bubUntil = 0; mascMood = ''; try { render(true); updateMascot(); } catch (e) { } } } // também percebe a janela mudando de monitor
  // ---- tela cheia: o mascote e a barra continuam visíveis por cima
  let fsVid = null, fsSwap = false;
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  function fsRestoreVid() {
    if (!fsVid) return;
    const { v, st } = fsVid; fsVid = null;
    if (st == null) v.removeAttribute('style'); else v.setAttribute('style', st);
  }
  function fsPseudo(v) { // vídeo ocupando a tela inteira, com o Supervisor por cima
    if (!fsVid) fsVid = { v, st: v.getAttribute('style') };
    v.style.cssText += ';position:fixed!important;inset:0!important;left:0!important;top:0!important;width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;margin:0!important;z-index:2147483600!important;background:#000!important;object-fit:contain!important;transform:none!important';
  }
  function fsFix() {
    try {
      if (!host || pipWin) return;
      const fe = fsEl();
      if (!fe) {
        if (fsSwap) return;
        if (host.parentNode !== document.body && document.body) document.body.append(host);
        fsRestoreVid(); return;
      }
      if (fe.tagName === 'VIDEO') {
        // um <video> em tela cheia não deixa nada por cima: troca pela tela cheia da página, com o vídeo ocupando tudo
        const v = fe; fsSwap = true; if (!document.getElementById('ileva-video-fill')) fsPseudo(v);
        const done = () => { fsSwap = false; };
        (document.exitFullscreen ? document.exitFullscreen() : Promise.resolve())
          .then(() => document.documentElement.requestFullscreen())
          .then(done, done);
        return;
      }
      if (fe.tagName === 'IFRAME' || fe.tagName === 'IMG' || fe.tagName === 'CANVAS') return;
      if (!fe.contains(host)) fe.append(host);
    } catch (e) { fsSwap = false; }
  }
  // vídeo aberto direto no navegador (arquivo .mp4): o vídeo sempre ocupa a janela/tela inteira
  function fsMediaDoc() {
    try {
      if (!/^video\//i.test(document.contentType || '') || document.getElementById('ileva-video-fill')) return;
      const st = document.createElement('style'); st.id = 'ileva-video-fill';
      st.textContent = 'html,body{margin:0!important;padding:0!important;width:100%!important;height:100%!important;overflow:hidden!important;background:#000!important}body>video{position:fixed!important;inset:0!important;left:0!important;top:0!important;width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;margin:0!important;object-fit:contain!important;background:#000!important;z-index:2147483600!important}';
      (document.head || document.documentElement).append(st);
      // botão de tela cheia do vídeo: usa a tela cheia da página para o Supervisor continuar por cima
      const v = document.querySelector('body>video');
      if (v) v.addEventListener('dblclick', e => { e.preventDefault(); e.stopPropagation(); if (fsEl()) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => { }); }, true);
    } catch (e) { }
  }
  fsMediaDoc();
  document.addEventListener('fullscreenchange', fsFix);
  document.addEventListener('webkitfullscreenchange', fsFix);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && fsVid && !fsEl()) fsRestoreVid(); }, true);
  // ===== Pausa para o almoço (1h15) =====
  const LUNCH_KEY = 'ilevaSup.lunch.v1', LUNCH_DUR = 75 * MIN;
  function lunchGet() { const l = HAS_GM ? gmGetJ(LUNCH_KEY, null) : lsGet(LUNCH_KEY, null); return l && l.start && Date.now() - l.start < 12 * HOUR ? l : null; }
  function lunchOn() { try { return !!lunchGet(); } catch (e) { return false; } }
  function lunchSet(v) { if (HAS_GM) gmSetJ(LUNCH_KEY, v); else lsSet(LUNCH_KEY, v); }
  function lunchStart() {
    if (lunchOn()) { lunchApply(); return; }
    const nome = ((lsGet('ilevaSup.user.v1', {}) || {}).nome || '').trim();
    const now = Date.now();
    lunchSet({ start: now, end: now + LUNCH_DUR, nome, mon: monId() });
    try { setOpen(false); } catch (e) { }
    lunchApply();
  }
  function lunchEnd(cancel) {
    const l = lunchGet(); lunchSet(null);
    if (l && !cancel) {
      try { const log = lsGet('ilevaSup.lunchLog.v1', []) || []; log.push({ start: l.start, back: Date.now(), nome: l.nome }); while (log.length > 40) log.shift(); lsSet('ilevaSup.lunchLog.v1', log); } catch (e) { }
      const dur = Date.now() - l.start, late = Date.now() - l.end;
      lastAction = { kind: 'info', key: '', label: `Bem-vindo(a) de volta${l.nome ? ', ' + l.nome : ''}! Almoço: ${fmtDur(dur)}${late > MIN ? ' (' + fmtDur(late) + ' de atraso)' : ''}.`, at: Date.now() };
      cheerUntil = Date.now() + 6000;
    }
    lunchApply(); try { render(true); } catch (e) { }
  }
  const mmss = ms => { const t = Math.max(0, Math.floor(ms / 1000)), hh = Math.floor(t / 3600), mm = Math.floor(t % 3600 / 60), ss = t % 60; return (hh ? hh + ':' + twoD(mm) : twoD(mm)) + ':' + twoD(ss); };
  const LUNCH_SCENE = '<svg class="ltable" viewBox="0 0 340 140" aria-hidden="true"><defs><linearGradient id="luW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b07a4f"/><stop offset="1" stop-color="#7a4f2f"/></linearGradient><radialGradient id="luP" cx=".45" cy=".35" r=".7"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d9dde6"/></radialGradient></defs>'
    + '<rect x="6" y="58" width="328" height="78" rx="14" fill="url(#luW)"/><rect x="6" y="52" width="328" height="20" rx="10" fill="#c68f5f"/><path d="M40 52 h260 l-14 34 h-232 z" fill="#00a884" opacity=".85"/><path d="M60 52 l-6 34 M100 52 l-4 34 M140 52 l-2 34 M180 52 l0 34 M220 52 l2 34 M260 52 l4 34" stroke="#ffffff" stroke-width="3" opacity=".35"/>'
    + '<ellipse cx="162" cy="58" rx="74" ry="20" fill="#000" opacity=".25"/><ellipse cx="160" cy="52" rx="74" ry="22" fill="url(#luP)"/><ellipse cx="160" cy="50" rx="56" ry="15" fill="#eef0f5"/>'
    + '<ellipse cx="138" cy="47" rx="20" ry="9" fill="#fffaf0"/><circle cx="131" cy="44" r="1.6" fill="#e6dcc4"/><circle cx="141" cy="46" r="1.6" fill="#e6dcc4"/><circle cx="146" cy="43" r="1.6" fill="#e6dcc4"/>'
    + '<ellipse cx="162" cy="50" rx="13" ry="7" fill="#5b3a26"/><circle cx="158" cy="48" r="1.6" fill="#3a2416"/><circle cx="166" cy="51" r="1.6" fill="#3a2416"/>'
    + '<path d="M172 44 q14 -10 26 0 q4 8 -10 10 q-14 2 -16 -10z" fill="#a0592e"/><path d="M178 44 q8 -4 14 0" stroke="#7a3f1e" stroke-width="2" fill="none"/>'
    + '<path d="M184 54 q6 -8 14 -2 q-4 6 -14 2z" fill="#43b02a"/><path d="M190 56 q8 -6 12 2 q-6 4 -12 -2z" fill="#5fcf3a"/><circle cx="178" cy="57" r="3.4" fill="#ff9f1a"/>'
    + '<g class="lsteam" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"><path d="M140 34 q-6 -8 0 -16 q6 -8 0 -16"/><path d="M162 32 q-6 -8 0 -16 q6 -8 0 -16"/><path d="M184 34 q-6 -8 0 -16 q6 -8 0 -16"/></g>'
    + '<rect x="262" y="18" width="30" height="40" rx="5" fill="#ffffff" opacity=".35"/><rect x="265" y="30" width="24" height="26" rx="3" fill="#ffb020" opacity=".9"/><path d="M282 4 l-6 40" stroke="#00a884" stroke-width="3" stroke-linecap="round"/>'
    + '<path d="M60 40 l-2 22 M54 40 v8 a4 4 0 0 0 8 0 v-8" stroke="#c9ced8" stroke-width="3" fill="none" stroke-linecap="round"/></svg>';
  const LUNCH_FORK = '<svg class="larm" viewBox="0 0 340 340" aria-hidden="true"><defs><linearGradient id="luA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a55d6"/><stop offset=".5" stop-color="#6a32b8"/><stop offset="1" stop-color="#4c1d8c"/></linearGradient><radialGradient id="luG" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d6d0e2"/></radialGradient></defs>'
    + '<g class="la"><path d="M99 167 L166 167" stroke="#33105f" stroke-width="16" stroke-linecap="round" opacity=".55"/><path d="M99 167 L166 167" stroke="url(#luA)" stroke-width="12" stroke-linecap="round"/><path d="M104 163 L160 163" stroke="#b892f5" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>'
    + '<rect x="160" y="158" width="10" height="18" rx="5" fill="url(#luG)" stroke="#bdb4cc" stroke-width="1.5"/>'
    + '<path d="M184 167 L212 167" stroke="#c9ced8" stroke-width="4" stroke-linecap="round"/><path d="M226 159 h-12 a6 6 0 0 0 0 16 h12 M226 167 h-10" stroke="#c9ced8" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="229" cy="167" r="4.5" fill="#a0592e"/>'
    + '<ellipse cx="178" cy="167" rx="12" ry="11" fill="url(#luG)" stroke="#bdb4cc" stroke-width="1.5"/><path d="M174 157 q4 -6 10 -2" fill="none" stroke="#bdb4cc" stroke-width="1.5"/></g></svg>';
  let lunchEl = null, lunchLateBeep = 0, lunchNotified = 0;
  function lunchApply() {
    if (!shadow) return;
    const l = lunchGet();
    if (!l) { if (lunchEl) { const el = lunchEl; lunchEl = null; el.classList.add('out'); setTimeout(() => el.remove(), 450); } return; }
    const lMode = !isCorp() ? 'm' : (l.mon && l.mon !== monId()) ? 'sb' : 'fs';
    if (lunchEl && shadow.contains(lunchEl) && lunchEl.dataset.mode !== lMode) { lunchEl.remove(); lunchEl = null; }
    if ((!lunchEl || !shadow.contains(lunchEl)) && lMode === 'sb') {
      const fill = h('i'), hold = h('button', { class: 'lhold' }, fill, h('span', {}, 'Voltei do almoço — segure'));
      let t0 = 0, raf = 0;
      const stop = () => { t0 = 0; cancelAnimationFrame(raf); fill.style.transition = 'width .25s'; fill.style.width = '0'; };
      const step = () => { if (!t0) return; const p = Math.min(1, (Date.now() - t0) / 1500); fill.style.width = (p * 100) + '%'; if (p >= 1) { t0 = 0; lunchEnd(false); return; } raf = requestAnimationFrame(step); };
      hold.addEventListener('pointerdown', e => { e.preventDefault(); fill.style.transition = 'none'; t0 = Date.now(); raf = requestAnimationFrame(step); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => hold.addEventListener(ev, stop));
      const lg = h('span', { class: 'lg' }); setHTML(lg, logoShine());
      lunchEl = h('div', { class: 'lunch cl sb', 'data-mode': 'sb' }, h('div', { class: 'lsbx' }, h('div', { class: 'sbtop' }, lg, h('span', { class: 'sbpill' }, 'Em pausa')), h('div', { class: 'sbclk' }), h('div', { class: 'sbt' }), h('div', { class: 'sbbar' }, h('i')), h('div', { class: 'sbc' }, h('span', { class: 'sbl' }), h('b', { class: 'sbr' })), hold, h('div', { class: 'sbh' }, 'Tela em espera · a pausa foi iniciada no monitor principal')));
      { const xm = lunchXmas(); if (xm) { lunchEl.prepend(xm.snow); lunchEl.querySelector('.lsbx').append(xm.box); } }
      lunchEl.addEventListener('keydown', e => e.stopPropagation(), true);
      shadow.append(lunchEl);
    }
    if ((!lunchEl || !shadow.contains(lunchEl)) && lMode === 'fs') {
      const fill = h('i'), lab = h('span', {}, 'Voltei do almoço — segure');
      const hold = h('button', { class: 'lhold' }, fill, lab);
      let t0 = 0, raf = 0;
      const stop = () => { t0 = 0; cancelAnimationFrame(raf); fill.style.transition = 'width .25s'; fill.style.width = '0'; };
      const step = () => { if (!t0) return; const p = Math.min(1, (Date.now() - t0) / 1500); fill.style.width = (p * 100) + '%'; if (p >= 1) { t0 = 0; lunchEnd(false); return; } raf = requestAnimationFrame(step); };
      hold.addEventListener('pointerdown', e => { e.preventDefault(); fill.style.transition = 'none'; t0 = Date.now(); raf = requestAnimationFrame(step); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => hold.addEventListener(ev, stop));
      const lgS = h('span', { class: 'lg' }); setHTML(lgS, LOGO_SVG.replace(/ilvLg/g, 'ilvLgL'));
      const ring = h('div', { class: 'lring' }); setHTML(ring, '<svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="52" fill="none" stroke-width="7"/><circle class="fg" cx="60" cy="60" r="52" fill="none" stroke-width="7" stroke-dasharray="326.7" stroke-dashoffset="0"/></svg>');
      const ico = h('span', { class: 'ico' }); setHTML(ico, '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17 21V3c-2 1-3 3.5-3 7 0 2 1 3 3 3"/></svg>');
      ring.append(h('div', { class: 'ctr' }, ico, h('div', { class: 'ltime' }), h('div', { class: 'lrl' })));
      const lg2 = h('span', { class: 'lg' }); setHTML(lg2, logoShine());
      setHTML(ring.querySelector('svg'), '<defs><linearGradient id="lgRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c06bff"/><stop offset="1" stop-color="#6a2fe0"/></linearGradient></defs>', 'afterbegin');
      lunchEl = h('div', { class: 'lunch cl fs', 'data-mode': 'fs' }, h('div', { class: 'ltop' }, lg2, h('b', {}, 'Supervisor Ileva'), h('span', { class: 'lst' }, 'Em pausa'), h('span', { class: 'lclk' })), h('div', { class: 'lcard' },
        h('div', { class: 'lhead' }, lgS, 'Supervisor Ileva', h('span', { class: 'lst' }, 'Em pausa')),
        ring, h('h2', {}), h('div', { class: 'lsub' }), hold,
        h('div', { class: 'lhint' }, 'Segure o botão por 1,5 segundo para encerrar a pausa.'),
        h('button', { class: 'lcancel', onclick: () => lunchEnd(true) }, 'Cliquei sem querer — cancelar a pausa')));
      { const xm = lunchXmas(); if (xm) { lunchEl.prepend(xm.snow); lunchEl.append(xm.box); } }
      lunchEl.addEventListener('keydown', e => e.stopPropagation(), true);
      shadow.append(lunchEl);
    }
    if (!lunchEl || !shadow.contains(lunchEl)) {
      const masc = h('div', { class: 'masc m-lunch' }); setHTML(masc, mascotHTML(), 'beforeend');
      const stage = h('div', { class: 'lstage' }, masc, h('div', { class: 'lbub' }));
      setHTML(stage, LUNCH_SCENE + LUNCH_FORK, 'beforeend');
      // sair: segurar o botão por 1,5 s (evita sair sem querer)
      const fill = h('i'), lab = h('span', {}, '✅ Voltei do almoço · segure');
      const hold = h('button', { class: 'lhold' }, fill, lab);
      let t0 = 0, raf = 0;
      const stop = () => { t0 = 0; cancelAnimationFrame(raf); fill.style.transition = 'width .25s'; fill.style.width = '0'; };
      const step = () => { if (!t0) return; const p = Math.min(1, (Date.now() - t0) / 1500); fill.style.width = (p * 100) + '%'; if (p >= 1) { t0 = 0; lunchEnd(false); return; } raf = requestAnimationFrame(step); };
      hold.addEventListener('pointerdown', e => { e.preventDefault(); fill.style.transition = 'none'; t0 = Date.now(); raf = requestAnimationFrame(step); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => hold.addEventListener(ev, stop));
      hold.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!t0) { fill.style.transition = 'none'; t0 = Date.now(); raf = requestAnimationFrame(step); } } });
      hold.addEventListener('keyup', stop);
      const cancel = h('button', { class: 'lcancel', onclick: () => lunchEnd(true) }, 'Cliquei sem querer — cancelar a pausa');
      lunchEl = h('div', { class: 'lunch', 'data-mode': 'm' }, h('div', { class: 'lbox' }, stage, h('h2', {}), h('div', { class: 'lsub' }), h('div', { class: 'ltime' }), hold, h('div', { class: 'lhint' }, 'Segure o botão por 1 segundo e meio para sair da pausa.'), cancel));
      lunchEl.addEventListener('keydown', e => e.stopPropagation(), true);
      shadow.append(lunchEl);
    }
    lunchTick();
  }
  // contagem para o Natal nas telas de almoço (novembro e dezembro)
  function lunchXmas() {
    const now = Date.now(), d = xmasDays(now); if (d == null) return null;
    let biz = 0; { const t = new Date(now); t.setHours(12, 0, 0, 0); const xm = new Date(t.getFullYear(), 11, 25, 12).getTime(); for (t.setDate(t.getDate() + 1); t.getTime() < xm; t.setDate(t.getDate() + 1)) if (isBizDay(t)) biz++; }
    const frase = d === 0 ? 'Feliz Natal! Boas festas da Ileva' : d === 1 ? 'É amanhã! Bom almoço e boa véspera' : d <= 7 ? 'Última semana: o Natal está logo ali' : d <= 15 ? 'Contagem regressiva ligada' : d <= 30 ? 'Dezembro chegando, clima de festa' : 'O Natal já está no horizonte';
    const orn = [[52, 74, '#39ff88'], [96, 70, '#c9a8ff'], [66, 104, '#f6f3ff'], [104, 108, '#ffd279'], [40, 112, '#c9a8ff'], [84, 140, '#f6f3ff'], [56, 146, '#39ff88'], [112, 144, '#ffd279']];
    const svg = h('span', {}); setHTML(svg, `<svg viewBox="0 0 150 175"><path class="t" pathLength="1" d="M75 26 L44 66 L58 66 L32 104 L48 104 L20 150 L130 150 L102 104 L118 104 L92 66 L106 66 Z"/><path class="t" pathLength="1" d="M66 150 V166 H84 V150"/><path class="t g" pathLength="1" d="M50 80 Q76 92 100 74"/><path class="t g" pathLength="1" d="M38 118 Q78 132 112 112"/>`
      + orn.map(([x, y, c], i) => `<circle class="o" cx="${x}" cy="${y}" r="4" fill="${c}" style="color:${c};transform-origin:${x}px ${y}px;animation-delay:${(2.4 + i * .1).toFixed(2)}s,${(3.4 + i * .25).toFixed(2)}s"/>`).join('')
      + `<path class="st" d="M75 2 L79 11 L89 12 L81.5 18.5 L84 28 L75 23 L66 28 L68.5 18.5 L61 12 L71 11 Z"/></svg>`);
    const snow = h('div', { class: 'lsnow' });
    for (let i = 0; i < 34; i++) { const f = h('i'); const sz = 2 + Math.random() * 3.5; f.style.cssText = `left:${(Math.random() * 100).toFixed(1)}%;--s:${sz.toFixed(1)}px;--o:${(.12 + Math.random() * .3).toFixed(2)};--d:${(11 + Math.random() * 12).toFixed(1)}s;--w:-${(Math.random() * 20).toFixed(1)}s;--x:${(Math.random() * 60 - 30).toFixed(0)}px`; snow.append(f); }
    const box = h('div', { class: 'lxm' }, svg.firstChild, h('div', {},
      d === 0 ? h('div', { class: 'n' }, 'Hoje!') : h('div', { class: 'n' }, String(d)),
      h('div', { class: 'l1' }, d === 0 ? 'é Natal' : d === 1 ? 'dia para o Natal' : 'dias para o Natal'),
      h('div', { class: 'l2' }, frase + (d > 1 && biz ? ` · ${biz} almoço${biz > 1 ? 's' : ''} de expediente até lá` : ''))));
    return { box, snow };
  }
  function lunchTick() {
    const l = lunchGet();
    if (!l) { if (lunchEl) lunchApply(); return; }
    if (!lunchEl || !shadow.contains(lunchEl)) { lunchApply(); return; }
    const now = Date.now(), late = now - l.end, nome = l.nome || '';
    const isLate = late > 0;
    lunchEl.classList.toggle('late', isLate);
    { const want = !isCorp() ? 'm' : (l.mon && l.mon !== monId()) ? 'sb' : 'fs'; if (lunchEl.dataset.mode !== want) { lunchApply(); return; } }
    if (lunchEl.dataset.mode === 'sb') {
      const q3 = sel => lunchEl.querySelector(sel);
      q3('.sbclk').textContent = hhmm(now);
      q3('.sbt').replaceChildren(h('b', {}, nome || 'Colaborador'), ' em pausa para o almoço');
      q3('.sbpill').textContent = isLate ? 'Pausa excedida' : 'Em pausa';
      q3('.sbbar i').style.width = (isLate ? 100 : Math.min(100, Math.max(0, (now - l.start) / LUNCH_DUR * 100))) + '%';
      q3('.sbl').textContent = `Saída ${hhmm(l.start)} · retorno ${hhmm(l.end)}`;
      q3('.sbr').textContent = isLate ? `+${mmss(late)}` : `faltam ${mmss(l.end - now)}`;
      lunchEl.classList.toggle('late', isLate);
      if (isLate && IS_WA && now - lunchLateBeep > 60000) { lunchLateBeep = now; beep(true, true); }
      return;
    }
    if (lunchEl.classList.contains('cl')) {
      const q2 = sel => lunchEl.querySelector(sel);
      { const ck = q2('.lclk'); if (ck) ck.textContent = hhmm(now); }
      const fg = q2('.lring .fg'); if (fg) fg.style.strokeDashoffset = String(326.7 * (isLate ? 0 : Math.min(1, Math.max(0, (now - l.start) / LUNCH_DUR))));
      lunchEl.querySelectorAll('.lst').forEach(x => { x.textContent = isLate ? 'Pausa excedida' : 'Em pausa'; });
      q2('.ltime').textContent = isLate ? '+' + mmss(late) : mmss(l.end - now);
      q2('.lrl').textContent = isLate ? 'além do horário' : 'restantes';
      q2('h2').textContent = isLate ? `${nome ? nome + ', seu' : 'Seu'} horário de almoço terminou` : `${nome || 'Colaborador'} em pausa para o almoço`;
      q2('.lsub').textContent = isLate ? `O retorno era às ${hhmm(l.end)} (saída às ${hhmm(l.start)}).` : `Saída às ${hhmm(l.start)} · retorno previsto às ${hhmm(l.end)}`;
      q2('.lcancel').style.display = now - l.start < 3 * MIN && !isLate ? '' : 'none';
      if (isLate) {
        if (IS_WA && now - lunchLateBeep > 60000) { lunchLateBeep = now; beep(true, true); }
        if (IS_WA && !lunchNotified) { lunchNotified = 1; try { if ('Notification' in window && Notification.permission === 'granted') ilevaNotif(`${nome || 'Almoço'}: horário de almoço encerrado`, { body: `O retorno era às ${hhmm(l.end)}.`, tag: 'ileva-almoco', lunch: true }); } catch (e) { } }
      }
      return;
    }
    const m = lunchEl.querySelector('.lstage .masc'); if (m) m.className = 'masc ' + (isLate ? 'm-late' : 'm-lunch');
    const q = sel => lunchEl.querySelector(sel);
    if (!isLate) {
      q('h2').textContent = `🍽️ ${nome ? nome + ' está' : 'Estou'} almoçando`;
      q('.lsub').textContent = `Saiu às ${hhmm(l.start)} · volta às ${hhmm(l.end)}`;
      q('.ltime').textContent = 'faltam ' + mmss(l.end - now);
      q('.lbub').textContent = late > -5 * MIN ? 'Hmm… já já eu volto! 😋' : 'Hora do almoço! Bom apetite! 😋';
      q('.lcancel').style.display = now - l.start < 3 * MIN ? '' : 'none';
    } else {
      q('h2').textContent = `⚠️ ${nome ? nome.toUpperCase() + ', VOCÊ' : 'VOCÊ'} ESTÁ ATRASADO!`;
      q('.lsub').textContent = `Seu horário de almoço era até ${hhmm(l.end)} (saiu às ${hhmm(l.start)})`;
      q('.ltime').textContent = '+ ' + mmss(late) + ' de atraso';
      q('.lbub').textContent = `${nome ? nome + ', seu' : 'Seu'} tempo acabou às ${hhmm(l.end)}! Volte para o atendimento! 🚨`;
      q('.lcancel').style.display = 'none';
      if (IS_WA && now - lunchLateBeep > 60000) { lunchLateBeep = now; beep(true, true); }
      if (IS_WA && !lunchNotified) { lunchNotified = 1; try { if ('Notification' in window && Notification.permission === 'granted') ilevaNotif(`⚠️ ${nome || 'Almoço'}: horário de almoço encerrado`, { body: `O intervalo era até ${hhmm(l.end)}. Volte para o atendimento.`, tag: 'ileva-almoco', lunch: true }); } catch (e) { } }
    }
  }
  // minimizar por tela (monitor): cada monitor guarda o seu; "todas" vale para todos os monitores
  const monId = () => { try { return `${screen.availLeft || 0}x${screen.availTop || 0}`; } catch (e) { return '0x0'; } };
  // posição da barra / do alerta de reunião: cada monitor guarda a sua
  function posGet(k) { const m = ui[k + 'Mon']; const v = m && typeof m === 'object' ? m[monId()] : null; return v || ui[k]; }
  function posSet(k, v) { ui[k + 'Mon'] = Object.assign({}, (ui[k + 'Mon'] && typeof ui[k + 'Mon'] === 'object') ? ui[k + 'Mon'] : {}, { [monId()]: v }); }
  let lastMon = '';
  let miniInfoEl = null;
  function miniInfoPaint() { if (miniInfoEl) miniInfoEl.textContent = `Ao minimizar, volta sozinho depois de ${Math.round(miniMax() / MIN)} min (definido pelo gestor).`; }
  function syncMini() {
    miniInfoPaint();
    const now = Date.now(), mm = (ui.miniMon && typeof ui.miniMon === 'object') ? ui.miniMon : {};
    const at = Math.max(Number(mm[monId()]) || 0, Number(ui.miniAll) || 0);
    const on = at > 0 && now - at < miniMax();
    const ch = on !== !!ui.mini;
    ui.mini = on; ui.miniAt = on ? at : 0;
    return ch;
  }
  function setMini(v, all) {
    const now = Date.now(), mm = Object.assign({}, ui.miniMon || {});
    Object.keys(mm).forEach(k => { if (now - mm[k] >= miniMax()) delete mm[k]; });
    if (v) { if (all) ui.miniAll = now; else mm[monId()] = now; }
    else { delete mm[monId()]; if (ui.miniAll && now - ui.miniAll < miniMax()) { ui.miniAll = 0; } }
    ui.miniMon = mm; syncMini(); saveUi(); bubUntil = 0; mascMood = ''; render(true); updateMascot();
  }
  function fabMini(n, alarm) {
    if (!ui.mini) fab.append(h('span', { class: 'lu', title: meetSoundOn() ? 'Desligar o som de todos os alertas' : 'Ligar o som dos alertas', onclick: e => { e.stopPropagation(); e.preventDefault(); setMeetSound(!meetSoundOn()); } }, meetSoundOn() ? '🔔' : '🔕'));
    if (!ui.mini && IS_WA) fab.append(h('span', { class: 'lu', title: 'Pausa para o almoço (1h15)', onclick: e => { e.stopPropagation(); e.preventDefault(); lunchStart(); } }, '🍽️'));
    if (!ui.mini) { fab.append(h('span', { class: 'mn', title: 'Minimizar nesta tela (as outras telas continuam abertas)', onclick: e => { e.stopPropagation(); e.preventDefault(); setMini(true); } }, '–')); return; }
    fab.className = 'fab mini' + (alarm ? ' alarm' : '');
    fab.title = 'Supervisor minimizado' + (alarm ? ` — ${n} urgente(s)!` : '') + `. Volta sozinho às ${hhmm((ui.miniAt || Date.now()) + miniMax())}. Clique para mostrar a barra e o mascote agora (arraste para mudar de lugar)`;
    fab.replaceChildren(logoEl(), n !== null ? h('span', { class: 'mb' }, String(n)) : '');
  }
  function render(force) {
    mountUI();
    const st = IS_WA ? computeAll() : satState(); lastSt = st;
    try { const fc = IS_WA ? rxData(st).finalizados.length : st.finCount; if (lastFinCount !== null && fc > lastFinCount) cheerUntil = Date.now() + 8000; lastFinCount = fc; } catch (e) { }
    if (IS_WA) publishSummary(st);
    const yellows = st.open.filter(g => g.level !== 'red').length;
    // botão flutuante (quando o painel está minimizado)
    const alarm = st.reds.length > 0;
    fab.className = 'fab' + (alarm ? ' alarm' : '');
    fab.style.display = ui.open ? 'none' : 'flex';
    fab.title = alarm ? `${st.reds.length} cliente(s) esperando há mais de 15 min` : 'Abrir o Supervisor de Atendimento (arraste para mudar de lugar)';
    if (isCorp()) {
      const reds = st.reds.length, rw = Math.max(0, ...(st.open || []).filter(g => g.level === 'red').map(g => g.wait || 0));
      const lv = !reds ? '' : (reds > 1 || rw >= 40 * MIN) ? ' lv3' : rw >= 25 * MIN ? ' lv2' : ' lv1';
      fab.className = 'fab' + (alarm ? ' alarm' : '') + lv;
      fab.replaceChildren(logoEl(), 'Supervisor', h('span', { class: 'sep' }),
        h('span', { class: 'stx' + (reds ? ' r' : '') }, h('span', { class: 'sdot' }), reds ? `${reds} urgente${reds > 1 ? 's' : ''}${lv !== ' lv1' && rw ? ' · ' + Math.floor(rw / MIN) + ' min' : ''}` : 'tudo no prazo'),
        h('span', { class: 'ab' }, `${st.open.length} em aberto`));
      { const tc = tarFabChip(); if (tc) fab.append(tc); }
    } else
    fab.replaceChildren(...(alarm ? [`🚨 ${st.reds.length} urgente${st.reds.length > 1 ? 's' : ''}`] : [logoEl(), 'Supervisor']),
      h('span', { class: 'b' }, `${st.open.length} em aberto`));
    if (!IS_WA && st.stale) { fab.className = 'fab'; fab.title = 'Abra o WhatsApp Web para acompanhar os atendimentos'; fab.replaceChildren(logoEl(), 'Supervisor', h('span', { class: 'b' }, '⏸ WhatsApp fechado')); }
    fabMini(alarm ? st.reds.length : (!IS_WA && st.stale ? null : st.open.length), alarm);
    if (!IS_WA) {
      panel.style.display = 'none'; placeFab(); return;
    }
    notifyReds(st);
    if (!ui.open) placeFab();
    panel.style.display = ui.open ? 'flex' : 'none';
    panel.style.width = ui.width + 'px';
    applyDock();
    if (!ui.open) return;
    statusEl.textContent = `${new Date().toLocaleTimeString('pt-BR').slice(0, 5)} · ${st.groups.length} grupos`; statusEl.title = 'Atualizado às ' + statusEl.textContent;
    roundEl.style.display = roundInfo ? 'block' : 'none';
    roundEl.textContent = roundInfo ? roundInfo + ' (clique em 🔄 para parar)' : '';
    // contadores clicáveis
    const chip = (cls, n, l, tab, filter, on) => {
      const sel = view === 'main' && ui.tab === tab && (tab === 'tom' || ui.filter === filter);
      return h('div', { class: `chip ${cls}${on ? ' on' : ''}${sel ? ' sel' : ''}`, title: sel ? 'Clique de novo para ver todos' : 'Ver só esta lista',
        onclick: () => (sel && tab !== 'tom') ? setTab('atend', null) : setTab(tab, filter) }, h('div', { class: 'n' }, String(n)), h('div', { class: 'l' }, l));
    };
    chipsEl.replaceChildren(
      chip('red', st.reds.length, 'urgentes', 'atend', 'red', st.reds.length > 0),
      chip('yellow', yellows, 'no prazo', 'atend', 'prazo'),
      chip('purple', st.promises.length + st.waiting.length, 'retorno/aguard.', 'atend', 'retorno'));
    if (TAB_PERM[ui.tab] && !pode(TAB_PERM[ui.tab])) ui.tab = 'atend';
    const pendCount = st.open.length + st.promises.length;
    const tab = (id, label, count, red) => (TAB_PERM[id] && !pode(TAB_PERM[id])) ? null : h('button', { class: 'tab' + (ui.tab === id && view === 'main' ? ' on' : ''), onclick: () => setTab(id) }, noEmoji(label), count != null ? h('span', { class: 'c' + (red ? '' : ' g') }, String(count)) : null);
    tabsEl.replaceChildren(
      tab('atend', 'Atendimentos', pendCount, st.reds.length > 0),
      tab('rx', '🩻 Raio-X', null),
      tab('tar', 'Tarefas', tarAll().filter(tarOpen).length || null, tarAll().some(x => tarOpen(x) && tarState(x) === 'late')),
      tab('lemb', '🔔 Lembretes', lembDue().length || null, lembDue().length > 0),
      tab('reun', '📅 Reuniões', meets.filter(m => !m.done && !m.del && m.ts + MEET_AFTER >= Date.now() && isoDay(new Date(m.ts)) === isoDay(new Date())).length || null, activeMeets(Date.now()).length > 0),
      ...(CHAT_ON ? [tab('chat', '💬 Equipe', null)] : []));
    if (view === 'cfg') { if (force || bodyEl.dataset.view !== 'cfg') { bodyEl.replaceChildren(...renderCfg()); bodyEl.dataset.view = 'cfg'; } return; }
    if (!force && kbForm && ui.tab === 'base' && bodyEl.dataset.view === 'base') return;
    const ae = shadow.activeElement;
    if (!force && ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && bodyEl.contains(ae)) return;
    const sel = shadow.getSelection ? shadow.getSelection() : null;
    if (!force && sel && sel.toString()) return;
    // não redesenha enquanto o usuário tiver uma "resposta sugerida" aberta/fechada manualmente, salvo mudança real
    const sig = JSON.stringify([ui.tab, ui.filter, kb.length, kbQuery, rounding, st.morningInfo ? st.morningInfo.at : 0, st.morning.map(x => x.it.name), st.morning.map(x => x.g ? Math.floor((st.now - x.it.since) / HOUR) : 0), lastAction && Date.now() - lastAction.at < 15000 ? lastAction.at : 0, st.finalized.map(g => g.name), st.open.map(g => [g.name, Math.floor(g.wait / MIN), g.level]), st.waiting.map(g => [g.name, Math.floor(g.wait / MIN)]), st.promises.map(g => g.name), st.tone.map(t => [t.group, t.ts, Math.min(16, Math.floor((st.now - t.ts) / MIN))])]);
    if (!force && sig === lastRenderSig && bodyEl.dataset.view === ui.tab) return;
    // preserva quais "detalhes" o usuário abriu/fechou
    const openState = new Map();
    bodyEl.querySelectorAll('details').forEach((d, i) => openState.set(i, d.open));
    const keepManual = bodyEl.dataset.view === ui.tab && !force;
    lastRenderSig = sig;
    const top = bodyEl.scrollTop;
    const content = ui.tab === 'reun' ? renderMeet() : ui.tab === 'lemb' ? renderLemb() : ui.tab === 'tar' ? renderTar() : ui.tab === 'chat' && CHAT_ON ? renderChat() : ui.tab === 'rx' ? renderRx(st) : renderAtend(st);
    bodyEl.replaceChildren(...content.flat(Infinity).filter(Boolean));
    if (keepManual) bodyEl.querySelectorAll('details').forEach((d, i) => { if (openState.has(i)) d.open = openState.get(i); });
    bodyEl.dataset.view = ui.tab;
    bodyEl.scrollTop = top;
  }
  // ------------------------------------------------------------------ LOOP
  // ------------------------------------------------------------------ MEISTERTASK: preenche o card "Raio x Diário" (com o login de quem está usando)
  function mtMerge(text, p) {
    const NL = text.includes('\r\n') ? '\r\n' : '\n';
    let lines = text.replace(/\r\n/g, '\n').split('\n');
    const dateRe = /📆\s*\|\s*\**\s*(\d{1,2})\/(\d{1,2})\s*\**/;
    let oldDate = null;
    const di = lines.findIndex(l => dateRe.test(l));
    if (di >= 0) { const m = lines[di].match(dateRe); oldDate = m[1].padStart(2, '0') + '/' + m[2].padStart(2, '0'); lines[di] = lines[di].replace(dateRe, `📆 | **${p.date}**`); }
    else lines.unshift(`📆 | **${p.date}**`, '-------------------------');
    const newDay = oldDate !== p.date;
    const slotRe = /⏰\s*`?\s*(\d{1,2}:\d{2})\s*(?:-\s*([^`\n]*?))?\s*`?\s*$/;
    const heads = []; lines.forEach((l, i) => { const m = l.match(slotRe); if (m) heads.push({ i, slot: m[1].padStart(5, '0'), nome: (m[2] || '').trim() }); });
    const endOf = (h) => { const nxt = heads.find(x => x.i > h.i); let e = nxt ? nxt.i : lines.length; const inf = lines.findIndex((l, i) => i > h.i && i < e && /^\s*INFORMAR/i.test(l)); if (inf >= 0) e = inf; return e; };
    const blockFor = (slot, nome, v) => [`⏰\`${slot}${nome ? ' - ' + nome : ''}\``, `Abertos: ${v.ab}`, `Finalizados: ${v.fin}`, `Andamento: ${v.and}`, '', `TOTAL DE ATENDIMENTOS: ${v.total}`, `Obs: ${v.obs}`, `Aberto: ${v.obsAb}`, `Andamento: ${v.obsAnd}`, `Horário de realização: ${v.hora}`, ''];
    const empty = { ab: '', fin: '', and: '', total: '', obs: '', obsAb: '', obsAnd: '', hora: '' };
    const target = heads.find(h => h.slot === p.slot);
    // de trás para frente para não bagunçar os índices
    const ops = [];
    for (const h of heads) {
      if (h === target) ops.push({ s: h.i, e: endOf(h), rep: blockFor(h.slot, p.nome || h.nome, p) });
      else if (newDay && target && h.slot > target.slot) ops.push({ s: h.i, e: endOf(h), rep: blockFor(h.slot, (p.nomes && p.nomes[h.slot]) || h.nome, empty) });
    }
    ops.sort((a, b) => b.s - a.s).forEach(o => { lines.splice(o.s, o.e - o.s, ...o.rep); });
    if (!target) { // horário não existe no card: insere antes das instruções
      let at = lines.findIndex(l => /^\s*INFORMAR/i.test(l)); if (at < 0) at = lines.length;
      lines.splice(at, 0, ...blockFor(p.slot, p.nome, p));
    }
    return lines.map(l => l.replace(/\s+$/, '')).join(NL).replace(/\n{4,}/g, '\n\n\n');
  }
  function mtToast(msg, ok) {
    try {
      const t = document.createElement('div');
      t.textContent = msg;
      Object.assign(t.style, { position: 'fixed', left: '50%', top: '18px', transform: 'translateX(-50%)', zIndex: 2147483647, background: ok ? '#0f2a22' : '#3a1418', color: '#fff', border: '2px solid ' + (ok ? '#25d366' : '#f15c6d'), borderRadius: '12px', padding: '10px 16px', font: '600 14px Segoe UI,Arial,sans-serif', boxShadow: '0 8px 24px rgba(0,0,0,.35)', maxWidth: '90vw' });
      document.body.append(t); setTimeout(() => t.remove(), 7000);
    } catch (e) { }
  }
  // ---- reuniões -> card "Treinamentos/Reuniões"
  const MTR_KEY = 'ilevaSup.mtReun.v1', MTR_Q = 'ilevaSup.mtReunQ.v1';
  const MTR_URL_PADRAO = 'https://www.meistertask.com/app/task/cUZtbYf0/treinamentos-reunioes';
  function mtReunCfg() { const c = lsGet(MTR_KEY, {}) || {}; if (!c.url) c.url = MTR_URL_PADRAO; return c; }
  function reunMerge(text, op) {
    const NL = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
    const markRe = /^\s*`?\s*•?\s*(OFERTAR|DOM|SEG|TER|QUA|QUI|SEX|S[AÁ]B)\s*:?\s*`?\s*$/i;
    const headRe = /^\s*(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2}):(\d{2})\s*-\s*(.*)$/;
    const norm = t => String(t || '').replace(/\s+/g, ' ').trim().toLowerCase();
    // 1) remove a entrada antiga (edição ou exclusão)
    for (const old of [op.oldHead, op.action !== 'remove' ? op.head : null].filter(Boolean)) {
      const i = lines.findIndex(l => norm(l) === norm(old));
      if (i >= 0) {
        let e = i + 1; while (e < lines.length && lines[e].trim() !== '' && !markRe.test(lines[e]) && !headRe.test(lines[e])) e++;
        while (e < lines.length && lines[e].trim() === '' && e + 1 < lines.length && lines[e + 1].trim() === '') e++;
        lines.splice(i, e - i + (lines[e] !== undefined && lines[e].trim() === '' ? 1 : 0));
      }
    }
    if (op.action === 'remove') return lines.join(NL);
    // 2) insere na seção do dia, em ordem de horário
    const dia = DIAS[new Date(op.ts).getDay()];
    const marks = []; lines.forEach((l, i) => { const m = l.match(markRe); if (m) marks.push({ i, d: m[1].toUpperCase().replace('Á', 'A') }); });
    const sec = marks.find(m => m.d === dia);
    const entry = op.entry.split('\n');
    if (!sec) { lines.push('', ...entry); return lines.join(NL); }
    const nxt = marks.find(m => m.i > sec.i); const end = nxt ? nxt.i : lines.length;
    const body = lines.slice(sec.i + 1, end);
    const blocks = []; let cur = null, extra = [];
    for (const l of body) {
      if (headRe.test(l)) { cur = [l]; blocks.push(cur); }
      else if (cur) { if (l.trim() === '') cur = null; else cur.push(l); }
      else if (l.trim() !== '') extra.push(l);
    }
    const key = b => { const m = b[0].match(headRe); return m ? (+m[2]) * 100000 + (+m[1]) * 1000 + (+m[3]) * 60 + (+m[4]) : 0; };
    blocks.push(entry); blocks.sort((a, b) => key(a) - key(b));
    const out = [lines[sec.i], ''];
    extra.forEach(l => out.push(l)); if (extra.length) out.push('');
    blocks.forEach(b => { out.push(...b, ''); });
    lines.splice(sec.i, end - sec.i, ...out);
    return lines.join(NL);
  }
  function mtReunEntry(m) {
    const d = new Date(m.ts), head = `${twoD(d.getDate())}/${twoD(d.getMonth() + 1)}- ${hhmm(m.ts)} - ${m.cliente}`;
    return { head, entry: [head, `ILEVA: ${m.resp || ''}`.trimEnd(), `Cliente: ${m.contato || ''}`.trimEnd(), `Motivo: ${m.assunto || ''}`.trimEnd()].join('\n') };
  }
  function mtReunQueue(m, action) {
    const url = mtReunCfg().url || '', tok = (url.match(/\/app\/task\/([^/?#]+)/) || [])[1];
    if (!tok) { lastAction = { kind: 'info', key: '', label: 'Para lançar no MeisterTask, cole o link do card "Treinamentos/Reuniões" em "📌 Card de reuniões no MeisterTask".', at: Date.now() }; render(true); return; }
    const e = mtReunEntry(m);
    const q = (HAS_GM ? gmGetJ(MTR_Q, []) : []) || [];
    q.push({ task: tok, at: Date.now(), action, ts: m.ts, head: e.head, entry: e.entry, oldHead: action === 'add' ? '' : (m.mtHead || '') });
    if (HAS_GM) gmSetJ(MTR_Q, q);
    if (action === 'remove') delete m.mtHead; else m.mtHead = e.head;
    saveMeets();
    try { window.open(url, '_blank'); } catch (err) { }
    lastAction = { kind: 'info', key: '', label: action === 'remove' ? 'Abrindo o MeisterTask para tirar a reunião do card.' : 'Abrindo o MeisterTask: a reunião será lançada no card sozinha.', at: Date.now() };
    render(true);
  }
  async function mtEditDesc(transform, okCheck) {
    const wait = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(400); } return null; };
    let ta = document.querySelector('textarea.kr-view');
    if (!ta) {
      const md = await wait(() => [...document.querySelectorAll('.ml-react-markdown')].sort((a, b) => (b.innerText || '').length - (a.innerText || '').length)[0], 30000);
      if (!md) throw new Error('descrição não encontrada');
      md.click(); ta = await wait(() => document.querySelector('textarea.kr-view'), 8000);
    }
    if (!ta) throw new Error('não abriu o editor');
    const novo = transform(ta.value);
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    ta.focus(); setter.call(ta, novo);
    ta.dispatchEvent(new Event('input', { bubbles: true })); ta.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(600);
    ta.blur(); document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    return await wait(() => !document.querySelector('textarea.kr-view') && okCheck(document.body.innerText || ''), 8000);
  }
  async function mtReunFill() {
    if (!HAS_GM || !/(^|\.)meistertask\.com$/.test(location.hostname)) return;
    const tok = (location.pathname.match(/\/app\/task\/([^/?#]+)/) || [])[1];
    const q = (gmGetJ(MTR_Q, []) || []).filter(o => Date.now() - o.at < 30 * MIN);
    const mine = q.filter(o => o.task === tok);
    if (!tok || !mine.length) return;
    try {
      const ok = await mtEditDesc(t => mine.reduce((acc, o) => reunMerge(acc, o), t),
        txt => mine.every(o => o.action === 'remove' ? !txt.includes(o.oldHead) : txt.includes(o.head)));
      gmSetJ(MTR_Q, q.filter(o => o.task !== tok));
      mtToast(ok ? `✅ ${mine.length > 1 ? mine.length + ' reuniões atualizadas' : (mine[0].action === 'remove' ? 'Reunião retirada' : 'Reunião lançada')} no card pelo Supervisor Ileva` : '⚠️ Confira o card: não consegui confirmar a alteração.', ok);
    } catch (e) {
      mtToast('⚠️ Não consegui atualizar o card sozinho. Confira e ajuste manualmente.', false);
    }
  }
  // ---- card "Treinamentos/Reuniões" -> agenda do Supervisor (importa o que foi escrito direto no card)
  function reunParse(text, now = Date.now()) {
    const t = String(text || '').replace(/\r/g, '').replace(/[`*_]/g, '');
    const headG = /(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2})[:h](\d{2})\s*-\s*/g;
    const marks = /[•·]?\s*\b(OFERTAR|DOM|SEG|TER|QUA|QUI|SEX|S[AÁ]B)\s*:/i;
    const heads = []; let m;
    while ((m = headG.exec(t))) heads.push({ m, i: m.index, j: headG.lastIndex });
    const out = [];
    heads.forEach((hd, k) => {
      let seg = t.slice(hd.j, k + 1 < heads.length ? heads[k + 1].i : t.length);
      const mk = seg.match(marks); if (mk) seg = seg.slice(0, mk.index);
      const lab = re => { const x = seg.match(re); return x ? x[1].replace(/\s+/g, ' ').trim() : ''; };
      const cliente = (seg.split(/\n|ILEVA\s*:/i)[0] || '').trim();
      const resp = lab(/ILEVA\s*:\s*([^\n]*?)(?=\s*(?:Cliente\s*:|Motivo\s*:|\n|$))/i);
      const contato = lab(/Cliente\s*:\s*([^\n]*?)(?=\s*(?:Motivo\s*:|ILEVA\s*:|\n|$))/i);
      const assunto = lab(/Motivo\s*:\s*([^\n]*?)(?=\s*(?:ILEVA\s*:|Cliente\s*:|\n|$))/i);
      const [dd, mm, HH, MI] = [+hd.m[1], +hd.m[2], +hd.m[3], +hd.m[4]];
      if (!cliente || mm < 1 || mm > 12 || dd < 1 || dd > 31 || HH > 23 || MI > 59) return;
      // ano: o mais próximo de hoje (o card não traz o ano)
      const y0 = new Date(now).getFullYear();
      const ts = [y0 - 1, y0, y0 + 1].map(y => new Date(y, mm - 1, dd, HH, MI).getTime()).sort((a, b) => Math.abs(a - now) - Math.abs(b - now))[0];
      out.push({ ts, cliente, resp, contato, assunto, head: `${twoD(dd)}/${twoD(mm)}- ${twoD(HH)}:${twoD(MI)} - ${cliente}` });
    });
    return out;
  }
  const reunNorm = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  function reunId(head) { let hsh = 5381; const s2 = reunNorm(head); for (let i = 0; i < s2.length; i++) hsh = ((hsh * 33) ^ s2.charCodeAt(i)) >>> 0; return 'mt' + hsh.toString(36); }
  function reunImport(text) {
    const now = Date.now(), found = reunParse(text, now).filter(x => x.ts > now - 30 * MIN && x.ts - now < 60 * DAY);
    if (!found.length) return 0;
    let cur = lsGet(LS_MEET, []); if (!Array.isArray(cur)) cur = [];
    const add = [];
    for (const x of found) {
      const id = reunId(x.head);
      const dup = cur.some(m => m.id === id || reunNorm(m.mtHead) === reunNorm(x.head) || (Math.abs(m.ts - x.ts) < MIN && reunNorm(m.cliente) === reunNorm(x.cliente)));
      if (dup || add.some(a => a.id === id)) continue;
      add.push({ id, cliente: x.cliente, ts: x.ts, resp: x.resp, assunto: x.assunto, contato: x.contato, upd: now, pending: !!SHARED_URL, mtHead: x.head, src: 'mt' });
    }
    if (!add.length) return 0;
    meets = cur.concat(add); saveMeets(); meetKey = ''; try { meetTick(); } catch (e) { }
    mtToast(`📅 Supervisor Ileva: ${add.length > 1 ? add.length + ' reuniões do card entraram' : 'a reunião "' + add[0].cliente + '" entrou'} na agenda — a equipe será alertada 10 min antes.`, true);
    return add.length;
  }
  let reunSeen = '';
  function reunScan() {
    if (!/(^|\.)meistertask\.com$/.test(location.hostname)) return;
    if (document.querySelector('textarea.kr-view')) return; // alguém editando: espera terminar
    const md = [...document.querySelectorAll('.ml-react-markdown')].map(e => e.innerText || '').find(tx => /\bSEG\s*:/i.test(tx) && /\bQUA\s*:/i.test(tx) && /\d{1,2}\/\d{1,2}\s*-\s*\d{1,2}:\d{2}\s*-/.test(tx));
    if (!md || md === reunSeen) return;
    reunSeen = md;
    try { reunImport(md); } catch (e) { }
  }
  // ---- fechamento do dia: depois do Raio-X das 17:00 o card do dia vai para a coluna Raio-X (Completed, no topo)
  //      e o card "Raio x Diário" fica em branco para o próximo dia útil
  const RXC_KEY = 'ilevaSup.rxClosed.v1';
  async function mtGql(op, query, variables) {
    const r = await fetch('/app/api/graphql?op=' + op, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) });
    const j = await r.json();
    if (j.errors && j.errors.length) throw new Error(j.errors[0].message);
    return j.data;
  }
  const mtUpdTask = task => mtGql('UpdateTaskDue', 'mutation UpdateTaskDue($task: TaskUpdateInput!) { updateTask(task: $task) { task { id section_id status sequence } } }', { task });
  function nextBizTs(ts) { const d = new Date(ts); d.setHours(12, 0, 0, 0); for (let i = 0; i < 10; i++) { d.setDate(d.getDate() + 1); if (bizIndex(d.getTime()) != null) break; } return d.getTime(); }
  function rxBlankFor(text, ts) { // mesmo modelo do card, com a data do próximo dia útil e os campos vazios
    const d = new Date(ts), dd = twoD(d.getDate()) + '/' + twoD(d.getMonth() + 1);
    const NL = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const dateRe = /📆\s*\|\s*\**\s*(\d{1,2})\/(\d{1,2})\s*\**/;
    const slotRe = /⏰\s*`?\s*(\d{1,2}:\d{2})\s*(?:-\s*([^`\n]*?))?\s*`?\s*$/;
    const fieldRe = /^(\s*)(Abertos|Finalizados|Andamento|TOTAL DE ATENDIMENTOS|Obs|Aberto|Hor[aá]rio de realiza[cç][aã]o)\s*:.*$/i;
    let inSlot = false;
    const out = lines.map(l => {
      if (dateRe.test(l)) return l.replace(dateRe, `📆 | **${dd}**`);
      if (/^\s*INFORMAR/i.test(l)) { inSlot = false; return l; }
      const m = l.match(slotRe);
      if (m) { inSlot = true; const sl = m[1].padStart(5, '0'), nm = rxResp(ts, sl); return `⏰\`${sl}${nm ? ' - ' + nm : ''}\``; }
      if (inSlot) { const f = l.match(fieldRe); if (f) return `${f[1]}${f[2]}:`; }
      return l;
    });
    return out.join(NL);
  }
  async function rxCloseDay(tok, filled, dayTs = Date.now()) {
    const pj = await mtGql('ProjectsWithSections', 'query ProjectsWithSections { projectsNew { nodes { id name active_sections { id name } } } }');
    const nodes = (pj.projectsNew && pj.projectsNew.nodes || []).filter(Boolean);
    let rxSec = null, orig = null, rxTasks = [];
    for (const n of nodes) {
      const sx = (n.active_sections || []).find(s => /^\s*raio\s*-?\s*x\s*$/i.test(s.name));
      if (!sx) continue;
      for (const s of n.active_sections) {
        const d = await mtGql('T', `query T { find_section(id: ${Number(s.id)}) { id tasks { id token name sequence status } } }`).catch(() => null);
        const tasks = (d && d.find_section && d.find_section.tasks) || [];
        if (s.id === sx.id) rxTasks = tasks;
        const t = tasks.find(x => x.token === tok);
        if (t) orig = t;
      }
      if (orig) { rxSec = sx.id; break; }
    }
    if (!orig || !rxSec) throw new Error('não achei o card do dia ou a coluna Raio-X');
    const minSeq = rxTasks.filter(t => t.status !== 8).reduce((m, t) => Math.min(m, Number(t.sequence) || 0), 0);
    // 1) cópia com o Raio-X do dia, no topo da coluna Raio-X, como Completed
    const c = await mtGql('CreateTask', 'mutation CreateTask($task: TaskCreateInput!) { create_task(task: $task) { task { id token } } }', { task: { name: orig.name || 'Raio x Diário', section_id: Number(rxSec) } });
    const hid = c.create_task.task.id;
    await mtUpdTask({ id: hid, notes: filled, sequence: minSeq - 15000 });
    await mtUpdTask({ id: hid, status: 2 });
    // 2) card do dia em branco para o próximo dia útil
    const nx = nextBizTs(dayTs);
    await mtUpdTask({ id: orig.id, notes: rxBlankFor(filled, nx) });
    gmSetJ(RXC_KEY, { day: dayKey(new Date(dayTs)), hist: hid, at: Date.now() });
    return nx;
  }
  const MT_OK = 'ilevaSup.mtOk.v1';
  function pendDayTs(p) { const m = String(p && p.date || '').match(/(\d{1,2})\/(\d{1,2})/); const now = new Date(); if (!m) return now.getTime(); const t = new Date(now.getFullYear(), +m[2] - 1, +m[1], 12); if (t - now > 180 * DAY) t.setFullYear(t.getFullYear() - 1); return t.getTime(); }
  let mtBusy = false;
  async function mtAutoFill() {
    if (/(^|\.)meistertask\.com$/.test(location.hostname)) {
      setInterval(reunScan, 4000); setTimeout(mtAgendaFetch, 4000); setInterval(mtAgendaFetch, 2 * 60 * 1000); setTimeout(() => mtReunClean(true), 6000); setTimeout(rxCardFetch, 5000); setTimeout(tarMtRun, 3000); setInterval(tarMtRun, 5000); setInterval(rxCardFetch, 2 * 60 * 1000); setInterval(() => mtReunClean(false), 5000); setInterval(() => { try { rxScanCard(); } catch (e) { } }, 4000);
      setInterval(() => { if (!mtBusy) mtRxFill(); }, 3000); // card aberto depois (sem recarregar a página)
    }
    mtReunFill();
    mtRxFill();
  }
  async function mtRxFill() {
    if (!HAS_GM || !/(^|\.)meistertask\.com$/.test(location.hostname) || mtBusy) return;
    const pend = gmGetJ(MT_PENDING, null);
    if (!pend || Date.now() - pend.at > 4 * DAY) return; // o envio fica guardado até o card ser aberto
    const tok = (location.pathname.match(/\/app\/task\/([^/?#]+)/) || [])[1];
    if (!tok || tok !== pend.task) return;
    mtBusy = true;
    try { await mtRxFillRun(pend, tok); } finally { mtBusy = false; }
  }
  async function mtRxFillRun(pend, tok) {
    const pDay = dayKey(new Date(pendDayTs(pend)));
    { const cl = gmGetJ(RXC_KEY, null);
      if (cl && cl.day === pDay && cl.hist) { // o dia já foi fechado: corrige o card que está na coluna Raio-X
        try {
          const d = await mtGql('T', `query T { find_tasks(ids: [${Number(cl.hist)}]) { id notes } }`);
          const cur = d.find_tasks && d.find_tasks[0];
          if (!cur) throw new Error('sem histórico');
          await mtUpdTask({ id: cl.hist, notes: mtMerge(cur.notes || '', pend) });
          gmSetJ(MT_PENDING, null); gmSetJ(MT_OK, { date: pend.date, slot: pend.slot, at: Date.now() });
          mtToast(`✅ Raio-X das ${pend.slot} atualizado no card de hoje da coluna Raio-X`, true);
        } catch (e) { gmSetJ(MT_PENDING, null); mtToast('⚠️ O dia já tinha sido fechado e não consegui atualizar o card da coluna Raio-X. Confira lá.', false); }
        return;
      } }
    const wait = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(400); } return null; };
    try {
      // 1) abre o modo de edição da descrição
      const md = await wait(() => [...document.querySelectorAll('.ml-react-markdown')].find(e => /Abertos:|⏰|TOTAL DE ATENDIMENTOS/.test(e.innerText || '')), 30000);
      let ta = document.querySelector('textarea.kr-view');
      if (!ta) { if (!md) throw new Error('descrição não encontrada'); md.click(); ta = await wait(() => document.querySelector('textarea.kr-view'), 8000); }
      if (!ta) throw new Error('não abriu o editor');
      // 2) troca só o bloco do horário (e a data)
      const novo = mtMerge(ta.value, pend);
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      ta.focus(); setter.call(ta, novo);
      ta.dispatchEvent(new Event('input', { bubbles: true })); ta.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(600);
      ta.blur(); document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      // 3) confere se salvou
      const ok = await wait(() => !document.querySelector('textarea.kr-view') && (document.body.innerText || '').includes('TOTAL DE ATENDIMENTOS: ' + pend.total), 8000);
      gmSetJ(MT_PENDING, null);
      if (ok) gmSetJ(MT_OK, { date: pend.date, slot: pend.slot, at: Date.now() });
      if (ok) mtToast(`✅ Raio-X das ${pend.slot}${pend.nome ? ' (' + pend.nome + ')' : ''} preenchido pelo Supervisor Ileva`, true);
      if (ok && pend.slot === RX_SLOTS[RX_SLOTS.length - 1]) { // último Raio-X do dia: fecha o dia
        await sleep(1500);
        try {
          const nx = await rxCloseDay(tok, novo, pendDayTs(pend));
          const d = new Date(nx);
          mtToast(`📦 Dia fechado: o Raio-X de hoje foi para a coluna Raio-X (Completed) e o card de ${twoD(d.getDate())}/${twoD(d.getMonth() + 1)} está em branco.`, true);
          setTimeout(() => location.reload(), 4000);
        } catch (e) { mtToast('⚠️ Raio-X salvo, mas não consegui fechar o dia sozinho (' + e.message + '). Mova o card manualmente.', false); }
      }
      else mtToast('⚠️ Confira o card: se o Raio-X não apareceu, clique na descrição e cole com Ctrl+V (o texto já está copiado).', false);
    } catch (e) {
      gmSetJ(MT_PENDING, null);
      mtToast('⚠️ Não consegui preencher sozinho. Clique na descrição do card e cole com Ctrl+V (o texto já está copiado).', false);
    }
  }

  // ------------------------------------------------------------------ VITRINE (outras abas do navegador)
  const SUMMARY_KEY = 'ilevaSup.summary.v1';
  function publishSummary(st) {
    if (!HAS_GM) return;
    try {
      gmSetJ(SUMMARY_KEY, { at: Date.now(), reds: st.reds.map(g => g.name), open: st.open.map(g => ({ name: g.name, wait: g.wait, approx: !!g.approx, level: g.level })),
        editable: st.editable.length, morning: st.morning.length, finCount: lastFinCount || 0 });
    } catch (e) { }
  }
  function satState() {
    const sm = gmGetJ(SUMMARY_KEY, null), now = Date.now();
    if (!sm || now - sm.at > 90 * 1000) return { stale: true, reds: [], open: [], editable: [], morning: [], finCount: lastFinCount || 0 };
    const el = now - sm.at;
    const open = (sm.open || []).map(g => Object.assign({}, g, { wait: g.wait + el }));
    return { stale: false, reds: open.filter(g => (sm.reds || []).includes(g.name)), open, editable: new Array(sm.editable || 0), morning: new Array(sm.morning || 0), finCount: sm.finCount || 0 };
  }
  function satHint(el, msg) {
    let t = shadow.querySelector('.optip');
    if (!t) { t = h('div', { class: 'optip' }); shadow.append(t); }
    const r = el.getBoundingClientRect();
    t.textContent = msg || 'Os detalhes ficam no painel da aba do WhatsApp Web';
    t.style.left = Math.max(4, Math.min(VW() - 300, r.left - 60)) + 'px'; t.style.top = Math.max(4, r.top - 32) + 'px'; t.style.display = 'block';
    clearTimeout(opTipT); opTipT = setTimeout(() => { t.style.display = 'none'; }, 2500);
  }
  // mudanças feitas em outra aba (reuniões, posição, transparência) chegam aqui na hora
  function listenShared() {
    if (!HAS_GM || typeof GM_addValueChangeListener !== 'function') return;
    GM_addValueChangeListener('ilevaSup.meet.v1', (k, o, n, remote) => {
      if (!remote) return;
      try { meets = JSON.parse(n) || []; } catch (e) { return; }
      meetKey = ''; meetTick(); if (IS_WA) { if (meets.some(m => m.pending)) syncMeets(); if (ui.open && ui.tab === 'reun') render(true); }
    });
    GM_addValueChangeListener('ilevaSup.ui.v1', (k, o, n, remote) => {
      if (!remote) return;
      const m3Was = ui.mascot3d;
      try { const v = JSON.parse(n) || {}; UI_SHARED.forEach(x => { ui[x] = v[x]; }); syncMini(); } catch (e) { return; }
      if (ui.mascot3d !== m3Was) mascotRebuild();
      applyOp(); placeFab(); placeMeetBar(); meetKey = ''; meetTick(); try { render(false); updateMascot(); } catch (e) { }
    });
    if (!IS_WA) GM_addValueChangeListener(SUMMARY_KEY, (k, o, n, remote) => { if (remote) render(false); });
  }
  function satTick() {
    try {
      if (!document.body) return;
      if (!host || !document.documentElement.contains(host)) mountUI();
      presApply(); // janela flutuante aberta ou apresentando no Meet: não mostra
      render(false);
      if (document.visibilityState === 'visible') GM_setValue('ilevaSup.satVisible', Date.now());
    } catch (e) { }
  }

  // ------------------------------------------------------------------ JANELA FLUTUANTE (fica por cima de qualquer programa)
  function togglePip() {
    if (pipWin) { try { pipWin.close(); } catch (e) { } return; }
    if (!pipPref().usar) { lastAction = { kind: 'info', key: '', label: 'A janela flutuante está desligada em Configurações > Telas e monitores.', at: Date.now() }; try { render(true); } catch (e) { } return; }
    if (!('documentPictureInPicture' in window)) {
      lastAction = { kind: 'info', key: '', label: 'Este navegador não tem janela flutuante. Use o Google Chrome ou o Microsoft Edge atualizado.', at: Date.now() }; render(true); return;
    }
    documentPictureInPicture.requestWindow({ width: 460, height: 620 }).then(pw => {
      pipWin = pw;
      try {
        const bs = pw.document.createElement('style');
        bs.textContent = 'html,body{margin:0;height:100%;background:radial-gradient(circle at 80% 100%,#1b2a33 0,#0b141a 70%);overflow:hidden;font-family:"Segoe UI",Helvetica,Arial,sans-serif}';
        pw.document.head.append(bs); pw.document.title = 'Supervisor Ileva';
      } catch (e) { }
      if (!shadow.querySelector('style.ilsv')) { const st = document.createElement('style'); st.className = 'ilsv'; st.textContent = CSS; shadow.prepend(st); }
      try { shadow.adoptedStyleSheets = []; } catch (e) { }
      ui.open = false; saveUi();
      host.classList.add('pip');
      pw.document.body.append(host);
      pw.addEventListener('pagehide', () => {
        pipWin = null; host.classList.remove('pip'); document.body.append(host);
        if (HAS_GM) gmSetJ('ilevaSup.pipAt', 0);
        meetKey = ''; placeFab(); placeMeetBar(); meetTick(); render(true);
      });
      if (HAS_GM) gmSetJ('ilevaSup.pipAt', Date.now());
      meetKey = ''; meetTick(); render(true);
    }).catch(e => { console.warn('[Supervisor Ileva] janela flutuante', e); });
  }

  // ------------------------------------------------------------------ BOAS-VINDAS DO DIA (primeira vez que o WhatsApp é aberto no dia)
  const WELCOME_KEY = 'ilevaSup.welcome.v1';
  const FRASES_DIA = ["Cada cliente bem atendido hoje é uma associação mais forte amanhã. Vamos juntos!", "Um bom atendimento começa com um sorriso, mesmo que seja por mensagem. 😊", "Hoje é um ótimo dia para resolver o que parecia difícil ontem.", "A pressa resolve rápido; o cuidado resolve de vez. Capriche em cada resposta!", "Você é a voz da Ileva para o cliente. Que hoje ela seja clara, gentil e segura.", "Pequenas respostas rápidas fazem grandes clientes satisfeitos.", "Problema bem explicado é meio caminho andado. Pergunte, entenda, resolva!", "O cliente nem sempre lembra do erro, mas sempre lembra de quem ajudou a resolver.", "Comece pelo que está há mais tempo esperando e o dia flui melhor.", "Respirar fundo também é produtividade. Bom trabalho hoje!", "Equipe que se ajuda atende melhor. Conte com os colegas e seja contado.", "Hoje vale a regra de ouro: responder em até 10 minutos e acompanhar até o fim.", "Cada \"deu certo, obrigado!\" do cliente é uma pequena vitória. Colecione várias hoje!", "Clareza é gentileza: explique como se estivesse ao lado do cliente.", "Um dia produtivo começa com a fila organizada. Bora zerar os pendentes?", "Ninguém sabe tudo, mas todo mundo pode aprender algo novo hoje.", "Seu atendimento de hoje pode ser o motivo de um cliente indicar a Ileva amanhã.", "Retorno prometido é retorno cumprido. Hoje vamos honrar cada um!", "Paciência com o cliente, firmeza com o problema. Esse é o jeito Ileva.", "A diferença entre bom e excelente está nos detalhes. Revise antes de enviar!", "Atendimento bom resolve; atendimento excelente encanta. Que tal encantar hoje?", "Uma mensagem bem escrita evita três perguntas depois. Capriche!", "Hoje é dia de mostrar que sistema bom vem com gente boa por trás.", "Organização é o melhor atalho. Um atendimento de cada vez, com atenção total.", "Quem atende com empatia transforma reclamação em confiança.", "Café na mão, foco no cliente e coração na equipe. Bom dia de trabalho!", "Não existe pergunta boba quando o objetivo é resolver. Pergunte sempre que precisar.", "Seja o atendimento que você gostaria de receber. Simples assim!", "Hoje cada minuto de espera a menos conta. Vamos com tudo!", "Feito é melhor que perfeito, mas bem feito é melhor que feito. Equilíbrio é tudo!", "Celebre os pequenos avanços: eles constroem os grandes resultados.", "O cliente confia na Ileva porque confia em você. Obrigado por fazer parte!", "Começar bem o dia é meio caminho para terminar melhor ainda.", "Escutar com atenção resolve metade do problema. A outra metade é com você!", "Um time alinhado não deixa ninguém sem resposta. Bora!", "Hoje é um novo dia para aprender, ensinar e atender com excelência.", "Gentileza não custa nada e vale muito. Use à vontade hoje!", "Atenção aos detalhes, carinho nas palavras e agilidade na solução.", "Todo grande resultado é feito de pequenos atendimentos bem feitos.", "Você faz diferença na rotina de muitas associações. Lembre disso hoje!", "Se ficar difícil, pause, respire e chame a equipe. Ninguém atende sozinho.", "Hoje vamos transformar dúvidas em soluções e clientes em fãs.", "Agilidade com qualidade: esse é o nosso superpoder.", "Comece o dia leve: uma resposta de cada vez, sem deixar ninguém para trás.", "Quando o cliente sai sabendo mais do que entrou, o atendimento foi nota 10.", "O sucesso do cliente é o nosso sucesso. Vamos fazer acontecer!", "Seu bom humor é contagiante, até pelo WhatsApp. Espalhe hoje!", "Feedback do cliente é presente: até quando vem embrulhado em reclamação.", "Foco, calma e organização. O resto a gente resolve juntos!", "Hoje é dia de deixar a fila vazia e o cliente feliz.", "Cada atendimento é uma chance de mostrar o melhor da Ileva.", "Responda como quem resolve, explique como quem ensina, acompanhe como quem cuida.", "Um dia de cada vez, um cliente de cada vez, sempre com excelência.", "Ótimos atendimentos não acontecem por acaso: acontecem por pessoas como você.", "Que hoje as mensagens sejam rápidas, os problemas pequenos e as soluções grandes!", "Erros acontecem; o que importa é como a gente resolve. Conte com a equipe!", "Você não está só respondendo mensagens, está ajudando associações a crescer.", "Sorria antes de digitar: o cliente sente a diferença.", "Hoje vamos superar o ontem. Bora fazer acontecer!", "Um ótimo dia começa com intenção. A sua hoje: atender com excelência!"];
  function fraseDoDia(d) {
    const y0 = new Date(d.getFullYear(), 0, 0), doy = Math.floor((d - y0) / DAY);
    return FRASES_DIA[(doy + d.getFullYear() * 7) % FRASES_DIA.length]; // muda todos os dias
  }
  function maybeWelcome() {
    if (!IS_WA) return;
    if (lsGet(WELCOME_KEY, '') === dayKey()) return;
    lsSet(WELCOME_KEY, dayKey());
    showWelcome();
  }
  function showWelcome() {
    if (!shadow || shadow.querySelector('.wel')) return;
    if (isCorp()) return showWelcomeCorp();
    const now = new Date(), hr = now.getHours();
    const saudBase = hr < 12 ? '☀️ Bom dia' : hr < 18 ? '🌤️ Boa tarde' : '🌙 Boa noite';
    // nome de quem usa este computador (perguntado uma vez e lembrado)
    const USER_KEY = 'ilevaSup.user.v1';
    let nome = (lsGet(USER_KEY, {}) || {}).nome || '';
    const hEl = h('div', { class: 'wh' });
    const paintHead = () => hEl.replaceChildren(nome ? `${saudBase}, ${nome}!` : `${saudBase}!`, ' Bem-vindo(a) ao atendimento Ileva');
    paintHead();
    const nameBox = h('div', { class: 'wname' });
    const askName = () => {
      const inp = h('input', { type: 'text', placeholder: 'Seu nome (ex.: Adriel)', value: nome, maxlength: '30' });
      const save = () => { nome = inp.value.trim().replace(/\s+/g, ' ').slice(0, 30); lsSet(USER_KEY, { nome }); paintHead(); showChange(); };
      inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') save(); });
      nameBox.replaceChildren(h('div', { class: 'wnq' }, '👋 Como podemos te chamar?'), h('div', { class: 'wnr' }, inp, h('button', { class: 'wns', onclick: save }, 'Salvar')));
      setTimeout(() => inp.focus(), 300);
    };
    const showChange = () => nameBox.replaceChildren(h('span', { class: 'wch', onclick: askName }, nome ? `Não é ${nome}? Trocar nome` : 'Informar meu nome'));
    if (nome) showChange(); else askName();
    const dataTxt = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    const today = isoDay(now);
    const reunHoje = meets.filter(m => !m.del && !m.fin && isoDay(new Date(m.ts)) === today && m.ts > Date.now() - MEET_AFTER).sort((a, b) => a.ts - b.ts);
    const abertos = lastSt && lastSt.open ? lastSt.open.length : 0;
    const big = h('div', { class: 'masc wbig m-welcome' });
    setHTML(big, mascotHTML(), 'beforeend');
    const close = () => { wel.classList.add('out'); setTimeout(() => wel.remove(), 400); document.removeEventListener('keydown', esc, true); };
    const esc = e => { if (e.key === 'Escape') close(); };
    const info = [];
    if (reunHoje.length) info.push(h('div', { class: 'wi' }, '📅 ', h('b', {}, `${reunHoje.length} ${reunHoje.length > 1 ? 'reuniões' : 'reunião'} hoje`), ' · a primeira às ', h('b', {}, hhmm(reunHoje[0].ts)), ` com ${reunHoje[0].cliente}`));
    { const AH = (lastSt && lastSt.open ? lastSt.open : []).filter(g => g.afterHours);
      if (AH.length) { const ini = new Date(bizWindowStart(Date.now())); info.push(h('div', { class: 'wi wah' }, '🌙 ', h('b', {}, `${AH.length} atendimento${AH.length > 1 ? 's' : ''} fora do expediente sem resposta`), ` (desde ${ini.toLocaleDateString('pt-BR', { weekday: 'short' })} 18:00): `, AH.map(g => clientLabel(g.name)).join(', '), '. Já entram no Raio-X de hoje.')); } }
    { const a = rxResp(Date.now(), '11:30'), b = rxResp(Date.now(), '17:00'); if (a || b) info.push(h('div', { class: 'wi' }, '🩻 Raio-X de hoje: ', h('b', {}, '11:30'), ` ${a} · `, h('b', {}, '17:00'), ` ${b}`)); }
    { const cr = cobResp(Date.now()); if (cr) info.push(h('div', { class: 'wi' }, '💰 ', cobMine(cr) && ((lsGet('ilevaSup.user.v1', {}) || {}).nome) ? h('b', {}, 'Hoje é o seu dia de cobrança!') : ['Dia de cobrança: ', h('b', {}, cr)], cobDone(Date.now()) ? ' · ✅ feita' : ' · realizar na parte da manhã')); }
    info.push(h('div', { class: 'wi' }, abertos ? ['💬 ', h('b', {}, `${abertos} atendimento${abertos > 1 ? 's' : ''} aguardando resposta`), ' agora'] : '✅ Nenhum atendimento aguardando resposta agora'));
    const wel = h('div', { class: 'wel', onclick: e => { if (e.target === wel) close(); } },
      h('div', { class: 'wbox' },
        h('div', { class: 'wsp' }, '✨'), h('div', { class: 'wsp s2' }, '⭐'), h('div', { class: 'wsp s3' }, '✨'),
        big,
        h('div', { class: 'wcard' },
          hEl,
          h('div', { class: 'wd' }, dataTxt.charAt(0).toUpperCase() + dataTxt.slice(1)),
          h('div', { class: 'wq' }, '“' + fraseDoDia(now) + '”'),
          info,
          h('button', { class: 'wbtn', onclick: close }, 'Bora trabalhar! 🚀'),
          nameBox)));
    shadow.append(wel);
    document.addEventListener('keydown', esc, true);
    setTimeout(() => { if (wel.isConnected && !(shadow.activeElement && shadow.activeElement.tagName === 'INPUT')) close(); }, 45000);
  }

  // ---- Boas-vindas no modo corporativo: tela inteira, com os números do dia
  function showWelcomeCorp(opts) {
    opts = opts || {}; const SAVER = !!opts.saver;
    const now = new Date(), hr = now.getHours(), USER_KEY = 'ilevaSup.user.v1';
    const saud = hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite';
    let nome = (lsGet(USER_KEY, {}) || {}).nome || '';
    const hEl = h('div', { class: 'hi' });
    const paintHead = () => hEl.replaceChildren(saud + (nome ? ', ' : ''), nome ? h('em', {}, nome.split(' ')[0]) : '', '.');
    paintHead();
    const nameBox = h('div', { class: 'wname' });
    const showChange = () => nameBox.replaceChildren(h('span', { class: 'wch', onclick: askName }, nome ? `Não é ${nome}? Trocar nome` : 'Informar meu nome'));
    const askName = () => {
      const inp = h('input', { type: 'text', placeholder: 'Seu nome (ex.: Adriel)', value: nome, maxlength: '30' });
      const save = () => { nome = inp.value.trim().replace(/\s+/g, ' ').slice(0, 30); lsSet(USER_KEY, { nome }); paintHead(); showChange(); };
      inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') save(); });
      nameBox.replaceChildren(h('div', { class: 'wnq' }, 'Como podemos te chamar?'), h('div', { class: 'wnr' }, inp, h('button', { class: 'wns', onclick: save }, 'Salvar')));
      setTimeout(() => inp.focus(), 300);
    };
    if (SAVER) nameBox.replaceChildren(); else if (nome) showChange(); else askName();
    const dataTxt = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const today = isoDay(now), st = lastSt || {};
    const reunHoje = meets.filter(m => !m.del && !m.fin && isoDay(new Date(m.ts)) === today && m.ts > Date.now() - MEET_AFTER).sort((a, b) => a.ts - b.ts);
    const open = st.open || [], reds = open.filter(g => g.level === 'red').length, AH = open.filter(g => g.afterHours).length;
    const lembs = lembDue().length + lembAll().filter(x => !x.del && !x.done && isoDay(new Date(x.quando)) === today && x.quando > Date.now()).length;
    const K = (cls, label, val, sub) => h('div', { class: 'k ' + cls }, h('div', { class: 'kl' }, label), h('div', { class: 'kv' }, String(val)), sub ? h('div', { class: 'ks' }, ...[].concat(sub)) : null);
    const kps = [K(open.length ? (reds ? 'r' : 'a') : 'g', 'Aguardando resposta', open.length, open.length ? [reds ? h('b', {}, `${reds} urgente${reds > 1 ? 's' : ''}`) : 'Nenhum urgente', AH ? ` · ${AH} de fora do expediente` : ''] : 'Tudo respondido')];
    kps.push(K('b', 'Reuniões hoje', reunHoje.length, reunHoje.length ? ['Primeira às ', h('b', {}, hhmm(reunHoje[0].ts)), ` · ${reunHoje[0].cliente}`] : 'Agenda livre'));
    { const a = rxResp(Date.now(), '11:30'), b = rxResp(Date.now(), '17:00'); if (a || b) kps.push(K('', 'Raio-X de hoje', '2', [h('b', {}, '11:30'), ` ${a || '—'}`, h('br'), h('b', {}, '17:00'), ` ${b || '—'}`])); }
    { const cr = cobResp(Date.now()); if (cr) kps.push(K(cobDone(Date.now()) ? 'g' : 'a', 'Dia de cobrança', cobDone(Date.now()) ? 'Feito' : 'Hoje', cobMine(cr) && nome ? h('b', {}, 'É o seu dia de cobrar') : ['Responsável: ', h('b', {}, cr)])); }
    if (lembs) kps.push(K('a', 'Lembretes de cobrança', lembs, 'para hoje · aba Lembretes'));
    const xd = xmasDays(now.getTime());
    const close = () => { wel.classList.add('out'); setTimeout(() => wel.remove(), 400); document.removeEventListener('keydown', esc, true); clearInterval(ct); };
    const esc = e => { if (e.key === 'Escape') close(); };
    const lg = h('span', { class: 'lg' }); setHTML(lg, LOGO_SVG.replace(/ilvLg/g, 'ilvLgW'));
    setHTML(lg, logoShine());
    const clk = h('span', { class: 'clk' }, hhmm(Date.now()));
    const ct = setInterval(() => { clk.textContent = hhmm(Date.now()); }, 15000);
    const wel = h('div', { class: 'wel wfull' },
      h('div', { class: 'wf' },
        h('div', { class: 'top' }, lg, h('b', {}, 'Supervisor Ileva'), ' · atendimento', clk),
        hEl,
        h('div', { class: 'dt' }, dataTxt.charAt(0).toUpperCase() + dataTxt.slice(1)),
        h('div', { class: 'qt' }, h('div', { class: 'ql' }, 'Mensagem do dia'), h('div', { class: 'qx' }, fraseDoDia(now).replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').replace(/\s+([.!?])/g, '$1').trim())),
        h('div', { class: 'kp' }, ...kps),
        h('div', { class: 'ft' }, h('button', { class: 'go', onclick: SAVER ? () => saverClose() : close }, SAVER ? 'Voltar ao trabalho' : 'Começar o dia'), h('span', { class: 'hint' }, SAVER ? 'ou mexa o mouse / aperte qualquer tecla' : 'ou pressione Esc'), nameBox,
          xd != null && xd > 0 ? h('span', { class: 'xm' }, `Faltam ${xd} dias para o Natal`) : null)));
    if (SAVER) { wel.classList.add('saver'); if (opts.silent) wel.classList.add('silent'); wel._ct = ct; shadow.append(wel); return wel; }
    shadow.append(wel);
    document.addEventListener('keydown', esc, true);
    setTimeout(() => { if (wel.isConnected && !(shadow.activeElement && shadow.activeElement.tagName === 'INPUT')) close(); }, 60000);
    return wel;
  }
  // ---- Proteção de tela: a tela de bom dia aparece depois de 5 min sem mexer em nada; qualquer tecla/mouse volta
  const SAVER_IDLE = 5 * MIN, ACT_KEY = 'ilevaSup.lastAct.v1';
  let actLocal = Date.now(), actWrote = 0, saverEl = null, saverBuilt = 0;
  function noteAct(e) {
    if (e && e.isTrusted === false) return;
    if (e && e.type === 'mousemove' && !(e.movementX || e.movementY)) return;
    actLocal = Date.now();
    if (HAS_GM && actLocal - actWrote > 3000) { actWrote = actLocal; gmSetJ(ACT_KEY, actLocal); } // vale para todas as abas e telas
    if (saverEl) saverClose();
  }
  ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'].forEach(ev => addEventListener(ev, noteAct, { capture: true, passive: true }));
  function saverClose() { const el = saverEl; saverEl = null; if (el) { try { clearInterval(el._ct); } catch (e) { } el.classList.remove('silent'); el.classList.add('out'); setTimeout(() => el.remove(), 400); } }
  function saverOpen(silent) { saverEl = showWelcomeCorp({ saver: true, silent }); saverBuilt = Date.now(); }
  // em quais monitores a proteção de tela aparece (cada monitor liga/desliga o seu; padrão: ligada)
  const saverHere = () => { const m = ui.saverMon; return !(m && typeof m === 'object' && m[monId()] === false); };
  function setSaverHere(on) { ui.saverMon = Object.assign({}, (ui.saverMon && typeof ui.saverMon === 'object') ? ui.saverMon : {}, { [monId()]: !!on }); saveUi(); if (!on && saverEl) saverClose(); lastAction = { kind: 'info', key: '', label: on ? 'Proteção de tela ligada neste monitor.' : 'Proteção de tela desligada neste monitor (os outros continuam como estão).', at: Date.now() }; try { render(true); } catch (e) { } }
  function saverTick() {
    try {
      if (!shadow || !isCorp()) return;
      if (!saverHere()) { if (saverEl) saverClose(); return; }
      const now = Date.now(), last = Math.max(actLocal, HAS_GM ? (gmGetJ(ACT_KEY, 0) || 0) : 0);
      if (saverEl) {
        if (!shadow.contains(saverEl)) { saverEl = null; return; }
        if (now - last < SAVER_IDLE || lunchOn() || isPresenting()) { saverClose(); return; } // mexeu em outra aba/tela
        if (now - saverBuilt > 60000) { const old = saverEl; saverEl = null; try { clearInterval(old._ct); } catch (e) { } old.remove(); saverOpen(true); } // atualiza os números
        return;
      }
      if (now - last < SAVER_IDLE) return;
      if (lunchOn() || isPresenting() || document.fullscreenElement || document.visibilityState !== 'visible' || shadow.querySelector('.wel')) return;
      if ([...document.querySelectorAll('video,audio')].some(m => !m.paused && !m.muted)) return;
      saverOpen(false);
    } catch (e) { }
  }

  function tick() {
    try {
      if (!rounding) { ingestList(); ingestOpenChat(); }
      prune(); save(); render(false); maybeAuto();
      if (pipWin && HAS_GM) gmSetJ('ilevaSup.pipAt', Date.now());
    } catch (e) { console.warn('[Supervisor Ileva]', e); }
  }
  const boot = setInterval(() => {
    if (!document.body) return;
    clearInterval(boot);
    listenShared();
    try { syncMini(); } catch (e) { }
    setInterval(() => { try { miniCheck(); } catch (e) { } }, 3000);
    setInterval(() => { try { lunchTick(); } catch (e) { } }, 1000);
    setInterval(blockTick, 1000); blockTick();
    // o Chrome desacelera os relógios de janelas sem foco: um relógio paralelo (worker) mantém a tela de almoço atualizada
    // (o WhatsApp e a extensão não permitem esse relógio extra: lá ele é dispensado, sem gerar erro)
    if (!IS_WA && !IS_EXT) try { const wk = new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),1000)'], { type: 'text/javascript' }))); wk.onmessage = () => { try { if (lunchEl || lunchOn()) lunchTick(); } catch (e) { } }; } catch (e) { }
    ['focus', 'visibilitychange', 'pointermove'].forEach(ev => addEventListener(ev, () => { try { if (lunchEl || lunchOn()) lunchTick(); } catch (e) { } }, { passive: true }));
    setInterval(saverTick, 5000);
    setInterval(ecoTick, 3000); setTimeout(ecoTick, 1500);
    setInterval(pipTick, 2000); setTimeout(pipTick, 4000);
    setInterval(lembTick, 15000); setTimeout(lembTick, 6000); setInterval(tarTick, 15000); setTimeout(tarTick, 9000); setInterval(eodTick, 30000);
    setTimeout(() => { try { lunchApply(); } catch (e) { } }, 1500);
    if (HAS_GM && typeof GM_addValueChangeListener === 'function') GM_addValueChangeListener(LUNCH_KEY, () => { lunchNotified = 0; try { lunchApply(); } catch (e) { } });
    if (location.hostname === 'meet.google.com' && HAS_GM) setInterval(meetPresScan, 1000);
    setInterval(presApply, 1000);
    if (HAS_GM && typeof GM_addValueChangeListener === 'function') GM_addValueChangeListener(PRES_KEY, () => presApply());
    if (!IS_WA) { mtAutoFill(); mountUI(); satTick(); setInterval(satTick, 3000); setInterval(meetTick, 1000); meetTick(); return; }
    mountUI(); tick(); setTimeout(maybeWelcome, 3500); setInterval(tick, 5000); setInterval(meetTick, 1000); meetTick(); syncMeets(); setInterval(syncMeets, 30000); setInterval(() => { try { if (activeMeets(Date.now()).some(m => !m.fin && (m.live || Date.now() >= m.ts - MEET_BEFORE))) syncMeets(); } catch (e) { } }, 8000); setInterval(() => { try { chatAuto(); } catch (e) { } }, 20000); console.log('[Alertas Ileva - Equipe] ativo — somente leitura. v' + VERSION);
  }, 500);

  // Para testes/diagnóstico no console: window.__ilevaSup.report()
  window.__ilevaSup = { boasVindas: () => showWelcome(), report: () => buildTextReport(computeAll()), data: () => data, round: () => round(true), morning: () => morningRound(true), snapshot: () => snapshotMorning(), kb: () => kb, base: () => man, reunioes: () => meets, learnAll: () => learnAll(), version: VERSION };
})();
