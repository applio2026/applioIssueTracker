import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { nextTicketKey, computeSlaDueAt } from '../tickets/ticket.service.js';
import { notify } from '../notifications/notification.service.js';

// Demo requests land in their own category so they never mix with client
// issues. 24h SLA backs the "we'll confirm within one business day" promise
// on the website.
const DEMO_CATEGORY = { name: 'Demo Request', defaultTeam: 'Sales', defaultSlaHours: 24 };

// System account that owns website-submitted tickets. It is created on first
// use, can never log in (inactive + non-bcrypt password hash), and exists only
// so tickets have a requester.
const WEBSITE_USER = {
  email: 'website@appliostack.system',
  name: 'Applio Stack Website',
  company: 'Applio Stack Website',
};

const optionalText = (max) => z.string().trim().max(max).optional().default('');

export const demoRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: optionalText(40),
  institution: z.string().trim().min(2).max(200),
  type: optionalText(80),
  size: optionalText(40),
  products: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  date: optionalText(40),
  notes: optionalText(2000),
  // Honeypot — hidden on the website form, so any value means a bot.
  company: optionalText(200),
});

const buildDescription = (f) =>
  [
    `**Name:** ${f.name}`,
    `**Email:** ${f.email}`,
    `**Phone:** ${f.phone || '—'}`,
    `**Institution:** ${f.institution}`,
    `**Institution type:** ${f.type || '—'}`,
    `**Approx. students:** ${f.size || '—'}`,
    `**Products interested in:** ${f.products.length ? f.products.join(', ') : '—'}`,
    `**Preferred date:** ${f.date || '—'}`,
    '',
    '**Notes:**',
    f.notes || '—',
    '',
    '_Submitted via the Book a Demo form on the Applio Stack website._',
  ].join('\n');

// POST /api/public/demo-requests — unauthenticated website form intake.
export const createDemoRequest = asyncHandler(async (req, res) => {
  const f = req.body;

  // Bots that filled the honeypot get a fake success so they don't adapt.
  if (f.company) return res.status(201).json({ ok: true });

  const category = await prisma.category.upsert({
    where: { name: DEMO_CATEGORY.name },
    update: {},
    create: DEMO_CATEGORY,
  });

  const requester = await prisma.user.upsert({
    where: { email: WEBSITE_USER.email },
    update: {},
    create: {
      ...WEBSITE_USER,
      role: 'CUSTOMER',
      isActive: false,
      // Random hex is never a valid bcrypt hash, so no password can match it.
      passwordHash: crypto.randomBytes(32).toString('hex'),
    },
  });

  const priority = 'MEDIUM'; // category default 24h × MEDIUM factor 1 = 24h SLA
  const slaDueAt = await computeSlaDueAt(category.id, priority);

  const ticket = await prisma.$transaction(async (tx) => {
    const key = await nextTicketKey(tx);
    const created = await tx.ticket.create({
      data: {
        key,
        title: `Demo request: ${f.institution} — ${f.name}`,
        description: buildDescription(f),
        label: f.institution,
        priority,
        categoryId: category.id,
        requesterId: requester.id,
        status: 'NEW',
        slaDueAt,
      },
    });
    await tx.activity.create({
      data: { ticketId: created.id, actorId: requester.id, type: 'CREATED' },
    });
    return created;
  });

  // Best-effort ping to managers (in-app + email) so leads don't sit unseen.
  const managers = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, isActive: true },
    select: { id: true },
  });
  await notify(
    managers.map((m) => m.id),
    {
      type: 'DEMO_REQUEST',
      ticketId: ticket.id,
      message: `New demo request from ${f.institution} (${ticket.key})`,
      emailSubject: `New demo request — ${f.institution} (${ticket.key})`,
      emailText: `${f.name} <${f.email}> requested a demo for ${f.institution}.`,
    },
  );

  res.status(201).json({ ok: true, ticketKey: ticket.key });
});
