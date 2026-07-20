import { getRecentAttempts, recordLoginAttempt } from "@/lib/repositories/login-attempt-repository";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const DELAY_SCHEDULE_MS = [0, 300, 700, 1500, 3000];

/**
 * Counts trailing consecutive failures from most-recent backward, stopping at the
 * first success or the end of the list. This is "consecutive" lockout semantics,
 * not a rolling-window count — a single success resets the streak immediately.
 */
function countTrailingFailures(attempts: Array<{ succeeded: boolean }>): number {
  let count = 0;
  for (const attempt of attempts) {
    if (attempt.succeeded) break;
    count += 1;
  }
  return count;
}

export async function isLocked(identifier: string): Promise<boolean> {
  const attempts = await getRecentAttempts(identifier, LOCKOUT_THRESHOLD);
  if (attempts.length < LOCKOUT_THRESHOLD) return false;
  if (attempts.some((a) => a.succeeded)) return false;

  const mostRecent = new Date(attempts[0].created_at).getTime();
  return Date.now() - mostRecent < LOCKOUT_WINDOW_MS;
}

export async function getProgressiveDelayMs(identifier: string): Promise<number> {
  const attempts = await getRecentAttempts(identifier, LOCKOUT_THRESHOLD);
  const streak = countTrailingFailures(attempts);
  const index = Math.min(streak, DELAY_SCHEDULE_MS.length - 1);
  return DELAY_SCHEDULE_MS[index];
}

/**
 * Never throws — a failed attempt-history write must not break the login flow itself,
 * matching recordAuditLog's contract in audit-service.ts.
 */
export async function recordAttemptResult(
  identifier: string,
  ip: string,
  succeeded: boolean
): Promise<void> {
  try {
    await recordLoginAttempt({ identifier, ip, succeeded });
  } catch (error) {
    console.error("Failed to record login attempt", error);
  }
}
