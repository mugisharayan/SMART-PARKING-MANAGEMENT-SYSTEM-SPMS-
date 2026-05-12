import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../store/authStore';

function ProtectedRoute({ roles }) {
  const { token, user, restoreAuth } = useAuthStore();

  /* token/user are already hydrated by index.js restoreAuth() call,
     but call again as a safety net in case this renders before hydration */
  const resolvedUser  = user  || restoreAuth();
  const resolvedToken = token || (() => {
    try { const s = localStorage.getItem('pms_auth'); return s ? JSON.parse(s).token : null; } catch { return null; }
  })();

  if (!resolvedUser || !resolvedToken) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(resolvedUser.role)) {
    return <Navigate to={resolvedUser.role === 'OPERATOR' ? '/operator' : '/attendant'} replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
