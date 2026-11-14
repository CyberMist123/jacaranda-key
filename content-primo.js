// 悉大图书馆检索（Primo）：没登录时自动点「Sign in → UniKey」。
// Primo 的登录和 Canvas / Okta 是分开的，但走的是同一个悉大 Okta：Okta 已经登录着的话，
// 点 UniKey 会直接跳回来、已登录，不用输密码。不读取、不填写任何账号密码。
//
// - 你自己点开了登录框：替你选 UniKey（任何时候都会）。
// - 打开 Primo 时没登录：自动点 Sign in → UniKey。
// - 你在 Primo 里点了「Sign out」：记在插件存储里（所有标签页共用），12 小时内不再自动登录；
//   你自己再点 Sign in 就解除。另外同一个标签页 10 分钟内最多自动登录一次，防止来回跳。

(() => {
  const TAB_KEY = 'jk_primo_autologin_at';     // sessionStorage：本标签页上次自动登录
  const SIGNED_OUT_KEY = 'primoSignedOutAt';    // chrome.storage.local：你主动退出的时间
  const SIGNED_OUT_HOLD = 12 * 60 * 60 * 1000;
  const isVisible = (el) => !!el && el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility !== 'hidden';

  // 登录框里 UniKey 那一项：外层是 md-list-item，真正绑了点击事件的是里面的 button
  const unikeyButton = () => Array.from(document.querySelectorAll('button[aria-label^="UniKey"]')).find(isVisible);
  const tabRecentlyDone = () => Date.now() - Number(sessionStorage.getItem(TAB_KEY) || 0) < 10 * 60 * 1000;

  let signedOutAt = 0;
  chrome.storage.local.get(SIGNED_OUT_KEY).then((r) => { signedOutAt = Number(r[SIGNED_OUT_KEY]) || 0; }).catch(() => {});

  // 只看你自己的点击（isTrusted）：点「Sign out」记下来；点「Sign in」说明你想登录，解除
  document.addEventListener('click', (e) => {
    if (!e.isTrusted) return;
    const el = e.target.closest && e.target.closest('button, a, [role="button"], md-menu-item');
    if (!el) return;
    const label = `${el.textContent || ''} ${el.getAttribute('aria-label') || ''}`.trim();
    if (/sign\s*out|log\s*out|logout|退出|登出|ログアウト|サインアウト/i.test(label)) {
      signedOutAt = Date.now();
      chrome.storage.local.set({ [SIGNED_OUT_KEY]: signedOutAt }).catch(() => {});
    } else if (el.id === 'signInBtn' || /^\s*sign\s*in\s*$/i.test(el.textContent || '')) {
      signedOutAt = 0;
      chrome.storage.local.remove(SIGNED_OUT_KEY).catch(() => {});
    }
  }, true);

  const loadedAt = Date.now();
  let signInClicks = 0;
  let lastSignInClick = 0;
  let picked = false;

  function tick() {
    // 登录框已经打开（不管是谁打开的）：选 UniKey
    const uk = unikeyButton();
    if (uk && !picked) {
      picked = true;
      sessionStorage.setItem(TAB_KEY, String(Date.now()));
      uk.click();
      return;
    }
    // 没登录：页面打开后 30 秒内自动点 Sign in；没弹出登录框就隔 3 秒再点，最多 3 次
    if (picked || tabRecentlyDone() || Date.now() - loadedAt > 30000) return;
    if (Date.now() - signedOutAt < SIGNED_OUT_HOLD) return; // 你主动退出过
    const signIn = document.getElementById('signInBtn');
    if (!isVisible(signIn) || signInClicks >= 3 || Date.now() - lastSignInClick < 3000) return;
    signInClicks += 1;
    lastSignInClick = Date.now();
    signIn.click();
  }

  setInterval(tick, 700);
  setTimeout(tick, 300); // 等存储里的「你退出过」读出来
})();
