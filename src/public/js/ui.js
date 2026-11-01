/* ==========================================================================
   ShipLens — UI layer
   Loads BEFORE app.js. It does not replace anything in app.js; it only
   observes network calls and form submissions to add:
     • button spinners + "Authenticating…" status
     • success / error toasts for form submissions
     • custom 403 / 404 / 500 / offline pages
     • skeleton fallback ("Couldn't load" + Retry) if data never arrives
   ========================================================================== */
(() => {
  'use strict';

  /* ---------- Config ---------- */
  const CFG = {
    authUrl: /(login|signin|sign-in|authenticate)/i,
    silentUrl: /(logout|refresh|session|heartbeat|ping)/i,
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
      retryConnection: 'Retry connection',
      offlineTitle: 'Connection Interrupted',
      offlineDesc: 'ShipLens cannot reach the central ledger node. Reconnecting automatically...',
      retryHandshake: 'Retry Handshake',
      fieldRequired: 'This field is required',
      fieldEmail: 'Enter a valid email address',
      fieldMin: 'Must be at least {n}',
      fieldInvalid: 'Check this value',
      promptTitle: 'Return report to branch lead',
      promptConfirm: 'Return report',
      promptCancel: 'Cancel',
      promptRequired: 'Add a note before returning the report',
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
      retryConnection: 'کنکشن دوبارہ آزمائیں',
      offlineTitle: 'رابطہ منقطع ہو گیا',
      offlineDesc: 'ShipLens مرکزی لیجر نوڈ تک نہیں پہنچ پا رہا۔ خودکار طور پر دوبارہ جڑ رہا ہے…',
      retryHandshake: 'دوبارہ رابطہ کریں',
      fieldRequired: 'یہ خانہ پُر کرنا ضروری ہے',
      fieldEmail: 'درست ای میل ایڈریس درج کریں',
      fieldMin: 'کم از کم {n} ہونا چاہیے',
      fieldInvalid: 'اس قدر کو چیک کریں',
      promptTitle: 'رپورٹ برانچ لیڈ کو واپس بھیجیں',
      promptConfirm: 'رپورٹ واپس بھیجیں',
      promptCancel: 'منسوخ کریں',
      promptRequired: 'رپورٹ واپس بھیجنے سے پہلے نوٹ لکھیں',
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
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path class="draw" pathLength="1" d="m6 12.5 4 4 8-9"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path class="draw" pathLength="1" d="m7 7 10 10"/><path class="draw d2" pathLength="1" d="M17 7 7 17"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path class="draw" pathLength="1" d="M12 6.5v7"/><path d="M12 17.5v.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path class="draw" pathLength="1" d="M12 11v6"/><path d="M12 7v.01"/></svg>',
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
    if (recentToasts.get(key) > now - 1500) return;
    recentToasts.set(key, now);

    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.style.setProperty('--life', duration + 'ms');
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

  /* ---------- Loader binding + request tracking ---------- */
  const LOADER_DELAY = 350;
  let pending = 0;
  let loaderTimer = null;
  let loaderCaption;
  const nativeFetch = window.fetch.bind(window);

  const updateProgress = () => {
    const L = window.Loader;
    if (!L) return;
    if (pending > 0) {
      if (!L.isShown() && !loaderTimer) {
        loaderTimer = setTimeout(() => {
          loaderTimer = null;
          if (pending > 0 && !currentErr && !offlineOpen()) L.show(loaderCaption);
        }, LOADER_DELAY);
      }
    } else {
      clearTimeout(loaderTimer);
      loaderTimer = null;
      loaderCaption = undefined;
      L.hide();
    }
  };

  function onResponse(res, method, url) {
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
    if (CFG.authUrl.test(url)) loaderCaption = t('authenticating');
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

  /* ---------- Safe Non-Destructive Form Loading State ---------- */
  function setLoading(btn, on, text) {
    if (!btn) return;
    if (on) {
      if (!btn.dataset.uiOrig) btn.dataset.uiOrig = btn.innerHTML;
      btn.dataset.uiLoadingText = text;
      btn.classList.add('is-loading');
      btn.setAttribute('aria-busy', 'true');
    } else {
      btn.classList.remove('is-loading');
      btn.removeAttribute('aria-busy');
      if (btn.dataset.uiOrig) {
        btn.innerHTML = btn.dataset.uiOrig;
        delete btn.dataset.uiOrig;
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

    if (btn.classList.contains('is-loading')) {
      e.preventDefault();
      return;
    }

    const isLogin = form.id === 'login-form';
    const status = isLogin ? $('#login-status') : null;
    const alertBox = isLogin ? $('#login-alert') : null;
    const started = performance.now();
    let sawRequest = false;
    let slowTimer;

    setTimeout(() => {
      setLoading(btn, true, loadingTextFor(form));
    }, 0);
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
      if (!taskRunning && pending === 0 && elapsed > 600 && (sawRequest || elapsed > 900)) return finish();
      if (elapsed > 30000) return finish();
      setTimeout(check, 80);
    };
    setTimeout(check, 80);
  }, true);

  window.handleContactSubmit = async function (e) {
  e.preventDefault();
  const form = e.target;
  const name = form.querySelector('#contact-name')?.value || '';
  const email = form.querySelector('#contact-email')?.value || '';
  const message = form.querySelector('#contact-message')?.value || '';
  const submitBtn = form.querySelector('button[type="submit"]');

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add('is-loading');
  }

  try {
    const res = await fetch('/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, message })
    });

    const data = await res.json();
    if (res.ok) {
      toast('success', currentLang === 'ur' ? 'پیغام کامیابی سے موصول ہو گیا ہے!' : 'Your message has been received by HQ.');
      form.reset();
    } else {
      toast('error', data.message || 'Failed to transmit message.');
    }
  } catch (err) {
    toast('error', 'Network failure connecting to Secretariat.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('is-loading');
    }
  }
};

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
    if (String(kind) === 'offline') { showOffline(); return; }
    if (!errView) return;
    if (window.Loader) window.Loader.hide();
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
      primary.textContent = t('retryConnection'); primary.onclick = retryConnection;
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

  /* ---------- Online / offline experience ---------- */
  const offlineEl = $('#offline-screen');
  const offlineRetry = $('#offline-retry');
  const offlineOpen = () => !!offlineEl && !offlineEl.classList.contains('hidden');

  function fillOfflineText() {
    if (!offlineEl) return;
    const title = $('#offline-title');
    const words = t('offlineTitle').split(' ');
    title.textContent = '';
    if (isRtl() || words.length < 2) title.textContent = t('offlineTitle');
    else {
      title.appendChild(document.createTextNode(words.slice(0, -1).join(' ') + ' '));
      const em = document.createElement('em');
      em.textContent = words[words.length - 1];
      title.appendChild(em);
    }
    $('#offline-desc').textContent = t('offlineDesc');
    $('#offline-retry-label').textContent = t('retryHandshake');
  }

  function showOffline() {
    if (!offlineEl) return;
    if (window.Loader) window.Loader.hide();
    if (typeof hideErrorPage === 'function') hideErrorPage();
    fillOfflineText();
    offlineEl.classList.remove('hidden');
    document.body.classList.add('no-scroll');
    setTimeout(() => offlineRetry && offlineRetry.focus(), 50);
  }

  function hideOffline() {
    if (!offlineEl) return;
    offlineEl.classList.add('hidden');
    document.body.classList.remove('no-scroll');
  }

  if (offlineRetry) {
    offlineRetry.addEventListener('click', async () => {
      offlineRetry.classList.add('is-retrying');
      try {
        await nativeFetch(location.pathname, { method: 'HEAD', cache: 'no-store' });
        location.reload();
      } catch (_) {
        offlineRetry.classList.remove('is-retrying');
        toast('error', t('stillOffline'));
      }
    });
  }

  window.addEventListener('offline', showOffline);
  window.addEventListener('online', () => {
    hideOffline();
    toast('success', t('backOnline'));
  });
  if (!navigator.onLine) showOffline();

  /* ---------- Sliding Pill Under Active Tab (Strict Loop-Proof) ---------- */
  function placeNavIndicator() {
    const nav = $('#public-nav');
    if (!nav) return;
    let ind = $('.nav-indicator', nav);
    if (!ind) {
      ind = document.createElement('span');
      ind.className = 'nav-indicator';
      ind.setAttribute('aria-hidden', 'true');
      nav.prepend(ind);
    }
    const active = $('.nav-item.active', nav);
    if (!active) {
      if (nav.classList.contains('has-indicator')) nav.classList.remove('has-indicator');
      return;
    }
    if (!nav.classList.contains('has-indicator')) nav.classList.add('has-indicator');
    ind.style.width = active.offsetWidth + 'px';
    ind.style.transform = 'translateX(' + active.offsetLeft + 'px)';
    if (!ind.classList.contains('ready')) requestAnimationFrame(() => ind.classList.add('ready'));
  }
  window.__placeNav = placeNavIndicator;

  window.addEventListener('DOMContentLoaded', () => {
    placeNavIndicator();
    const navItems = $$('#public-nav .nav-item');
    if (navItems.length > 0 && window.MutationObserver) {
      const navObserver = new MutationObserver((mutations) => {
        let shouldUpdate = false;
        for (const m of mutations) {
          if (m.type === 'attributes' && m.attributeName === 'class') {
            shouldUpdate = true;
            break;
          }
        }
        if (shouldUpdate) placeNavIndicator();
      });
      navItems.forEach((item) => navObserver.observe(item, { attributes: true, attributeFilter: ['class'] }));
    }
  });
  window.addEventListener('load', placeNavIndicator);
  window.addEventListener('resize', placeNavIndicator);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeNavIndicator);

  /* ---------- 404 for unknown routes ---------- */
  function checkRoute() {
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    if (CFG.validRoutes.includes(h)) return;
    if (document.getElementById(h) || document.getElementById('view-' + h) || document.getElementById(h + '-view')) return;
    showErrorPage('404');
  }
  window.addEventListener('hashchange', checkRoute);
  window.addEventListener('DOMContentLoaded', checkRoute);

  /* ---------- Skeleton Fallback ---------- */
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

  /* ---------- Validation Pills ---------- */
  const PILL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 7v6M12 17v.01"/></svg>';
  let focusedInvalid = false;

  function fieldMessage(el) {
    const v = el.validity;
    if (v.valueMissing) return t('fieldRequired');
    if (v.typeMismatch && el.type === 'email') return t('fieldEmail');
    if (v.rangeUnderflow) return t('fieldMin').replace('{n}', el.min);
    return el.validationMessage || t('fieldInvalid');
  }

  function clearPill(el) {
    if (el._uiPill) { el._uiPill.remove(); el._uiPill = null; }
    el.removeAttribute('aria-invalid');
    el.removeAttribute('aria-describedby');
  }

  function showPill(el, msg) {
    clearPill(el);
    const pill = document.createElement('span');
    pill.className = 'field-pill';
    pill.setAttribute('role', 'alert');
    pill.id = 'msg-' + (el.id || 'field');
    pill.innerHTML = PILL_ICON;
    const text = document.createElement('span');
    text.textContent = msg;
    pill.appendChild(text);
    (el.closest('.input-wrap') || el).insertAdjacentElement('afterend', pill);
    el._uiPill = pill;
    el.setAttribute('aria-invalid', 'true');
    el.setAttribute('aria-describedby', pill.id);
  }

  document.addEventListener('invalid', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLElement)) return;
    e.preventDefault();
    showPill(el, fieldMessage(el));
    if (!focusedInvalid) {
      focusedInvalid = true;
      el.focus();
      setTimeout(() => { focusedInvalid = false; }, 0);
    }
  }, true);

  const clearOnEdit = (e) => { if (e.target && e.target._uiPill) clearPill(e.target); };
  document.addEventListener('input', clearOnEdit, true);
  document.addEventListener('change', clearOnEdit, true);

  /* ---------- Prompt Dialog ---------- */
  function askText(message) {
    return new Promise((resolve) => {
      const prev = document.activeElement;
      const scrim = document.createElement('div');
      scrim.className = 'dlg-scrim';
      scrim.innerHTML =
        '<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-desc">' +
          '<h3 id="dlg-title"></h3><p id="dlg-desc"></p>' +
          '<div class="form-group"><textarea id="dlg-input" rows="3" aria-labelledby="dlg-desc"></textarea></div>' +
          '<div class="dlg-actions">' +
            '<button type="button" class="btn btn-secondary" data-dlg="cancel"></button>' +
            '<button type="button" class="btn btn-primary" data-dlg="ok"></button>' +
          '</div>' +
        '</div>';
      $('#dlg-title', scrim).textContent = t('promptTitle');
      $('#dlg-desc', scrim).textContent = message || '';
      $('[data-dlg="cancel"]', scrim).textContent = t('promptCancel');
      $('[data-dlg="ok"]', scrim).textContent = t('promptConfirm');
      document.body.appendChild(scrim);

      const input = $('#dlg-input', scrim);
      const close = (value) => {
        document.removeEventListener('keydown', onKey, true);
        scrim.remove();
        if (prev && prev.focus) prev.focus();
        resolve(value);
      };
      const confirm = () => {
        const v = input.value.trim();
        if (!v) { showPill(input, t('promptRequired')); input.focus(); return; }
        close(v);
      };
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); close(null); return; }
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); confirm(); return; }
        if (e.key === 'Tab') {
          const f = $$('textarea, button', scrim);
          const first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
      document.addEventListener('keydown', onKey, true);
      scrim.addEventListener('click', (e) => {
        if (e.target === scrim) return close(null);
        const act = e.target.closest('[data-dlg]');
        if (!act) return;
        if (act.dataset.dlg === 'ok') confirm(); else close(null);
      });
      setTimeout(() => input.focus(), 30);
    });
  }

  /* ---------- Headline Accents ---------- */
  function applyAccents() {
    if (isRtl()) return;
    $$('[data-accent-tail]').forEach((el) => {
      if (el.querySelector('em')) return;
      const n = parseInt(el.getAttribute('data-accent-tail'), 10) || 1;
      const words = el.textContent.trim().split(/\s+/);
      if (words.length <= n) return;
      const em = document.createElement('em');
      em.textContent = words.slice(-n).join(' ');
      el.textContent = '';
      el.appendChild(document.createTextNode(words.slice(0, -n).join(' ') + ' '));
      el.appendChild(em);
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    const orig = window.toggleLanguage;
    if (typeof orig === 'function') {
      window.toggleLanguage = function () {
        const out = orig.apply(this, arguments);
        applyAccents();
        placeNavIndicator();
        if (offlineOpen()) fillOfflineText();
        return out;
      };
    }
    applyAccents();
  });

  window.ShipLensUI = { toast, showErrorPage, hideErrorPage, prompt: askText };
  window.showErrorPage = showErrorPage;
})();