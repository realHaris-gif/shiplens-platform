// State
let currentLang = 'en';
let currentUser = null;
let branches = [];

// Bilingual dictionary
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

function toggleLanguage() {
  currentLang = currentLang === 'en' ? 'ur' : 'en';
  document.documentElement.setAttribute('lang', currentLang);
  document.documentElement.setAttribute('dir', currentLang === 'ur' ? 'rtl' : 'ltr');
  document.getElementById('lang-label').innerText = i18n[currentLang].lang_toggle_text;

  // Apply translations
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

// Fetch active branches for dropdown
async function fetchBranches() {
  try {
    const res = await fetch('/branches');
    if (res.ok) {
      branches = await res.json();
      const select = document.getElementById('preferredBranch');
      select.innerHTML = `<option value="" disabled selected>${i18n[currentLang].opt_select_branch}</option>`;
      branches.forEach((b) => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.innerText = `${b.name} (${b.city}) [${b.code}]`;
        select.appendChild(opt);
      });
    }
  } catch (e) {
    console.error('Error loading branches:', e);
  }
}

// Handle volunteer application
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

    const data = await res.json();

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

    const data = await res.json();

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

  // Route to role-specific dashboard
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
      showView('public-view');
  }
}

function logout() {
  currentUser = null;
  localStorage.removeItem('shiplens_token');
  document.getElementById('user-profile').classList.add('hidden');
  document.getElementById('auth-buttons').classList.remove('hidden');
  showView('public-view');
}

// Branch lead actions
async function handleRecordCollection(event) {
  event.preventDefault();
  const amountPkr = parseInt(document.getElementById('col-amount-pkr').value, 10);
  const amountPaisa = amountPkr * 100; // Integer arithmetic
  const collectionDate = document.getElementById('col-date').value;

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

  if (res.ok) {
    alert('Collection recorded in Paisa ledger.');
    event.target.reset();
  } else {
    const err = await res.json();
    alert(`Error: ${err.error}`);
  }
}

async function handleCreateReport(event) {
  event.preventDefault();
  const res = await fetch('/reports', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('shiplens_token')}`
    },
    body: JSON.stringify({
      branchId: currentUser.branchId,
      weekStartDate: document.getElementById('rep-start').value,
      weekEndDate: document.getElementById('rep-end').value,
      submissionNotes: document.getElementById('rep-notes').value
    })
  });

  if (res.ok) {
    alert('Draft report generated.');
    loadBranchLeadReports();
    event.target.reset();
  } else {
    const err = await res.json();
    alert(`Error: ${err.error}`);
  }
}

async function loadBranchLeadReports() {
  const tbody = document.querySelector('#branch-reports-table tbody');
  const res = await fetch('/reports', {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('shiplens_token')}` }
  });
  if (res.ok) {
    const reports = await res.json();
    if (reports.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center">No reports drafted yet.</td></tr>';
      return;
    }
    tbody.innerHTML = reports.map((r) => `
      <tr>
        <td>${r.week_start_date} to ${r.week_end_date}</td>
        <td>PKR ${(Number(r.total_amount_paisa) / 100).toLocaleString()}</td>
        <td><span class="role-badge">${r.status}</span></td>
        <td>
          ${r.status === 'DRAFT' || r.status === 'RETURNED' ? `<button class="btn btn-outline" onclick="submitReport('${r.id}')">Submit to HQ</button>` : 'Locked'}
        </td>
      </tr>
    `).join('');
  }
}

async function submitReport(id) {
  const res = await fetch(`/reports/${id}/submit`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${localStorage.getItem('shiplens_token')}` }
  });
  if (res.ok) {
    alert('Report submitted for central review.');
    loadBranchLeadReports();
  }
}

async function loadHRRoster() {
  const tbody = document.querySelector('#hr-roster-table tbody');
  const res = await fetch('/members', {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('shiplens_token')}` }
  });
  if (res.ok) {
    const members = await res.json();
    tbody.innerHTML = members.map((m) => `
      <tr>
        <td><strong>${m.member_code}</strong></td>
        <td>${m.full_name}</td>
        <td>${m.branch_name}</td>
        <td>${m.email}</td>
        <td><span class="role-badge">${m.status}</span></td>
      </tr>
    `).join('');
  }
}

async function loadFinanceQueue() {
  const tbody = document.querySelector('#finance-reports-table tbody');
  const res = await fetch('/reports?status=SUBMITTED', {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('shiplens_token')}` }
  });
  if (res.ok) {
    const reports = await res.json();
    if (reports.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">No reports currently awaiting review.</td></tr>';
      return;
    }
    tbody.innerHTML = reports.map((r) => `
      <tr>
        <td>${r.id.slice(0, 8)}...</td>
        <td>${r.week_start_date} to ${r.week_end_date}</td>
        <td>PKR ${(Number(r.total_amount_paisa) / 100).toLocaleString()}</td>
        <td><span class="role-badge">${r.status}</span></td>
        <td>
          <button class="btn btn-primary" onclick="approveReport('${r.id}')">Approve & Freeze</button>
        </td>
      </tr>
    `).join('');
  }
}

async function approveReport(id) {
  const res = await fetch(`/reports/${id}/approve`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${localStorage.getItem('shiplens_token')}` }
  });
  if (res.ok) {
    alert('Report approved. Collections locked and metrics snapshot frozen.');
    loadFinanceQueue();
  }
}

// Initial bootstrap
window.addEventListener('DOMContentLoaded', () => {
  fetchBranches();
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