import type { HealthStatusDTO } from '@acm-tracker/shared';
import { formatRelativeTime } from '../utils/formatRelativeTime.js';

const STALE_MULTIPLIER = 3;

export function AsOfBadge({ health }: { health: HealthStatusDTO | undefined }) {
  if (!health) {
    return <span className="as-of-badge as-of-badge--unknown">Checking status…</span>;
  }

  const isFailing = health.lastPollSuccess === false;
  const isStale = health.lastSuccessfulPollAt
    ? Date.now() - new Date(health.lastSuccessfulPollAt).getTime() >
      health.pollIntervalSeconds * 1000 * STALE_MULTIPLIER
    : true;

  const status = isFailing ? 'error' : isStale ? 'stale' : 'ok';
  const label = isFailing
    ? `ACM connection failing — last success ${formatRelativeTime(health.lastSuccessfulPollAt)}`
    : `Data as of ${formatRelativeTime(health.lastSuccessfulPollAt)}`;

  return <span className={`as-of-badge as-of-badge--${status}`}>{label}</span>;
}
