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

function toggleLanguage() {
  currentLang = currentLang === 'en' ? 'ur' : 'en';
  document.documentElement.setAttribute('lang', currentLang);
  document.documentElement.setAttribute('dir', currentLang === 'ur' ? 'rtl' : 'ltr');
  document.getElementById('lang-label').innerText = i18n[currentLang].lang_toggle_text;

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
    }
  } catch (e) {
    console.error('Error loading branches:', e);
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
  try {
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
          <td>${r.week_start_date} to ${r.week_end_date}</td>
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
          <td>${r.week_start_date} to ${r.week_end_date}</td>
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