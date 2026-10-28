import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import './LoginPage.css';

const DEMO_ACCOUNTS = [
  { role: 'Patient', email: 'patient@cares.org', pass: 'Patient@12345', label: 'Patient Portal' },
  { role: 'Doctor', email: 'dr.daniel@cares.org', pass: 'Doctor@12345', label: 'Doctor Portal' },
  { role: 'Hospital', email: 'hospital@riverside.org', pass: 'Hospital@12345', label: 'Facility Portal' },
  { role: 'Admin', email: 'admin@cares.org', pass: 'Admin@12345', label: 'Admin Portal' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleRoleRedirect = (role) => {
    switch (role) {
      case 'patient':
        navigate('/patient/dashboard');
        break;
      case 'doctor':
        navigate('/doctor/dashboard');
        break;
      case 'hospital':
        navigate('/hospital/dashboard');
        break;
      case 'admin':
        navigate('/admin/dashboard');
        break;
      default:
        navigate('/');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    try {
      const user = await login(email, password);
      handleRoleRedirect(user.role);
    } catch (err) {
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickFill = (acc) => {
    setEmail(acc.email);
    setPassword(acc.pass);
    setErrorMsg('');
  };

  return (
    <main className="login-page page-width">
      <div className="login-card">
        <div className="login-header">
          <p className="login-eyebrow">CARES SECURE PORTAL</p>
          <h1>One login for all care roles.</h1>
          <p className="login-subtitle">
            Sign in to access your role-specific dashboard. Your portal is determined automatically by your verified account credentials.
          </p>
        </div>

        {errorMsg && (
          <div className="login-alert-error" role="alert">
            <span>⚠️</span> {errorMsg}
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span>Email Address</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. yourname@domain.com"
              required
              autoComplete="email"
            />
          </label>

          <label className="login-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
          </label>

          <button
            type="submit"
            className="login-submit-button primary-button"
            disabled={submitting}
          >
            {submitting ? 'Authenticating...' : 'Sign in to CARES →'}
          </button>
        </form>

        <div className="login-footer-links">
          <span>New patient?</span>
          <Link to="/register">Create patient account</Link>
        </div>

        <div className="demo-credentials-box">
          <div className="demo-credentials-title">
            <span>⚡ Evaluator Quick-Fill</span>
            <small>Click to auto-fill sample credentials for each role</small>
          </div>
          <div className="demo-account-buttons">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                type="button"
                key={acc.role}
                onClick={() => handleQuickFill(acc)}
                className="demo-pill-button"
              >
                <strong>{acc.role}</strong>
                <span>{acc.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
