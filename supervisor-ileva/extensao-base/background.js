// Ileva Supervisor - serviço em segundo plano da extensão
// 1) Faz as conexões com a planilha Google (o painel no WhatsApp não pode acessar outros sites diretamente).
// 2) Atualização automática: quando os arquivos da pasta da extensão mudam, a extensão se recarrega sozinha.
const ALLOWED = /^https:\/\/(script\.google\.com|script\.googleusercontent\.com)\//;

// clique no logo da Ileva na barra do navegador = página de Configurações
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (m && m.t === 'ilv-open-options') { chrome.runtime.openOptionsPage(); return; }
  if (m && m.t === 'ilv-check-update') { checkUpdate(); return; }
  if (m && m.t === 'ilv-focus' && sender.tab) { // conversa aberta pela janela flutuante: mostra o WhatsApp
    chrome.windows.get(sender.tab.windowId, w => { chrome.windows.update(sender.tab.windowId, w && w.state === 'minimized' ? { state: 'maximized', focused: true } : { focused: true }); });
    chrome.tabs.update(sender.tab.id, { active: true }); return;
  }
  if (!m || m.t !== 'ilv-xhr') return;
  if (!ALLOWED.test(m.url)) { reply({ err: 'endereço não permitido' }); return; }
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), Math.max(1000, m.timeout || 30000));
  const init = { method: m.method, headers: m.headers, signal: ac.signal, credentials: m.anonymous ? 'omit' : 'include', redirect: 'follow' };
  if (m.data != null && m.method !== 'GET') init.body = m.data;
  fetch(m.url, init)
    .then(async r => reply({ status: r.status, text: await r.text(), url: r.url }))
    .catch(e => reply(ac.signal.aborted ? { timeout: true } : { err: String(e && e.message || e) }))
    .finally(() => clearTimeout(to));
  return true; // resposta assíncrona
});

async function checkUpdate() {
  try {
    const r = await fetch(chrome.runtime.getURL('versao.txt') + '?t=' + Date.now(), { cache: 'no-store' });
    const v = (await r.text()).trim();
    if (v && v !== chrome.runtime.getManifest().version) chrome.runtime.reload();
  } catch (e) { }
}
// Ctrl+Shift+9 em qualquer programa: esconde/mostra o Supervisor por 5 minutos (print ou gravação de tela)
chrome.commands.onCommand.addListener(async c => {
  if (c !== 'esconder') return;
  const k = 'ilevaExt.hideUntil', o = await chrome.storage.local.get(k);
  let cur = 0; try { cur = Number(JSON.parse(o[k] || '0')) || 0; } catch (e) { }
  await chrome.storage.local.set({ [k]: JSON.stringify(cur > Date.now() ? 0 : Date.now() + 5 * 60000) });
});
chrome.alarms.create('ilv-upd', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'ilv-upd') checkUpdate(); });
checkUpdate();
