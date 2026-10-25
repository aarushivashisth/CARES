
import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const { pathname } = useLocation()
  const isHome = pathname === '/'

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

        <Link to="/#hospitals">Hospital insights</Link>
        <Link to="/#home-care">Care at home</Link>
        <Link to="/#emergency">Emergency</Link>
      </nav>

      <div className="nav-actions">
        <Link to="/#help" className="login-link">
          Help
        </Link>
        <Link to="/#my-care" className="account-button">
          My care ↗
        </Link>
      </div>
    </header>
  )
}
