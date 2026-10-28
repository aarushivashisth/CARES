import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import './LoginPage.css';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('Prefer not to say');
  const [city, setCity] = useState('Chandigarh');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    try {
      await register({
        full_name: fullName,
        email,
        password,
        phone,
        gender,
        city
      });
      navigate('/patient/dashboard');
    } catch (err) {
      setErrorMsg(err.message || 'Registration failed. Please check your information.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page page-width">
      <div className="login-card">
        <div className="login-header">
          <p className="login-eyebrow">NEW PATIENT REGISTRATION</p>
          <h1>Create your CARES account.</h1>
          <p className="login-subtitle">
            Sign up to track appointment requests, save trusted healthcare providers, and manage your health journey.
          </p>
        </div>

        {errorMsg && (
          <div className="login-alert-error" role="alert">
            <span>⚠️</span> {errorMsg}
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span>Full Name</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              required
            />
          </label>

          <label className="login-field">
            <span>Email Address</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. priya@example.com"
              required
            />
          </label>

          <label className="login-field">
            <span>Password (min. 6 characters)</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a secure password"
              minLength={6}
              required
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label className="login-field">
              <span>Phone Number</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 555-0199"
              />
            </label>

            <label className="login-field">
              <span>City</span>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Chandigarh"
              />
            </label>
          </div>

          <label className="login-field">
            <span>Gender Preference</span>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              style={{
                padding: '12px 14px',
                border: '1px solid #d4ded3',
                borderRadius: '8px',
                fontSize: '14px',
                background: '#fcfdfc',
                color: '#203e37'
              }}
            >
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Non-binary">Non-binary</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </label>

          <button
            type="submit"
            className="login-submit-button primary-button"
            disabled={submitting}
          >
            {submitting ? 'Creating account...' : 'Complete Patient Registration →'}
          </button>
        </form>

        <div className="login-footer-links">
          <span>Already registered?</span>
          <Link to="/login">Sign in here</Link>
        </div>
      </div>
    </main>
  );
}
