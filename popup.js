// 弹窗。界面文字见 i18n.js（t()），彩蛋语录见 quiet-life.js。

const $ = (id) => document.getElementById(id);

function setRow(id, on, text) {
  const row = $(id);
  row.dataset.on = on ? '1' : '0';
  row.querySelector('.state').textContent = text;
}

function renderState(state) {
  if (!state) {
    $('lastRun').textContent = t('notRun');
    return;
  }
  setRow('oktaRow', state.oktaActive, t(state.oktaActive ? 'on' : 'off'));
  setRow('canvasRow', state.canvasActive, t(state.canvasActive ? 'on' : 'off'));
  const n = state.proxiedOriginsCount || 0;
  setRow('proxyRow', n > 0, t('count', { n }));

  if (state.lastRunAt) {
    const dt = new Date(state.lastRunAt);
    const time = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
    $('lastRun').textContent = t('lastRun', { time });
  }
}

// 不能走代理的原因（i18n 键名）；能走则返回空字符串。
// 悉大自己的网站、已经在代理里的页面、浏览器内部页都不需要（也没法）再套一层代理，
// 否则 OpenAthens 会报 "cannot complete your request"。
function whyNotProxyable(url) {
  let u;
  try { u = new URL(url || ''); } catch { return 'cannotProxy'; }
  if (!/^https?:$/.test(u.protocol)) return 'cannotProxy';
  const h = u.hostname;
  const own = ['sydney.edu.au', 'openathens.net', 'exlibrisgroup.com', 'instructure.com'];
  if (own.some((d) => h === d || h.endsWith('.' + d))) return 'ownSite';
  return '';
}

// true = OpenAthens 明确说不认识这个资源；查不到（断网、超时）就当认识，照常跳转。
// - 不跟随跳转（redirect: 'manual'）：OpenAthens 要把你转去出版商网站，本身就说明它认识；预检也就不会去请求出版商网站。
// - OpenAthens 第一次见到一个网址时，先回一个「OpenAthens / Please wait...」过渡页（200），
//   过一会儿再问才是真正的结果。所以遇到过渡页就隔 0.7 秒再问，总共最多 8 秒。
// - 网络出错重试一次，再不行才放行。
async function libraryDoesNotKnow(target) {
  const deadline = Date.now() + 8000;
  let networkErrors = 0;
  while (Date.now() < deadline) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(500, deadline - Date.now()));
    try {
      const resp = await fetch(target, { credentials: 'omit', cache: 'no-store', redirect: 'manual', signal: controller.signal });
      if (resp.type === 'opaqueredirect') return false; // 要转走 = 认识
      if (resp.status === 404) return true;
      const html = await resp.text();
      if (/<title>\s*OpenAthens:\s*404|not aware of the resource/i.test(html)) return true;
      if (!/<title>\s*OpenAthens\s*\/\s*Please wait/i.test(html)) return false; // 其它 200 = 认识
    } catch (e) {
      if (e.name === 'AbortError' || ++networkErrors >= 2) return false;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((r) => setTimeout(r, 700)); // 过渡页或网络错误：稍等再问
  }
  return false;
}

// 存下来的状态可能是几分钟前的（比如刚登录完），所以一打开就静默重查一次；双击状态卡片也会重查。
async function refreshStatus() {
  $('lastRun').textContent = t('checking');
  const resp = await chrome.runtime.sendMessage({ type: 'RUN_KEEPALIVE_NOW' });
  if (resp?.state) renderState(resp.state);
}

// 提示：在底部原位置显示一行立体字，盖住底部文字一会儿再换回来（不会和别的内容重叠）
function toast(text) {
  const el = $('toast');
  const wrap = el.parentElement;
  el.textContent = text;
  el.classList.add('show');
  wrap.classList.add('toasting');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => {
    el.classList.remove('show');
    wrap.classList.remove('toasting');
  }, 1800);
}

// ---------------- 彩蛋：连点标题 4 下切换「平静生活」模式 ----------------
// 紫绿撞色 + 底部语录。单击语录换一句（先按顺序，再随机）；连点 3 下发动「败者食尘」回到普通界面。

const isKira = () => document.body.classList.contains('kira');
let quoteIdx = 0; // 已经出到第几句，存在 storage，下次打开接着来

function showQuote(text) {
  $('footer').textContent = LANG === 'en' ? `“${text}”` : `「${text}」`; // 英文用弯引号，中日用「」
}

async function nextQuote() {
  showQuote(quietLineAt(quoteIdx));
  quoteIdx += 1;
  await chrome.storage.local.set({ quoteIdx });
}

async function applyKira(on, { opening = false } = {}) {
  document.body.classList.toggle('kira', on);
  $('refreshNowBtn').textContent = t(on ? 'kiraRefresh' : 'refresh');
  if (!on) {
    $('footer').textContent = t($('footer').dataset.i18n);
    return;
  }
  const timed = opening ? quietLineForTime() : null;
  if (timed) showQuote(timed);
  else await nextQuote();
}

