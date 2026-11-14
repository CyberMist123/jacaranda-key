// 后台：开着浏览器时每 18 分钟续一次登录态。不读取、不存储任何账号密码。

const ALARM_NAME = 'usyd-keepalive-tick';
const PERIOD_MINUTES = 18;

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
  // 1. Okta 会话续期
  const okta = await ping('https://sso.sydney.edu.au/api/v1/sessions/me/lifecycle/refresh', {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  const oktaActive = okta.status === 200;

  // 2. Canvas 会话（被重定向回 SSO 说明已过期）
  const canvas = await ping('https://canvas.sydney.edu.au/api/v1/users/self', {
    headers: { Accept: 'application/json' },
  });
  const canvasActive = canvas.status === 200 && !String(canvas.url).includes('sso.sydney.edu.au');

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
    oktaActive,
    canvasActive,
    proxiedOriginsCount: origins.size,
  };
  await chrome.storage.local.set({ keepAliveState: state });

  const on = oktaActive || canvasActive;
  await chrome.action.setBadgeText({ text: on ? 'ON' : 'EXP' });
  await chrome.action.setBadgeBackgroundColor({ color: on ? '#3a7bfd' : '#8e8e93' });
  return state;
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
