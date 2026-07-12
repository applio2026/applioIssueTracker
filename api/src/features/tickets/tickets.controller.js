import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { notFound, forbidden, badRequest } from '../../utils/AppError.js';
import {
  nextTicketKey,
  computeSlaDueAt,
  canTransition,
  scopeWhereForUser,
  canAccessTicket,
  watcherIds,
  ticketInclude,
  OPEN_STATUSES,
  DONE_STATUSES,
} from './ticket.service.js';
import { notify } from '../notifications/notification.service.js';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const STATUSES = [
  'NEW', 'OPEN', 'IN_PROGRESS', 'ON_HOLD', 'IN_REVIEW',
  'RESOLVED', 'CLOSED', 'REJECTED', 'REOPENED',
];

const isManager = (u) => ['ADMIN', 'SUPER_ADMIN'].includes(u.role);

// ---------- schemas ----------
export const createTicketSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(5),
  categoryId: z.string().optional(),
  priority: z.enum(PRIORITIES).default('MEDIUM'),
});

export const updateTicketSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(5).optional(),
  categoryId: z.string().nullable().optional(),
  priority: z.enum(PRIORITIES).optional(),
});

export const statusSchema = z.object({ status: z.enum(STATUSES) });
export const assignSchema = z.object({ assigneeId: z.string().nullable() });
export const commentSchema = z.object({
  body: z.string().min(1),
  isInternal: z.boolean().optional(),
});

// ---------- handlers ----------

// GET /api/tickets  (role-scoped, with filters)
export const listTickets = asyncHandler(async (req, res) => {
  const { status, priority, categoryId, assigneeId, q, label, from, to, view } = req.query;
  const where = { ...scopeWhereForUser(req.user) };

  // Dashboard drill-down views; an explicit `status` below overrides them.
  if (view === 'open') {
    where.status = { in: OPEN_STATUSES };
  } else if (view === 'breached') {
    where.status = { in: OPEN_STATUSES };
    where.slaDueAt = { lt: new Date() };
  } else if (view === 'resolved7d') {
    where.status = { in: DONE_STATUSES };
    where.updatedAt = { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
  }

  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (categoryId) where.categoryId = categoryId;
  if (assigneeId) where.assigneeId = assigneeId;
  if (label) where.label = label;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) {
      const d = new Date(to);
      d.setHours(23, 59, 59, 999);
      where.createdAt.lte = d;
    }
  }
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { key: { contains: q, mode: 'insensitive' } },
    ];
  }

  const tickets = await prisma.ticket.findMany({
    where,
    include: ticketInclude,
    orderBy: { updatedAt: 'desc' },
  });
  res.json({ tickets });
});

// GET /api/tickets/:id
export const getTicket = asyncHandler(async (req, res) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    include: {
      ...ticketInclude,
      comments: {
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { id: true, name: true, role: true } } },
      },
      activities: {
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { id: true, name: true } } },
      },
      attachments: true,
      subTasks: {
        orderBy: { createdAt: 'asc' },
        include: {
          assignee: { select: { id: true, name: true, role: true } },
          createdBy: { select: { id: true, name: true } },
        },
      },
      timeLogs: {
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, role: true } } },
      },
      watchers: { select: { userId: true, user: { select: { id: true, name: true } } } },
      linksFrom: {
        include: { to: { select: { id: true, key: true, title: true, status: true } } },
      },
      linksTo: {
        include: { from: { select: { id: true, key: true, title: true, status: true } } },
      },
    },
  });
  if (!ticket) throw notFound('Ticket not found');

  // Access check: managers see all; others their own/assigned tickets,
  // including tickets where they own a sub-task.
  if (!canAccessTicket(req.user, ticket)) throw forbidden('You cannot view this ticket');

  res.json({ ticket });
});

// POST /api/tickets
export const createTicket = asyncHandler(async (req, res) => {
  if (!req.user.permissions?.canRaiseTickets) {
    throw forbidden('You do not have permission to raise tickets');
  }
  const { title, description, categoryId, priority } = req.body;
  const slaDueAt = await computeSlaDueAt(categoryId, priority);

  // Customers' tickets are labelled with their company; everyone else is "local".
  const label = req.user.role === 'CUSTOMER' ? req.user.company || 'local' : 'local';

  const ticket = await prisma.$transaction(async (tx) => {
    const key = await nextTicketKey(tx);
    const created = await tx.ticket.create({
      data: {
        key,
        title,
        description,
        label,
        priority,
        categoryId: categoryId || null,
        requesterId: req.user.id,
        status: 'NEW',
        slaDueAt,
      },
    });
    await tx.activity.create({
      data: { ticketId: created.id, actorId: req.user.id, type: 'CREATED' },
    });
    return created;
  });

  const full = await prisma.ticket.findUnique({
    where: { id: ticket.id },
    include: ticketInclude,
  });
  res.status(201).json({ ticket: full });
});

