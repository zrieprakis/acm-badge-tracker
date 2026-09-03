import { useState } from 'react';
import type { TeamMemberDTO } from '@acm-tracker/shared';
import { api, ApiError } from '../api/client.js';

interface Draft {
  displayName: string;
  acmCardholderId: string;
  notes: string;
}

export function RosterTable({
  members,
  onChanged,
}: {
  members: TeamMemberDTO[];
  onChanged: () => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>({ displayName: '', acmCardholderId: '', notes: '' });
  const [error, setError] = useState<string>();
  const [busyId, setBusyId] = useState<number | null>(null);

  function startEdit(member: TeamMemberDTO) {
    setEditingId(member.id);
    setDraft({
      displayName: member.displayName,
      acmCardholderId: member.acmCardholderId,
      notes: member.notes ?? '',
    });
    setError(undefined);
  }

  async function saveEdit(id: number) {
    setBusyId(id);
    setError(undefined);
    try {
      await api.updateTeamMember(id, {
        displayName: draft.displayName,
        acmCardholderId: draft.acmCardholderId,
        notes: draft.notes.trim() ? draft.notes.trim() : null,
      });
      setEditingId(null);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save changes');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(member: TeamMemberDTO) {
    setBusyId(member.id);
    setError(undefined);
    try {
      if (member.isActive) {
        await api.deactivateTeamMember(member.id);
      } else {
        await api.updateTeamMember(member.id, { isActive: true });
      }
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update status');
    } finally {
      setBusyId(null);
    }
  }

  async function deleteMember(member: TeamMemberDTO) {
    const confirmed = window.confirm(
      `Permanently delete "${member.displayName}"? This removes their badge history too and can't be undone. ` +
        `If you just want to stop tracking them, use Deactivate instead.`,
    );
    if (!confirmed) return;

    setBusyId(member.id);
    setError(undefined);
    try {
      await api.deleteTeamMember(member.id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete team member');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {error && (
        <p role="alert" className="roster-form__error">
          {error}
        </p>
      )}
      <div className="roster-table-wrapper">
        <table className="roster-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Badge Number</th>
              <th>Notes</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const isEditing = editingId === member.id;
              const isBusy = busyId === member.id;

              return (
                <tr
                  key={member.id}
                  className={member.isActive ? undefined : 'roster-table__row--inactive'}
                >
                  <td>
                    {isEditing ? (
                      <input
                        value={draft.displayName}
                        onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
                      />
                    ) : (
                      member.displayName
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        value={draft.acmCardholderId}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, acmCardholderId: e.target.value }))
                        }
                      />
                    ) : (
                      member.acmCardholderId
                    )}
                  </td>
                  <td className="roster-table__notes">
                    {isEditing ? (
                      <input
                        value={draft.notes}
                        onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                      />
                    ) : (
                      (member.notes ?? '')
                    )}
                  </td>
                  <td>{member.isActive ? 'Active' : 'Inactive'}</td>
                  <td>
                    {isEditing ? (
                      <>
                        <button type="button" onClick={() => void saveEdit(member.id)} disabled={isBusy}>
                          Save
                        </button>{' '}
                        <button type="button" onClick={() => setEditingId(null)} disabled={isBusy}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => startEdit(member)}>
                          Edit
                        </button>{' '}
                        <button type="button" onClick={() => void toggleActive(member)} disabled={isBusy}>
                          {member.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>{' '}
                        <button type="button" onClick={() => void deleteMember(member)} disabled={isBusy}>
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
