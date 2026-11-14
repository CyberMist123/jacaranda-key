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

// ---------------- 彩蛋：连点标题 4 下切换「平静生活」模式 ----------------
// 紫绿撞色 + 一句致敬某位只想过平静生活的上班族的语录（每次打开随机一句）

// 平时的底部文字取 popup.html 里写的那句（本机版会换掉它）
const FOOTER_NORMAL = document.getElementById('footer').textContent;
const QUIET_LIFE = [
  '我只想过平静的生活，不想每天重新登录 Canvas。',
  '我的名字叫 Jacaranda Key，住在浏览器右上角，未婚。',
  '每 18 分钟续一次期，决不把重新登录留到第二天。',
  '我不存密码，cookie 也仅止于 400 天。',
  '睡前喝一杯温牛奶，再帮你续一次期。',
  '医生都说我的登录状态很正常。',
  '我不喜欢争斗，也不喜欢 Okta 验证码。',
  '平静的生活，就是 Canvas 永不掉线。',
];

const isKira = () => document.body.classList.contains('kira');

function applyKira(on) {
  document.body.classList.toggle('kira', on);
  const quote = QUIET_LIFE[Math.floor(Math.random() * QUIET_LIFE.length)];
  document.getElementById('footer').textContent = on ? `「${quote}」` : FOOTER_NORMAL;
  document.getElementById('refreshNowBtn').textContent = on ? '续一下，保持平静' : '立即续期';
}

function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 1800);
}

async function setupEasterEgg() {
  const { kiraMode } = await chrome.storage.local.get('kiraMode');
  applyKira(!!kiraMode);

  let clicks = [];
  document.getElementById('title').addEventListener('click', async () => {
    const now = Date.now();
    clicks = clicks.filter((t) => now - t < 1500).concat(now);
    if (clicks.length < 4) return;
    clicks = [];
    const on = !isKira();
    applyKira(on);
    await chrome.storage.local.set({ kiraMode: on });
    toast(on ? '平静生活模式：开启' : '平静生活模式：关闭');
  });
}

async function initPopup() {
  // 无痕窗口里的弹窗读无痕那份后台写的状态（manifest: incognito = split）
  const key = chrome.extension.inIncognitoContext ? 'keepAliveStateIncognito' : 'keepAliveState';
  const stored = await chrome.storage.local.get(key);
  renderState(stored[key]);

  await setupEasterEgg();

  const refreshBtn = document.getElementById('refreshNowBtn');
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.textContent = '续期中…';
    const resp = await chrome.runtime.sendMessage({ type: 'RUN_KEEPALIVE_NOW' });
    if (resp?.state) renderState(resp.state);
    refreshBtn.textContent = isKira()
      ? '续好了，今天也是平静的一天'
      : '已续期 · 之后每 18 分钟自动续';
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
