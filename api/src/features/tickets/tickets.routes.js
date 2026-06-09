import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { upload } from '../../middleware/upload.js';
import {
  listTickets,
  getTicket,
  createTicket,
  createTicketSchema,
  updateTicket,
  updateTicketSchema,
  changeStatus,
  statusSchema,
  assignTicket,
  assignSchema,
  addComment,
  commentSchema,
} from './tickets.controller.js';
import {
  uploadAttachment,
  downloadAttachment,
  deleteAttachment,
} from './attachments.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', listTickets);
router.post('/', validate(createTicketSchema), createTicket);
router.get('/:id', getTicket);
router.patch('/:id', validate(updateTicketSchema), updateTicket);
router.patch('/:id/status', validate(statusSchema), changeStatus);
router.patch('/:id/assign', requireRole('ADMIN', 'SUPER_ADMIN'), validate(assignSchema), assignTicket);
router.post('/:id/comments', validate(commentSchema), addComment);

// Attachments
router.post('/:id/attachments', upload.single('file'), uploadAttachment);
router.get('/:id/attachments/:attId/download', downloadAttachment);
router.delete('/:id/attachments/:attId', deleteAttachment);

export default router;
