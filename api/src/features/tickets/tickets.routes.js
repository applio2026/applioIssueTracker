import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
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
import {
  createSubTask,
  createSubTaskSchema,
  updateSubTask,
  updateSubTaskSchema,
  deleteSubTask,
} from './subtasks.controller.js';
import { addTimeLog, deleteTimeLog, timeLogSchema } from './timelogs.controller.js';
import {
  watchTicket,
  unwatchTicket,
  createLink,
  createLinkSchema,
  deleteLink,
} from './collab.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', listTickets);
router.post('/', validate(createTicketSchema), createTicket);
router.get('/:id', getTicket);
router.patch('/:id', validate(updateTicketSchema), updateTicket);
router.patch('/:id/status', validate(statusSchema), changeStatus);
router.patch('/:id/assign', requirePermission('canManageTickets'), validate(assignSchema), assignTicket);
router.post('/:id/comments', validate(commentSchema), addComment);

// Sub-tasks
router.post('/:id/subtasks', validate(createSubTaskSchema), createSubTask);
router.patch('/:id/subtasks/:subId', validate(updateSubTaskSchema), updateSubTask);
router.delete('/:id/subtasks/:subId', deleteSubTask);

// Time logs
router.post('/:id/time', validate(timeLogSchema), addTimeLog);
router.delete('/:id/time/:logId', deleteTimeLog);

// Watching
router.post('/:id/watch', watchTicket);
router.delete('/:id/watch', unwatchTicket);

// Issue links ("relates to")
router.post('/:id/links', validate(createLinkSchema), createLink);
router.delete('/:id/links/:linkId', deleteLink);

// Attachments
router.post('/:id/attachments', upload.single('file'), uploadAttachment);
router.get('/:id/attachments/:attId/download', downloadAttachment);
router.delete('/:id/attachments/:attId', deleteAttachment);

export default router;
