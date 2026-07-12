import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth.js';

// Guards routes by authentication, and optionally by role or a permission.
export default function ProtectedRoute({ children, roles, permission }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  if (permission && !user.permissions?.[permission]) {
    return <Navigate to="/" replace />;
  }

  return children;
}
