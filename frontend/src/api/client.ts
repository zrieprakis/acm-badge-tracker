import type {
  ApiErrorBody,
  AuthUserDTO,
  ChangePasswordInput,
  CreateTeamMemberInput,
  DashboardEntryDTO,
  HealthStatusDTO,
  LoginInput,
  TeamMemberDTO,
  UpdateTeamMemberInput,
} from '@acm-tracker/shared';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as ApiErrorBody;
      if (body.error) message = body.error;
    } catch {
      // response body wasn't JSON - fall back to statusText
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  login: (input: LoginInput) =>
    request<AuthUserDTO>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  me: () => request<AuthUserDTO>('/auth/me'),
  changePassword: (input: ChangePasswordInput) =>
    request<void>('/auth/password', { method: 'PUT', body: JSON.stringify(input) }),

  getDashboard: () => request<DashboardEntryDTO[]>('/dashboard'),
  getHealth: () => request<HealthStatusDTO>('/health'),

  getTeam: () => request<TeamMemberDTO[]>('/team'),
  createTeamMember: (input: CreateTeamMemberInput) =>
    request<TeamMemberDTO>('/team', { method: 'POST', body: JSON.stringify(input) }),
  updateTeamMember: (id: number, input: UpdateTeamMemberInput) =>
    request<TeamMemberDTO>(`/team/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deactivateTeamMember: (id: number) => request<TeamMemberDTO>(`/team/${id}`, { method: 'DELETE' }),
  deleteTeamMember: (id: number) => request<void>(`/team/${id}?hard=true`, { method: 'DELETE' }),
};
