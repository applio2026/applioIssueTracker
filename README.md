# Tracking System

A Jira-style ticketing platform for university management. Customers raise tickets, Admins
triage and assign them to Developers, and every ticket follows a full lifecycle from creation
to closure. See [PLAN.md](PLAN.md) for the full plan and [mockups.html](mockups.html) for the UI.

> **Access policy:** No public sign-up. Only the **Super Admin** creates accounts and assigns roles.

## Stack
- **web** — React (Vite) + React Router + TanStack Query + Tailwind
- **api** — Node.js + Express + Prisma
- **db**  — PostgreSQL

## Prerequisites
- Node.js 18+ and npm
- PostgreSQL running locally (or via `docker compose up db`)

## Setup

```bash
# 1. Install all workspaces
npm install

# 2. Configure the API environment
#    copy api/.env.example -> api/.env and set DATABASE_URL + secrets
cp api/.env.example api/.env

# 3. Create the database schema and seed the Super Admin
npm run db:migrate
npm run db:seed

# 4. Run both API and web together
npm run dev
```

- API:  http://localhost:4100
- Web:  http://localhost:5177

## Seeded login
After `npm run db:seed`:

| Role        | Email                  | Password     |
|-------------|------------------------|--------------|
| Super Admin | superadmin@university.edu | Admin@123 |

All other accounts are created from the **Users** screen by the Super Admin.

## Useful scripts
| Command             | What it does                          |
|---------------------|---------------------------------------|
| `npm run dev`       | Run API + web together                |
| `npm run db:migrate`| Apply Prisma migrations               |
| `npm run db:seed`   | Seed the Super Admin account          |
| `npm run db:studio` | Open Prisma Studio (DB browser)       |

## Run with Docker (full stack)
Requires Docker. Builds db + api + web; the API auto-migrates and seeds on boot.

```bash
docker compose up --build
# open http://localhost:8080  (Super Admin: superadmin@university.edu / Admin@123)
```

The web container (nginx) serves the built SPA and reverse-proxies `/api` to the API
container. Uploaded files and Postgres data persist in named volumes.
**Change the JWT secrets and Super Admin password in `docker-compose.yml` before any real use.**

## Features
- **Auth & roles** — login only (no public sign-up); Customer / Developer / Admin / Super Admin
- **User management** — Super Admin creates accounts and assigns roles
- **Tickets** — raise, list/filter, detail, Jira-style status lifecycle, priority, assignment, comments, activity timeline, **file attachments**
- **Kanban board** — drag-and-drop status changes (staff)
- **Notifications** — in-app bell + email (assignment / status / comments)
- **Dashboard** — KPIs, trend + status charts, developer workload, CSV export (managers)
- **Settings** — manage categories, default team, and SLA targets (Super Admin)
