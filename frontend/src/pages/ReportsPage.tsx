import { useState } from 'react';
import { REPORTS } from '../reports/registry.js';

export function ReportsPage() {
  const [selectedId, setSelectedId] = useState(REPORTS[0].id);
  const selected = REPORTS.find((report) => report.id === selectedId) ?? REPORTS[0];
  const SelectedReport = selected.Component;

  return (
    <div className="reports-page">
      <div className="roster-admin-page__header">
        <h1>Reports</h1>
      </div>

      <label className="reports-page__selector">
        Report
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          {REPORTS.map((report) => (
            <option key={report.id} value={report.id}>
              {report.label}
            </option>
          ))}
        </select>
      </label>

      <SelectedReport />
    </div>
  );
}
