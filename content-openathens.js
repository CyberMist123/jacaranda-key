(() => {
  // 在悉大图书馆 OpenAthens "Choose how to sign in" 页面自动选择 "UniKey" 通道
  let clicked = false;
  function tryPickUnikey() {
    if (clicked) return;
    if (!location.hostname.includes('login.openathens.net')) return;
    const bodyText = document.body?.innerText || '';
    if (!/Choose how to sign in/i.test(bodyText)) return;
    const els = document.querySelectorAll('div, a, button, li');
    for (const el of els) {
      const txt = (el.innerText || '').trim();
      if (/^UniKey\b/i.test(txt) && txt.length < 80 && el.offsetParent !== null) {
        clicked = true;
        el.click();
        return;
      }
    }
  }
  const timer = setInterval(tryPickUnikey, 400);
  setTimeout(() => clearInterval(timer), 15000);
  tryPickUnikey();
})();
