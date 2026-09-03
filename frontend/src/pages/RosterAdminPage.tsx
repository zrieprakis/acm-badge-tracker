import { useEffect, useState } from 'react';
import type { TeamMemberDTO } from '@acm-tracker/shared';
import { api, ApiError } from '../api/client.js';
import { RosterForm } from '../components/RosterForm.js';
import { RosterTable } from '../components/RosterTable.js';

export function RosterAdminPage() {
  const [members, setMembers] = useState<TeamMemberDTO[]>();
  const [error, setError] = useState<string>();

  async function refresh() {
    try {
      setMembers(await api.getTeam());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load roster');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="roster-admin-page">
      <div className="roster-admin-page__header">
        <h1>Roster Admin</h1>
      </div>

      <RosterForm onCreated={() => void refresh()} />

      {error && (
        <p role="alert" className="roster-form__error">
          {error}
        </p>
      )}

      {members ? (
        <RosterTable members={members} onChanged={() => void refresh()} />
      ) : (
        <p>Loading…</p>
      )}
    </div>
  );
}
