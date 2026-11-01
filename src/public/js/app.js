// Global State
let currentLang = localStorage.getItem('shiplens_lang') || 'en';
let currentUser = null;
let branches = [];
let branchesLoaded = false;

/* =====================================================================
   Loader — Fluid Metaball Overlay
   ===================================================================== */
const Loader = (() => {
  const MIN_VISIBLE = 500;
  let shownAt = 0, hideTimer = null, offTimer = null, visible = false;
  const node = () => document.getElementById('loader');
  const defaultCaption = () => (currentLang === 'ur' ? 'ShipLens نوڈ سے ہم آہنگی ہو رہی ہے…' : 'Syncing ShipLens Node...');
  return {
    isShown: () => visible,
    show(caption) {
      const n = node();
      if (!n) return;
      clearTimeout(hideTimer); clearTimeout(offTimer);
      const c = document.getElementById('loader-caption');
      if (c) c.textContent = caption || defaultCaption();
      if (!visible) {
        visible = true; shownAt = Date.now();
        n.classList.remove('hidden');
        void n.offsetWidth;
        n.classList.add('is-on');
      }
    },
    hide() {
      const n = node();
      if (!n || !visible) return;
      clearTimeout(hideTimer);
      const wait = Math.max(0, MIN_VISIBLE - (Date.now() - shownAt));
      hideTimer = setTimeout(() => {
        visible = false;
        n.classList.remove('is-on');
        offTimer = setTimeout(() => n.classList.add('hidden'), 320);
      }, wait);
    }
  };
})();
window.Loader = Loader;

/* =====================================================================
   Theme Switcher & Curtain Wipe
   ===================================================================== */
const THEME_KEY = 'shiplens_theme';
const THEME_LABELS = {
  en: { toLight: 'Switch to light mode', toDark: 'Switch to dark mode' },
  ur: { toLight: 'لائٹ موڈ پر جائیں', toDark: 'ڈارک موڈ پر جائیں' }
};

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function syncThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const light = currentTheme() === 'light';
  btn.setAttribute('aria-pressed', String(light));
  btn.setAttribute('aria-label', THEME_LABELS[currentLang][light ? 'toDark' : 'toLight']);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch (_) {}
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#F8FAFC' : '#07060d');
  syncThemeToggle();
}

function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  const direction = next === 'light' ? 'to-light' : 'to-dark';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    applyTheme(next);
    return;
  }

  if (typeof document.startViewTransition === 'function') {
    document.documentElement.setAttribute('data-transition', direction);
    const transition = document.startViewTransition(() => {
      applyTheme(next);
    });

    transition.finished.finally(() => {
      document.documentElement.removeAttribute('data-transition');
    });
    return;
  }

  const curtain = document.createElement('div');
  curtain.className = 'theme-curtain';
  curtain.dataset.to = next;
  document.body.appendChild(curtain);

  curtain.addEventListener('animationend', () => {
    applyTheme(next);
    curtain.remove();
  }, { once: true });
}

/* =====================================================================
   Translations Dictionary
   ===================================================================== */