function bitesTheDust() {
  document.body.classList.remove('bites');
  void document.body.offsetWidth; // 让动画可以连续触发
  document.body.classList.add('bites');
  setTimeout(async () => {
    document.body.classList.remove('bites');
    await applyKira(false); // 回到原来的普通界面，就像什么都没发生过
    await chrome.storage.local.set({ kiraMode: false });
    document.querySelectorAll('details[open]').forEach((d) => { d.open = false; });
    window.scrollTo(0, 0);
    refreshStatus();
  }, 650);
}

async function setupEasterEgg() {
  const stored = await chrome.storage.local.get(['kiraMode', 'quoteIdx']);
  quoteIdx = Number(stored.quoteIdx) || 0;
  await applyKira(!!stored.kiraMode, { opening: true });

  let clicks = [];
  $('title').addEventListener('click', async () => {
    const now = Date.now();
    clicks = clicks.filter((x) => now - x < 1500).concat(now);
    if (clicks.length < 4) return;
    clicks = [];
    const on = !isKira();
    await applyKira(on);
    await chrome.storage.local.set({ kiraMode: on });
    toast(t(on ? 'kiraOn' : 'kiraOff'));
  });

  // 语录：event.detail 是连击次数。1 = 换一句；2 = 预兆台词；3 = 败者食尘
  $('footer').addEventListener('click', (e) => {
    if (!isKira()) return;
    if (e.detail >= 3) {
      showQuote(quietLife().bites);
      bitesTheDust();
    } else if (e.detail === 2) {
      const warn = quietLife().warn;
      showQuote(warn[Math.floor(Math.random() * warn.length)]);
    } else {
      nextQuote();
    }
  });
}

// ---------------- 设置（语言） ----------------

async function setupSettings() {
  const { lang = 'auto' } = await chrome.storage.local.get('lang');
  for (const opt of document.querySelectorAll('.lang-opt')) {
    opt.classList.toggle('active', opt.dataset.lang === lang);
    opt.addEventListener('click', async () => {
      await chrome.storage.local.set({ lang: opt.dataset.lang });
      sessionStorage.setItem('jk_open_settings', '1'); // 重新载入后停在设置页
      location.reload();
    });
  }
  const show = (on) => {
    $('main').hidden = on;
    $('settings').hidden = !on;
  };
  // 彩蛋开关：和连点标题 4 下是同一个开关
  const egg = $('eggToggle');
  egg.checked = isKira();
  egg.addEventListener('change', async () => {
    await applyKira(egg.checked);
    await chrome.storage.local.set({ kiraMode: egg.checked });
  });
  $('githubLink').addEventListener('click', async () => {
    await chrome.tabs.create({ url: $('githubLink').dataset.url });
    window.close();
  });
  $('settingsBtn').addEventListener('click', () => show($('settings').hidden));
  $('settingsBtn').addEventListener('click', () => { egg.checked = isKira(); });
  $('backBtn').addEventListener('click', () => show(false));
  if (sessionStorage.getItem('jk_open_settings')) {
    sessionStorage.removeItem('jk_open_settings');
    show(true);
  }
}

// ---------------- 初始化 ----------------

async function initPopup() {
  await I18N_READY;

  // 无痕窗口里的弹窗读无痕那份后台写的状态（manifest: incognito = split）
  const key = chrome.extension.inIncognitoContext ? 'keepAliveStateIncognito' : 'keepAliveState';
  const stored = await chrome.storage.local.get(key);
  renderState(stored[key]);

  await setupEasterEgg();
  await setupSettings();
  refreshStatus();
  $('statusCard').addEventListener('dblclick', refreshStatus);

  const refreshBtn = $('refreshNowBtn');
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.textContent = t('refreshing');
    await refreshStatus();
    refreshBtn.textContent = t(isKira() ? 'kiraRefreshed' : 'refreshed');
  });

  // 点开弹窗时 activeTab 授权当前标签页，才能读到它的网址
  const proxyBtn = $('proxyCurrentBtn');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const reason = whyNotProxyable(tab?.url);
  if (reason) {
    proxyBtn.disabled = true;
    proxyBtn.textContent = t(reason);
  }
  proxyBtn.addEventListener('click', async () => {
    if (reason || proxyBtn.disabled) return;
    const target = `https://go.openathens.net/redirector/sydney.edu.au?url=${encodeURIComponent(tab.url)}`;
    // 先问一下 OpenAthens 认不认识这个网站（只在点按钮时问，不会每次打开弹窗都把网址发出去）。
    // 不认识的网站它会返回一个标题为 "OpenAthens: 404" 的页面，与其把人带过去看报错，不如这里直接说。
    proxyBtn.disabled = true;
    proxyBtn.textContent = t('proxyChecking');
    if (await libraryDoesNotKnow(target)) {
      proxyBtn.textContent = t('notInLibrary');
      return;
    }
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