// PATCH /api/tickets/:id  (edit fields — manager or requester)
export const updateTicket = asyncHandler(async (req, res) => {
  const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
  if (!ticket) throw notFound('Ticket not found');

  const canEdit = isManager(req.user) || ticket.requesterId === req.user.id;
  if (!canEdit) throw forbidden('You cannot edit this ticket');

  const activities = [];
  if (req.body.priority && req.body.priority !== ticket.priority) {
    activities.push({
      ticketId: ticket.id, actorId: req.user.id, type: 'PRIORITY_CHANGED',
      fromValue: ticket.priority, toValue: req.body.priority,
    });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const t = await tx.ticket.update({ where: { id: ticket.id }, data: req.body });
    if (activities.length) await tx.activity.createMany({ data: activities });
    return t;
  });

  const full = await prisma.ticket.findUnique({ where: { id: updated.id }, include: ticketInclude });
  res.json({ ticket: full });
});

// PATCH /api/tickets/:id/status
export const changeStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
  if (!ticket) throw notFound('Ticket not found');

  // Managers can move anything; the assigned developer can move their own ticket.
  const canMove = isManager(req.user) || ticket.assigneeId === req.user.id;
  if (!canMove) throw forbidden('You cannot change this ticket\'s status');

  if (status === ticket.status) throw badRequest('Ticket already has that status');
  if (!canTransition(ticket.status, status)) {
    throw badRequest(`Cannot move from ${ticket.status} to ${status}`);
  }

  const type = status === 'REOPENED' ? 'REOPENED' : 'STATUS_CHANGED';
  await prisma.$transaction([
    prisma.ticket.update({ where: { id: ticket.id }, data: { status } }),
    prisma.activity.create({
      data: { ticketId: ticket.id, actorId: req.user.id, type, fromValue: ticket.status, toValue: status },
    }),
  ]);

  const full = await prisma.ticket.findUnique({ where: { id: ticket.id }, include: ticketInclude });

  await notify([ticket.requesterId, ticket.assigneeId, ...(await watcherIds(ticket.id))], {
    type: 'STATUS_CHANGED',
    ticketId: ticket.id,
    message: `${full.key} moved to ${status} by ${req.user.name}`,
    excludeUserId: req.user.id,
    emailSubject: `[${full.key}] Status: ${status}`,
    emailText: `"${full.title}" is now ${status} (changed by ${req.user.name}).`,
  });

  res.json({ ticket: full });
});

// PATCH /api/tickets/:id/assign  (managers only)
export const assignTicket = asyncHandler(async (req, res) => {
  const { assigneeId } = req.body;
  const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
  if (!ticket) throw notFound('Ticket not found');

  let assignee = null;
  if (assigneeId) {
    assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
    if (!assignee || !assignee.isActive) throw badRequest('Assignee not found or inactive');
    if (!['DEVELOPER', 'ADMIN', 'SUPER_ADMIN'].includes(assignee.role)) {
      throw badRequest('Tickets can only be assigned to staff');
    }
  }

  // Auto-advance NEW -> OPEN when first assigned.
  const newStatus = ticket.status === 'NEW' && assigneeId ? 'OPEN' : ticket.status;

  await prisma.$transaction([
    prisma.ticket.update({
      where: { id: ticket.id },
      data: { assigneeId: assigneeId || null, status: newStatus },
    }),
    prisma.activity.create({
      data: {
        ticketId: ticket.id, actorId: req.user.id, type: 'ASSIGNED',
        fromValue: ticket.assigneeId, toValue: assigneeId || null,
      },
    }),
  ]);

  const full = await prisma.ticket.findUnique({ where: { id: ticket.id }, include: ticketInclude });

  if (assigneeId) {
    await notify([assigneeId], {
      type: 'TICKET_ASSIGNED',
      ticketId: ticket.id,
      message: `You were assigned ${full.key}: ${full.title}`,
      excludeUserId: req.user.id,
      emailSubject: `[${full.key}] Assigned to you`,
      emailText: `${req.user.name} assigned you "${full.title}".`,
    });
  }

  res.json({ ticket: full });
});

// POST /api/tickets/:id/comments
export const addComment = asyncHandler(async (req, res) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    include: { subTasks: { select: { assigneeId: true } } },
  });
  if (!ticket) throw notFound('Ticket not found');

  if (!canAccessTicket(req.user, ticket)) throw forbidden('You cannot comment on this ticket');

  // Internal comments are staff-only.
  const isInternal = !!req.body.isInternal && isManager(req.user);

  const comment = await prisma.$transaction(async (tx) => {
    const c = await tx.comment.create({
      data: { ticketId: ticket.id, authorId: req.user.id, body: req.body.body, isInternal },
      include: { author: { select: { id: true, name: true, role: true } } },
    });
    await tx.activity.create({
      data: { ticketId: ticket.id, actorId: req.user.id, type: 'COMMENTED' },
    });
    return c;
  });

  // Internal comments only notify staff (the assignee), not the requester
  // or watchers (who may be customers).
  const recipients = isInternal
    ? [ticket.assigneeId]
    : [ticket.requesterId, ticket.assigneeId, ...(await watcherIds(ticket.id))];
  await notify(recipients, {
    type: 'TICKET_COMMENT',
    ticketId: ticket.id,
    message: `${req.user.name} commented on ${ticket.key}`,
    excludeUserId: req.user.id,
    emailSubject: `[${ticket.key}] New comment`,
    emailText: `${req.user.name} commented:\n\n${req.body.body}`,
  });

  res.status(201).json({ comment });
});
