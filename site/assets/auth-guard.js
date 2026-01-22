(function () {
  const LOGIN_PATH = '/login/';
  const HOME_AFTER_LOGIN = '/dashboard/';

  function isLoginPage() {
    const p = window.location.pathname || '/';
    return p === '/login/' || p === '/login';
  }

  function ensureIdentityWidget(cb) {
    if (window.netlifyIdentity) return cb(true);
    const src = 'https://identity.netlify.com/v1/netlify-identity-widget.js';
    const existing = Array.from(document.scripts || []).find((s) => s.src === src);
    if (existing) {
      existing.addEventListener(
        'load',
        () => cb(!!window.netlifyIdentity),
        { once: true }
      );
      setTimeout(() => cb(!!window.netlifyIdentity), 500);
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => cb(!!window.netlifyIdentity);
    s.onerror = () => cb(false);
    document.head.appendChild(s);
  }

  function boot() {
    ensureIdentityWidget((ok) => {
      if (!ok || !window.netlifyIdentity) return;
      window.netlifyIdentity.init();

      window.netlifyIdentity.on('login', () => {
        if (isLoginPage()) location.href = HOME_AFTER_LOGIN;
      });

      window.netlifyIdentity.on('logout', () => {
        location.href = LOGIN_PATH;
      });

      const u = window.netlifyIdentity.currentUser?.();
      if (u) {
        if (isLoginPage()) location.href = HOME_AFTER_LOGIN;
      } else {
        if (!isLoginPage()) location.href = LOGIN_PATH;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
