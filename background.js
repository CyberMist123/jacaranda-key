// 后台：开着浏览器时每 18 分钟续一次登录态。不读取、不存储任何账号密码。
//
// manifest 里 incognito 设为 "split"：无痕窗口会单独跑一份本脚本，
// 它的 fetch 带的是无痕窗口自己的登录 cookie，所以无痕窗口的登录也能续上。

const ALARM_NAME = 'usyd-keepalive-tick';
const PERIOD_MINUTES = 18;
const INCOGNITO = chrome.extension.inIncognitoContext;
const STATE_KEY = INCOGNITO ? 'keepAliveStateIncognito' : 'keepAliveState';

// ---------------- 重启后保持登录 ----------------
// 悉大 Okta 的登录 cookie 是「会话 cookie」，浏览器一关就被清掉，所以重启后要重新登录。
// 这里把 sso.sydney.edu.au 自己的会话 cookie 改成带过期时间的普通 cookie，让它能撑过重启。
// 只是让 cookie 不被浏览器清掉；学校服务器那边的登录过期了，照样需要重新登录。
// 无痕窗口不做：无痕的 cookie 本来就只存在内存里，关掉全部无痕窗口就该清空。

const SSO_HOST = 'sso.sydney.edu.au';
// 一直保留：Chrome 规定 cookie 最长 400 天，这里直接用上限
const PERSIST_DAYS = 400;

function isSsoHostCookie(c) {
  return c.domain === SSO_HOST || c.domain === '.' + SSO_HOST;
}

async function persistCookie(c) {
  if (INCOGNITO || !c.session || !isSsoHostCookie(c)) return;
  const details = {
    url: `https://${SSO_HOST}${c.path || '/'}`,
    name: c.name,
    value: c.value,
    path: c.path,
    secure: c.secure,
    httpOnly: c.httpOnly,
    sameSite: c.sameSite,
    storeId: c.storeId,
    expirationDate: Math.floor(Date.now() / 1000) + PERSIST_DAYS * 86400,
  };
  if (!c.hostOnly) details.domain = c.domain; // host-only（含 __Host- 前缀）cookie 不能带 domain
  if (c.partitionKey) details.partitionKey = c.partitionKey;
  try {
    await chrome.cookies.set(details);
  } catch {}
}

async function persistAllSsoCookies() {
  if (INCOGNITO) return;
  try {
    for (const c of await chrome.cookies.getAll({ domain: SSO_HOST })) await persistCookie(c);
  } catch {}
}

// 登录时 Okta 新写入的会话 cookie，当场转成持久 cookie。
// 删除事件（退出登录）一律不管，不会把已退出的登录「复活」。
chrome.cookies.onChanged.addListener(({ removed, cookie }) => {
  if (!removed) persistCookie(cookie);
});

// ---------------- 定时续期 ----------------

async function ensureAlarm() {
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (!existing) {
    chrome.alarms.create(ALARM_NAME, { delayInMinutes: 1, periodInMinutes: PERIOD_MINUTES });
  }
}

async function ping(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const resp = await fetch(url, {
      credentials: 'include',
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
      ...options,
    });
    return { ok: resp.ok, status: resp.status, url: resp.url || url };
  } catch (err) {
    return { ok: false, status: 0, url };
  } finally {
    clearTimeout(timer);
  }
}

async function runKeepAliveTick(trigger = 'alarm') {
  await persistAllSsoCookies();

  // 1. Okta 会话续期
  const okta = await ping(`https://${SSO_HOST}/api/v1/sessions/me/lifecycle/refresh`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  const oktaActive = okta.status === 200;

  // 2. Canvas 会话（被重定向回 SSO 说明已过期）
  const canvas = await ping('https://canvas.sydney.edu.au/api/v1/users/self', {
    headers: { Accept: 'application/json' },
  });
  const canvasActive = canvas.status === 200 && !String(canvas.url).includes(SSO_HOST);

  // 3. 已打开的图书馆代理（OpenAthens）标签页：各轻触一次
  //    有 *.openathens.net 的 host 权限即可读到这些标签页的网址，不需要 tabs 权限
  const origins = new Set();
  try {
    for (const t of await chrome.tabs.query({})) {
      if (!t.url) continue;
      try {
        const u = new URL(t.url);
        if (u.hostname.endsWith('.proxy.openathens.net')) origins.add(u.origin);
      } catch {}
    }
    for (const origin of origins) await ping(`${origin}/favicon.ico`);
  } catch {}

  const state = {
    lastRunAt: new Date().toISOString(),
    trigger,
    incognito: INCOGNITO,
    oktaActive,
    oktaStatus: okta.status,
    canvasActive,
    canvasStatus: canvas.status,
    proxiedOriginsCount: origins.size,
  };
  await chrome.storage.local.set({ [STATE_KEY]: state });

  const on = oktaActive || canvasActive;
  // 一切正常时不显示角标（太显眼）；只有没登录才显示灰色 EXP
  await setBadge(on ? '' : 'EXP', '#8e8e93');
  return state;
}

// ---------------- 角标 ----------------
// 普通窗口和无痕窗口共用同一个插件图标。不带 tabId 设置的是全局角标，
// 两份后台都设全局就会互相覆盖（开个无痕窗口，普通窗口的 ON 就变成 EXP）。
// 所以：全局角标只归普通窗口那份；无痕那份只给无痕标签页逐个设（标签页级角标优先于全局）。

const BADGE_KEY = INCOGNITO ? 'badgeIncognito' : 'badge';

async function setBadge(text, color) {
  await chrome.storage.local.set({ [BADGE_KEY]: { text, color } });
  if (!INCOGNITO) {
    await chrome.action.setBadgeText({ text });
    await chrome.action.setBadgeBackgroundColor({ color });
    return;
  }
  for (const t of await chrome.tabs.query({})) {
    if (t.incognito) await applyBadgeToTab(t.id);
  }
}

async function applyBadgeToTab(tabId) {
  const badge = (await chrome.storage.local.get(BADGE_KEY))[BADGE_KEY];
  if (!badge) return;
  try {
    await chrome.action.setBadgeText({ tabId, text: badge.text });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: badge.color });
  } catch {} // 标签页可能已关闭
}

if (INCOGNITO) {
  // 新开的、跳转中的无痕标签页补上角标
  chrome.tabs.onCreated.addListener((tab) => { if (tab.incognito) applyBadgeToTab(tab.id); });
  chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (tab.incognito && info.status === 'loading') applyBadgeToTab(tabId);
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureAlarm();
  await runKeepAliveTick('install');
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureAlarm();
  await runKeepAliveTick('startup');
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) await runKeepAliveTick('alarm');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'RUN_KEEPALIVE_NOW') {
    (async () => {
      await ensureAlarm();
      sendResponse({ ok: true, state: await runKeepAliveTick('manual') });
    })();
    return true;
  }
  return false;
});

ensureAlarm();
// 无痕那份没有 onInstalled / onStartup，开无痕窗口时先跑一次，角标马上有状态
if (INCOGNITO) runKeepAliveTick('incognito-start');
