import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api/client.js';

export function RosterForm({ onCreated }: { onCreated: () => void }) {
  const [displayName, setDisplayName] = useState('');
  const [acmCardholderId, setAcmCardholderId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(undefined);
    try {
      await api.createTeamMember({
        displayName,
        acmCardholderId,
        notes: notes.trim() ? notes.trim() : null,
      });
      setDisplayName('');
      setAcmCardholderId('');
      setNotes('');
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add team member');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="roster-form" onSubmit={handleSubmit}>
      <label>
        Name
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      </label>
      <label>
        Badge Number
        <input
          value={acmCardholderId}
          onChange={(e) => setAcmCardholderId(e.target.value)}
          placeholder="e.g. 2558933"
          title="Any one of this person's ACM badge/token numbers - if they hold more than one, all of them are tracked automatically"
          required
        />
      </label>
      <label>
        Notes
        <input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <button type="submit" disabled={submitting}>
        {submitting ? 'Adding…' : 'Add team member'}
      </button>
      {error && (
        <div className="roster-form__error" role="alert">
          {error}
        </div>
      )}
    </form>
  );
}
