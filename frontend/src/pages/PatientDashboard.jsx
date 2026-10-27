import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/apiClient.js';
import { Link } from 'react-router-dom';
import './Dashboard.css';

export default function PatientDashboard() {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDashboard = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get('/patient/dashboard');
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load patient portal data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <main className="dashboard-page page-width">
      <div className="dashboard-banner">
        <span className="dashboard-banner-badge">Milestone 1 Foundation</span>
        <span>
          Live authenticated session connected to Express REST API & SQLite relational database.
        </span>
      </div>

      <header className="dashboard-header">
        <div className="dashboard-title-wrap">
          <p className="dashboard-eyebrow">PATIENT CARE PORTAL</p>
          <h1>Welcome, {user?.profile?.full_name || 'Patient'}</h1>
          <p className="dashboard-user-meta">
            Logged in as <strong>{user?.email}</strong> · Role: Patient
          </p>
        </div>
        <button type="button" onClick={logout} className="dashboard-logout-button">
          Sign out ⎋
        </button>
      </header>

      {loading ? (
        <p style={{ color: '#168044', padding: '24px 0' }}>Loading patient portal data...</p>
      ) : error ? (
        <div className="login-alert-error">Failed to load portal data: {error}</div>
      ) : (
        <>
          <section className="dashboard-metrics-grid">
            <div className="dashboard-metric-card">
              <p>Requested Appointments</p>
              <strong>{data?.metrics?.totalAppointments || 0}</strong>
            </div>
            <div className="dashboard-metric-card">
              <p>Pending Doctor Review</p>
              <strong>{data?.metrics?.pendingRequests || 0}</strong>
            </div>
            <div className="dashboard-metric-card">
              <p>Primary Region</p>
              <strong>{data?.profile?.city || 'Chandigarh'}</strong>
            </div>
          </section>

          <div className="dashboard-panels-grid">
            <div>
              <article className="dashboard-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>Your Appointment Requests</h2>
                  <button
                    type="button"
                    onClick={loadDashboard}
                    style={{
                      background: 'transparent',
                      border: '1px solid #d4ded3',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#3b5247',
                      cursor: 'pointer',
                    }}
                  >
                    ↻ Refresh
                  </button>
                </div>
                {data?.appointments && data.appointments.length > 0 ? (
                  <div className="dashboard-list">
                    {data.appointments.map((appt) => (
                      <div className="dashboard-list-item" key={appt.id}>
                        <div className="dashboard-list-info">
                          <h3>{appt.doctor_name}</h3>
                          <p>{appt.doctor_specialty} · {appt.hospital_name || 'Riverside Medical Center'}</p>
                          <p style={{ marginTop: '4px', color: '#177b40', fontWeight: '500' }}>
                            <strong>Date:</strong> {appt.requested_date || 'Upcoming'} · <strong>Time:</strong> {appt.preferred_slot} ({appt.visit_type})
                          </p>
                          {appt.reason_for_visit && (
                            <p style={{ marginTop: '2px', color: '#68776e', fontSize: '11px' }}>
                              Reason: {appt.reason_for_visit}
                            </p>
                          )}
                        </div>
                        <div>
                          <span className={`status-badge ${appt.status}`}>
                            ● {appt.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="dashboard-placeholder-card">
                    <strong>No appointments requested yet</strong>
                    You can discover doctors and request appointments through the directory.
                    <div style={{ marginTop: '12px' }}>
                      <Link to="/doctors" className="primary-button" style={{ fontSize: '12px', padding: '8px 14px' }}>
                        Browse Doctors →
                      </Link>
                    </div>
                  </div>
                )}
              </article>

              <article className="dashboard-panel">
                <h2>Care Navigation Quick Actions</h2>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <Link to="/doctors" className="primary-button" style={{ fontSize: '13px' }}>
                    Find a Doctor <span>→</span>
                  </Link>
                  <Link to="/#hospitals" className="secondary-button" style={{ fontSize: '13px' }}>
                    View Hospital Crowd Insights
                  </Link>
                  <Link to="/#home-care" className="secondary-button" style={{ fontSize: '13px' }}>
                    Explore Home Care
                  </Link>
                </div>
              </article>
            </div>

            <div>
              <aside className="dashboard-panel">
                <h2>Patient Profile</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: '#68776e', display: 'block', fontSize: '11px' }}>NAME</span>
                    <strong>{data?.profile?.full_name}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#68776e', display: 'block', fontSize: '11px' }}>PHONE</span>
                    <strong>{data?.profile?.phone || 'Not provided'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#68776e', display: 'block', fontSize: '11px' }}>GENDER</span>
                    <strong>{data?.profile?.gender || 'Not specified'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#68776e', display: 'block', fontSize: '11px' }}>EMERGENCY CONTACT</span>
                    <strong>{data?.profile?.emergency_contact || 'None listed'}</strong>
                  </div>
                </div>
              </aside>

              <div className="dashboard-placeholder-card">
                <strong>⚡ Milestone 1 Foundation Note</strong>
                This portal is connected to the SQLite database. Future milestones will connect real EHR records, RAG navigation chatbot, and live booking confirmations.
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
