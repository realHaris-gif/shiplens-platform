// State
let currentLang = 'en';
let currentUser = null;
let branches = [];

const i18n = {
  en: {
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

// Safe JSON parser to guard against HTML responses
async function safeJson(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await response.json();
  }
  const text = await response.text();
  throw new Error(`Server returned unexpected ${response.status} response (${text.slice(0, 80).trim()}...)`);
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
  // Update active state on nav links
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
      const select = document.getElementById('preferredBranch');
      if (select) {
        select.innerHTML = `<option value="" disabled selected>${i18n[currentLang].opt_select_branch}</option>`;
        branches.forEach((b) => {
          const opt = document.createElement('option');
          opt.value = b.id;
          opt.innerText = `${b.name} (${b.city}) [${b.code}]`;
          select.appendChild(opt);
        });
      }
      renderPublicBranchesTable();
    }
  } catch (e) {
    console.error('Error loading branches:', e);
  }
}

// Populate Public Branches Directory Table
function renderPublicBranchesTable() {
  const tbody = document.querySelector('#public-branches-table tbody');
  if (!tbody || branches.length === 0) return;

  tbody.innerHTML = branches.map((b) => `
    <tr>
      <td><strong>${b.code}</strong></td>
      <td>${b.name}</td>
      <td>${b.city}</td>
      <td><span class="role-badge" style="background:#059669; color:#fff;">ACTIVE</span></td>
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
      if (items.length === 0) {
        container.innerHTML = '<p style="color: #64748b; font-style: italic;">No public bulletins published at this time.</p>';
        return;
      }
      container.innerHTML = items.map((item) => `
        <div style="border-bottom: 1px solid #e2e8f0; padding: 0.75rem 0;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <h4 style="margin: 0; color: #0f172a;">${item.title}</h4>
            <small style="color: #64748b;">${new Date(item.published_at || item.created_at).toLocaleDateString()}</small>
          </div>
          <p style="margin: 0.25rem 0 0 0; color: #475569; font-size: 0.95rem;">${item.summary || item.body.slice(0, 160)}...</p>
        </div>
      `).join('');
    }
  } catch (err) {
    container.innerHTML = '<p style="color: #ef4444;">Unable to load public bulletins.</p>';
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
      document.getElementById('volunteer-form').reset();
    } else {
      throw new Error(data.error || 'Failed to submit application');
    }
  } catch (err) {
    alertEl.innerText = err.message;
    alertEl.className = 'alert alert-error';
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
      renderAuthenticatedState();
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
}

// HR Actions: Load Applications, Review & Accept
async function loadHRRoster() {
  const token = localStorage.getItem('shiplens_token');

  // 1. Load pending applications
  const appsTbody = document.querySelector('#hr-applications-table tbody');
  if (appsTbody) {
    try {
      const appsRes = await fetch('/applications?status=APPLIED', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (appsRes.ok) {
        const applications = await safeJson(appsRes);
        if (applications.length === 0) {
          appsTbody.innerHTML = '<tr><td colspan="5" class="text-center">No pending applications in queue.</td></tr>';
        } else {
          appsTbody.innerHTML = applications.map((a) => `
            <tr>
              <td><strong>${a.full_name}</strong></td>
              <td>${a.email}</td>
              <td>${a.phone}</td>
              <td>${a.preferred_branch_name || 'Unassigned'}</td>
              <td>
                <button class="btn btn-primary" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick="reviewApplication('${a.id}', 'ACCEPTED', '${a.preferred_branch_id || ''}')">Accept & Mint</button>
                <button class="btn btn-outline" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick="reviewApplication('${a.id}', 'DECLINED')">Decline</button>
              </td>
            </tr>
          `).join('');
        }
      }
    } catch (err) {
      console.error('Failed to load applications:', err);
    }
  }

  // 2. Load active members
  const rosterTbody = document.querySelector('#hr-roster-table tbody');
  if (rosterTbody) {
    try {
      const membersRes = await fetch('/members', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (membersRes.ok) {
        const members = await safeJson(membersRes);
        if (members.length === 0) {
          rosterTbody.innerHTML = '<tr><td colspan="5" class="text-center">No active members in roster.</td></tr>';
        } else {
          rosterTbody.innerHTML = members.map((m) => `
            <tr>
              <td><strong>${m.member_code}</strong></td>
              <td>${m.full_name}</td>
              <td>${m.branch_name || 'Assigned Branch'}</td>
              <td>${m.email} (${m.phone})</td>
              <td><span class="role-badge">${m.status}</span></td>
            </tr>
          `).join('');
        }
      }
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  }
}

async function reviewApplication(applicationId, status, preferredBranchId) {
  const token = localStorage.getItem('shiplens_token');
  try {
    const res = await fetch(`/applications/${applicationId}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        status,
        assignedBranchId: preferredBranchId || undefined
      })
    });

    const data = await safeJson(res);
    if (res.ok) {
      if (status === 'ACCEPTED') {
        alert(`Volunteer accepted! Atomic Member Code minted: ${data.member.member_code}`);
      } else {
        alert('Application marked as DECLINED.');
      }
      loadHRRoster();
    } else {
      alert(`Error: ${data.error || 'Review operation failed'}`);
    }
  } catch (err) {
    alert(`Network Error: ${err.message}`);
  }
}

