import path from 'node:path';
import fs from 'node:fs';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { notFound, forbidden, badRequest } from '../../utils/AppError.js';
import { canAccessTicket, isManager } from './ticket.service.js';
import { UPLOAD_DIR } from '../../middleware/upload.js';

async function loadTicketWithAccess(ticketId, user) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { subTasks: { select: { assigneeId: true } } },
  });
  if (!ticket) throw notFound('Ticket not found');
  // Use the shared, permission- and department-aware access check so
  // attachment access exactly matches who can view the ticket.
  if (!canAccessTicket(user, ticket)) throw forbidden('You cannot access this ticket');
  return ticket;
}

// POST /api/tickets/:id/attachments  (multipart field: "file")
export const uploadAttachment = asyncHandler(async (req, res) => {
  const ticket = await loadTicketWithAccess(req.params.id, req.user);
  if (!req.file) throw badRequest('No file uploaded');

  const attachment = await prisma.attachment.create({
    data: {
      ticketId: ticket.id,
      fileName: req.file.originalname,
      filePath: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedById: req.user.id,
    },
  });
  res.status(201).json({ attachment });
});

// GET /api/tickets/:id/attachments/:attId/download
export const downloadAttachment = asyncHandler(async (req, res) => {
  await loadTicketWithAccess(req.params.id, req.user);

  const att = await prisma.attachment.findUnique({ where: { id: req.params.attId } });
  if (!att || att.ticketId !== req.params.id) throw notFound('Attachment not found');

  const absPath = path.join(UPLOAD_DIR, att.filePath);
  if (!fs.existsSync(absPath)) throw notFound('File missing on server');

  res.download(absPath, att.fileName);
});

// DELETE /api/tickets/:id/attachments/:attId  (uploader or manager)
export const deleteAttachment = asyncHandler(async (req, res) => {
  await loadTicketWithAccess(req.params.id, req.user);

  const att = await prisma.attachment.findUnique({ where: { id: req.params.attId } });
  if (!att || att.ticketId !== req.params.id) throw notFound('Attachment not found');
  if (att.uploadedById !== req.user.id && !isManager(req.user)) {
    throw forbidden('You cannot delete this attachment');
  }

  const absPath = path.join(UPLOAD_DIR, att.filePath);
  fs.promises.unlink(absPath).catch(() => {}); // best-effort file removal
  await prisma.attachment.delete({ where: { id: att.id } });
  res.json({ ok: true });
});
