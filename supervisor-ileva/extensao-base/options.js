'use strict';
// Página de Configurações do Ileva Supervisor.
// Preferências pessoais: armazenamento da extensão (as abas abertas recebem na hora).
// Administração (equipe, permissões, regras): planilha compartilhada (todos os computadores em até 1 minuto).
const CFG = window.ILEVA_CFG || {};
const K = { ui: 'ilevaSup.ui.v1', user: 'ilevaSup.user.v1', acesso: 'ilevaSup.acesso.v1', prefs: 'ilevaExt.prefs' };
const MINI_OPTS = [5, 10, 15, 20, 30, 45, 60];
const PERFIS = [['colaborador', 'Colaborador'], ['supervisor', 'Supervisor'], ['gestor', 'Gestor']];
const PERFIL_NOME = Object.fromEntries(PERFIS);
const PERMS = [
  { g: 'Acesso a módulos', k: 'ver_atendimentos', t: 'Atendimentos, reuniões, tarefas e lembretes', d: 'Painel principal, agenda e listas da equipe', fixo: true },
  { g: 'Acesso a módulos', k: 'raiox', t: 'Raio-X diário', d: 'Preencher e enviar o Raio-X ao MeisterTask' },
  { g: 'Acesso a módulos', k: 'ver_relatorios', t: 'Relatórios e indicadores', d: 'Aba Resumo, cópia do relatório e dos dados da equipe' },
  { g: 'Acesso a módulos', k: 'revisao_tom', t: 'Revisão de tom e base de respostas', d: 'Abas Tom e Base, com sugestões de resposta' },
  { g: 'Acesso a módulos', k: 'chat_equipe', t: 'Chat da equipe', d: 'Aba de mensagens internas' },
  { g: 'Ações', k: 'excluir_de_outros', t: 'Excluir registros de outras pessoas', d: 'Tarefas, reuniões e lembretes criados por colegas' },
  { g: 'Ações', k: 'finalizar_reuniao_de_outros', t: 'Finalizar reunião de outro responsável', d: 'Encerrar reuniões ministradas por colegas' },
  { g: 'Ações', k: 'ronda', t: 'Executar ronda nos grupos', d: 'Abre os grupos de clientes e marca como lidos' },
  { g: 'Administração', k: 'bloqueios_e_frases', t: 'Bloqueio de sites e frases de encerramento', d: 'Bloquear YouTube e Spotify; revisar frases aprendidas' },
  { g: 'Administração', k: 'administracao', t: 'Equipe, permissões e regras gerais', d: '', so_gestor: true },
];
const PADRAO = {
  colaborador: { ver_atendimentos: 1, raiox: 1, ver_relatorios: 0, revisao_tom: 0, excluir_de_outros: 0, finalizar_reuniao_de_outros: 0, ronda: 0, chat_equipe: 1, bloqueios_e_frases: 0 },
  supervisor: { ver_atendimentos: 1, raiox: 1, ver_relatorios: 0, revisao_tom: 1, excluir_de_outros: 1, finalizar_reuniao_de_outros: 1, ronda: 1, chat_equipe: 1, bloqueios_e_frases: 0 },
};
const ICON = {
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 16 0v1"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M1 21v-1a7 7 0 0 1 14 0v1"/><path d="M16 4.1a4 4 0 0 1 0 7.8M23 21v-1a7 7 0 0 0-5-6.7"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
};
const ico = (n, s = 16, w = 1.75) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

