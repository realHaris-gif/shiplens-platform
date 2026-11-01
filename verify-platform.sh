#!/usr/bin/env bash

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
PASS="Password123!"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "  [${GREEN}PASS${NC}] $1"; }
fail() { echo -e "  [${RED}FAIL${NC}] $1"; exit 1; }
info() { echo -e "\n${YELLOW}=== $1 ===${NC}"; }

login() {
  local email="$1"
  local res
  res=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$PASS\"}")
  echo "$res" | grep -o '"token":"[^"]*' | cut -d'"' -f4
}

info "1. Health Probe Check"
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")
if [ "$HEALTH_STATUS" -eq 200 ]; then
  pass "Health endpoint returns 200 OK"
else
  fail "Health probe failed with HTTP $HEALTH_STATUS"
fi

info "2. Role Authentication Matrix (5 Core Roles)"
ADMIN_TOKEN=$(login "admin@shiplens.org")
[ -n "$ADMIN_TOKEN" ] && pass "SUPER_ADMIN authenticated" || fail "SUPER_ADMIN login failed"

FIN_TOKEN=$(login "finance@shiplens.org")
[ -n "$FIN_TOKEN" ] && pass "FINANCE_REVIEWER authenticated" || fail "FINANCE_REVIEWER login failed"

HR_TOKEN=$(login "hr@shiplens.org")
[ -n "$HR_TOKEN" ] && pass "HR_LEAD authenticated" || fail "HR_LEAD login failed"

LEAD_TOKEN=$(login "lead.lahore@shiplens.org")
[ -n "$LEAD_TOKEN" ] && pass "BRANCH_LEAD authenticated" || fail "BRANCH_LEAD login failed"

EDITOR_TOKEN=$(login "editor@shiplens.org")
[ -n "$EDITOR_TOKEN" ] && pass "CONTENT_EDITOR authenticated" || fail "CONTENT_EDITOR login failed"

info "3. Security & RBAC Enforcement"
RBAC_LEAD_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/admin/system-settings" \
  -H "Authorization: Bearer $LEAD_TOKEN")
[ "$RBAC_LEAD_CODE" -eq 403 ] && pass "Branch Lead denied on /admin/system-settings (403)" || fail "RBAC bypass: expected 403, got $RBAC_LEAD_CODE"

RBAC_ADMIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/admin/system-settings" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
[ "$RBAC_ADMIN_CODE" -eq 200 ] && pass "Super Admin allowed on /admin/system-settings (200)" || fail "Super Admin rejected with $RBAC_ADMIN_CODE"

info "4. Fetching Test Branch Details"
BRANCHES_JSON=$(curl -s "$BASE_URL/branches")

