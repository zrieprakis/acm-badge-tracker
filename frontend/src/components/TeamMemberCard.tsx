import type { DashboardEntryDTO } from '@acm-tracker/shared';
import { formatRelativeTime } from '../utils/formatRelativeTime.js';
import { isWithinSchoolHoursToday } from '../utils/schoolTime.js';

export function TeamMemberCard({ entry }: { entry: DashboardEntryDTO }) {
  const hasEvent = Boolean(entry.doorName);
  const hasPrevious = Boolean(entry.previousDoorName);
  const isPresentToday = isWithinSchoolHoursToday(entry.eventTimestamp);

  const cardClassName = isPresentToday
    ? 'team-member-card team-member-card--present'
    : 'team-member-card';

  return (
    <div className={cardClassName}>
      <div className="team-member-card__name">{entry.displayName}</div>
      <div className="team-member-card__door">{entry.doorName ?? 'No badge events yet'}</div>
      {hasEvent && (
        <div className="team-member-card__time">{formatRelativeTime(entry.eventTimestamp)}</div>
      )}
      {hasPrevious && (
        <div className="team-member-card__previous">
          <span className="team-member-card__previous-door">{entry.previousDoorName}</span>
          <span className="team-member-card__previous-time">
            {formatRelativeTime(entry.previousEventTimestamp)}
          </span>
        </div>
      )}
    </div>
  );
}
