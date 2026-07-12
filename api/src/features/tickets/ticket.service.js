import { prisma } from '../../lib/prisma.js';

// Priority multipliers applied to a category's default SLA hours.
const PRIORITY_SLA_FACTOR = {
  URGENT: 0.25,
  HIGH: 0.5,
  MEDIUM: 1,
  LOW: 2,
};

// Allowed status transitions (Jira-style lifecycle).
export const STATUS_TRANSITIONS = {
  NEW: ['OPEN', 'IN_PROGRESS', 'REJECTED'],
  OPEN: ['IN_PROGRESS', 'ON_HOLD', 'REJECTED'],
  IN_PROGRESS: ['ON_HOLD', 'IN_REVIEW', 'RESOLVED'],
  ON_HOLD: ['IN_PROGRESS', 'OPEN'],
  IN_REVIEW: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  REJECTED: ['REOPENED'],
  REOPENED: ['IN_PROGRESS', 'OPEN'],
};

export function canTransition(from, to) {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// Statuses that count as "still being worked on" vs. finished.
export const OPEN_STATUSES = ['NEW', 'OPEN', 'IN_PROGRESS', 'ON_HOLD', 'IN_REVIEW', 'REOPENED'];
export const DONE_STATUSES = ['RESOLVED', 'CLOSED'];

// Atomically increment the ticket counter and return a key like "UNIV-101".
export async function nextTicketKey(tx) {
  const counter = await tx.counter.upsert({
    where: { id: 'ticket' },
    update: { value: { increment: 1 } },
    create: { id: 'ticket', value: 101 },
  });
  return `UNIV-${counter.value}`;
}

export async function computeSlaDueAt(categoryId, priority, from = new Date()) {
  let baseHours = 48;
  if (categoryId) {
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (category) baseHours = category.defaultSlaHours;
  }
  const hours = baseHours * (PRIORITY_SLA_FACTOR[priority] ?? 1);
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}

// Manager = can do manager actions (assign, change any status, edit any ticket,
// see internal comments). Granted via the ADMIN/SUPER_ADMIN role or the
// per-user "canManageTickets" permission.
export const isManager = (u) =>
  u.role === 'ADMIN' || u.role === 'SUPER_ADMIN' || !!u.permissions?.canManageTickets;

// Category ids a user is department-scoped to. SUPER_ADMIN is never scoped.
const scopedCategoryIds = (user) =>
  user.role === 'SUPER_ADMIN' ? [] : user.allowedCategoryIds || [];

// Build a Prisma `where` clause scoped to what the user is allowed to see.
export function scopeWhereForUser(user) {
  const cats = scopedCategoryIds(user);
  const catFilter = cats.length ? { categoryId: { in: cats } } : null;

  if (user.role === 'SUPER_ADMIN') return {};

  // Managers see everything, or just their departments if scoped.
  if (isManager(user)) return catFilter || {};

  if (user.role === 'CUSTOMER') return { requesterId: user.id };

  // Everyone else: their own/assigned/sub-task tickets, plus any ticket in a
  // department they've been assigned to.
  const or = [
    { assigneeId: user.id },
    { requesterId: user.id },
    { subTasks: { some: { assigneeId: user.id } } },
  ];
  if (catFilter) or.push(catFilter);
  return { OR: or };
}

// True if the user may view/collaborate on the ticket. `ticket.subTasks`
// must be loaded (assigneeId is enough) for sub-task assignees to qualify.
export function canAccessTicket(user, ticket) {
  const cats = scopedCategoryIds(user);
  const inDept = cats.length > 0 && ticket.categoryId != null && cats.includes(ticket.categoryId);

  if (isManager(user)) {
    // A department-scoped manager only reaches tickets in their departments.
    return cats.length ? inDept : true;
  }
  return (
    ticket.requesterId === user.id ||
    ticket.assigneeId === user.id ||
    (ticket.subTasks?.some((s) => s.assigneeId === user.id) ?? false) ||
    inDept
  );
}

// Watcher user ids for notification fan-out.
export async function watcherIds(ticketId) {
  const rows = await prisma.ticketWatcher.findMany({
    where: { ticketId },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

export const ticketInclude = {
  category: { select: { id: true, name: true } },
  requester: { select: { id: true, name: true, email: true, role: true } },
  assignee: { select: { id: true, name: true, email: true, role: true } },
};
