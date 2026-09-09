/** DTOs shared between the backend API and the frontend. */

export interface TeamMemberDTO {
  id: number;
  displayName: string;
  acmCardholderId: string;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamMemberInput {
  displayName: string;
  acmCardholderId: string;
  notes?: string | null;
}

export interface UpdateTeamMemberInput {
  displayName?: string;
  acmCardholderId?: string;
  notes?: string | null;
  isActive?: boolean;
}

export interface DashboardEntryDTO {
  teamMemberId: number;
  displayName: string;
  doorName: string | null;
  doorId: string | null;
  eventType: string | null;
  eventTimestamp: string | null;
  updatedAt: string | null;
  /** The door/timestamp before the current one, from access_event_history - null if there isn't one yet. */
  previousDoorName: string | null;
  previousEventTimestamp: string | null;
}

export interface HealthStatusDTO {
  lastPollStartedAt: string | null;
  lastPollCompletedAt: string | null;
  lastPollSuccess: boolean | null;
  lastPollError: string | null;
  lastSuccessfulPollAt: string | null;
  consecutiveFailureCount: number;
  pollIntervalSeconds: number;
}

export interface AuthUserDTO {
  username: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface ApiErrorBody {
  error: string;
}

/** One team member's first and last recorded swipe on one school-local calendar day. */
export interface FirstLastSwipeReportEntryDTO {
  teamMemberId: number;
  displayName: string;
  /** School-local calendar date (America/Chicago), YYYY-MM-DD. */
  date: string;
  firstEventTimestamp: string;
  firstDoorName: string | null;
  lastEventTimestamp: string;
  lastDoorName: string | null;
}
