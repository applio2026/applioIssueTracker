import { Router } from 'express';
import { requireApiKey } from '../../middleware/apiKey.js';
import { validate } from '../../middleware/validate.js';
import {
  provisionUser,
  provisionUserSchema,
  setUserActive,
  setUserActiveSchema,
  createSsoToken,
  ssoTokenSchema,
} from './integration.controller.js';

const router = Router();

// Partner-facing routes authenticate with an API key, not a user session.
router.use(requireApiKey);

router.post('/users', validate(provisionUserSchema), provisionUser);
router.patch('/users', validate(setUserActiveSchema), setUserActive);
router.post('/sso-token', validate(ssoTokenSchema), createSsoToken);

export default router;
