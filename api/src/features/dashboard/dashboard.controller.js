import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { OPEN_STATUSES, DONE_STATUSES } from '../tickets/ticket.service.js';

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

// GET /api/dashboard/stats  (managers only)
export const getStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const since7 = daysAgo(7);

  const [
    openCount,
    resolved7d,
    breaches,
    byStatusRaw,
    byPriorityRaw,
    byCategoryRaw,
    doneTickets,
    createdRecent,
    staff,
  ] = await Promise.all([
    prisma.ticket.count({ where: { status: { in: OPEN_STATUSES } } }),
    prisma.ticket.count({ where: { status: { in: DONE_STATUSES }, updatedAt: { gte: since7 } } }),
    prisma.ticket.count({
      where: { status: { in: OPEN_STATUSES }, slaDueAt: { lt: now } },
    }),
    prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.ticket.groupBy({ by: ['priority'], _count: { _all: true } }),
    prisma.ticket.groupBy({ by: ['categoryId'], _count: { _all: true } }),
    // For average resolution time (approx: updatedAt - createdAt for done tickets).
    prisma.ticket.findMany({
      where: { status: { in: DONE_STATUSES } },
      select: { createdAt: true, updatedAt: true },
    }),
    // Created in the last 7 days, for the daily trend.
    prisma.ticket.findMany({
      where: { createdAt: { gte: since7 } },
      select: { createdAt: true },
    }),
    prisma.user.findMany({
      where: { isActive: true, role: { in: ['DEVELOPER', 'ADMIN', 'SUPER_ADMIN'] } },
      select: { id: true, name: true, role: true, department: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  // Average resolution time in hours.
  let avgResolutionHours = 0;
  if (doneTickets.length) {
    const totalMs = doneTickets.reduce((s, t) => s + (t.updatedAt - t.createdAt), 0);
    avgResolutionHours = +(totalMs / doneTickets.length / 3_600_000).toFixed(1);
  }

  // Daily created counts for the last 7 days (oldest -> newest).
  const trend = [];
  for (let i = 6; i >= 0; i--) {
    const day = daysAgo(i);
    const key = day.toISOString().slice(0, 10);
    trend.push({
      date: key,
      label: day.toLocaleDateString('en-US', { weekday: 'short' }),
      count: 0,
    });
  }
  const trendIndex = Object.fromEntries(trend.map((d, i) => [d.date, i]));
  for (const t of createdRecent) {
    const key = t.createdAt.toISOString().slice(0, 10);
    if (key in trendIndex) trend[trendIndex[key]].count += 1;
  }

  // Category names.
  const categories = await prisma.category.findMany({ select: { id: true, name: true } });
  const catName = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const byCategory = byCategoryRaw.map((r) => ({
    name: r.categoryId ? catName[r.categoryId] || 'Unknown' : 'Uncategorized',
    count: r._count._all,
  }));

  // Per-developer workload.
  const [activeByAssignee, resolvedByAssignee, breachByAssignee] = await Promise.all([
    prisma.ticket.groupBy({
      by: ['assigneeId'],
      where: { status: { in: OPEN_STATUSES }, assigneeId: { not: null } },
      _count: { _all: true },
    }),
    prisma.ticket.groupBy({
      by: ['assigneeId'],
      where: { status: { in: DONE_STATUSES }, updatedAt: { gte: since7 }, assigneeId: { not: null } },
      _count: { _all: true },
    }),
    prisma.ticket.groupBy({
      by: ['assigneeId'],
      where: { status: { in: OPEN_STATUSES }, slaDueAt: { lt: now }, assigneeId: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const toMap = (rows) => Object.fromEntries(rows.map((r) => [r.assigneeId, r._count._all]));
  const activeMap = toMap(activeByAssignee);
  const resolvedMap = toMap(resolvedByAssignee);
  const breachMap = toMap(breachByAssignee);

  const workload = staff.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    department: u.department,
    active: activeMap[u.id] || 0,
    resolved7d: resolvedMap[u.id] || 0,
    breaches: breachMap[u.id] || 0,
  }));

  res.json({
    kpis: {
      open: openCount,
      resolved7d,
      avgResolutionHours,
      slaBreaches: breaches,
    },
    byStatus: byStatusRaw.map((r) => ({ status: r.status, count: r._count._all })),
    byPriority: byPriorityRaw.map((r) => ({ priority: r.priority, count: r._count._all })),
    byCategory,
    trend,
    workload,
  });
});

// GET /api/dashboard/export  (managers only) — CSV of all tickets
export const exportTickets = asyncHandler(async (req, res) => {
  const tickets = await prisma.ticket.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      category: { select: { name: true } },
      requester: { select: { name: true } },
      assignee: { select: { name: true } },
    },
  });

  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['Key', 'Title', 'Status', 'Priority', 'Category', 'Requester', 'Assignee', 'Created', 'SLA Due'];
  const rows = tickets.map((t) => [
    t.key, t.title, t.status, t.priority,
    t.category?.name || '', t.requester?.name || '', t.assignee?.name || '',
    t.createdAt.toISOString(), t.slaDueAt ? t.slaDueAt.toISOString() : '',
  ].map(esc).join(','));

  const csv = [header.join(','), ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="tickets-${Date.now()}.csv"`);
  res.send(csv);
});
