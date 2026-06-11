import crypto from 'crypto';

// Simple server-verified math captcha with a random operator ("4 + 2",
// "7 - 3", "4 × 2"). The question is generated here and only the id travels
// to the client, so the answer can't be scraped from the page. Entries are
// single-use and expire after 5 minutes.
// In-memory: fine for a single API instance; restarts just invalidate
// outstanding challenges (the user gets a fresh question).
const store = new Map(); // captchaId -> { answer, expiresAt }
const TTL_MS = 5 * 60 * 1000;

const rand = (max) => 1 + Math.floor(Math.random() * max);

export function createCaptcha() {
  // Opportunistic cleanup so the map doesn't grow unbounded.
  const now = Date.now();
  for (const [id, c] of store) if (c.expiresAt < now) store.delete(id);

  const op = ['+', '-', '×'][Math.floor(Math.random() * 3)];
  let a = rand(9);
  let b = rand(9);
  let answer;
  if (op === '+') {
    answer = a + b;
  } else if (op === '-') {
    if (b > a) [a, b] = [b, a]; // keep answers non-negative
    answer = a - b;
  } else {
    b = rand(5); // keep products easy mental math
    answer = a * b;
  }

  const captchaId = crypto.randomUUID();
  store.set(captchaId, { answer, expiresAt: now + TTL_MS });
  return { captchaId, question: `${a} ${op} ${b}` };
}

// Single-use: the entry is consumed whether the answer is right or wrong,
// so wrong guesses can't be retried against the same question.
export function verifyCaptchaAnswer(captchaId, answer) {
  const entry = store.get(captchaId);
  if (!entry) return false;
  store.delete(captchaId);
  return entry.expiresAt >= Date.now() && Number(answer) === entry.answer;
}
