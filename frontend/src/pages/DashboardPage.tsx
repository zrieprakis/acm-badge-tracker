import { api } from '../api/client.js';
import { usePolling } from '../hooks/usePolling.js';
import { AsOfBadge } from '../components/AsOfBadge.js';
import { TeamMemberCard } from '../components/TeamMemberCard.js';

const DASHBOARD_POLL_INTERVAL_MS = 20_000;

export function DashboardPage() {
  const dashboard = usePolling(api.getDashboard, DASHBOARD_POLL_INTERVAL_MS);
  const health = usePolling(api.getHealth, DASHBOARD_POLL_INTERVAL_MS);

  return (
    <div className="dashboard-page">
      <div className="dashboard-page__header">
        <h1>Team Badge Status</h1>
        <AsOfBadge health={health.data} />
      </div>

      {dashboard.loading && !dashboard.data && <p>Loading…</p>}
      {dashboard.error && (
        <p role="alert" className="dashboard-page__error">
          Failed to load dashboard: {dashboard.error.message}
        </p>
      )}
      {dashboard.data?.length === 0 && (
        <p>No team members yet. Add some in Roster Admin.</p>
      )}

      <div className="dashboard-page__grid">
        {dashboard.data?.map((entry) => (
          <TeamMemberCard key={entry.teamMemberId} entry={entry} />
        ))}
      </div>
    </div>
  );
}
