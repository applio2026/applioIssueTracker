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

export const isManager = (u) => ['ADMIN', 'SUPER_ADMIN'].includes(u.role);

// Build a Prisma `where` clause scoped to what the user is allowed to see.
export function scopeWhereForUser(user) {
  switch (user.role) {
    case 'CUSTOMER':
      return { requesterId: user.id };
    case 'DEVELOPER':
      // Developers see tickets assigned to them, that they raised, or where
      // they own a sub-task.
      return {
        OR: [
          { assigneeId: user.id },
          { requesterId: user.id },
          { subTasks: { some: { assigneeId: user.id } } },
        ],
      };
    case 'ADMIN':
    case 'SUPER_ADMIN':
    default:
      return {};
  }
}

// True if the user may view/collaborate on the ticket. `ticket.subTasks`
// must be loaded (assigneeId is enough) for sub-task assignees to qualify.
export function canAccessTicket(user, ticket) {
  return (
    isManager(user) ||
    ticket.requesterId === user.id ||
    ticket.assigneeId === user.id ||
    (ticket.subTasks?.some((s) => s.assigneeId === user.id) ?? false)
  );
}

export const ticketInclude = {
  category: { select: { id: true, name: true } },
  requester: { select: { id: true, name: true, email: true, role: true } },
  assignee: { select: { id: true, name: true, email: true, role: true } },
};
