// sso.sydney.edu.au：只做一件事——自动勾上「保持登录 / Keep me signed in」。
// 不读取、不填写任何账号、密码或验证码。

(() => {
  const SELECTORS = [
    'input[name="rememberMe"][type="checkbox"]',
    'input[data-se-for-name="rememberMe"][type="checkbox"]',
  ];

  function checkRememberMe() {
    for (const sel of SELECTORS) {
      const box = document.querySelector(sel);
      if (box && !box.checked && box.dataset.jkChecked !== '1') {
        box.dataset.jkChecked = '1'; // 每个复选框只勾一次，用户手动取消后不再改回
        box.click();
      }
    }
  }

  checkRememberMe();
  const timer = setInterval(checkRememberMe, 1000);
  setTimeout(() => clearInterval(timer), 20000);
})();
