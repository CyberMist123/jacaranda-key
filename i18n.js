// 界面多语言：中文 / English / 日本語。
// Chrome 自带的 chrome.i18n 只能跟随浏览器语言、不能在插件里切换，所以自己做一个小的：
// 语言存在 chrome.storage.local 的 lang（auto | zh | en | ja），auto = 跟随浏览器。

const I18N = {
  zh: {
    checking: '检测中…',
    notRun: '尚未运行',
    proxyPages: '图书馆代理页',
    on: '保持中',
    off: '未登录',
    count: '{n} 个',
    lastRun: '{time} 已续期',
    proxyBtn: '用图书馆代理打开当前页',
    cannotProxy: '当前页无法代理',
    ownSite: '悉大或图书馆页面，无需代理',
    refresh: '立即续期',
    refreshing: '续期中…',
    refreshed: '已续期 · 之后每 18 分钟自动续',
    kiraRefresh: '续一下，保持平静',
    kiraRefreshed: '续好了，今天也是平静的一天',
    kiraOn: '平静生活模式：开启',
    kiraOff: '平静生活模式：关闭',
    footer: '不存储任何账号密码 · 非悉尼大学官方工具',
    dblclickHint: '双击重新检测',
    libSearch: '图书馆检索',
    settings: '设置',
    language: '语言',
    langAuto: '跟随浏览器',
    back: '返回',
  },
  en: {
    checking: 'Checking…',
    notRun: 'Not run yet',
    proxyPages: 'Library proxy tabs',
    on: 'Active',
    off: 'Signed out',
    count: '{n}',
    lastRun: 'Refreshed {time}',
    proxyBtn: 'Open this page via the library',
    cannotProxy: "Can't open this page via the library",
    ownSite: 'USYD or library page — no proxy needed',
    refresh: 'Refresh now',
    refreshing: 'Refreshing…',
    refreshed: 'Refreshed · auto-refreshes every 18 min',
    kiraRefresh: 'Refresh, and stay calm',
    kiraRefreshed: 'Done. Another quiet day.',
    kiraOn: 'Quiet life mode: ON',
    kiraOff: 'Quiet life mode: OFF',
    footer: 'Stores no passwords · Not an official USYD tool',
    dblclickHint: 'Double-click to re-check',
    libSearch: 'Library Search',
    settings: 'Settings',
    language: 'Language',
    langAuto: 'Follow browser',
    back: 'Back',
  },
  ja: {
    checking: '確認中…',
    notRun: '未実行',
    proxyPages: '図書館プロキシのタブ',
    on: '維持中',
    off: '未ログイン',
    count: '{n} 件',
    lastRun: '{time} 更新済み',
    proxyBtn: '図書館経由でこのページを開く',
    cannotProxy: 'このページは図書館経由で開けません',
    ownSite: 'USYD・図書館のページなので不要です',
    refresh: '今すぐ更新',
    refreshing: '更新中…',
    refreshed: '更新しました · 以後 18 分ごとに自動更新',
    kiraRefresh: '更新して、平穏に',
    kiraRefreshed: '更新完了。今日も平穏な一日だ。',
    kiraOn: '平穏な生活モード：オン',
    kiraOff: '平穏な生活モード：オフ',
    footer: 'パスワードは保存しません · USYD 公式ツールではありません',
    dblclickHint: 'ダブルクリックで再確認',
    libSearch: '図書館検索',
    settings: '設定',
    language: '言語',
    langAuto: 'ブラウザに合わせる',
    back: '戻る',
  },
};

let LANG = 'zh';

function resolveLang(pref) {
  if (pref === 'zh' || pref === 'en' || pref === 'ja') return pref;
  const nav = (navigator.language || '').toLowerCase();
  if (nav.startsWith('zh')) return 'zh';
  if (nav.startsWith('ja')) return 'ja';
  return 'en';
}

function t(key, vars = {}) {
  const s = I18N[LANG]?.[key] ?? I18N.zh[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

// 带 data-i18n / data-i18n-title / data-i18n-placeholder 的元素换成当前语言
function applyI18n(root = document) {
  document.documentElement.lang = { zh: 'zh-CN', en: 'en', ja: 'ja' }[LANG];
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
}

const I18N_READY = (async () => {
  try {
    const { lang } = await chrome.storage.local.get('lang');
    LANG = resolveLang(lang || 'auto');
  } catch {
    LANG = resolveLang('auto');
  }
  applyI18n();
})();
