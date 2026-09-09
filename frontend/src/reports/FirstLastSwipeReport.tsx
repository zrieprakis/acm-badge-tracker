import { useEffect, useState, type FormEvent } from 'react';
import type { FirstLastSwipeReportEntryDTO } from '@acm-tracker/shared';
import { api, ApiError } from '../api/client.js';
import { FirstLastSwipeReportTable } from '../components/FirstLastSwipeReportTable.js';
import { addDaysToDateKey, todaySchoolDateKey } from '../utils/schoolTime.js';

export function FirstLastSwipeReport() {
  const [start, setStart] = useState(() => addDaysToDateKey(todaySchoolDateKey(), -6));
  const [end, setEnd] = useState(() => todaySchoolDateKey());
  const [entries, setEntries] = useState<FirstLastSwipeReportEntryDTO[]>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function runReport() {
    setLoading(true);
    setError(undefined);
    try {
      setEntries(await api.getFirstLastSwipeReport(start, end));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void runReport();
    // Only on mount - re-running on every date change would fire a request per keystroke.
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void runReport();
  }

  return (
    <section>
      <form className="roster-form" onSubmit={handleSubmit}>
        <label>
          Start date
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            max={end}
            required
          />
        </label>
        <label>
          End date
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            min={start}
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Running…' : 'Run report'}
        </button>
        {error && (
          <div className="roster-form__error" role="alert">
            {error}
          </div>
        )}
      </form>

      {entries && <FirstLastSwipeReportTable entries={entries} />}
    </section>
  );
}
