function setRow(id, on, text) {
  const row = document.getElementById(id);
  row.dataset.on = on ? '1' : '0';
  row.querySelector('.state').textContent = text;
}

function renderState(state) {
  const lastRun = document.getElementById('lastRun');
  if (!state) {
    lastRun.textContent = '尚未运行';
    return;
  }

  setRow('oktaRow', state.oktaActive, state.oktaActive ? '保持中' : '未登录');
  setRow('canvasRow', state.canvasActive, state.canvasActive ? '保持中' : '未登录');
  const n = state.proxiedOriginsCount || 0;
  setRow('proxyRow', n > 0, `${n} 个`);

  if (state.lastRunAt) {
    const dt = new Date(state.lastRunAt);
    const hh = String(dt.getHours()).padStart(2, '0');
    const mm = String(dt.getMinutes()).padStart(2, '0');
    lastRun.textContent = `${hh}:${mm} 已续期`;
  }
}

// 返回不能走代理的原因；能走则返回空字符串。
// 悉大自己的网站、已经在代理里的页面、浏览器内部页都不需要（也没法）再套一层代理，
// 否则 OpenAthens 会报 "cannot complete your request"。
function whyNotProxyable(url) {
  let u;
  try { u = new URL(url || ''); } catch { return '当前页无法代理'; }
  if (!/^https?:$/.test(u.protocol)) return '当前页无法代理';
  const h = u.hostname;
  const own = ['sydney.edu.au', 'openathens.net', 'exlibrisgroup.com', 'instructure.com'];
  if (own.some((d) => h === d || h.endsWith('.' + d))) return '悉大或图书馆页面，无需代理';
  return '';
}

async function initPopup() {
  const { keepAliveState } = await chrome.storage.local.get('keepAliveState');
  renderState(keepAliveState);

  const refreshBtn = document.getElementById('refreshNowBtn');
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.textContent = '续期中…';
    const resp = await chrome.runtime.sendMessage({ type: 'RUN_KEEPALIVE_NOW' });
    if (resp?.state) renderState(resp.state);
    refreshBtn.textContent = '已续期 · 之后每 18 分钟自动续';
  });

  // 点开弹窗时 activeTab 授权当前标签页，才能读到它的网址
  const proxyBtn = document.getElementById('proxyCurrentBtn');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const reason = whyNotProxyable(tab?.url);
  if (reason) {
    proxyBtn.disabled = true;
    proxyBtn.textContent = reason;
  }
  proxyBtn.addEventListener('click', async () => {
    if (reason) return;
    const target = `https://go.openathens.net/redirector/sydney.edu.au?url=${encodeURIComponent(tab.url)}`;
    await chrome.tabs.update(tab.id, { url: target });
    window.close();
  });

  for (const link of document.querySelectorAll('.link[data-url]')) {
    link.addEventListener('click', async () => {
      await chrome.tabs.create({ url: link.getAttribute('data-url') });
      window.close();
    });
  }
}

initPopup();
