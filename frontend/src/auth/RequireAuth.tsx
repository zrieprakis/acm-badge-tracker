import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext.js';

export function RequireAuth() {
  const { user, loading } = useAuth();

  if (loading) return <div className="page-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}
