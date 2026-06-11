import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { notFound, forbidden } from '../../utils/AppError.js';
import { canAccessTicket, isManager } from './ticket.service.js';

export const timeLogSchema = z.object({
  // One entry caps at 24h — log multiple entries for longer stretches.
  minutes: z.number().int().min(1).max(24 * 60),
  note: z.string().trim().max(500).optional(),
});

// POST /api/tickets/:id/time — any ticket participant can log work time.
export const addTimeLog = asyncHandler(async (req, res) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    include: { subTasks: { select: { assigneeId: true } } },
  });
  if (!ticket) throw notFound('Ticket not found');
  if (!canAccessTicket(req.user, ticket)) throw forbidden('You cannot log time on this ticket');

  const timeLog = await prisma.timeLog.create({
    data: {
      ticketId: ticket.id,
      userId: req.user.id,
      minutes: req.body.minutes,
      note: req.body.note || null,
    },
    include: { user: { select: { id: true, name: true, role: true } } },
  });
  res.status(201).json({ timeLog });
});

// DELETE /api/tickets/:id/time/:logId — own entries, or any as manager.
export const deleteTimeLog = asyncHandler(async (req, res) => {
  const log = await prisma.timeLog.findUnique({ where: { id: req.params.logId } });
  if (!log || log.ticketId !== req.params.id) throw notFound('Time log not found');

  if (!isManager(req.user) && log.userId !== req.user.id) {
    throw forbidden('You can only delete your own time logs');
  }
  await prisma.timeLog.delete({ where: { id: log.id } });
  res.json({ ok: true });
});