const i18n = {
  en: {
    nav_home: 'Home',
    nav_about: 'About',
    nav_programs: 'Programs',
    nav_branches: 'Branches',
    nav_events: 'Events',
    nav_get_involved: 'Get Involved',
    nav_contact: 'Contact',
    hero_title: 'Decentralized Governance & Operational Integrity',
    hero_desc: 'ShipLens connects regional branches across Pakistan with centralized financial auditing, immutable logging, and volunteer management.',
    form_title: 'Volunteer Application',
    form_subtitle: 'Join our nationwide branch network in making an operational impact.',
    label_name: 'Full Name',
    label_email: 'Email Address',
    label_phone: 'Phone Number',
    label_branch: 'Preferred Branch',
    opt_select_branch: 'Select your local branch',
    label_notes: 'Statement of Intent / Skills',
    btn_submit_app: 'Submit Volunteer Application',
    nav_login: 'Portal Login',
    nav_portal: 'Open Portal',
    nav_logout: 'Sign Out',
    login_title: 'Staff & Officer Authentication',
    login_subtitle: 'Enter credentials to access role-authorized operational pipelines.',
    label_password: 'Password',
    btn_login: 'Authenticate',
    btn_back_home: '← Back to Public Portal',
    lang_toggle_text: 'اردو'
  },
  ur: {
    nav_home: 'ہوم',
    nav_about: 'ہمارے متعلق',
    nav_programs: 'پروگرامز',
    nav_branches: 'شاخیں',
    nav_events: 'تقریبات',
    nav_get_involved: 'شمولیت',
    nav_contact: 'رابطہ',
    hero_title: 'غیر مرکزی حکمرانی اور مالیاتی شفافیت',
    hero_desc: 'شپ لینز پاکستان بھر کی علاقائی شاخوں کو مرکزی مالیاتی آڈٹ، ناقابلِ تغیر لاگز، اور رضاکارانہ نظم و نسق سے جوڑتا ہے۔',
    form_title: 'رضاکارانہ شمولیت کی درخواست',
    form_subtitle: 'ہمارے قومی برانچ نیٹ ورک کا حصہ بنیں اور عملی تبدیلی لائیں۔',
    label_name: 'مکمل نام',
    label_email: 'ای میل ایڈریس',
    label_phone: 'فون نمبر',
    label_branch: 'منتخب برانچ',
    opt_select_branch: 'اپنی مقامی برانچ کا انتخاب کریں',
    label_notes: 'شمولیت کا مقصد یا مہارتیں',
    btn_submit_app: 'درخواست جمع کروائیں',
    nav_login: 'پورٹل لاگ ان',
    nav_portal: 'پورٹل کھولیں',
    nav_logout: 'لاگ آؤٹ',
    login_title: 'عملہ و افسران کی لاگ ان تصدیق',
    login_subtitle: 'اپنے مجاز اختیارات والے ڈیش بورڈ تک رسائی کے لیے لاگ ان کریں۔',
    label_password: 'پاس ورڈ',
    btn_login: 'لاگ ان کریں',
    btn_back_home: '← پبلک پورٹل پر واپس جائیں',
    lang_toggle_text: 'English'
  }
};

/* ---------- Utility Helpers ---------- */
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function notify(type, message, duration) {
  if (window.ShipLensUI && window.ShipLensUI.toast) window.ShipLensUI.toast(type, message, duration);
  else alert(message);
}

const STATUS_CLASS = {
  APPROVED: 'success', ACCEPTED: 'success', PUBLISHED: 'success', ACTIVE: 'success',
  SUBMITTED: 'info', FROZEN: 'info', APPLIED: 'info', RESUBMITTED: 'info',
  DRAFT: 'warning', RETURNED: 'danger', DECLINED: 'danger', INACTIVE: 'danger',
  FORMING: 'info', PAUSED: 'warning', CLOSED: 'danger'
};

function pill(status) {
  const cls = STATUS_CLASS[status] ? ` status-${STATUS_CLASS[status]}` : '';
  return `<span class="status-pill${cls}">${esc(status)}</span>`;
}

function failedRow(cols) {
  return `<tr><td colspan="${cols}" class="text-center"><div class="empty-state"><span>Couldn’t load this data.</span><button type="button" class="btn btn-outline btn-sm" onclick="location.reload()">Retry</button></div></td></tr>`;
}

function emptyRow(cols, text) {
  return `<tr><td colspan="${cols}" class="text-center">${esc(text)}</td></tr>`;
}

async function safeJson(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await response.json();
  }
  const text = await response.text();
  throw new Error(`Server returned unexpected ${response.status} response (${text.slice(0, 80).trim()}...)`);
}

function authHeaders(extra = {}) {
  const token = localStorage.getItem('shiplens_token');
  const headers = {
    'X-Requested-With': 'ShipLens',
    ...extra
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function formatDateDisplay(rawDate) {
  if (!rawDate) return '';
  return typeof rawDate === 'string' ? rawDate.split('T')[0] : new Date(rawDate).toISOString().split('T')[0];
}

function toggleLanguage() {
  currentLang = currentLang === 'en' ? 'ur' : 'en';
  localStorage.setItem('shiplens_lang', currentLang);
  document.documentElement.setAttribute('lang', currentLang);
  document.documentElement.setAttribute('dir', currentLang === 'ur' ? 'rtl' : 'ltr');

  const langLabel = document.getElementById('lang-label');
  if (langLabel) langLabel.innerText = i18n[currentLang].lang_toggle_text;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (i18n[currentLang][key]) {
      el.innerText = i18n[currentLang][key];
    }
  });

  syncThemeToggle();
  loadHomeBulletins();
  loadDynamicProgramsAndEvents();
  renderPublicBranchesTable();
}

/* =====================================================================
   Portal & Navigation State Machine
   ===================================================================== */
const PORTAL_VIEWS = ['branch-lead-view', 'hr-lead-view', 'finance-view', 'editor-view'];

function portalViewFor(role) {
  switch (role) {
    case 'BRANCH_LEAD': return 'branch-lead-view';
    case 'HR_LEAD': return 'hr-lead-view';
    case 'FINANCE_REVIEWER':
    case 'SUPER_ADMIN': return 'finance-view';
    case 'CONTENT_EDITOR': return 'editor-view';
    default: return null;
  }
}

