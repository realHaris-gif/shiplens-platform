# ShipLens Enterprise — Decentralized Governance & Financial Auditing Platform

> **Live Deployment URL:** [https://shiplens-platform.onrender.com](https://shiplens-platform.onrender.com)  
> **Challenge:** EchoLens Digital Challenge #01  
> **Status:** Production-Ready & Compliant with Challenge Handbook  

ShipLens is an operational, governance, and financial auditing platform engineered to transition distributed non-profit organizations from vulnerable, decentralized spreadsheets to centralized, auditable, and immutable accounting ledgers.

---

## Key Platform Features

- **Paisa-Precision Integer Accounting:** Strictly eliminates IEEE 754 floating-point rounding errors by storing all currency values in whole integer paisa (`1 PKR = 100 Paisa`).
- **7-Day Collection Locking Rule:** Physical collections cannot be modified or altered once 7 days have elapsed from creation or once approved.
- **Strict 7-Day Monday–Sunday Weekly Reports:** Enforces automated start-to-end date calculation and rejects inverted date submissions.
- **Append-Only Immutable Audit Trail:** Database triggers prevent any `UPDATE` or `DELETE` mutations on audit log tables.
- **Atomic Member Code Minting:** HR intake pipeline mints sequential identifiers (`MEM-1000` series) atomically within database transactions.
- **Formula-Sanitized CSV Exports:** Protects administrative reviewers from CSV formula injection by neutralizing dangerous prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`).
- **Dual-Language Urdu/English UI:** Native RTL typography using `Noto Nastaliq Urdu` with mirrored layout mechanics.
- **7 Mandatory Public Pages:** Fully navigable Single Page Architecture covering Home, About, Programs, Branches, Events, Get Involved, and Contact.

---

## Evaluation Test Credentials

Log in using the **Portal Login** interface with the following test credentials:

| Role | Email Address | Password | Branch Scope |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@shiplens.org` | `Password123!` | Nationwide / Central HQ |
| **Finance Reviewer** | `finance@shiplens.org` | `Password123!` | Nationwide Auditing |
| **HR Lead** | `hr@shiplens.org` | `Password123!` | Nationwide Intake |
| **Branch Lead (Lahore)** | `lead.lahore@shiplens.org` | `Password123!` | Lahore Branch (`LHE-01`) |
| **Branch Lead (Karachi)** | `lead.karachi@shiplens.org` | `Password123!` | Karachi Branch (`KHI-01`) |
| **Content Editor** | `editor@shiplens.org` | `Password123!` | Public CMS & Bulletins |

---

## Architecture and Technology Stack

- **Backend:** Node.js 20, Express, TypeScript
- **Database:** PostgreSQL 16 with UUID and Triggers
- **Authentication:** JWT (JSON Web Tokens) with Role-Based Access Control (RBAC) and HTTP-only cookies
- **Frontend:** Vanilla TypeScript/JavaScript SPA, semantic HTML5, CSS custom properties, RTL support
- **DevOps & CI/CD:** GitHub Actions with PostgreSQL 16 container, multi-stage Docker build, deployed on Render

---

##  Local Quickstart Guide

### Prerequisites
- Node.js 20.x
- PostgreSQL 15+ (or Docker)

### 1. Clone & Install
```bash
git clone [https://github.com/realHaris-gif/ShipLens.git](https://github.com/realHaris-gif/ShipLens.git)
cd ShipLens
npm install