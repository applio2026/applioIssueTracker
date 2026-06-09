import { prisma } from '../../lib/prisma.js';
import { sendMail } from '../../lib/mailer.js';
import { env } from '../../config/env.js';

/**
 * Create in-app notifications for a set of recipients and email them (best-effort).
 * Recipients equal to `excludeUserId` (usually the actor) are skipped, as are
 * empty/duplicate ids. Failures are swallowed so they never break the request.
 *
 * @param {string[]} userIds        candidate recipient ids
 * @param {object}   payload
 * @param {string}   payload.type   short event type, e.g. 'TICKET_ASSIGNED'
 * @param {string}   payload.message in-app message text
 * @param {string}   [payload.ticketId]
 * @param {string}   [payload.excludeUserId]
 * @param {string}   [payload.emailSubject]
 * @param {string}   [payload.emailText]
 */
export async function notify(userIds, payload) {
  try {
    const recipients = [...new Set(userIds.filter(Boolean))].filter(
      (id) => id !== payload.excludeUserId,
    );
    if (recipients.length === 0) return;

    await prisma.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        ticketId: payload.ticketId || null,
        type: payload.type,
        message: payload.message,
      })),
    });

    if (payload.emailSubject) {
      const users = await prisma.user.findMany({
        where: { id: { in: recipients } },
        select: { email: true },
      });
      const link = `${env.clientUrl}/tickets/${payload.ticketId || ''}`;
      await Promise.all(
        users.map((u) =>
          sendMail({
            to: u.email,
            subject: payload.emailSubject,
            text: `${payload.emailText || payload.message}\n\nView: ${link}`,
          }),
        ),
      );
    }
  } catch (err) {
    console.error('[notify] failed:', err.message);
  }
}
