import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { loginLimiter, captchaLimiter, passwordChangeLimiter } from '../../middleware/rateLimit.js';
import {
  login,
  loginSchema,
  getCaptcha,
  ssoLogin,
  ssoLoginSchema,
  refresh,
  logout,
  me,
  changePassword,
  changePasswordSchema,
} from './auth.controller.js';

const router = Router();

router.get('/captcha', captchaLimiter, getCaptcha);
router.post('/login', loginLimiter, validate(loginSchema), login);
router.post('/sso', loginLimiter, validate(ssoLoginSchema), ssoLogin);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', requireAuth, me);
router.post(
  '/change-password',
  requireAuth,
  passwordChangeLimiter,
  validate(changePasswordSchema),
  changePassword,
);

export default router;