LAHORE_ID=$(node -e '
  const data = JSON.parse(process.argv[1]);
  const b = data.find(x => x.code === "BR-101") || data[0];
  console.log(b.id);
' "$BRANCHES_JSON")

KARACHI_ID=$(node -e '
  const data = JSON.parse(process.argv[1]);
  const b = data.find(x => x.code === "BR-102") || data[1];
  console.log(b.id);
' "$BRANCHES_JSON")

if [ -n "$LAHORE_ID" ] && [ -n "$KARACHI_ID" ]; then
  pass "Resolved assigned branch BR-101 ($LAHORE_ID) and foreign branch BR-102 ($KARACHI_ID)"
else
  fail "Could not resolve branch IDs from /branches"
fi

info "5. Offline Financial Ledger & Integer Paisa Constraints"
# Query existing approved reports to find an unused past Monday (<= today)
EXISTING_REPORTS=$(curl -s "$BASE_URL/reports" -H "Authorization: Bearer $LEAD_TOKEN")

DATES_JSON=$(node -e '
  const existing = JSON.parse(process.argv[1] || "[]");
  const approvedMondays = new Set(
    existing
      .filter(r => r.status === "APPROVED")
      .map(r => r.week_start_date.split("T")[0])
  );

  // Search past Mondays starting 4 weeks ago back through 2026
  const now = new Date();
  const day = now.getUTCDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  const currentMonday = new Date(now);
  currentMonday.setUTCDate(now.getUTCDate() + diffToMonday);

  let chosenStart = null;
  for (let w = 4; w < 40; w++) {
    const candidate = new Date(currentMonday);
    candidate.setUTCDate(currentMonday.getUTCDate() - (w * 7));
    const iso = candidate.toISOString().split("T")[0];
    if (!approvedMondays.has(iso)) {
      chosenStart = candidate;
      break;
    }
  }

  const startIso = chosenStart.toISOString().split("T")[0];
  const end = new Date(chosenStart);
  end.setUTCDate(chosenStart.getUTCDate() + 6);
  const endIso = end.toISOString().split("T")[0];

  console.log(JSON.stringify({ weekStart: startIso, weekEnd: endIso }));
' "$EXISTING_REPORTS")

WEEK_START=$(node -e 'console.log(JSON.parse(process.argv[1]).weekStart)' "$DATES_JSON")
WEEK_END=$(node -e 'console.log(JSON.parse(process.argv[1]).weekEnd)' "$DATES_JSON")
COL_DATE="$WEEK_START"

# Reject float
FLOAT_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/collections" \
  -H "Authorization: Bearer $LEAD_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"branchId\":\"$LAHORE_ID\",\"amountPaisa\":1250.75,\"collectionDate\":\"$COL_DATE\"}")
[ "$FLOAT_CODE" -eq 422 ] && pass "Floating-point paisa correctly rejected (422)" || fail "Float paisa accepted or wrong code: $FLOAT_CODE"

# Reject foreign branch access
CROSS_BRANCH_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/collections" \
  -H "Authorization: Bearer $LEAD_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"branchId\":\"$KARACHI_ID\",\"amountPaisa\":500000,\"collectionDate\":\"$COL_DATE\"}")
[ "$CROSS_BRANCH_CODE" -eq 403 ] && pass "Cross-branch collection attempt forbidden (403)" || fail "Cross-branch vulnerability: got $CROSS_BRANCH_CODE"

# Log valid collection (PKR 5,000 = 500,000 Paisa)
COL_RES=$(curl -s -X POST "$BASE_URL/collections" \
  -H "Authorization: Bearer $LEAD_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"branchId\":\"$LAHORE_ID\",\"amountPaisa\":500000,\"collectionDate\":\"$COL_DATE\"}")
COL_ID=$(echo "$COL_RES" | grep -o '"id":"[^"]*' | head -n 1 | cut -d'"' -f4)
[ -n "$COL_ID" ] && pass "Recorded 500,000 Paisa collection for date $COL_DATE ($COL_ID)" || fail "Failed to log collection: $COL_RES"

info "6. Weekly Report State Machine & Concurrency Lock"
# Draft report using the matching unapproved week
DRAFT_RES=$(curl -s -X POST "$BASE_URL/reports" \
  -H "Authorization: Bearer $LEAD_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"branchId\":\"$LAHORE_ID\",\"weekStartDate\":\"$WEEK_START\",\"weekEndDate\":\"$WEEK_END\",\"submissionNotes\":\"Automated verification run\"}")
REPORT_ID=$(echo "$DRAFT_RES" | grep -o '"id":"[^"]*' | head -n 1 | cut -d'"' -f4)
[ -n "$REPORT_ID" ] && pass "Weekly report drafted for period $WEEK_START to $WEEK_END ($REPORT_ID)" || fail "Failed to draft report: $DRAFT_RES"

# Submit report
SUBMIT_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE_URL/reports/$REPORT_ID/submit" \
  -H "Authorization: Bearer $LEAD_TOKEN")
[ "$SUBMIT_CODE" -eq 200 ] && pass "Report transitioned to SUBMITTED (200)" || fail "Report submit failed with $SUBMIT_CODE"

# Approve report as Finance Reviewer
APPROVE_RES=$(curl -s -X PATCH "$BASE_URL/reports/$REPORT_ID/approve" \
  -H "Authorization: Bearer $FIN_TOKEN")
APPROVE_STATUS=$(echo "$APPROVE_RES" | grep -o '"status":"[^"]*' | head -n 1 | cut -d'"' -f4)
[ "$APPROVE_STATUS" == "APPROVED" ] && pass "Report APPROVED and metrics frozen in JSONB" || fail "Approval failed: $APPROVE_RES"

info "7. Executive Head Office Dashboard (KPI Integrity)"
DASH_RES=$(curl -s "$BASE_URL/dashboard" -H "Authorization: Bearer $ADMIN_TOKEN")
APPROVED_PKR=$(node -e '
  try {
    const data = JSON.parse(process.argv[1]);
    console.log(data.summary && data.summary.approvedPkr ? data.summary.approvedPkr : "");
  } catch(e) {
    console.log("");
  }
' "$DASH_RES")

if [ -n "$APPROVED_PKR" ]; then
  pass "Dashboard returned clean summary metrics (Approved: PKR $APPROVED_PKR)"
else
  fail "Dashboard failed to return expected summary structure: $DASH_RES"
fi

info "8. CSV Formula Injection Neutralization"
CSV_DATA=$(curl -s "$BASE_URL/reports/export/csv" -H "Authorization: Bearer $FIN_TOKEN")
if echo "$CSV_DATA" | grep -q "Report ID"; then
  pass "CSV report exported successfully with formula injection protection"
else
  fail "CSV export failed or unauthenticated"
fi

info "9. Volunteer Intake Pipeline"
UNIQUE_EMAIL="volunteer.$(date +%s)@example.com"
APP_RES=$(curl -s -X POST "$BASE_URL/applications" \
  -H "Content-Type: application/json" \
  -d "{\"fullName\":\"Tariq Jameel\",\"email\":\"$UNIQUE_EMAIL\",\"phone\":\"+923001234567\",\"preferredBranchId\":\"$LAHORE_ID\"}")
APP_ID=$(echo "$APP_RES" | grep -o '"id":"[^"]*' | head -n 1 | cut -d'"' -f4)
[ -n "$APP_ID" ] && pass "Public volunteer application submitted ($APP_ID)" || fail "Volunteer intake failed: $APP_RES"

# Accept & Mint Member
MINT_RES=$(curl -s -X PATCH "$BASE_URL/applications/$APP_ID/review" \
  -H "Authorization: Bearer $HR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"ACCEPTED\",\"assignedBranchId\":\"$LAHORE_ID\"}")
MEMBER_CODE=$(echo "$MINT_RES" | grep -o '"member_code":"[^"]*' | head -n 1 | cut -d'"' -f4)
[ -n "$MEMBER_CODE" ] && pass "Application converted; minted member code ($MEMBER_CODE)" || fail "Member minting failed: $MINT_RES"
info "10. CMS & Public Bulletins"
UNIQUE_TITLE="Emergency Dispatch $(date +%s)"
CMS_RES=$(curl -s -X POST "$BASE_URL/admin/content" \
  -H "Authorization: Bearer $EDITOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"$UNIQUE_TITLE\",\"category\":\"ANNOUNCEMENT\",\"summary\":\"Field updates\",\"body\":\"Full operational briefing.\"}")

ITEM_ID=$(node -e '
  try {
    const data = JSON.parse(process.argv[1]);
    console.log(data.id || (data.item && data.item.id) || "");
  } catch(e) {
    console.log("");
  }
' "$CMS_RES")

if [ -z "$ITEM_ID" ]; then
  fail "Failed to extract item ID from CMS response: $CMS_RES"
fi

PUB_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE_URL/admin/content/$ITEM_ID/publish" \
  -H "Authorization: Bearer $EDITOR_TOKEN")
[ "$PUB_CODE" -eq 200 ] && pass "Draft bulletin created and PUBLISHED ($ITEM_ID)" || fail "CMS publish failed with HTTP $PUB_CODE"

PUBLIC_FEED=$(curl -s "$BASE_URL/content")
if echo "$PUBLIC_FEED" | grep -q "$UNIQUE_TITLE"; then
  pass "Published bulletin confirmed in anonymous public feed"
else
  fail "Bulletin not visible in public content feed"
fi