function activeViewId() {
  const v = document.querySelector('.view:not(.hidden)');
  return v ? v.id : null;
}

function syncPortalButton(viewId) {
  const btn = document.getElementById('open-portal');
  if (!btn) return;
  const canOpen = !!(currentUser && portalViewFor(currentUser.role));
  btn.classList.toggle('hidden', !canOpen || PORTAL_VIEWS.includes(viewId));
}

function showView(viewId) {
  document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
  const target = document.getElementById(viewId);
  if (target) target.classList.remove('hidden');

  if (PORTAL_VIEWS.includes(viewId)) {
    document.querySelectorAll('#public-nav .nav-item.active').forEach((l) => l.classList.remove('active'));
  }
  syncPortalButton(viewId);
}

function handleBrandClick() {
  if (currentUser && portalViewFor(currentUser.role)) openPortal();
  else navigateTo('home');
}

function navigateTo(pageName) {
  document.querySelectorAll('#public-nav .nav-item').forEach((link) => {
    link.classList.remove('active');
    if (link.getAttribute('href') === `#${pageName}`) {
      link.classList.add('active');
    }
  });

  const viewMap = {
    'home': 'view-home',
    'about': 'view-about',
    'programs': 'view-programs',
    'branches': 'view-branches',
    'events': 'view-events',
    'get-involved': 'view-get-involved',
    'contact': 'view-contact'
  };

  const targetViewId = viewMap[pageName] || 'view-home';
  showView(targetViewId);

  if (pageName === 'home') {
    loadHomeBulletins();
  } else if (pageName === 'branches') {
    renderPublicBranchesTable();
  } else if (pageName === 'programs' || pageName === 'events') {
    loadDynamicProgramsAndEvents();
  }
}

// Fetch active branches
async function fetchBranches() {
  try {
    const res = await fetch('/branches');
    if (res.ok) {
      branches = await safeJson(res);
      branchesLoaded = true;
      const select = document.getElementById('preferredBranch');
      if (select) {
        select.innerHTML = `<option value="" disabled selected>${esc(i18n[currentLang].opt_select_branch)}</option>`;
        branches.forEach((b) => {
          const opt = document.createElement('option');
          opt.value = b.id;
          opt.textContent = `${b.name} (${b.city}) [${b.code}]`;
          select.appendChild(opt);
        });
      }
      renderPublicBranchesTable();
    } else {
      const tbody = document.querySelector('#public-branches-table tbody');
      if (tbody) tbody.innerHTML = failedRow(4);
    }
  } catch (e) {
    const tbody = document.querySelector('#public-branches-table tbody');
    if (tbody) tbody.innerHTML = failedRow(4);
  }
}

function renderPublicBranchesTable() {
  const tbody = document.querySelector('#public-branches-table tbody');
  if (!tbody || !branchesLoaded) return;

  if (branches.length === 0) {
    tbody.innerHTML = emptyRow(4, 'No branches listed yet.');
    return;
  }

  tbody.innerHTML = branches.map((b) => `
    <tr>
      <td><strong>${esc(b.code)}</strong></td>
      <td>${esc(b.name)}</td>
      <td>${esc(b.city)}</td>
      <td><span class="status-pill status-success">${esc(b.status || 'ACTIVE')}</span></td>
    </tr>
  `).join('');
}

