import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../store/authStore';

function ProtectedRoute({ roles }) {
  const { token, user, restoreAuth } = useAuthStore();

  const resolvedUser = user || restoreAuth();

  if (!resolvedUser || !token) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(resolvedUser.role)) {
    return <Navigate to={resolvedUser.role === 'OPERATOR' ? '/operator' : '/attendant'} replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
