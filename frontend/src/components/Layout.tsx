import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-layout">
      <header className="app-layout__header">
        <span className="app-layout__title">ACM Badge Tracker</span>
        <nav className="app-layout__nav">
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/reports">Reports</NavLink>
          <NavLink to="/admin/roster">Roster Admin</NavLink>
        </nav>
        <div className="app-layout__user">
          <NavLink to="/account">{user?.username}</NavLink>
          <button type="button" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      </header>
      <main className="app-layout__main">
        <Outlet />
      </main>
    </div>
  );
}
