import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { notFound, forbidden, badRequest, conflict } from '../../utils/AppError.js';
import { canAccessTicket, isManager } from './ticket.service.js';

// Load a ticket (with sub-task assignees) and check the user may access it.
async function loadTicketForUser(id, user) {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { subTasks: { select: { assigneeId: true } } },
  });
  if (!ticket) throw notFound('Ticket not found');
  if (!canAccessTicket(user, ticket)) throw forbidden('You cannot access this ticket');
  return ticket;
}

// ---------- watchers ----------

// POST /api/tickets/:id/watch — start watching (idempotent).
export const watchTicket = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForUser(req.params.id, req.user);
  await prisma.ticketWatcher.upsert({
    where: { ticketId_userId: { ticketId: ticket.id, userId: req.user.id } },
    update: {},
    create: { ticketId: ticket.id, userId: req.user.id },
  });
  res.status(201).json({ watching: true });
});

// DELETE /api/tickets/:id/watch — stop watching (idempotent).
export const unwatchTicket = asyncHandler(async (req, res) => {
  await loadTicketForUser(req.params.id, req.user);
  await prisma.ticketWatcher.deleteMany({
    where: { ticketId: req.params.id, userId: req.user.id },
  });
  res.json({ watching: false });
});

// ---------- issue links ----------

export const createLinkSchema = z.object({
  key: z.string().trim().min(1), // ticket key, e.g. UNIV-104
});

// POST /api/tickets/:id/links — "relates to" another ticket by key.
export const createLink = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForUser(req.params.id, req.user);

  const target = await prisma.ticket.findUnique({
    where: { key: req.body.key.toUpperCase() },
    include: { subTasks: { select: { assigneeId: true } } },
  });
  if (!target) throw notFound(`No ticket found with key ${req.body.key.toUpperCase()}`);
  if (target.id === ticket.id) throw badRequest('A ticket cannot link to itself');
  if (!canAccessTicket(req.user, target)) {
    throw forbidden('You cannot link to a ticket you have no access to');
  }

  // One link per pair, regardless of direction.
  const existing = await prisma.ticketLink.findFirst({
    where: {
      OR: [
        { fromId: ticket.id, toId: target.id },
        { fromId: target.id, toId: ticket.id },
      ],
    },
  });
  if (existing) throw conflict('These tickets are already linked');

  const link = await prisma.ticketLink.create({
    data: { fromId: ticket.id, toId: target.id, createdById: req.user.id },
    include: { to: { select: { id: true, key: true, title: true, status: true } } },
  });
  res.status(201).json({ link });
});

// DELETE /api/tickets/:id/links/:linkId — link creator or manager.
export const deleteLink = asyncHandler(async (req, res) => {
  await loadTicketForUser(req.params.id, req.user);
  const link = await prisma.ticketLink.findUnique({ where: { id: req.params.linkId } });
  if (!link || (link.fromId !== req.params.id && link.toId !== req.params.id)) {
    throw notFound('Link not found');
  }
  if (!isManager(req.user) && link.createdById !== req.user.id) {
    throw forbidden('Only the link creator or a manager can remove a link');
  }
  await prisma.ticketLink.delete({ where: { id: link.id } });
  res.json({ ok: true });
});
