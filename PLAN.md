# Tracking System — Project Plan

A Jira-style ticketing platform for university management. Customers (students/faculty/staff)
raise tickets, Admins triage and assign them to Developers, and every ticket follows a full
lifecycle from creation to closure.

> **Access policy:** There is **no public sign-up**. Only the **Super Admin** creates
> accounts and assigns each user a role. The login screen is sign-in only.

---

## 1. Tech Stack

| Layer        | Technology                                              |
|--------------|---------------------------------------------------------|
| Frontend     | React (Vite) + React Router + TanStack Query + Tailwind |
| State/Forms  | Zustand (light global state) + React Hook Form + Zod    |
| Backend      | Node.js + Express (REST API)                             |
| Database     | PostgreSQL + Prisma ORM                                  |
| Auth         | JWT (access + refresh) + bcrypt, role-based guards       |
| Email        | Nodemailer (SMTP) + queue (BullMQ/Redis, optional)      |
| File uploads | Multer + local disk (S3-compatible later)               |
| Realtime     | Socket.IO (live board + notifications) — phase 2         |
| Charts       | Recharts (dashboards)                                    |
| Deploy       | Docker Compose (api + web + postgres)                    |

---

## 2. User Roles & Permissions

| Capability                         | Customer | Developer | Admin/Manager | Super Admin |
|------------------------------------|:--------:|:---------:|:-------------:|:-----------:|
| Raise a ticket                     |    ✅    |    ✅     |      ✅       |     ✅      |
| View own tickets                   |    ✅    |    ✅     |      ✅       |     ✅      |
| View all tickets                   |    ❌    |  team only |     ✅       |     ✅      |
| Comment on tickets                 |    ✅    |    ✅     |      ✅       |     ✅      |
| Assign / reassign ticket           |    ❌    |    ❌     |      ✅       |     ✅      |
| Change status / priority           |    ❌    |  assigned |     ✅       |     ✅      |
| Create accounts & assign roles     |    ❌    |    ❌     |      ❌       |     ✅      |
| Manage users (enable/disable/edit) |    ❌    |    ❌     |      ❌       |     ✅      |
| Configure categories / SLA / system|    ❌    |    ❌     |   limited     |     ✅      |
| View dashboards & reports          |  own     |   own     |     ✅       |     ✅      |
| Audit logs                         |    ❌    |    ❌     |      ❌       |     ✅      |

---

## 3. Ticket Lifecycle (Jira-style)

```
  NEW ──► OPEN ──► IN PROGRESS ──► IN REVIEW ──► RESOLVED ──► CLOSED
   │        │           │                            │
   │        └───────────┴──────────► ON HOLD ────────┘
   │
   └──► REJECTED (invalid/duplicate)        REOPENED ◄── (from Closed)
```

- **New** – just submitted by a customer, awaiting triage.
- **Open** – triaged & accepted, ready to be assigned.
- **In Progress** – a developer is actively working on it.
- **On Hold** – blocked / waiting on requester or third party.
- **In Review** – work done, pending verification by admin/requester.
- **Resolved** – fix confirmed, awaiting auto-close window.
- **Closed** – completed.
- **Rejected** – invalid, duplicate, or out of scope.
- **Reopened** – customer not satisfied; goes back into the flow.

Each transition is recorded in an **activity timeline** (who, what, when) — the audit trail.

---

## 4. Core Data Model

```
User            id, name, email, password_hash, role, department, avatar, is_active
Ticket          id, key (e.g. UNIV-101), title, description, status, priority,
                category_id, requester_id, assignee_id, sla_due_at, created_at, updated_at
Category        id, name, default_team, default_sla_hours        (e.g. IT, Hostel, Exams)
Comment         id, ticket_id, author_id, body, is_internal, created_at
Attachment      id, ticket_id, comment_id?, file_name, file_path, uploaded_by
Activity        id, ticket_id, actor_id, type, from_value, to_value, created_at
Notification    id, user_id, ticket_id, type, message, is_read, created_at
SLA / Priority  priority (Low/Medium/High/Urgent) → response & resolution targets
```

- **Ticket key**: human-friendly auto ID like `UNIV-101` for easy reference.
- **Priority**: Low / Medium / High / Urgent — drives SLA timers and board sorting.

---

## 5. Key Screens

1. **Login** – sign-in only (no public registration).
2. **Customer Portal** – "My Tickets" list + "Raise a Ticket" form.
3. **Ticket Detail** – description, status, assignee, activity timeline, comments, attachments.
4. **Kanban Board** – drag-and-drop columns by status (Admin/Developer).
5. **Admin Dashboard** – KPIs, charts, SLA breaches, ticket queue.
6. **User Management** – CRUD users, assign roles (Super Admin).
7. **Settings** – categories, priorities, SLA policies, email templates.

> Visual mockups for all of these are in **`mockups.html`** — open it in any browser.

---

## 6. REST API (sketch)

```
POST   /api/auth/login              POST   /api/auth/refresh      POST /api/auth/logout
GET    /api/tickets                 GET    /api/tickets/:id       POST /api/tickets
PATCH  /api/tickets/:id             PATCH  /api/tickets/:id/assign
PATCH  /api/tickets/:id/status      GET    /api/tickets/:id/activity
POST   /api/tickets/:id/comments    POST   /api/tickets/:id/attachments
GET    /api/users   POST /api/users   PATCH /api/users/:id        (Super Admin only)
GET    /api/categories  /api/dashboard/stats   /api/notifications
```
> Note: no `/auth/register` endpoint — accounts are created via `POST /api/users`
> by the Super Admin, who sets the role. New users get a temporary password / invite email.

---

## 7. Delivery Roadmap

### Phase 0 — Foundation (week 1)
- Repo scaffold (monorepo: `/api`, `/web`), Docker Compose, Postgres + Prisma schema.
- Auth: login only (no public register), JWT, role middleware, seed a Super Admin account.
- Super Admin "Create User" flow (assign role) — the only way accounts are created.

### Phase 1 — Core Ticketing (weeks 2–3)
- Raise ticket, ticket list with filters, ticket detail page.
- Comments + attachments, activity timeline, status & priority changes.
- Assignment & reassignment (Admin).

### Phase 2 — Board & Notifications (week 4)
- Kanban board with drag-and-drop status transitions.
- Email notifications (assignment, status change, new comment).
- In-app notification bell.

### Phase 3 — Dashboards & Reports (week 5)
- Admin dashboard KPIs + Recharts (by status, priority, category, SLA breaches).
- CSV export, per-developer workload report.

### Phase 4 — Polish & Deploy (week 6)
- User management & settings (categories, SLA), audit log view.
- Permissions hardening, responsive UI, seed/demo data, deploy.

---

## 8. Folder Structure (planned)

```
issuetracker/
├─ docker-compose.yml
├─ api/
│  ├─ prisma/schema.prisma
│  └─ src/{routes,controllers,services,middleware,utils,index.js}
└─ web/
   └─ src/{pages,components,features,hooks,api,store,App.jsx}
```

---

## 9. Next Step

Approve this plan (and the mockups) and I'll scaffold **Phase 0**: the monorepo,
Docker Compose, Postgres + Prisma schema, and a working auth flow with seeded role accounts.