// Branch Lead Actions: Collections & Weekly Reporting
async function handleRecordCollection(event) {
  event.preventDefault();
  const amountPkr = parseInt(document.getElementById('col-amount-pkr').value, 10);
  const amountPaisa = amountPkr * 100;
  const collectionDate = document.getElementById('col-date').value;

  try {
    const res = await fetch('/collections', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('shiplens_token')}`
      },
      body: JSON.stringify({
        branchId: currentUser.branchId,
        amountPaisa,
        collectionDate
      })
    });

    const data = await safeJson(res);
    if (res.ok) {
      alert(`Collection of PKR ${amountPkr.toLocaleString()} committed to Paisa ledger (${amountPaisa} paisa).`);
      event.target.reset();
    } else {
      alert(`Error: ${data.error}`);
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

async function handleCreateReport(event) {
  event.preventDefault();
  const startDate = document.getElementById('rep-start').value;
  const endDate = document.getElementById('rep-end').value;

  // Frontend guard: prevent inverted dates
  if (new Date(endDate) < new Date(startDate)) {
    alert('Validation Error: Week End Date cannot be earlier than Week Start Date.');
    return;
  }

  try {
    const res = await fetch('/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('shiplens_token')}`
      },
      body: JSON.stringify({
        branchId: currentUser.branchId,
        weekStartDate: startDate,
        weekEndDate: endDate,
        submissionNotes: document.getElementById('rep-notes').value
      })
    });

    const data = await safeJson(res);
    if (res.ok) {
      alert('Draft weekly report generated from collections.');
      loadBranchLeadReports();
      event.target.reset();
    } else {
      alert(`Error: ${data.error}`);
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

async function loadBranchLeadReports() {
  const tbody = document.querySelector('#branch-reports-table tbody');
  if (!tbody) return;

  try {
    const res = await fetch('/reports', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('shiplens_token')}` }
    });
    if (res.ok) {
      const reports = await safeJson(res);
      if (reports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No reports drafted yet.</td></tr>';
        return;
      }
      tbody.innerHTML = reports.map((r) => `
        <tr>
          <td>${formatDateDisplay(r.week_start_date)} to ${formatDateDisplay(r.week_end_date)}</td>
          <td>PKR ${(Number(r.total_amount_paisa) / 100).toLocaleString()}</td>
          <td><span class="role-badge">${r.status}</span></td>
          <td>
            ${r.status === 'DRAFT' || r.status === 'RETURNED' 
              ? `<button class="btn btn-primary" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick="submitReport('${r.id}')">Submit to HQ</button>` 
              : '<span style="color: #64748b; font-size: 0.85rem;">Locked / Under Review</span>'}
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load reports:', err);
  }
}

async function submitReport(id) {
  try {
    const res = await fetch(`/reports/${id}/submit`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('shiplens_token')}` }
    });
    const data = await safeJson(res);
    if (res.ok) {
      alert('Report submitted for central review.');
      loadBranchLeadReports();
    } else {
      alert(`Submission error: ${data.error}`);
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// Finance Reviewer Actions: Approve & Freeze Snapshots
async function loadFinanceQueue() {
  const tbody = document.querySelector('#finance-reports-table tbody');
  if (!tbody) return;

  try {
    const res = await fetch('/reports?status=SUBMITTED', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('shiplens_token')}` }
    });
    if (res.ok) {
      const reports = await safeJson(res);
      if (reports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No reports currently awaiting review.</td></tr>';
        return;
      }
      tbody.innerHTML = reports.map((r) => `
        <tr>
          <td><code>${r.id.slice(0, 8)}...</code></td>
          <td>${formatDateDisplay(r.week_start_date)} to ${formatDateDisplay(r.week_end_date)}</td>
          <td>PKR ${(Number(r.total_amount_paisa) / 100).toLocaleString()}</td>
          <td><span class="role-badge">${r.status}</span></td>
          <td>
            <button class="btn btn-primary" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick="approveReport('${r.id}')">Approve & Freeze</button>
            <button class="btn btn-outline" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick="returnReport('${r.id}')">Return</button>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load finance queue:', err);
  }
}

async function approveReport(id) {
  try {
    const res = await fetch(`/reports/${id}/approve`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('shiplens_token')}` }
    });
    const data = await safeJson(res);
    if (res.ok) {
      alert('Report approved. Weekly collections locked and frozen metrics snapshot generated.');
      loadFinanceQueue();
    } else {
      alert(`Approval error: ${data.error}`);
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

async function returnReport(id) {
  const reason = prompt('Enter rejection / clarification notes for the branch lead:');
  if (!reason) return;

  try {
    const res = await fetch(`/reports/${id}/return`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('shiplens_token')}`
      },
      body: JSON.stringify({ rejectionReason: reason })
    });

    const data = await safeJson(res);
    if (res.ok) {
      alert('Report returned to branch lead.');
      loadFinanceQueue();
    } else {
      alert(`Error: ${data.error}`);
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// Download formula-sanitized reports CSV
function exportReportsCsv() {
  const token = localStorage.getItem('shiplens_token');
  fetch('/reports/export/csv', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
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
  })
  .catch((err) => alert(err.message));
}

// Initial bootstrap
window.addEventListener('DOMContentLoaded', () => {
  fetchBranches();

  // Attach datepicker auto-calculation listeners for weekly reports
  const repStart = document.getElementById('rep-start');
  const repEnd = document.getElementById('rep-end');

  if (repStart && repEnd) {
    repStart.addEventListener('change', () => {
      if (!repStart.value) return;

      const [year, month, day] = repStart.value.split('-').map(Number);
      const start = new Date(year, month - 1, day);

      // Auto-set end date to the following Sunday (+6 days)
      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      const endYear = end.getFullYear();
      const endMonth = String(end.getMonth() + 1).padStart(2, '0');
      const endDay = String(end.getDate()).padStart(2, '0');

      repEnd.value = `${endYear}-${endMonth}-${endDay}`;
      repEnd.min = repStart.value; // Prevent user from picking an earlier date
    });
  }

  // Handle direct hash navigation (#about, #branches, etc.)
  const currentHash = window.location.hash.replace('#', '') || 'home';
  navigateTo(currentHash);

  const token = localStorage.getItem('shiplens_token');
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      currentUser = payload;
      renderAuthenticatedState();
    } catch {
      localStorage.removeItem('shiplens_token');
    }
  }
});