async function loadHomeBulletins() {
  const container = document.getElementById('home-bulletins-list');
  if (!container) return;

  try {
    const res = await fetch(`/content?lang=${currentLang}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (res.ok) {
      const items = await safeJson(res);
      container.removeAttribute('aria-busy');
      if (items.length === 0) {
        container.innerHTML = '<p class="subtitle">No public bulletins published at this time.</p>';
        return;
      }
      container.innerHTML = items.map((item) => `
        <article class="bulletin">
          <div class="bulletin-head">
            <h4>${esc(currentLang === 'ur' && item.title_ur ? item.title_ur : item.title)}</h4>
            <small>${esc(new Date(item.published_at || item.created_at).toLocaleDateString())}</small>
          </div>
          <p>${esc(currentLang === 'ur' && item.summary_ur ? item.summary_ur : (item.summary || (item.body || '').slice(0, 160) + '...'))}</p>
        </article>
      `).join('');
    } else {
      container.innerHTML = '<p class="subtitle">Unable to load public bulletins right now.</p>';
    }
  } catch (err) {
    container.innerHTML = '<p class="subtitle">Unable to load public bulletins right now.</p>';
  }
}

async function loadDynamicProgramsAndEvents() {
  // Programs
  try {
    const progRes = await fetch(`/content?category=PROGRAM&lang=${currentLang}`);
    if (progRes.ok) {
      const programs = await safeJson(progRes);
      const container = document.getElementById('programs-cards-container');
      if (container && programs.length > 0) {
        container.innerHTML = programs.map((p) => `
          <div class="card program-card">
            <h3>${esc(currentLang === 'ur' && p.title_ur ? p.title_ur : p.title)}</h3>
            <p>${esc(currentLang === 'ur' && p.summary_ur ? p.summary_ur : p.summary)}</p>
          </div>
        `).join('');
      }
    }
  } catch (_) {}

  // Events
  try {
    const evRes = await fetch(`/content?category=EVENT&lang=${currentLang}`);
    if (evRes.ok) {
      const events = await safeJson(evRes);
      const container = document.getElementById('events-cards-container');
      if (container && events.length > 0) {
        container.innerHTML = events.map((e) => `
          <div class="card event-card">
            <h3>${esc(currentLang === 'ur' && e.title_ur ? e.title_ur : e.title)}</h3>
            <p class="event-meta"><strong>Date:</strong> ${esc(formatDateDisplay(e.event_date) || 'TBD')}</p>
            <p class="event-meta"><strong>Location:</strong> ${esc(currentLang === 'ur' && e.location_ur ? e.location_ur : (e.location || 'Nationwide'))}</p>
            <p>${esc(currentLang === 'ur' && e.summary_ur ? e.summary_ur : e.summary)}</p>
          </div>
        `).join('');
      }
    }
  } catch (_) {}
}

async function handleVolunteerSubmit(event) {
  event.preventDefault();
  const alertEl = document.getElementById('app-alert');
  alertEl.className = 'alert hidden';

  const payload = {
    fullName: document.getElementById('fullName').value.trim(),
    email: document.getElementById('email').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    preferredBranchId: document.getElementById('preferredBranch').value,
    notes: document.getElementById('notes').value.trim()
  };

  try {
    const res = await fetch('/applications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'ShipLens'
      },
      body: JSON.stringify(payload)
    });

    const data = await safeJson(res);

    if (res.ok) {
      alertEl.innerText = currentLang === 'ur'
        ? 'آپ کی درخواست کامیابی سے جمع ہو گئی ہے۔ برانچ انتظامیہ جلد رابطہ کرے گی۔'
        : 'Application submitted successfully! Our regional HR lead will review your submission.';
      alertEl.className = 'alert alert-success';
      alertEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('volunteer-form').reset();
    } else {
      throw new Error(data.message || data.error || 'Failed to submit application');
    }
  } catch (err) {
    alertEl.innerText = err.message;
    alertEl.className = 'alert alert-error';
    alertEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/* =====================================================================
   Authentication Flow
   ===================================================================== */
async function handleLogin(event) {
  event.preventDefault();
  const alertEl = document.getElementById('login-alert');
  if (alertEl) {
    alertEl.className = 'alert hidden';
    alertEl.innerText = '';
  }

  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  if (!emailInput || !passwordInput) return;

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  try {
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'ShipLens'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await safeJson(res);

    if (res.ok && data.token) {
      currentUser = data.user || null;
      localStorage.setItem('shiplens_token', data.token);

      const form = document.getElementById('login-form');
      if (form) form.reset();

      renderAuthenticatedState(true);
      notify('success', `Signed in as ${currentUser?.email || email}`);
    } else {
      throw new Error(data.message || data.error || 'Invalid credentials');
    }
  } catch (err) {
    if (alertEl) {
      alertEl.innerText = err.message || 'Login failed. Please check your credentials.';
      alertEl.className = 'alert alert-error';
      alertEl.classList.remove('hidden');
    } else {
      notify('error', err.message || 'Login failed');
    }
  }
}

function renderAuthenticatedState(openDashboard = true) {
  const authBtns = document.getElementById('auth-buttons');
  const userProfile = document.getElementById('user-profile');
  if (authBtns) authBtns.classList.add('hidden');
  if (userProfile) userProfile.classList.remove('hidden');

  const roleBadge = document.getElementById('user-role-badge');
  if (roleBadge && currentUser) {
    roleBadge.innerText = currentUser.role;
    roleBadge.title = currentUser.email;
  }
  const emailDisplay = document.getElementById('user-email-display');
  if (emailDisplay && currentUser) emailDisplay.innerText = currentUser.email;

  if (!openDashboard) {
    syncPortalButton(activeViewId());
    return;
  }
  openPortal();
}

function openPortal() {
  if (!currentUser) return;
  switch (currentUser.role) {
    case 'BRANCH_LEAD':
      showView('branch-lead-view');
      loadBranchLeadReports();
      break;
    case 'HR_LEAD':
      showView('hr-lead-view');
      loadHRRoster();
      break;
    case 'FINANCE_REVIEWER':
    case 'SUPER_ADMIN':
      showView('finance-view');
      loadFinanceQueue();
      break;
    case 'CONTENT_EDITOR':
      showView('editor-view');
      loadEditorContentList();
      break;
    default:
      navigateTo('home');
  }
}

async function logout() {
  try {
    await fetch('/auth/logout', {
      method: 'POST',
      headers: authHeaders()
    });
  } catch (_) {}

  currentUser = null;
  localStorage.removeItem('shiplens_token');
  const userProfile = document.getElementById('user-profile');
  const authBtns = document.getElementById('auth-buttons');
  const portalBtn = document.getElementById('open-portal');
  if (userProfile) userProfile.classList.add('hidden');
  if (authBtns) authBtns.classList.remove('hidden');
  if (portalBtn) portalBtn.classList.add('hidden');
  navigateTo('home');
  notify('info', 'You have been signed out.');
}

/* =====================================================================
   Role Dashboard Actions
   ===================================================================== */
async function loadHRRoster() {
  const appsTbody = document.querySelector('#hr-applications-table tbody');
  if (appsTbody) {
    try {
      const appsRes = await fetch('/applications?status=APPLIED', { headers: authHeaders() });
      if (appsRes.ok) {
        const applications = await safeJson(appsRes);
        if (applications.length === 0) {
          appsTbody.innerHTML = emptyRow(5, 'No pending applications in queue.');
        } else {
          appsTbody.innerHTML = applications.map((a) => `
            <tr>
              <td><strong>${esc(a.full_name)}</strong></td>
              <td>${esc(a.email)}</td>
              <td>${esc(a.phone)}</td>
              <td>${esc(a.preferred_branch_name || 'Unassigned')}</td>
              <td>
                <button type="button" class="btn btn-primary btn-sm" onclick="reviewApplication('${esc(a.id)}', 'ACCEPTED', '${esc(a.preferred_branch_id || '')}')">Accept & Mint</button>
                <button type="button" class="btn btn-outline btn-sm btn-decline" onclick="reviewApplication('${esc(a.id)}', 'DECLINED')">Decline</button>
              </td>
            </tr>
          `).join('');
        }
      } else if (appsRes.status !== 403) {
        appsTbody.innerHTML = failedRow(5);
      }
    } catch (err) {
      appsTbody.innerHTML = failedRow(5);
    }
  }

  const rosterTbody = document.querySelector('#hr-roster-table tbody');
  if (rosterTbody) {
    try {
      const membersRes = await fetch('/members', { headers: authHeaders() });
      if (membersRes.ok) {
        const membersData = await safeJson(membersRes);
        const members = Array.isArray(membersData) ? membersData : (membersData.items || []);
        if (members.length === 0) {
          rosterTbody.innerHTML = emptyRow(5, 'No active members in roster.');
        } else {
          rosterTbody.innerHTML = members.map((m) => `
            <tr>
              <td><strong>${esc(m.member_code)}</strong></td>
              <td>${esc(m.full_name)}</td>
              <td>${esc(m.branch_name || 'Assigned Branch')}</td>
              <td>${esc(m.email)} (${esc(m.phone)})</td>
              <td>${pill(m.status)}</td>
            </tr>
          `).join('');
        }
      } else if (membersRes.status !== 403) {
        rosterTbody.innerHTML = failedRow(5);
      }
    } catch (err) {
      rosterTbody.innerHTML = failedRow(5);
    }
  }
}

async function reviewApplication(applicationId, status, preferredBranchId) {
  let rejectionReason = undefined;
  if (status === 'DECLINED') {
    const promptMsg = 'Please enter a decline reason for the audit trail:';
    rejectionReason = prompt(promptMsg);
    if (!rejectionReason) return;
  }

  try {
    const res = await fetch(`/applications/${applicationId}/review`, {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        status,
        assignedBranchId: preferredBranchId || undefined,
        rejectionReason
      })
    });

    const data = await safeJson(res);
    if (res.ok) {
      if (status === 'ACCEPTED') {
        notify('success', `Volunteer accepted! Member code minted: ${data.member ? data.member.member_code : 'MEM-AUTO'}`, 7000);
      } else {
        notify('info', 'Application marked as declined.');
      }
      loadHRRoster();
    } else {
      notify('error', data.message || data.error || 'Review operation failed');
    }
  } catch (err) {
    notify('error', err.message);
  }
}

async function handleRecordCollection(event) {
  event.preventDefault();
  const valStr = document.getElementById('col-amount-pkr').value.trim();
  
  // Safe integer-paisa parsing without IEEE floating-point drift
  const parts = valStr.split('.');
  const wholePkr = parseInt(parts[0], 10) || 0;
  const fractionPaisa = parts[1] ? parseInt(parts[1].slice(0, 2).padEnd(2, '0'), 10) : 0;
  const amountPaisa = (wholePkr * 100) + fractionPaisa;

  const collectionDate = document.getElementById('col-date').value;
  const form = event.target;
  const branchId = (currentUser && (currentUser.branchId || currentUser.branch_id)) || null;

  try {
    const res = await fetch('/collections', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        branchId,
        amountPaisa,
        collectionDate
      })
    });

    const data = await safeJson(res);
    if (res.ok) {
      notify('success', `Collection of PKR ${(amountPaisa / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} committed to the ledger.`);
      form.reset();
    } else {
      notify('error', data.message || data.error || 'Could not record collection');
    }
  } catch (err) {
    notify('error', err.message);
  }
}

async function handleCreateReport(event) {
  event.preventDefault();
  const startDate = document.getElementById('rep-start').value;
  const endDate = document.getElementById('rep-end').value;
  const form = event.target;

  if (new Date(endDate) < new Date(startDate)) {
    notify('error', 'Week End Date cannot be earlier than Week Start Date.');
    return;
  }

  const branchId = (currentUser && (currentUser.branchId || currentUser.branch_id)) || null;

  try {
    const res = await fetch('/reports', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        branchId,
        weekStartDate: startDate,
        weekEndDate: endDate,
        submissionNotes: document.getElementById('rep-notes').value
      })
    });

    const data = await safeJson(res);
    if (res.ok) {
      notify('success', 'Draft weekly report generated from collections.');
      loadBranchLeadReports();
      form.reset();
    } else {
      notify('error', data.message || data.error || 'Could not create report');
    }
  } catch (err) {
    notify('error', err.message);
  }
}

async function loadBranchLeadReports() {
  const tbody = document.querySelector('#branch-reports-table tbody');
  if (!tbody) return;

  try {
    const res = await fetch('/reports', { headers: authHeaders() });
    if (res.ok) {
      const reports = await safeJson(res);
      if (reports.length === 0) {
        tbody.innerHTML = emptyRow(4, 'No reports drafted yet.');
        return;
      }
      tbody.innerHTML = reports.map((r) => `
        <tr>
          <td>${esc(formatDateDisplay(r.week_start_date))} to ${esc(formatDateDisplay(r.week_end_date))}</td>
          <td>PKR ${(Number(r.total_amount_paisa) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          <td>${pill(r.status)}</td>
          <td>
            ${r.status === 'DRAFT' || r.status === 'RETURNED'
              ? `<button type="button" class="btn btn-primary btn-sm" onclick="submitReport('${esc(r.id)}')">${r.status === 'RETURNED' ? 'Resubmit' : 'Submit to HQ'}</button>`
              : '<span class="subtitle" style="margin:0">Locked / Under Review</span>'}
          </td>
        </tr>
      `).join('');
    } else if (res.status !== 403) {
      tbody.innerHTML = failedRow(4);
    }
  } catch (err) {
    tbody.innerHTML = failedRow(4);
  }
}

async function submitReport(id) {
  try {
    const res = await fetch(`/reports/${id}/submit`, {
      method: 'PATCH',
      headers: authHeaders()
    });
    const data = await safeJson(res);
    if (res.ok) {
      notify('success', 'Report submitted for central review.');
      loadBranchLeadReports();
    } else {
      notify('error', data.message || data.error || 'Submission failed');
    }
  } catch (err) {
    notify('error', err.message);
  }
}

async function loadFinanceQueue() {
  // 1. Fetch Executive Dashboard KPIs & Regional Breakdown
  try {
    const dashRes = await fetch('/dashboard', { headers: authHeaders() });
    if (dashRes.ok) {
      const data = await safeJson(dashRes);
      const summary = data.summary || {};

      const approvedEl = document.getElementById('metric-approved-pkr');
      const pendingEl = document.getElementById('metric-pending-pkr');
      const pendingCountEl = document.getElementById('metric-pending-count');
      const unroutedEl = document.getElementById('metric-unrouted-pkr');
      const unroutedCountEl = document.getElementById('metric-unrouted-count');

      if (approvedEl) approvedEl.textContent = `PKR ${Number(summary.approvedPkr || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
      if (pendingEl) pendingEl.textContent = `PKR ${Number(summary.pendingPkr || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
      if (pendingCountEl) pendingCountEl.textContent = `${summary.pendingReportsCount || 0} reports awaiting review`;
      if (unroutedEl) unroutedEl.textContent = `PKR ${Number(summary.unroutedPkr || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
      if (unroutedCountEl) unroutedCountEl.textContent = `${summary.unroutedCollectionsCount || 0} items not remitted`;

      const branchTbody = document.querySelector('#dashboard-branches-table tbody');
      if (branchTbody && Array.isArray(data.branches)) {
        if (data.branches.length === 0) {
          branchTbody.innerHTML = emptyRow(6, 'No branches registered.');
        } else {
          branchTbody.innerHTML = data.branches.map((b) => `
            <tr>
              <td><strong>${esc(b.code)}</strong></td>
              <td>${esc(b.name)}</td>
              <td>${esc(b.city)}</td>
              <td>PKR ${Number(b.approvedPkr || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td>${esc(b.approvedReportsCount || 0)}</td>
              <td>${pill(b.status)}</td>
            </tr>
          `).join('');
        }
      }
    }
  } catch (err) {
    console.error('Failed to load dashboard metrics:', err);
  }

  // 2. Fetch Review Queue Table (SUBMITTED and RESUBMITTED)
  const tbody = document.querySelector('#finance-reports-table tbody');
  if (!tbody) return;

  try {
    const res = await fetch('/reports?status=SUBMITTED,RESUBMITTED', { headers: authHeaders() });
    if (res.ok) {
      const reports = await safeJson(res);
      if (reports.length === 0) {
        tbody.innerHTML = emptyRow(5, 'No reports currently awaiting review.');
        return;
      }
      tbody.innerHTML = reports.map((r) => `
        <tr>
          <td><code>${esc(String(r.id).slice(0, 8))}...</code></td>
          <td>${esc(formatDateDisplay(r.week_start_date))} to ${esc(formatDateDisplay(r.week_end_date))}</td>
          <td>PKR ${(Number(r.total_amount_paisa) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          <td>${pill(r.status)}</td>
          <td>
            <button type="button" class="btn btn-primary btn-sm" onclick="approveReport('${esc(r.id)}')">Approve &amp; Freeze</button>
            <button type="button" class="btn btn-outline btn-sm btn-decline" onclick="returnReport('${esc(r.id)}')">Return</button>
          </td>
        </tr>
      `).join('');
    } else if (res.status !== 403) {
      tbody.innerHTML = failedRow(5);
    }
  } catch (err) {
    tbody.innerHTML = failedRow(5);
  }
}

async function approveReport(id) {
  try {
    const res = await fetch(`/reports/${id}/approve`, {
      method: 'PATCH',
      headers: authHeaders()
    });
    const data = await safeJson(res);
    if (res.ok) {
      notify('success', 'Report approved. Collections locked and metrics snapshot frozen.', 6000);
      loadFinanceQueue();
    } else {
      notify('error', data.message || data.error || 'Approval failed');
    }
  } catch (err) {
    notify('error', err.message);
  }
}

async function returnReport(id) {
  const promptMsg = 'Enter rejection / clarification notes for the branch lead:';
  const reason = (window.ShipLensUI && window.ShipLensUI.prompt)
    ? await window.ShipLensUI.prompt(promptMsg)
    : prompt(promptMsg);
  if (!reason) return;

  try {
    const res = await fetch(`/reports/${id}/return`, {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ rejectionReason: reason })
    });

    const data = await safeJson(res);
    if (res.ok) {
      notify('info', 'Report returned to branch lead.');
      loadFinanceQueue();
    } else {
      notify('error', data.message || data.error || 'Could not return report');
    }
  } catch (err) {
    notify('error', err.message);
  }
}

async function loadEditorContentList() {
  const tbody = document.querySelector('#editor-content-table tbody');
  if (!tbody) return;

  try {
    const res = await fetch('/admin/content', { headers: authHeaders() });
    if (res.ok) {
      const items = await safeJson(res);
      if (items.length === 0) {
        tbody.innerHTML = emptyRow(4, 'No content items created yet.');
        return;
      }
      tbody.innerHTML = items.map((item) => `
        <tr>
          <td><strong>${esc(item.title)}</strong></td>
          <td><span class="role-badge">${esc(item.category)}</span></td>
          <td>${pill(item.status)}</td>
          <td>
            ${item.status === 'DRAFT'
              ? `<button type="button" class="btn btn-primary btn-sm" onclick="publishContentItem('${esc(item.id)}')">Publish</button>`
              : `<button type="button" class="btn btn-outline btn-sm" onclick="unpublishContentItem('${esc(item.id)}')">Unpublish</button>`
            }
          </td>
        </tr>
      `).join('');
    } else if (res.status !== 403) {
      tbody.innerHTML = failedRow(4);
    }
  } catch (err) {
    tbody.innerHTML = failedRow(4);
  }
}

async function handleCreateContent(event) {
  event.preventDefault();

  const title = document.getElementById('post-title').value.trim();
  const category = document.getElementById('post-category').value;
  const summary = document.getElementById('post-summary').value.trim();
  const body = document.getElementById('post-body').value.trim();

  try {
    const res = await fetch('/admin/content', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ title, category, summary, body })
    });

    const data = await safeJson(res);
    if (res.ok) {
      notify('success', 'Draft bulletin saved.');
      document.getElementById('editor-form').reset();
      loadEditorContentList();
    } else {
      notify('error', data.message || data.error || 'Failed to save draft');
    }
  } catch (err) {
    notify('error', err.message);
  }
}

async function publishContentItem(id) {
  try {
    const res = await fetch(`/admin/content/${id}/publish`, {
      method: 'PATCH',
      headers: authHeaders()
    });
    const data = await safeJson(res);
    if (res.ok) {
      notify('success', 'Bulletin published to the public portal.');
      loadEditorContentList();
    } else {
      notify('error', data.message || data.error || 'Publish failed');
    }
  } catch (err) {
    notify('error', err.message);
  }
}

async function unpublishContentItem(id) {
  try {
    const res = await fetch(`/admin/content/${id}/unpublish`, {
      method: 'PATCH',
      headers: authHeaders()
    });
    const data = await safeJson(res);
    if (res.ok) {
      notify('info', 'Bulletin reverted to draft.');
      loadEditorContentList();
    } else {
      notify('error', data.message || data.error || 'Unpublish failed');
    }
  } catch (err) {
    notify('error', err.message);
  }
}

function exportReportsCsv() {
  fetch('/reports/export/csv', { headers: authHeaders() })
    .then((res) => {
      if (!res.ok) throw new Error('Failed to generate CSV export');
      return res.blob();
    })
    .then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shiplens-reports-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      notify('success', 'CSV export downloaded.');
    })
    .catch((err) => notify('error', err.message));
}

