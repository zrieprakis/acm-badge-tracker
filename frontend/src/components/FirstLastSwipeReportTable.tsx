import { useState } from 'react';
import type { FirstLastSwipeReportEntryDTO } from '@acm-tracker/shared';
import { formatSchoolDateKey, formatSchoolTime } from '../utils/schoolTime.js';

type GroupBy = 'date' | 'name';

function groupKey(entry: FirstLastSwipeReportEntryDTO, groupBy: GroupBy): string {
  return groupBy === 'name' ? entry.displayName : entry.date;
}

/** Groups by the chosen column, but always sorts chronologically within each group. */
function sortForGrouping(
  entries: FirstLastSwipeReportEntryDTO[],
  groupBy: GroupBy,
): FirstLastSwipeReportEntryDTO[] {
  return [...entries].sort((a, b) => {
    const byGroup = groupKey(a, groupBy).localeCompare(groupKey(b, groupBy));
    if (byGroup !== 0) return byGroup;
    return a.firstEventTimestamp.localeCompare(b.firstEventTimestamp);
  });
}

export function FirstLastSwipeReportTable({
  entries,
}: {
  entries: FirstLastSwipeReportEntryDTO[];
}) {
  const [groupBy, setGroupBy] = useState<GroupBy>('date');

  if (entries.length === 0) {
    return <p>No swipes recorded in that date range.</p>;
  }

  const sorted = sortForGrouping(entries, groupBy);

  function headerButton(label: string, value: GroupBy) {
    return (
      <button type="button" className="report-table__group-button" onClick={() => setGroupBy(value)}>
        {label}
        {groupBy === value ? ' ▾' : ''}
      </button>
    );
  }

  return (
    <div className="roster-table-wrapper">
      <table className="roster-table report-table">
        <thead>
          <tr>
            <th>{headerButton('Date', 'date')}</th>
            <th>{headerButton('Name', 'name')}</th>
            <th>First swipe</th>
            <th>Door</th>
            <th>Last swipe</th>
            <th>Door</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry, i) => {
            const startsNewGroup =
              i > 0 && groupKey(sorted[i - 1], groupBy) !== groupKey(entry, groupBy);

            return (
              <tr
                key={`${entry.teamMemberId}|${entry.date}`}
                className={startsNewGroup ? 'report-table__row--group-start' : undefined}
              >
                <td>{formatSchoolDateKey(entry.date)}</td>
                <td>{entry.displayName}</td>
                <td>{formatSchoolTime(entry.firstEventTimestamp)}</td>
                <td>{entry.firstDoorName ?? ''}</td>
                <td>{formatSchoolTime(entry.lastEventTimestamp)}</td>
                <td>{entry.lastDoorName ?? ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
