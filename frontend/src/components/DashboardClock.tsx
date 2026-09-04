import { useEffect, useState } from 'react';
import { formatSchoolClock } from '../utils/schoolTime.js';

const UPDATE_INTERVAL_MS = 30_000;

export function DashboardClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), UPDATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="dashboard-clock" title="School's local time (Central)">
      {formatSchoolClock(now)}
    </div>
  );
}
