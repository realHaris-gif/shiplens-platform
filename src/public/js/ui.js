/* ==========================================================================
   ShipLens — UI layer
   Loads BEFORE app.js. It does not replace anything in app.js; it only
   observes network calls and form submissions to add:
     • top progress bar + button spinners + "Authenticating…" status
     • success / error toasts for form submissions
     • custom 403 / 404 / 500 / offline pages
     • skeleton fallback ("Couldn't load" + Retry) if data never arrives
   ========================================================================== */
(() => {
  'use strict';

  /* ---------- Config (edit if your API paths differ) ---------- */
  const CFG = {
    authUrl: /(login|signin|sign-in|authenticate)/i,          // login request
    silentUrl: /(logout|refresh|session|heartbeat|ping)/i,    // no toasts for these
    // Hashes that are valid page routes. Anything else shows the 404 page,
    // unless an element with a matching id exists (e.g. #finance -> #finance-view).
    validRoutes: ['', 'home', 'about', 'programs', 'branches', 'events',
                  'get-involved', 'contact', 'login', 'dashboard', 'portal'],
    staleSkeletonMs: 8000
  };

  /* ---------- Strings (English / Urdu) ---------- */
  const T = {
    en: {
      authenticating: 'Authenticating…',
      authSub: 'Verifying your credentials securely',
      authSlow: 'Still working — your connection looks slow.',
      working: 'Working…',
      submitting: 'Submitting application…',
      sending: 'Sending message…',
      signedIn: 'Signed in successfully.',
      saved: 'Saved successfully.',
      updated: 'Updated successfully.',
      deleted: 'Deleted successfully.',
      contactSent: 'Message sent to the Central Secretariat.',
      sessionExpired: 'Your session has expired. Please sign in again.',
      forbidden: 'You don’t have permission to do that.',
      tooMany: 'Too many requests. Please wait a moment and try again.',
      serverError: 'The server hit a problem. Please try again shortly.',
      unreachable: 'Can’t reach the server. Check your connection.',
      requestFailed: 'That didn’t work. Please check the details and try again.',
      backOnline: 'You’re back online.',
      stillOffline: 'Still offline. Check your connection and try again.',
      offlineBanner: 'No internet connection',
      loadFailed: 'Couldn’t load this data.',
      retry: 'Retry',
      showPw: 'Show password',
      hidePw: 'Hide password',
      goHome: 'Go to home',
      goBack: 'Go back',
      tryAgain: 'Try again',
      e403: ['Access denied', 'You don’t have permission to view this page. If you think this is a mistake, contact your administrator.'],
      e404: ['Page not found', 'The page you’re looking for doesn’t exist or has been moved.'],
      e500: ['Something went wrong', 'Our servers hit an unexpected problem. Please try again in a moment.'],
      eoffline: ['You’re offline', 'Check your internet connection and try again. We’ll reconnect automatically.']
    },
    ur: {
      authenticating: 'تصدیق ہو رہی ہے…',
      authSub: 'آپ کی اسناد محفوظ طریقے سے جانچی جا رہی ہیں',
      authSlow: 'ابھی کام جاری ہے — آپ کا انٹرنیٹ سست لگ رہا ہے۔',
      working: 'کام جاری ہے…',
      submitting: 'درخواست جمع کی جا رہی ہے…',
      sending: 'پیغام بھیجا جا رہا ہے…',
      signedIn: 'کامیابی سے لاگ اِن ہو گئے۔',
      saved: 'کامیابی سے محفوظ ہو گیا۔',
      updated: 'کامیابی سے اپ ڈیٹ ہو گیا۔',
      deleted: 'کامیابی سے حذف ہو گیا۔',
      contactSent: 'پیغام مرکزی سیکریٹریٹ کو بھیج دیا گیا۔',
      sessionExpired: 'آپ کا سیشن ختم ہو گیا ہے۔ براہِ کرم دوبارہ لاگ اِن کریں۔',
      forbidden: 'آپ کو اس کام کی اجازت نہیں ہے۔',
      tooMany: 'بہت زیادہ درخواستیں۔ براہِ کرم کچھ دیر انتظار کریں۔',
      serverError: 'سرور میں مسئلہ پیش آیا۔ براہِ کرم کچھ دیر بعد کوشش کریں۔',
      unreachable: 'سرور تک رسائی نہیں ہو رہی۔ اپنا انٹرنیٹ چیک کریں۔',
      requestFailed: 'یہ کام نہیں ہو سکا۔ براہِ کرم تفصیلات چیک کر کے دوبارہ کوشش کریں۔',
      backOnline: 'انٹرنیٹ بحال ہو گیا۔',
      stillOffline: 'انٹرنیٹ اب بھی بند ہے۔ کنکشن چیک کر کے دوبارہ کوشش کریں۔',
      offlineBanner: 'انٹرنیٹ کنکشن نہیں ہے',
      loadFailed: 'ڈیٹا لوڈ نہیں ہو سکا۔',
      retry: 'دوبارہ کوشش',
      showPw: 'پاس ورڈ دکھائیں',
      hidePw: 'پاس ورڈ چھپائیں',
      goHome: 'ہوم پر جائیں',
      goBack: 'واپس جائیں',
      tryAgain: 'دوبارہ کوشش کریں',
      e403: ['رسائی ممنوع', 'آپ کو یہ صفحہ دیکھنے کی اجازت نہیں ہے۔ اگر آپ کو لگتا ہے کہ یہ غلطی ہے تو اپنے منتظم سے رابطہ کریں۔'],
      e404: ['صفحہ نہیں ملا', 'جو صفحہ آپ تلاش کر رہے ہیں وہ موجود نہیں یا منتقل ہو چکا ہے۔'],
      e500: ['کچھ غلط ہو گیا', 'ہمارے سرور میں غیر متوقع مسئلہ پیش آیا۔ براہِ کرم کچھ دیر بعد دوبارہ کوشش کریں۔'],
      eoffline: ['انٹرنیٹ کنکشن نہیں ہے', 'اپنا انٹرنیٹ کنکشن چیک کریں اور دوبارہ کوشش کریں۔ ہم خود بخود دوبارہ جڑ جائیں گے۔']
    }
  };

  const isRtl = () => document.documentElement.dir === 'rtl';
  const t = (k) => (T[isRtl() ? 'ur' : 'en'][k]) || T.en[k] || k;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 6v8M12 18v.01"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 6v8M12 18v.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 11v6M12 7v.01"/></svg>',
    403: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><path d="M12 15v2"/></svg>',
    404: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M9 9l4 4M13 9l-4 4"/></svg>',
    500: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2.5 20h19L12 3z"/><path d="M12 10v4M12 17.5v.01"/></svg>',
    offline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8a15 15 0 0 0-8.4-3.7M5 12.9a10 10 0 0 1 5.2-2.7M19 12.9a10 10 0 0 0-2.7-1.9M8.5 16.4a5 5 0 0 1 7 0M12 20h.01M3 3l18 18"/></svg>'
  };

  /* ---------- Toasts ---------- */
  const toastRoot = $('#toast-root');
  const recentToasts = new Map();

  function toast(type, message, duration = 4500) {
    if (!toastRoot || !message) return;
    const key = type + message;
    const now = Date.now();
    if (recentToasts.get(key) > now - 1500) return; // de-duplicate bursts
    recentToasts.set(key, now);

    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = '<span class="toast-icon">' + (ICONS[type] || ICONS.info) + '</span>' +
      '<span class="toast-msg"></span>' +
      '<button type="button" class="toast-close" aria-label="Close">×</button>';
    el.querySelector('.toast-msg').textContent = message;
    toastRoot.appendChild(el);
    while (toastRoot.children.length > 4) toastRoot.firstElementChild.remove();

    requestAnimationFrame(() => el.classList.add('show'));
    let timer;
    const close = () => {
      clearTimeout(timer);
      el.classList.remove('show');
      setTimeout(() => el.remove(), 320);
    };
    el.querySelector('.toast-close').addEventListener('click', close);
    timer = setTimeout(close, duration);
  }

  /* ---------- Progress bar + request tracking ---------- */
  const progress = $('#progress-bar');
  let pending = 0;
  const nativeFetch = window.fetch.bind(window);

  const updateProgress = () => {
    if (!progress) return;
    if (pending > 0) {
      progress.classList.remove('active');
      void progress.offsetWidth; // restart animation
      progress.classList.add('active');
    } else {
      progress.style.transition = 'opacity .4s';
      progress.classList.remove('active');
    }
  };

  function onResponse(res, method, url) {
    // Success and 4xx validation messages are shown by app.js itself.
    // This layer only handles cross-cutting failures.
    if (res.ok) return;
    const isAuth = CFG.authUrl.test(url);
    const mutating = method !== 'GET' && method !== 'HEAD';
    if (CFG.silentUrl.test(url)) return;

    const s = res.status;
    if (s === 401) { if (!isAuth) toast('warning', t('sessionExpired')); return; }
    if (s === 403) {
      if (isAuth) return;
      if (!mutating) showErrorPage('403'); else toast('error', t('forbidden'));
      return;
    }
    if (s === 429) { toast('error', t('tooMany')); return; }
    if (s >= 500) toast('error', t('serverError'));
  }

  function onNetworkError() {
    if (!navigator.onLine) showErrorPage('offline');
    else toast('error', t('unreachable'));
  }

  window.fetch = async function (input, init) {
    const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    const url = typeof input === 'string' ? input : ((input && input.url) || String(input));
    pending++;
    updateProgress();
    try {
      const res = await nativeFetch(input, init);
      try { onResponse(res, method, url); } catch (e) { console.error(e); }
      return res;
    } catch (err) {
      if (!(err && err.name === 'AbortError')) onNetworkError();
      throw err;
    } finally {
      pending--;
      updateProgress();
    }
  };

  /* ---------- Form submissions: loading + status ---------- */
  function setLoading(btn, on, text) {
    if (!btn) return;
    if (on) {
      btn.dataset.uiOrig = btn.textContent;
      btn.dataset.uiLoadingText = text;
      btn.textContent = text;
      btn.classList.add('is-loading');
      btn.setAttribute('aria-busy', 'true');
    } else {
      btn.classList.remove('is-loading');
      btn.removeAttribute('aria-busy');
      // Restore only if nothing else (e.g. language switch) changed the label meanwhile
      if (btn.textContent === btn.dataset.uiLoadingText && btn.dataset.uiOrig) {
        btn.textContent = btn.dataset.uiOrig;
      }
    }
  }

  function loadingTextFor(form) {
    if (form.id === 'login-form') return t('authenticating');
    if (form.id === 'volunteer-form') return t('submitting');
    if (form.id === 'contact-form') return t('sending');
    return t('working');
  }

  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    const btn = e.submitter || form.querySelector('button[type="submit"]');
    if (!btn) return;

    // Block double submits
    if (btn.classList.contains('is-loading')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }

    const isLogin = form.id === 'login-form';
    const status = isLogin ? $('#login-status') : null;
    const alertBox = isLogin ? $('#login-alert') : null;
    const started = performance.now();
    let sawRequest = false;
    let slowTimer;

    setLoading(btn, true, loadingTextFor(form));
    form.setAttribute('aria-busy', 'true');

    if (isLogin && status) {
      if (alertBox) alertBox.classList.add('hidden');
      $('#login-status-title').textContent = t('authenticating');
      $('#login-status-sub').textContent = t('authSub');
      status.classList.remove('hidden');
      slowTimer = setTimeout(() => { $('#login-status-sub').textContent = t('authSlow'); }, 4000);
    }

    const finish = () => {
      clearTimeout(slowTimer);
      setLoading(btn, false);
      form.removeAttribute('aria-busy');
      if (status) status.classList.add('hidden');
      if (isLogin && alertBox && !alertBox.classList.contains('hidden')) {
        const card = form.closest('.card');
        if (card) { card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); }
      }
    };

    const check = () => {
      if (pending > 0) sawRequest = true;
      const elapsed = performance.now() - started;
      const taskRunning = form._uiTask && !form._uiTaskDone;
      // Keep the spinner visible for at least ~600ms so it never flashes
      if (!taskRunning && pending === 0 && elapsed > 600 && (sawRequest || elapsed > 900)) return finish();
      if (elapsed > 30000) return finish(); // safety net
      setTimeout(check, 80);
    };
    setTimeout(check, 80);
  }, true);

  /* Contact form: there is no backend endpoint, so simulate the send. */
  window.handleContactSubmit = function (e) {
    e.preventDefault();
    const form = e.target;
    form._uiTaskDone = false;
    form._uiTask = new Promise((resolve) => setTimeout(resolve, 900)).then(() => {
      form._uiTaskDone = true;
      toast('success', t('contactSent'));
      form.reset();
    });
  };

  /* Password show / hide */
  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-toggle-password]');
    if (toggle) {
      const input = document.getElementById(toggle.dataset.togglePassword);
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.setAttribute('aria-label', show ? t('hidePw') : t('showPw'));
      toggle.style.color = show ? 'var(--primary)' : '';
      return;
    }
    if (e.target.closest('.nav-item, .nav-brand')) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (e.target.closest('[data-reload]')) location.reload();
  });

  /* ---------- Error pages ---------- */
  const errView = $('#error-view');
  const errCard = $('#error-card');
  let currentErr = null;

  function goHome() {
    hideErrorPage();
    if (typeof window.navigateTo === 'function') window.navigateTo('home');
    else location.hash = '#home';
  }

  async function retryConnection() {
    const btn = $('#error-primary');
    setLoading(btn, true, t('working'));
    try {
      await nativeFetch(location.pathname, { method: 'HEAD', cache: 'no-store' });
      location.reload();
    } catch (_) {
      setLoading(btn, false);
      toast('error', t('stillOffline'));
    }
  }

  function showErrorPage(kind) {
    if (!errView) return;
    kind = String(kind);
    if (!ICONS[kind]) kind = '500';
    currentErr = kind;
    const [title, desc] = t('e' + kind);

    errCard.dataset.kind = kind;
    $('#error-icon').innerHTML = ICONS[kind];
    $('#error-code').textContent = kind === 'offline' ? (isRtl() ? 'آف لائن' : 'Offline') : kind;
    $('#error-title').textContent = title;
    $('#error-desc').textContent = desc;

    const primary = $('#error-primary');
    const secondary = $('#error-secondary');
    secondary.classList.remove('hidden');

    if (kind === '403' || kind === '404') {
      primary.textContent = t('goHome'); primary.onclick = goHome;
      secondary.textContent = t('goBack');
      secondary.onclick = () => { hideErrorPage(); if (history.length > 1) history.back(); };
    } else if (kind === '500') {
      primary.textContent = t('tryAgain'); primary.onclick = () => location.reload();
      secondary.textContent = t('goHome'); secondary.onclick = goHome;
    } else {
      primary.textContent = t('tryAgain'); primary.onclick = retryConnection;
      secondary.classList.add('hidden');
    }

    errView.classList.remove('hidden');
    document.body.classList.add('no-scroll');
    setTimeout(() => primary.focus(), 50);
  }

  function hideErrorPage() {
    if (!errView) return;
    errView.classList.add('hidden');
    document.body.classList.remove('no-scroll');
    currentErr = null;
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && currentErr && currentErr !== 'offline') hideErrorPage();
  });

  /* ---------- Online / offline ---------- */
  const banner = $('#net-banner');
  const bannerText = $('#net-banner-text');

  function setOfflineUi(offline) {
    if (!banner) return;
    bannerText.textContent = t('offlineBanner');
    banner.classList.toggle('show', offline);
  }

  window.addEventListener('offline', () => setOfflineUi(true));
  window.addEventListener('online', () => {
    setOfflineUi(false);
    toast('success', t('backOnline'));
    if (currentErr === 'offline') hideErrorPage();
  });
  if (!navigator.onLine) setOfflineUi(true);

  /* ---------- 404 for unknown routes ---------- */
  function checkRoute() {
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    if (CFG.validRoutes.includes(h)) return;
    if (document.getElementById(h) || document.getElementById('view-' + h) || document.getElementById(h + '-view')) return;
    showErrorPage('404');
  }
  window.addEventListener('hashchange', checkRoute);
  window.addEventListener('DOMContentLoaded', checkRoute);

  /* ---------- Skeleton fallback ---------- */
  const firstSeen = new WeakMap();

  function failedMarkup(colspan) {
    const inner = '<div class="empty-state"><span>' + t('loadFailed') + '</span>' +
      '<button type="button" class="btn btn-outline btn-sm" data-reload>' + t('retry') + '</button></div>';
    return colspan
      ? '<tr><td colspan="' + colspan + '" class="text-center">' + inner + '</td></tr>'
      : inner;
  }

  setInterval(() => {
    if (pending > 0) return;
    const now = Date.now();

    const targets = new Set();
    $$('tr.skeleton-row').forEach((r) => targets.add(r.parentElement));
    $$('.skeleton-block').forEach((b) => targets.add(b.parentElement));

    targets.forEach((box) => {
      const view = box.closest('.view');
      if (view && view.classList.contains('hidden')) { firstSeen.delete(box); return; }
      const since = firstSeen.get(box) || now;
      firstSeen.set(box, since);
      if (now - since < CFG.staleSkeletonMs) return;

      if (box.tagName === 'TBODY') {
        const cs = box.querySelector('td[colspan]');
        box.innerHTML = failedMarkup(cs ? cs.getAttribute('colspan') : 1);
      } else {
        box.innerHTML = failedMarkup();
        box.removeAttribute('aria-busy');
      }
    });
  }, 1500);

  /* ---------- Public API ---------- */
  window.ShipLensUI = { toast, showErrorPage, hideErrorPage };
  window.showErrorPage = showErrorPage;
})();