import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { notFound, forbidden, badRequest } from '../../utils/AppError.js';
import { canAccessTicket, isManager } from './ticket.service.js';

const SUBTASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'];

export const createSubTaskSchema = z.object({
  title: z.string().trim().min(2),
  assigneeId: z.string().nullable().optional(),
});

export const updateSubTaskSchema = z.object({
  title: z.string().trim().min(2).optional(),
  status: z.enum(SUBTASK_STATUSES).optional(),
  assigneeId: z.string().nullable().optional(),
});

const subTaskInclude = {
  assignee: { select: { id: true, name: true, role: true } },
  createdBy: { select: { id: true, name: true } },
};

// Load the ticket and verify the requester is a participant.
async function loadTicketForUser(id, user) {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { subTasks: { select: { assigneeId: true } } },
  });
  if (!ticket) throw notFound('Ticket not found');
  if (!canAccessTicket(user, ticket)) throw forbidden('You cannot work on this ticket');
  return ticket;
}

async function assertAssignee(assigneeId) {
  if (!assigneeId) return;
  const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
  if (!assignee || !assignee.isActive) throw badRequest('Sub-task assignee not found or inactive');
}

// POST /api/tickets/:id/subtasks — any ticket participant can add one.
export const createSubTask = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForUser(req.params.id, req.user);
  const { title, assigneeId } = req.body;
  await assertAssignee(assigneeId);

  const subTask = await prisma.subTask.create({
    data: {
      ticketId: ticket.id,
      title,
      assigneeId: assigneeId || null,
      createdById: req.user.id,
    },
    include: subTaskInclude,
  });
  res.status(201).json({ subTask });
});

// PATCH /api/tickets/:id/subtasks/:subId — title/status/assignee.
export const updateSubTask = asyncHandler(async (req, res) => {
  await loadTicketForUser(req.params.id, req.user);
  const existing = await prisma.subTask.findUnique({ where: { id: req.params.subId } });
  if (!existing || existing.ticketId !== req.params.id) throw notFound('Sub-task not found');

  // Managers, the creator, or the current assignee can update it.
  const canEdit =
    isManager(req.user) ||
    existing.createdById === req.user.id ||
    existing.assigneeId === req.user.id;
  if (!canEdit) throw forbidden('You cannot update this sub-task');

  if ('assigneeId' in req.body) await assertAssignee(req.body.assigneeId);

  const subTask = await prisma.subTask.update({
    where: { id: existing.id },
    data: req.body,
    include: subTaskInclude,
  });
  res.json({ subTask });
});

// DELETE /api/tickets/:id/subtasks/:subId — creator or manager only.
export const deleteSubTask = asyncHandler(async (req, res) => {
  await loadTicketForUser(req.params.id, req.user);
  const existing = await prisma.subTask.findUnique({ where: { id: req.params.subId } });
  if (!existing || existing.ticketId !== req.params.id) throw notFound('Sub-task not found');

  if (!isManager(req.user) && existing.createdById !== req.user.id) {
    throw forbidden('Only the creator or a manager can delete a sub-task');
  }
  await prisma.subTask.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});
