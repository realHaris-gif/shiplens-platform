// State
let currentLang = 'en';
let currentUser = null;
let branches = [];
let branchesLoaded = false;

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
    nav_logout: 'لاگ آؤٹ',
    login_title: 'عملہ و افسران کی لاگ ان تصدیق',
    login_subtitle: 'اپنے مجاز اختیارات والے ڈیش بورڈ تک رسائی کے لیے لاگ ان کریں۔',
    label_password: 'پاس ورڈ',
    btn_login: 'لاگ ان کریں',
    btn_back_home: '← پبلک پورٹل پر واپس جائیں',
    lang_toggle_text: 'English'
  }
};

/* ---------- Helpers ---------- */

// Escape anything coming from the database before putting it in innerHTML (XSS fix)
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// Toast (from ui.js) with a safe fallback
function notify(type, message, duration) {
  if (window.ShipLensUI && window.ShipLensUI.toast) window.ShipLensUI.toast(type, message, duration);
  else alert(message);
}

const STATUS_CLASS = {
  APPROVED: 'success', ACCEPTED: 'success', PUBLISHED: 'success', ACTIVE: 'success',
  SUBMITTED: 'info', FROZEN: 'info', APPLIED: 'info',
  DRAFT: 'warning', RETURNED: 'danger', DECLINED: 'danger', INACTIVE: 'danger'
};

function pill(status) {
  const cls = STATUS_CLASS[status] ? ` status-${STATUS_CLASS[status]}` : '';
  return `<span class="status-pill${cls}">${esc(status)}</span>`;
}

function failedRow(cols) {
  return `<tr><td colspan="${cols}" class="text-center"><div class="empty-state"><span>Couldn’t load this data.</span><button type="button" class="btn btn-outline btn-sm" data-reload>Retry</button></div></td></tr>`;
}

function emptyRow(cols, text) {
  return `<tr><td colspan="${cols}" class="text-center">${esc(text)}</td></tr>`;
}

// Safe JSON parser to guard against HTML responses
async function safeJson(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await response.json();
  }
  const text = await response.text();
  throw new Error(`Server returned unexpected ${response.status} response (${text.slice(0, 80).trim()}...)`);
}

function authHeaders(extra = {}) {
  return { 'Authorization': `Bearer ${localStorage.getItem('shiplens_token')}`, ...extra };
}

function formatDateDisplay(rawDate) {
  if (!rawDate) return '';
  return typeof rawDate === 'string' ? rawDate.split('T')[0] : new Date(rawDate).toISOString().split('T')[0];
}

function toggleLanguage() {
  currentLang = currentLang === 'en' ? 'ur' : 'en';
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
}

function showView(viewId) {
  document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
  const target = document.getElementById(viewId);
  if (target) target.classList.remove('hidden');
}

// 7 Public Pages Router
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
  }
}

// Fetch active branches for dropdown and public directory
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
    console.error('Error loading branches:', e);
    const tbody = document.querySelector('#public-branches-table tbody');
    if (tbody) tbody.innerHTML = failedRow(4);
  }
}

// Populate Public Branches Directory Table
function renderPublicBranchesTable() {
  const tbody = document.querySelector('#public-branches-table tbody');
  if (!tbody || !branchesLoaded) return; // keep skeleton until data arrives

  if (branches.length === 0) {
    tbody.innerHTML = emptyRow(4, 'No branches listed yet.');
    return;
  }

  tbody.innerHTML = branches.map((b) => `
    <tr>
      <td><strong>${esc(b.code)}</strong></td>
      <td>${esc(b.name)}</td>
      <td>${esc(b.city)}</td>
      <td><span class="status-pill status-success">ACTIVE</span></td>
    </tr>
  `).join('');
}

