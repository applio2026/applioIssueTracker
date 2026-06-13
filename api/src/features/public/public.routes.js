import { Router } from 'express';
import { publicFormLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { createDemoRequest, demoRequestSchema } from './demoRequests.controller.js';

const router = Router();

// Unauthenticated intake for forms on public marketing sites. Every route here
// must stay rate-limited; the origins allowed to call them are controlled by
// PUBLIC_CORS_ORIGINS (see app.js).
router.post('/demo-requests', publicFormLimiter, validate(demoRequestSchema), createDemoRequest);

export default router;