// ---------- utilitários ----------
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'value') e.value = v; else if (k === 'checked') e.checked = !!v; else if (k === 'disabled') e.disabled = !!v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) { if (k == null || k === false) continue; e.append(k instanceof Node ? k : document.createTextNode(String(k))); }
  return e;
}
const icon = (n, s) => h('span', { html: ico(n, s), style: 'display:inline-flex' });
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const iniciais = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';
const corAv = n => 'av c' + ([...String(n || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 5);
const fmtDH = ts => ts ? new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
function quando(ts) {
  if (!ts) return '—'; const d = Date.now() - ts;
  if (d < 90e3) return 'Agora'; if (d < 3600e3) return `Há ${Math.round(d / 60e3)} min`;
  const dt = new Date(ts), hoje = new Date(); const hm = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (dt.toDateString() === hoje.toDateString()) return `Hoje, ${hm}`;
  const ont = new Date(Date.now() - 864e5); if (dt.toDateString() === ont.toDateString()) return `Ontem, ${hm}`;
  return dt.toLocaleDateString('pt-BR');
}
let toastT = 0;
function toast(msg, err) { const t = document.getElementById('toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, err ? 6000 : 2600); }
async function sha256(txt) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
const clone = o => JSON.parse(JSON.stringify(o));

// ---------- estado ----------
const st = { store: {}, route: 'perfil', sel: null, tab: 'membros', draft: null, filtro: '', fPerfil: '', fStatus: 'ativos', adding: false, unlockUntil: 0, sync: { cls: 'busy', txt: 'Conectando à planilha…' }, remote: null };
const getJ = (k, d) => { const v = st.store[k]; if (v == null) return d; if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch (e) { return d; } };
const setJ = (k, v) => { st.store[k] = JSON.stringify(v); return chrome.storage.local.set({ [k]: st.store[k] }); };
const prefs = () => Object.assign({ tema: 'auto', eco: false }, getJ(K.prefs, {}));
const ui = () => getJ(K.ui, {}) || {};
const meuNome = () => ((getJ(K.user, {}) || {}).nome || '').trim();
const acesso = () => { const a = getJ(K.acesso, null); return a && Array.isArray(a.membros) ? a : null; };
const view = () => st.draft || acesso();
const eu = () => { const a = acesso(), n = norm(meuNome()); return a && n ? a.membros.find(m => norm(m.nome) === n) || null : null; };
function souGestor() { const a = acesso(); if (!a || !a.membros.length) return CFG.variant === 'gestor'; const m = eu(); return !!(m && m.ativo !== false && m.perfil === 'gestor'); }
const desbloqueado = () => !(acesso() && acesso().pin) || st.unlockUntil > Date.now();
function efetiva(m, k) { if (m.perfil === 'gestor') return true; if (k === 'administracao') return false; if (m.extra && k in m.extra) return !!m.extra[k]; return !!(PADRAO[m.perfil] || PADRAO.colaborador)[k]; }

async function updUi(patch) { const u = Object.assign({}, ui(), patch); await setJ(K.ui, u); }
async function updPrefs(patch) { await setJ(K.prefs, Object.assign(prefs(), patch)); aplicaTema(); }
function aplicaTema() {
  const t = prefs().tema; const dark = t === 'escuro' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

// ---------- planilha ----------
async function api(params) {
  if (!CFG.url) throw new Error('planilha não configurada');
  const u = CFG.url + '?' + new URLSearchParams(Object.assign({ key: CFG.key, t: Date.now() }, params)).toString();
  const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 25000);
  try {
    const r = await fetch(u, { credentials: 'omit', signal: ac.signal });
    const j = await r.json(); if (!j.ok) throw new Error(j.err || 'erro na planilha'); return j;
  } catch (e) { throw new Error(ac.signal.aborted ? 'a planilha demorou para responder' : (e.message || 'sem conexão com a planilha')); }
  finally { clearTimeout(to); }
}
function setSync(cls, txt) { st.sync = { cls, txt }; const e = document.getElementById('sync'); if (e) { e.className = 'sync ' + cls; e.textContent = txt; } }
async function carregaRemoto() {
  setSync('busy', 'Sincronizando…');
  try {
    const j = await api({ action: 'cfg' }); st.remote = j.cfg || {};
    if (st.remote.acesso && !st.draft) await setJ(K.acesso, st.remote.acesso);
    setSync('', 'Sincronizado com a planilha'); render();
  } catch (e) { setSync('err', 'Sem conexão com a planilha: ' + e.message); }
}
async function salvaRemoto(obj) { setSync('busy', 'Salvando…'); const j = await api({ action: 'cfgset', data: JSON.stringify(obj) }); st.remote = j.cfg || st.remote; setSync('', 'Sincronizado com a planilha'); return j; }

// ---------- navegação ----------
const ROTAS = [
  { sec: 'Pessoal', id: 'perfil', t: 'Meu perfil', i: 'user' },
  { sec: 'Pessoal', id: 'alertas', t: 'Alertas e notificações', i: 'bell' },
  { sec: 'Pessoal', id: 'telas', t: 'Telas e monitores', i: 'monitor' },
  { sec: 'Administração', id: 'equipe', t: 'Equipe e permissões', i: 'users', adm: true },
  { sec: 'Administração', id: 'regras', t: 'Regras da equipe', i: 'sliders', adm: true },
  { sec: 'Administração', id: 'auditoria', t: 'Auditoria', i: 'history', adm: true },
  { sec: 'Sistema', id: 'sobre', t: 'Sobre e atualizações', i: 'info' },
];
function go(id) { if (st.draft && st.route === 'equipe' && id !== 'equipe') { if (!confirm('Há alterações não salvas em Equipe e permissões. Descartar?')) return; st.draft = null; } st.route = id; location.hash = id; render(); window.scrollTo(0, 0); }
function renderNav() {
  const nav = document.getElementById('nav'); nav.replaceChildren();
  let sec = '';
  for (const r of ROTAS) {
    if (r.adm && !souGestor()) continue;
    if (r.sec !== sec) { sec = r.sec; nav.append(h('div', { class: 'ns' }, sec)); }
    nav.append(h('button', { class: 'ni' + (st.route === r.id ? ' on' : ''), onclick: () => go(r.id) }, icon(r.i), r.t, r.adm && acesso() && acesso().pin && !desbloqueado() ? h('span', { class: 'tag', html: ico('lock', 13) }) : null));
  }
  const m = eu(), nome = meuNome() || 'Sem nome';
  document.getElementById('me').replaceChildren(h('span', { class: corAv(nome) }, iniciais(nome)), h('div', {}, h('b', {}, nome), h('small', {}, m ? PERFIL_NOME[m.perfil] : souGestor() ? 'Gestor' : 'Colaborador')));
}
function cabecalho(t, d, ...acoes) { return h('div', { class: 'ph' }, h('div', {}, h('h1', {}, t), d ? h('p', {}, d) : null), acoes.length ? h('div', { style: 'display:flex;gap:8px' }, acoes) : null); }
const sw = (checked, onchange, disabled) => h('input', { type: 'checkbox', class: 'sw', role: 'switch', checked, disabled, onchange: e => onchange(e.target.checked) });
const linha = (t, d, ctl) => h('div', { class: 'pr' }, h('div', {}, h('b', {}, t), d ? (typeof d === 'string' ? h('small', {}, d) : d) : null), ctl);
const bloco = (t, d, ...rows) => h('div', { class: 'form' }, h('div', {}, h('h3', {}, t), h('p', {}, d)), h('div', { class: 'fc' }, rows));
const travado = txt => h('small', { class: 'lk', html: ico('lock', 12) + ' ' + txt });

// ---------- Pessoal ----------
function pgPerfil() {
  const nomeIn = h('input', { class: 'field', value: meuNome(), placeholder: 'Seu nome, como a equipe te chama (ex.: Akim)', maxlength: 40 });
  const m = eu();
  const tema = prefs().tema;
  const seg = h('div', { class: 'seg', style: 'margin:0;width:330px' }, [['auto', 'Automático'], ['claro', 'Claro'], ['escuro', 'Escuro']].map(([v, l]) => h('button', { class: tema === v ? 'on' : '', onclick: () => updPrefs({ tema: v }).then(render) }, l)));
  return [cabecalho('Meu perfil', 'Seus dados neste computador e a aparência da página de Configurações.'),
    bloco('Identificação', 'O nome liga você às suas tarefas, reuniões e lembretes. Use sempre o mesmo nome.',
      linha('Nome', 'Usado em "Cadastrada por", "Finalizada por" e nas suas permissões', h('div', { style: 'display:flex;gap:8px;min-width:360px' }, nomeIn,
        h('button', { class: 'btn p', onclick: async () => { const v = nomeIn.value.trim(); if (!v) return toast('Informe o nome.', true); await setJ(K.user, Object.assign({}, getJ(K.user, {}), { nome: v })); toast('Nome salvo. Aperte F5 nas abas abertas para atualizar.'); render(); } }, 'Salvar'))),
      linha('Perfil de acesso', m ? 'Definido pelo gestor em Equipe e permissões' : acesso() ? 'Seu nome não está cadastrado pelo gestor: acesso de Colaborador' : 'A equipe ainda não foi cadastrada: acesso completo, como antes',
        h('span', { class: 'rl' + (m && m.perfil === 'gestor' ? ' g' : '') }, m ? PERFIL_NOME[m.perfil] : acesso() ? 'Colaborador' : (CFG.variant === 'gestor' ? 'Gestor' : 'Colaborador')))),
    bloco('Aparência', 'Tema desta página. Automático segue o tema do Windows.', linha('Tema', null, seg))];
}
function pgAlertas() {
  const u = ui(), p = prefs(), mini = MINI_OPTS.includes(Number(u.miniMin)) ? Number(u.miniMin) : 5;
  return [cabecalho('Alertas e notificações', 'Preferências pessoais deste computador. Itens com cadeado foram definidos pelo gestor.'),
    bloco('Avisos', 'Como o Supervisor chama a sua atenção durante o expediente.',
      linha('Sons de alerta', 'Atendimentos, reuniões, Raio-X, tarefas, lembretes e almoço', sw(u.meetSound !== false, v => updUi({ meetSound: v }).then(() => toast(v ? 'Sons ligados.' : 'Sons desligados.')))),
      linha('Notificações do Windows', 'Aparecem no canto da tela com o navegador em segundo plano. Para permitir, abra o WhatsApp Web e aceite quando o navegador pedir.', h('span', { class: 'lk' }, 'Controlado pelo navegador')),
      linha('Tempo máximo do alerta minimizado', souGestor() ? 'Você altera em Administração > Regras da equipe' : travado('Definido pelo gestor'), h('span', { class: 'rl' }, `${mini} minutos`))),
    bloco('Desempenho', 'Para computadores mais simples ou com muitas abas abertas.',
      linha('Modo econômico', 'Desliga as animações decorativas (brilho do logo, pulsos e efeitos). Os alertas continuam iguais.', sw(!!p.eco, v => updPrefs({ eco: v }).then(() => toast(v ? 'Modo econômico ligado.' : 'Modo econômico desligado.')))))];
}
function monitores() {
  const u = ui(), ids = new Set();
  for (const k of ['saverMon', 'fabPosMon', 'meetPosMon', 'meetMinMon', 'meetHideMon']) if (u[k] && typeof u[k] === 'object') Object.keys(u[k]).forEach(x => /^-?\d+x-?\d+$/.test(x) && ids.add(x));
  const aqui = `${screen.availLeft || 0}x${screen.availTop || 0}`; ids.add(aqui);
  return { aqui, lista: [...ids].sort((a, b) => { const [ax, ay] = a.split('x').map(Number), [bx, by] = b.split('x').map(Number); return ax - bx || ay - by; }) };
}
function pgTelas() {
  const u = ui(), { aqui, lista } = monitores(), sm = (u.saverMon && typeof u.saverMon === 'object') ? u.saverMon : {};
  const card = (id, i) => { const on = sm[id] !== false; return h('button', { class: 'mo' + (on ? ' on' : ''), onclick: () => updUi({ saverMon: Object.assign({}, sm, { [id]: !on }) }).then(render) },
    h('div', { class: 'scr' }), h('span', { class: 'cb', html: on ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' : '' }),
    h('b', {}, `Monitor ${i + 1}`), h('small', {}, (id === aqui ? 'Onde esta página está · ' : '') + (on ? 'Proteção ligada' : 'Sem proteção'))); };
  const op = (k, t) => { const v = Math.round((Number(u[k]) >= 0.15 && Number(u[k]) <= 1 ? Number(u[k]) : 1) * 100); const out = h('span', {}, v + '%');
    return linha(t, null, h('div', { class: 'range' }, h('input', { type: 'range', min: 15, max: 100, step: 5, value: v, oninput: e => { out.textContent = e.target.value + '%'; }, onchange: e => updUi({ [k]: Number(e.target.value) / 100 }) }), out)); };
  const regra = (st.remote && st.remote.pipRegra) || getJ('ilevaSup.pipRegra.v1', {}) || {};
  const pp = Object.assign({ usar: true, modo: 'sempre', fila: true, reun: true, tar: true, lemb: true, lembrar: true, apresentando: true }, prefs().pip || {});
  const setPip = patch => updPrefs({ pip: Object.assign({}, pp, patch) }).then(render);
  const obrig = !!regra.obrigatoria;
  const modo = h('select', { onchange: e => setPip({ modo: e.target.value }) }, [['sempre', 'Sempre visível'], ['aviso', 'Só quando houver aviso']].map(([v, l]) => h('option', { value: v, selected: pp.modo === v ? true : null }, l)));
  const pip = bloco('Janela flutuante', 'Barra, fila e avisos numa janela por cima de qualquer programa, mesmo com o navegador minimizado. Abre pelo menu ⋯ do painel no WhatsApp.',
    linha('Usar janela flutuante', obrig ? travado('Obrigatória para a equipe (definido pelo gestor)') : 'Mostra o botão e o lembrete para abrir a janela', sw(obrig || pp.usar, v => setPip({ usar: v }), obrig)),
    linha('Modo de exibição', 'Só quando houver aviso: a fila aparece apenas com atendimento urgente; reuniões, tarefas e lembretes aparecem sempre', modo),
    linha('Fila de atendimentos', null, sw(pp.fila, v => setPip({ fila: v }))),
    linha('Alertas de reunião', null, sw(pp.reun, v => setPip({ reun: v }))),
    linha('Avisos de tarefas', null, sw(pp.tar, v => setPip({ tar: v }))),
    linha('Lembretes de cobrança', null, sw(pp.lemb, v => setPip({ lemb: v }))),
    linha('Lembrar de abrir', obrig ? travado('Definido pelo gestor') : 'Ao abrir o WhatsApp, mostra o botão "Abrir janela flutuante". O Chrome exige um clique para abrir.', sw(obrig || pp.lembrar, v => setPip({ lembrar: v }), obrig)));
  const hideAt = Number(getJ('ilevaExt.hideUntil', 0)) || 0, oculto = hideAt > Date.now();
  const priv = bloco('Privacidade na tela', 'Para tirar print, gravar a tela ou apresentar sem mostrar o Supervisor.',
    linha('Esconder ao apresentar no Google Meet', 'Esconde barra, fila e avisos enquanto você compartilha a tela', sw(pp.apresentando !== false, v => setPip({ apresentando: v }))),
    linha('Esconder agora por 5 minutos', oculto ? `Escondido até ${new Date(hideAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Também pelo atalho Ctrl+Shift+9, em qualquer programa (de novo para mostrar)',
      h('button', { class: 'btn', onclick: () => setJ('ilevaExt.hideUntil', oculto ? 0 : Date.now() + 5 * 60e3).then(() => { toast(oculto ? 'Supervisor visível de novo.' : 'Supervisor escondido por 5 minutos.'); render(); }) }, oculto ? 'Mostrar agora' : 'Esconder')),
    linha('Trocar o atalho', 'Se Ctrl+Shift+9 já for usado por outro programa', h('button', { class: 'btn', onclick: () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }) }, 'Abrir atalhos')));
  return [cabecalho('Telas e monitores', 'Onde e como o Supervisor aparece na sua tela.'), pip, priv,
    bloco('Proteção de tela', 'Mostra a tela de bom dia após 5 minutos sem atividade. Desmarque o monitor onde roda vídeo.', h('div', { class: 'mons' }, lista.map(card)),
      h('div', { class: 'lbl', style: 'padding:0 0 14px' }, 'Um monitor aparece aqui depois que o Supervisor é aberto nele pelo menos uma vez.')),
    bloco('Transparência', 'Quanto menor, mais discreto. Também dá para ajustar com a roda do mouse sobre cada elemento.', op('fabOp', 'Barra de atendimentos'), op('meetOp', 'Alerta de reunião'), op('pqOp', 'Fila de prioridade'))];
}

// ---------- Administração ----------
function pgBloqueio() {
  const a = acesso(), criar = !(a && a.pin);
  const pin = h('input', { type: 'password', inputmode: 'numeric', maxlength: 6, placeholder: '••••••', autocomplete: 'off' });
  const pin2 = criar ? h('input', { type: 'password', inputmode: 'numeric', maxlength: 6, placeholder: 'repita', autocomplete: 'off' }) : null;
  const err = h('div', { class: 'err' });
  const go2 = async () => {
    const v = pin.value.trim(); err.textContent = '';
    if (!/^\d{6}$/.test(v)) { err.textContent = 'O PIN tem 6 números.'; return; }
    if (criar) {
      if (pin2.value.trim() !== v) { err.textContent = 'Os dois PINs não são iguais.'; return; }
      const nome = meuNome(); if (!nome) { err.textContent = 'Antes, informe seu nome em Meu perfil.'; return; }
      const salt = [...crypto.getRandomValues(new Uint8Array(8))].map(x => x.toString(16).padStart(2, '0')).join('');
      const base = a ? clone(a) : { v: 1, membros: [] };
      if (!base.membros.some(m => norm(m.nome) === norm(nome))) base.membros.unshift({ id: 'm' + Date.now().toString(36), nome, setor: 'Administração', perfil: 'gestor', extra: {}, ativo: true, desde: Date.now() });
      base.pin = { salt, hash: await sha256(salt + ':' + v) };
      base.audit = [{ at: Date.now(), by: nome, msg: 'Configurou a administração e o PIN do gestor' }].concat(base.audit || []).slice(0, 25);
      base.upd = Date.now(); base.updBy = nome;
      try { await salvaRemoto({ acesso: base }); await setJ(K.acesso, base); } catch (e) { err.textContent = 'Não foi possível salvar: ' + e.message; return; }
      toast('Administração configurada.');
    } else if (await sha256(a.pin.salt + ':' + v) !== a.pin.hash) { err.textContent = 'PIN incorreto.'; pin.value = ''; return; }
    st.unlockUntil = Date.now() + 30 * 60e3; try { await chrome.storage.session.set({ ilvUnlock: st.unlockUntil }); } catch (e) { }
    render();
  };
  [pin, pin2].forEach(x => x && x.addEventListener('keydown', e => { if (e.key === 'Enter') go2(); }));
  setTimeout(() => pin.focus(), 50);
  return [h('div', { class: 'lock' }, h('span', { class: 'ic', html: ico('shield', 24) }),
    h('h2', {}, criar ? 'Configurar a administração' : 'Área do gestor'),
    h('p', {}, criar ? 'Crie o PIN do gestor (6 números). Ele protege equipe, permissões e regras em qualquer computador. Seu nome entra como Gestor.' : 'Digite o PIN do gestor para continuar. O acesso fica liberado por 30 minutos neste navegador.'),
    h('div', { class: 'pin' }, pin), pin2 ? h('div', { class: 'pin' }, pin2) : null, err,
    h('button', { class: 'btn p', onclick: go2 }, criar ? 'Criar PIN e continuar' : 'Entrar'))];
}
function pgEquipe() {
  const a = view(); const membros = a ? a.membros : [];
  const lista = membros.filter(m => (!st.filtro || norm(m.nome).includes(norm(st.filtro))) && (!st.fPerfil || m.perfil === st.fPerfil) && (st.fStatus === 'todos' || (st.fStatus === 'ativos' ? m.ativo !== false : m.ativo === false)));
  if (!st.sel || !membros.some(m => m.id === st.sel)) st.sel = (membros[0] || {}).id || null;
  const busca = h('input', { placeholder: 'Buscar por nome', value: st.filtro, oninput: e => { st.filtro = e.target.value; const c = document.activeElement === e.target; render(); if (c) { const i = document.querySelector('.tb input'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } } });
  const fP = h('select', { onchange: e => { st.fPerfil = e.target.value; render(); } }, h('option', { value: '' }, 'Perfil: todos'), PERFIS.map(([v, l]) => h('option', { value: v, selected: st.fPerfil === v ? true : null }, l)));
  const fS = h('select', { onchange: e => { st.fStatus = e.target.value; render(); } }, [['ativos', 'Status: ativos'], ['inativos', 'Status: inativos'], ['todos', 'Status: todos']].map(([v, l]) => h('option', { value: v, selected: st.fStatus === v ? true : null }, l)));
  const rows = lista.map(m => h('tr', { class: m.id === st.sel ? 'sel' : '', onclick: () => { st.sel = m.id; render(); } },
    h('td', {}, h('div', { class: 'nm' }, h('span', { class: corAv(m.nome) }, iniciais(m.nome)), h('div', {}, h('b', {}, m.nome), h('small', {}, m.setor || '—')))),
    h('td', {}, h('span', { class: 'rl' + (m.perfil === 'gestor' ? ' g' : '') }, PERFIL_NOME[m.perfil] || m.perfil)),
    h('td', {}, h('span', { class: 'dot' + (m.ativo === false ? ' off' : '') }, m.ativo === false ? 'Inativo' : 'Ativo')),
    h('td', { class: 'mu' }, m.desde ? new Date(m.desde).toLocaleDateString('pt-BR') : '—')));
  const add = st.adding ? addForm() : null;
  const tabela = h('div', { class: 'card' }, h('div', { class: 'tb' }, h('label', { class: 'in', html: ico('search', 14) }, busca), fP, fS), add,
    lista.length ? h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Membro'), h('th', {}, 'Perfil'), h('th', {}, 'Status'), h('th', {}, 'Desde'))), h('tbody', {}, rows))
      : h('div', { class: 'empty' }, membros.length ? 'Ninguém encontrado com esses filtros.' : 'Nenhum membro cadastrado.'),
    h('div', { class: 'note', html: ico('shield', 15) + '<div>O nome precisa ser <b>igual</b> ao que cada pessoa informou no Supervisor (Configurações > Meu perfil). A administração é protegida pelo PIN do gestor.</div>' }));
  const sel = membros.find(m => m.id === st.sel);
  return [cabecalho('Equipe e permissões', 'Quem usa o Supervisor e o que cada pessoa pode ver e fazer. As alterações valem em todos os computadores em até 1 minuto.',
      h('button', { class: 'btn p', html: ico('plus', 15) + 'Adicionar membro', onclick: () => { st.adding = true; render(); setTimeout(() => { const i = document.querySelector('.addrow input'); if (i) i.focus(); }, 30); } })),
    h('div', { class: 'tabs' }, h('button', { class: 'tab on' }, 'Membros', h('em', {}, String(membros.filter(m => m.ativo !== false).length))), h('button', { class: 'tab', onclick: () => go('auditoria') }, 'Registro de auditoria')),
    h('div', { class: 'cols' }, tabela, sel ? detalhe(sel) : h('div', { class: 'card empty' }, 'Selecione um membro.'))];
}
function editar(fn) { if (!st.draft) st.draft = clone(acesso() || { v: 1, membros: [] }); fn(st.draft); render(); }
function addForm() {
  const av = st.addVals = st.addVals || { nome: '', setor: '', perfil: 'colaborador' };
  const nome = h('input', { class: 'field', placeholder: 'Nome (igual ao do Supervisor)', maxlength: 40, value: av.nome, oninput: e => { av.nome = e.target.value; } });
  const setor = h('input', { class: 'field', placeholder: 'Setor (ex.: Atendimento)', maxlength: 30, value: av.setor, oninput: e => { av.setor = e.target.value; } });
  const perfil = h('select', { onchange: e => { av.perfil = e.target.value; } }, PERFIS.map(([v, l]) => h('option', { value: v, selected: av.perfil === v ? true : null }, l)));
  const ok = () => {
    const n = nome.value.trim(); if (!n) return toast('Informe o nome.', true);
    if ((view() ? view().membros : []).some(m => norm(m.nome) === norm(n))) return toast('Já existe um membro com esse nome.', true);
    const id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    editar(d => d.membros.push({ id, nome: n, setor: setor.value.trim(), perfil: perfil.value, extra: {}, ativo: true, desde: Date.now() }));
    st.sel = id; st.adding = false; st.addVals = null; render();
  };
  nome.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
  return h('div', { class: 'addrow' }, nome, setor, perfil, h('button', { class: 'btn p sm', onclick: ok }, 'Adicionar'), h('button', { class: 'btn sm', onclick: () => { st.adding = false; st.addVals = null; render(); } }, 'Cancelar'));
}
function detalhe(m) {
  const set = fn => editar(d => fn(d.membros.find(x => x.id === m.id)));
  const souEu = norm(m.nome) === norm(meuNome());
  const nCustom = Object.keys(m.extra || {}).length;
  const grupos = []; let g = '';
  for (const p of PERMS) {
    if (p.g !== g) { g = p.g; grupos.push(h('div', { class: 'pgh' }, g)); }
    let ctl;
    if (p.so_gestor) ctl = travado('Exclusivo do gestor');
    else if (m.perfil === 'gestor') ctl = sw(true, () => { }, true);
    else if (p.fixo) ctl = sw(true, () => { }, true);
    else ctl = sw(efetiva(m, p.k), v => set(x => { x.extra = x.extra || {}; const pad = !!(PADRAO[x.perfil] || PADRAO.colaborador)[p.k]; if (v === pad) delete x.extra[p.k]; else x.extra[p.k] = v ? 1 : 0; }));
    const custom = m.perfil !== 'gestor' && m.extra && p.k in m.extra;
    grupos.push(h('div', { class: 'pr' }, h('div', {}, h('b', {}, p.t, custom ? h('span', { class: 'cu' }, 'Personalizado') : null), p.d ? h('small', {}, p.d) : null), ctl));
  }
  return h('div', { class: 'card' },
    h('div', { class: 'pf' },
      h('div', { class: 'pfh' }, h('span', { class: corAv(m.nome) }, iniciais(m.nome)), h('div', {}, h('b', {}, m.nome, souEu ? h('span', { class: 'mu', style: 'font-weight:400' }, ' (você)') : null), h('small', {}, (m.setor || 'Sem setor') + ' · desde ' + (m.desde ? new Date(m.desde).toLocaleDateString('pt-BR') : '—')))),
      h('div', { class: 'seg' }, PERFIS.map(([v, l]) => h('button', { class: m.perfil === v ? 'on' : '', disabled: souEu && v !== 'gestor' ? true : null, title: souEu && v !== 'gestor' ? 'Você não pode tirar o seu próprio acesso de gestor' : null, onclick: () => set(x => { x.perfil = v; x.extra = {}; }) }, l))),
      h('div', { class: 'lbl' }, m.perfil === 'gestor' ? 'Gestor tem acesso total.' : `Permissões do perfil ${PERFIL_NOME[m.perfil]}` + (nCustom ? ` · ${nCustom} personalizada${nCustom > 1 ? 's' : ''}` : '')),
      h('div', { class: 'grid2', style: 'padding:12px 0 0;border:0' },
        h('div', {}, h('label', {}, 'Setor'), h('input', { class: 'field', value: m.setor || '', maxlength: 30, onchange: e => set(x => { x.setor = e.target.value.trim(); }) })),
        h('div', {}, h('label', {}, 'Status'), h('div', { style: 'display:flex;align-items:center;gap:10px;height:34px' }, sw(m.ativo !== false, v => set(x => { x.ativo = v; }), souEu), h('span', {}, m.ativo === false ? 'Inativo (sem acesso)' : 'Ativo'))))),
    h('div', { class: 'pg' }, grupos),
    nCustom && m.perfil !== 'gestor' ? h('div', { style: 'padding:0 18px 16px' }, h('button', { class: 'btn sm', onclick: () => set(x => { x.extra = {}; }) }, 'Voltar ao padrão do perfil')) : null);
}
function difs(a, b) {
  const out = [], A = new Map((a ? a.membros : []).map(m => [m.id, m]));
  for (const m of b.membros) {
    const o = A.get(m.id);
    if (!o) { out.push(`Adicionou ${m.nome} como ${PERFIL_NOME[m.perfil]}`); continue; }
    if (o.perfil !== m.perfil) out.push(`Mudou ${m.nome} de ${PERFIL_NOME[o.perfil]} para ${PERFIL_NOME[m.perfil]}`);
    if ((o.ativo !== false) !== (m.ativo !== false)) out.push(`${m.ativo === false ? 'Desativou' : 'Reativou'} ${m.nome}`);
    if ((o.setor || '') !== (m.setor || '')) out.push(`Alterou o setor de ${m.nome} para ${m.setor || '—'}`);
    for (const p of PERMS) { const ov = o.perfil === m.perfil ? efetiva(o, p.k) : null, nv = efetiva(m, p.k); if (ov != null && ov !== nv) out.push(`${nv ? 'Liberou' : 'Bloqueou'} "${p.t}" para ${m.nome}`); }
  }
  return out;
}
function pgRegras() {
  const r = st.remote || {}, mini = MINI_OPTS.includes(Number(r.miniMin)) ? Number(r.miniMin) : (MINI_OPTS.includes(Number(ui().miniMin)) ? Number(ui().miniMin) : 5);
  const blk = r.block || { on: false };
  const sel = h('select', { onchange: async e => { const v = Number(e.target.value); try { await salvaRemoto({ miniMin: v, miniMinAt: Date.now() }); await updUi({ miniMin: v, miniMinAt: Date.now() }); await auditar(`Mudou o tempo do alerta minimizado para ${v} minutos`); toast('Tempo atualizado para toda a equipe.'); } catch (x) { toast('Não foi possível salvar: ' + x.message, true); } render(); } },
    MINI_OPTS.map(v => h('option', { value: v, selected: v === mini ? true : null }, `${v} minutos`)));
  return [cabecalho('Regras da equipe', 'Valem para todos os computadores em até 1 minuto.'),
    bloco('Alertas', 'Quanto tempo o alerta pode ficar minimizado antes de voltar sozinho à tela.', linha('Tempo máximo do alerta minimizado', 'Igual para toda a equipe', sel)),
    bloco('Janela flutuante', 'Torna a janela flutuante obrigatória: o colaborador não consegue desligar e o lembrete para abrir não pode ser dispensado.',
      linha('Janela flutuante obrigatória para a equipe', (r.pipRegra && r.pipRegra.at) ? `Alterado por ${r.pipRegra.by || '—'} em ${fmtDH(r.pipRegra.at)}` : 'Cada pessoa escolhe', sw(!!(r.pipRegra && r.pipRegra.obrigatoria), async v => { try { await salvaRemoto({ pipRegra: { obrigatoria: v, by: meuNome(), at: Date.now() } }); await setJ('ilevaSup.pipRegra.v1', { obrigatoria: v }); await auditar(`${v ? 'Tornou obrigatória' : 'Deixou opcional'} a janela flutuante`); toast('Regra salva para a equipe.'); } catch (x) { toast('Não foi possível salvar: ' + x.message, true); } render(); }))),
    bloco('Bloqueio de sites', 'Bloqueia YouTube e Spotify nos computadores da equipe durante o expediente. O gestor não é bloqueado.',
      linha('Bloquear YouTube e Spotify', blk.on ? `Ligado por ${blk.by || '—'} em ${fmtDH(blk.at)}` : 'Desligado', sw(!!blk.on, async v => { try { await salvaRemoto({ block: { on: v, by: meuNome(), at: Date.now() } }); await auditar(`${v ? 'Ligou' : 'Desligou'} o bloqueio de YouTube e Spotify`); toast(v ? 'Bloqueio ligado para a equipe.' : 'Bloqueio desligado.'); } catch (x) { toast('Não foi possível salvar: ' + x.message, true); } render(); })))];
}
async function auditar(msg) { const a = acesso(); if (!a) return; const n = clone(a); n.audit = [{ at: Date.now(), by: meuNome(), msg }].concat(n.audit || []).slice(0, 25); try { await salvaRemoto({ acesso: n }); await setJ(K.acesso, n); } catch (e) { } }
function pgAuditoria() {
  const L = (acesso() && acesso().audit) || [];
  return [cabecalho('Auditoria', 'As 25 alterações mais recentes de equipe, permissões e regras.'),
    h('div', { class: 'card audit', style: 'margin-top:18px' }, L.length ? L.map(x => h('div', { class: 'row' }, h('span', { class: 'mu' }, fmtDH(x.at)), h('b', { style: 'font-weight:550' }, x.by || '—'), h('span', {}, x.msg))) : h('div', { class: 'empty' }, 'Nenhuma alteração registrada ainda.'))];
}

// ---------- Sistema ----------
function pgSobre() {
  const man = chrome.runtime.getManifest();
  return [cabecalho('Sobre e atualizações', 'Versão instalada neste navegador.'),
    h('div', { class: 'card', style: 'padding:4px 20px;margin-top:18px' }, h('dl', { class: 'kv' },
      h('dt', {}, 'Produto'), h('dd', {}, man.name),
      h('dt', {}, 'Versão'), h('dd', {}, man.version),
      h('dt', {}, 'Pacote'), h('dd', {}, CFG.variant === 'gestor' ? 'Gestor (completo)' : 'Equipe'),
      h('dt', {}, 'Atualização'), h('dd', {}, 'Automática: a extensão confere a pasta de instalação a cada minuto.'),
      h('dt', {}, 'Dados compartilhados'), h('dd', {}, h('span', { class: 'sync ' + st.sync.cls }, st.sync.txt)),
      h('dt', {}, 'WhatsApp'), h('dd', {}, 'Somente leitura: o Supervisor nunca envia, edita ou apaga mensagens.'))),
    h('div', { style: 'margin-top:14px;display:flex;gap:8px' },
      h('button', { class: 'btn', html: ico('refresh', 15) + 'Verificar atualização agora', onclick: () => { try { chrome.runtime.sendMessage({ t: 'ilv-check-update' }); } catch (e) { } toast('Verificando… se houver versão nova, a extensão recarrega sozinha.'); } }),
      h('button', { class: 'btn', onclick: () => carregaRemoto() }, 'Sincronizar com a planilha'))];
}

// ---------- render ----------
function render() {
  aplicaTema();
  const r = ROTAS.find(x => x.id === st.route) || ROTAS[0];
  if (r.adm && !souGestor()) { st.route = 'perfil'; return render(); }
  renderNav();
  document.getElementById('crumb').textContent = r.t;
  const main = document.getElementById('main');
  const pg = r.adm && !desbloqueado() || (r.adm && !acesso() && CFG.variant === 'gestor') ? pgBloqueio
    : { perfil: pgPerfil, alertas: pgAlertas, telas: pgTelas, equipe: pgEquipe, regras: pgRegras, auditoria: pgAuditoria, sobre: pgSobre }[r.id];
  main.replaceChildren(...[pg()].flat());
  const bar = document.getElementById('savebar');
  const d = st.draft ? difs(acesso(), st.draft) : [];
  bar.hidden = !(st.route === 'equipe' && st.draft);
  document.getElementById('dirtyTxt').textContent = d.length ? `${d.length} alteraç${d.length > 1 ? 'ões' : 'ão'} não salva${d.length > 1 ? 's' : ''}` : 'Alterações não salvas';
  const se = document.getElementById('sync'); se.className = 'sync ' + st.sync.cls; se.textContent = st.sync.txt;
}
document.getElementById('discard').onclick = () => { st.draft = null; st.adding = false; render(); };
document.getElementById('save').onclick = async () => {
  const btn = document.getElementById('save'); if (!st.draft) return;
  const ant = acesso(), nov = clone(st.draft), msgs = difs(ant, nov);
  if (!nov.membros.some(m => m.perfil === 'gestor' && m.ativo !== false)) return toast('É preciso ter pelo menos um gestor ativo.', true);
  nov.audit = msgs.map(msg => ({ at: Date.now(), by: meuNome(), msg })).concat(nov.audit || []).slice(0, 25);
  nov.upd = Date.now(); nov.updBy = meuNome();
  btn.disabled = true; btn.textContent = 'Salvando…';
  try { await salvaRemoto({ acesso: nov }); await setJ(K.acesso, nov); st.draft = null; toast('Alterações salvas. Chegam aos outros computadores em até 1 minuto.'); }
  catch (e) { toast('Não foi possível salvar: ' + e.message, true); }
  btn.disabled = false; btn.textContent = 'Salvar alterações'; render();
};
chrome.storage.onChanged.addListener((ch, area) => { if (area !== 'local') return; for (const k in ch) st.store[k] = ch[k].newValue; if (!st.draft && !document.activeElement.matches('input[type=text],input:not([type]),input[type=password]')) render(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', aplicaTema);
window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (id !== st.route && ROTAS.some(r => r.id === id)) go(id); });
window.addEventListener('beforeunload', e => { if (st.draft) { e.preventDefault(); e.returnValue = ''; } });

(async () => {
  st.store = await chrome.storage.local.get(null);
  try { const s = await chrome.storage.session.get('ilvUnlock'); st.unlockUntil = s.ilvUnlock || 0; } catch (e) { }
  const hash = location.hash.slice(1); if (ROTAS.some(r => r.id === hash)) st.route = hash;
  render();
  carregaRemoto();
  setInterval(() => { if (!st.draft) carregaRemoto(); }, 60000);
})();