// Fetch published bulletins from /content
async function loadHomeBulletins() {
  const container = document.getElementById('home-bulletins-list');
  if (!container) return;

  try {
    const res = await fetch('/content', {
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
            <h4>${esc(item.title)}</h4>
            <small>${esc(new Date(item.published_at || item.created_at).toLocaleDateString())}</small>
          </div>
          <p>${esc(item.summary || (item.body || '').slice(0, 160) + '...')}</p>
        </article>
      `).join('');
    } else {
      container.innerHTML = '<p class="subtitle">Unable to load public bulletins right now.</p>';
    }
  } catch (err) {
    container.innerHTML = '<p class="subtitle">Unable to load public bulletins right now.</p>';
  }
}

// Public volunteer application submission
async function handleVolunteerSubmit(event) {
  event.preventDefault();
  const alertEl = document.getElementById('app-alert');
  alertEl.className = 'alert hidden';

  const payload = {
    fullName: document.getElementById('fullName').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    preferredBranchId: document.getElementById('preferredBranch').value,
    notes: document.getElementById('notes').value
  };

  try {
    const res = await fetch('/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      throw new Error(data.error || 'Failed to submit application');
    }
  } catch (err) {
    alertEl.innerText = err.message;
    alertEl.className = 'alert alert-error';
    alertEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// Handle authentication
async function handleLogin(event) {
  event.preventDefault();
  const alertEl = document.getElementById('login-alert');
  alertEl.className = 'alert hidden';

  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await safeJson(res);

    if (res.ok) {
      currentUser = data.user;
      localStorage.setItem('shiplens_token', data.token);
      document.getElementById('login-form').reset();
      renderAuthenticatedState();
      notify('success', `Signed in as ${currentUser.email}`);
    } else {
      throw new Error(data.message || data.error || 'Invalid credentials');
    }
  } catch (err) {
    alertEl.innerText = err.message;
    alertEl.className = 'alert alert-error';
  }
}

function renderAuthenticatedState() {
  document.getElementById('auth-buttons').classList.add('hidden');
  document.getElementById('user-profile').classList.remove('hidden');
  document.getElementById('user-role-badge').innerText = currentUser.role;
  document.getElementById('user-email-display').innerText = currentUser.email;

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

function logout() {
  currentUser = null;
  localStorage.removeItem('shiplens_token');
  document.getElementById('user-profile').classList.add('hidden');
  document.getElementById('auth-buttons').classList.remove('hidden');
  navigateTo('home');
  notify('info', 'You have been signed out.');
}

// HR Actions: Load Applications, Review & Accept
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
                <button type="button" class="btn btn-outline btn-sm" onclick="reviewApplication('${esc(a.id)}', 'DECLINED')">Decline</button>
              </td>
            </tr>
          `).join('');
        }
      } else if (appsRes.status !== 403) {
        appsTbody.innerHTML = failedRow(5);
      }
    } catch (err) {
      console.error('Failed to load applications:', err);
      appsTbody.innerHTML = failedRow(5);
    }
  }

  const rosterTbody = document.querySelector('#hr-roster-table tbody');
  if (rosterTbody) {
    try {
      const membersRes = await fetch('/members', { headers: authHeaders() });
      if (membersRes.ok) {
        const members = await safeJson(membersRes);
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
      console.error('Failed to load members:', err);
      rosterTbody.innerHTML = failedRow(5);
    }
  }
}

async function reviewApplication(applicationId, status, preferredBranchId) {
  try {
    const res = await fetch(`/applications/${applicationId}/review`, {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        status,
        assignedBranchId: preferredBranchId || undefined
      })
    });

    const data = await safeJson(res);
    if (res.ok) {
      if (status === 'ACCEPTED') {
        notify('success', `Volunteer accepted! Member code minted: ${data.member.member_code}`, 7000);
      } else {
        notify('info', 'Application marked as declined.');
      }
      loadHRRoster();
    } else {
      notify('error', data.error || 'Review operation failed');
    }
  } catch (err) {
    notify('error', err.message);
  }
}

