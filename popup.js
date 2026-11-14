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
  document.getElementById('proxyCurrentBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || !/^https?:/.test(tab.url)) return;
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