function exportReportsPdf() {
  fetch('/reports/export/pdf', { headers: authHeaders() })
    .then((res) => {
      if (!res.ok) throw new Error('Failed to generate PDF export');
      return res.blob();
    })
    .then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shiplens-reports-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      notify('success', 'PDF audit export downloaded.');
    })
    .catch((err) => notify('error', err.message));
}

/* =====================================================================
   Initial Bootstrap
   ===================================================================== */
window.addEventListener('DOMContentLoaded', async () => {
  document.documentElement.setAttribute('lang', currentLang);
  document.documentElement.setAttribute('dir', currentLang === 'ur' ? 'rtl' : 'ltr');
  const langLabel = document.getElementById('lang-label');
  if (langLabel && i18n[currentLang]) langLabel.innerText = i18n[currentLang].lang_toggle_text;

  fetchBranches();
  loadDynamicProgramsAndEvents();

  const repStart = document.getElementById('rep-start');
  const repEnd = document.getElementById('rep-end');

  if (repStart && repEnd) {
    repStart.addEventListener('change', () => {
      if (!repStart.value) return;

      const [year, month, day] = repStart.value.split('-').map(Number);
      const start = new Date(year, month - 1, day);

      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      const endYear = end.getFullYear();
      const endMonth = String(end.getMonth() + 1).padStart(2, '0');
      const endDay = String(end.getDate()).padStart(2, '0');

      repEnd.value = `${endYear}-${endMonth}-${endDay}`;
      repEnd.min = repStart.value;
    });
  }

  const currentHash = window.location.hash.replace('#', '') || 'home';
  navigateTo(currentHash);

  // Authenticate session from token or DB /auth/me check
  const token = localStorage.getItem('shiplens_token');
  if (token) {
    try {
      const res = await fetch('/auth/me', { headers: authHeaders() });
      if (res.ok) {
        currentUser = await safeJson(res);
        renderAuthenticatedState(currentHash === 'home');
      } else {
        localStorage.removeItem('shiplens_token');
      }
    } catch {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp && payload.exp * 1000 > Date.now()) {
          currentUser = payload;
          renderAuthenticatedState(currentHash === 'home');
        } else {
          localStorage.removeItem('shiplens_token');
        }
      } catch {
        localStorage.removeItem('shiplens_token');
      }
    }
  }
});