// Branch Lead Actions: Collections & Weekly Reporting
async function handleRecordCollection(event) {
  event.preventDefault();
  const amountPkr = parseInt(document.getElementById('col-amount-pkr').value, 10);
  const amountPaisa = amountPkr * 100;
  const collectionDate = document.getElementById('col-date').value;
  const form = event.target;

  try {
    const res = await fetch('/collections', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        branchId: currentUser.branchId,
        amountPaisa,
        collectionDate
      })
    });

    const data = await safeJson(res);
    if (res.ok) {
      notify('success', `Collection of PKR ${amountPkr.toLocaleString()} committed to the ledger.`);
      form.reset();
    } else {
      notify('error', data.error || 'Could not record collection');
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

  try {
    const res = await fetch('/reports', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        branchId: currentUser.branchId,
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
      notify('error', data.error || 'Could not create report');
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
          <td>PKR ${(Number(r.total_amount_paisa) / 100).toLocaleString()}</td>
          <td>${pill(r.status)}</td>
          <td>
            ${r.status === 'DRAFT' || r.status === 'RETURNED'
              ? `<button type="button" class="btn btn-primary btn-sm" onclick="submitReport('${esc(r.id)}')">Submit to HQ</button>`
              : '<span class="subtitle" style="margin:0">Locked / Under Review</span>'}
          </td>
        </tr>
      `).join('');
    } else if (res.status !== 403) {
      tbody.innerHTML = failedRow(4);
    }
  } catch (err) {
    console.error('Failed to load reports:', err);
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
      notify('error', data.error || 'Submission failed');
    }
  } catch (err) {
    notify('error', err.message);
  }
}

// Finance Reviewer Actions: Approve & Freeze Snapshots
async function loadFinanceQueue() {
  const tbody = document.querySelector('#finance-reports-table tbody');
  if (!tbody) return;

  try {
    const res = await fetch('/reports?status=SUBMITTED', { headers: authHeaders() });
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
          <td>PKR ${(Number(r.total_amount_paisa) / 100).toLocaleString()}</td>
          <td>${pill(r.status)}</td>
          <td>
            <button type="button" class="btn btn-primary btn-sm" onclick="approveReport('${esc(r.id)}')">Approve & Freeze</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="returnReport('${esc(r.id)}')">Return</button>
          </td>
        </tr>
      `).join('');
    } else if (res.status !== 403) {
      tbody.innerHTML = failedRow(5);
    }
  } catch (err) {
    console.error('Failed to load finance queue:', err);
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
      notify('error', data.error || 'Approval failed');
    }
  } catch (err) {
    notify('error', err.message);
  }
}

async function returnReport(id) {
  const reason = prompt('Enter rejection / clarification notes for the branch lead:');
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
      notify('error', data.error || 'Could not return report');
    }
  } catch (err) {
    notify('error', err.message);
  }
}

// Content Editor Actions
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
    console.error('Failed to load editor content:', err);
    tbody.innerHTML = failedRow(4);
  }
}

async function handleCreateContent(event) {
  event.preventDefault();

  const title = document.getElementById('post-title').value;
  const category = document.getElementById('post-category').value;
  const summary = document.getElementById('post-summary').value;
  const body = document.getElementById('post-body').value;

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
      notify('error', data.error || 'Failed to save draft');
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
      notify('error', data.error || 'Publish failed');
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
      notify('error', data.error || 'Unpublish failed');
    }
  } catch (err) {
    notify('error', err.message);
  }
}

// Download formula-sanitized reports CSV
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

// Initial bootstrap
window.addEventListener('DOMContentLoaded', () => {
  fetchBranches();

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

  const token = localStorage.getItem('shiplens_token');
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      // Drop expired tokens instead of showing a dashboard that will 401
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('shiplens_token');
        notify('warning', 'Your session has expired. Please sign in again.');
      } else {
        currentUser = payload;
        renderAuthenticatedState();
      }
    } catch {
      localStorage.removeItem('shiplens_token');
    }
  }
});