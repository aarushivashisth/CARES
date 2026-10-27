import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Route guard component that enforces authentication and server-assigned role authorization.
 */
export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <main className="page-width" style={{ padding: '80px 0', textAlign: 'center' }}>
        <p style={{ color: '#168044', fontWeight: '600' }}>Verifying secure session...</p>
      </main>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // Redirect to the user's appropriate portal if they attempt to access an unauthorized portal
    const roleRoutes = {
      patient: '/patient/dashboard',
      doctor: '/doctor/dashboard',
      hospital: '/hospital/dashboard',
      admin: '/admin/dashboard',
    };
    const targetRoute = roleRoutes[user.role] || '/';
    return <Navigate to={targetRoute} replace />;
  }

  return children;
}
