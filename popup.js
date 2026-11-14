function renderState(state) {
  const lastRun = document.getElementById('lastRun');
  if (!state) {
    lastRun.textContent = '尚未运行';
    return;
  }

  const setPill = (id, active, offText) => {
    const el = document.getElementById(id);
    el.textContent = active ? '保持中' : offText;
    el.className = active ? 'pill ok' : 'pill warn';
  };
  setPill('oktaPill', state.oktaActive, '未登录 / 已过期');
  setPill('canvasPill', state.canvasActive, '未登录 / 已过期');
  document.getElementById('proxyCount').textContent = `${state.proxiedOriginsCount || 0} 个`;

  if (state.lastRunAt) {
    const dt = new Date(state.lastRunAt);
    const hh = String(dt.getHours()).padStart(2, '0');
    const mm = String(dt.getMinutes()).padStart(2, '0');
    lastRun.textContent = `上次续期 ${hh}:${mm}`;
  }
}

async function initPopup() {
  const { keepAliveState } = await chrome.storage.local.get('keepAliveState');
  renderState(keepAliveState);

  document.getElementById('refreshNowBtn').addEventListener('click', async () => {
    const btn = document.getElementById('refreshNowBtn');
    btn.textContent = '续期中…';
    const resp = await chrome.runtime.sendMessage({ type: 'RUN_KEEPALIVE_NOW' });
    if (resp?.state) renderState(resp.state);
    btn.textContent = '✅ 已续期（之后每 18 分钟自动跑）';
  });

  // 点开弹窗时 activeTab 授权当前标签页，才能读到它的网址
  document.getElementById('proxyCurrentBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || !/^https?:/.test(tab.url)) return;
    const target = `https://go.openathens.net/redirector/sydney.edu.au?url=${encodeURIComponent(tab.url)}`;
    await chrome.tabs.update(tab.id, { url: target });
    window.close();
  });

  for (const chip of document.querySelectorAll('.chip[data-url]')) {
    chip.addEventListener('click', async () => {
      await chrome.tabs.create({ url: chip.getAttribute('data-url') });
      window.close();
    });
  }
}

initPopup();
