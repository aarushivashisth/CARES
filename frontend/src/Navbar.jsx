import { Link, useLocation } from 'react-router-dom'
import { useAuth } from './context/useAuth.js'

export default function Navbar() {
  const { pathname } = useLocation()
  const isHome = pathname === '/'
  const { user, isAuthenticated, logout } = useAuth()

  const getDashboardPath = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'patient': return '/patient/dashboard';
      case 'doctor': return user.status === 'pending_approval' ? '/doctor/application' : '/doctor/dashboard';
      case 'hospital': return '/hospital/dashboard';
      case 'admin': return '/admin/dashboard';
      default: return '/login';
    }
  };

  return (
    <header className="navbar">
      <Link className="brand" to="/" aria-label="CARES home">
        <img
          src="/images/cares-logo.svg"
          alt="CARES — One Stop Healthcare"
          className="cares-logo"
        />
      </Link>

      <nav className="nav-links">
        <Link className={isHome ? 'active' : ''} to="/">
          Home
        </Link>

        <Link
          className={pathname === '/doctors' ? 'active' : ''}
          to="/doctors"
        >
          Find a doctor
        </Link>

        <Link
          className={pathname === '/hospitals' || pathname.startsWith('/hospitals/') ? 'active' : ''}
          to="/hospitals"
        >
          Hospitals
        </Link>
        <Link to="/home-care">Care at home</Link>
        <Link to="/navigator">Care Navigator</Link>
        <Link
          className={pathname === '/emergency' ? 'active' : ''}
          to="/emergency"
        >
          Emergency
        </Link>
      </nav>

      <div className="nav-actions">
        {isAuthenticated ? (
          <>
            <Link to={getDashboardPath()} className="account-button">
              {user?.role === 'admin' ? 'Admin Portal' : user?.role === 'doctor' ? 'Doctor Portal' : user?.role === 'hospital' ? 'Facility Portal' : 'My Care'} ↗
            </Link>
            <button
              type="button"
              onClick={logout}
              style={{
                background: 'none',
                border: 'none',
                color: '#65756c',
                fontSize: '11px',
                cursor: 'pointer',
                padding: '0 4px'
              }}
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link to="/#help" className="login-link">
              Help
            </Link>
            <Link to="/login" className="account-button">
              Sign in ↗
            </Link>
          </>
        )}
      </div>
    </header>
  )
}
