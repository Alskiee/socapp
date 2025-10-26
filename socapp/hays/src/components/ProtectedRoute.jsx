import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
  const { token, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="text-center p-8">Loading...</div>;
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}
