import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { badRequest } from '../utils/AppError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

// Allowlist of attachment types. Executable/script types (.html, .svg, .js,
// .exe, .sh, …) are rejected so the uploads dir can't be turned into a
// malware/stored-XSS vector. Downloads are also forced as attachments.
const ALLOWED_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp',
  '.pdf', '.txt', '.log', '.csv',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip',
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Random stored name; the original name is preserved in the DB. Only a
    // sanitized extension (letters/digits) is appended to the server filename.
    const raw = path.extname(file.originalname).toLowerCase();
    const ext = /^\.[a-z0-9]{1,8}$/.test(raw) ? raw : '';
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }, // 10 MB, one file
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXT.has(ext)) return cb(null, true);
    cb(badRequest(`File type not allowed: ${ext || 'unknown'}`));
  },
});
