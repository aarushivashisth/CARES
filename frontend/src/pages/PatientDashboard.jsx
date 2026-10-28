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
  const [cancellingId, setCancellingId] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);

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

  const handleCancelAppointment = async (appt) => {
    const isConfirmed = window.confirm(
      `Are you sure you want to cancel your appointment with ${appt.doctor_name} scheduled for ${appt.requested_date || 'upcoming date'} at ${appt.preferred_slot}?`
    );

    if (!isConfirmed) return;

    setCancellingId(appt.id);
    setActionNotice(null);

    try {
      const res = await api.patch(`/patient/appointments/${appt.id}/cancel`, {
        notes: 'Cancelled by patient via portal',
      });

      if (res.success) {
        setActionNotice({
          type: 'success',
          message: `Appointment #${appt.id} with ${appt.doctor_name} was successfully cancelled.`,
        });
        await loadDashboard();
      } else {
        setActionNotice({
          type: 'error',
          message: res.error || 'Failed to cancel appointment.',
        });
      }
    } catch (err) {
      console.error('Error cancelling appointment:', err);
      setActionNotice({
        type: 'error',
        message: err.message || 'Unable to cancel appointment. Please try again.',
      });
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <main className="dashboard-page page-width">
      <div className="dashboard-banner">
        <span className="dashboard-banner-badge">Patient Portal</span>
        <span>
          Live authenticated session connected to Express REST API & SQLite relational appointment registry.
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

      {actionNotice && (
        <div
          style={{
            padding: '12px 18px',
            marginBottom: '20px',
            borderRadius: '8px',
            background: actionNotice.type === 'success' ? '#def7ec' : '#fde8e8',
            color: actionNotice.type === 'success' ? '#03543f' : '#9b1c1c',
            border: `1px solid ${actionNotice.type === 'success' ? '#bcf0da' : '#f8b4b4'}`,
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{actionNotice.message}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

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
              <p>Confirmed Appointments</p>
              <strong>{data?.metrics?.acceptedAppointments || 0}</strong>
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
                    {data.appointments.map((appt) => {
                      const canCancel = ['pending', 'requested', 'accepted', 'confirmed'].includes(appt.status);
                      const isBusy = cancellingId === appt.id;

                      return (
                        <div className="dashboard-list-item" key={appt.id}>
                          <div className="dashboard-list-info" style={{ flex: '1 1 250px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <h3 style={{ margin: 0 }}>{appt.doctor_name}</h3>
                              <span style={{ fontSize: '11px', color: '#64748b' }}>Req #{appt.id}</span>
                            </div>
                            <p>
                              {appt.doctor_specialty} · {appt.hospital_name || 'Riverside Medical Center'}
                            </p>
                            <p style={{ marginTop: '4px', color: '#177b40', fontWeight: '500' }}>
                              <strong>Date:</strong> {appt.requested_date || 'Upcoming'} · <strong>Time:</strong> {appt.preferred_slot} ({appt.visit_type})
                            </p>
                            {appt.reason_for_visit && (
                              <p style={{ marginTop: '2px', color: '#68776e', fontSize: '11px' }}>
                                <strong>Reason:</strong> {appt.reason_for_visit}
                              </p>
                            )}
                            {appt.latest_notes && (
                              <div className="dashboard-notes-box">
                                <strong>Status Note:</strong> {appt.latest_notes}
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                            <span className={`status-badge ${appt.status}`}>
                              ● {appt.status}
                            </span>

                            {canCancel && (
                              <div className="dashboard-action-buttons">
                                <button
                                  type="button"
                                  className="dashboard-cancel-btn"
                                  disabled={isBusy}
                                  onClick={() => handleCancelAppointment(appt)}
                                >
                                  {isBusy ? 'Cancelling...' : 'Cancel Visit'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
                  <Link to="/hospitals" className="secondary-button" style={{ fontSize: '13px' }}>
                    Explore Hospital Directory
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
                <strong>⚡ Appointment Management Active</strong>
                Requests submitted are securely audited in real-time. You can track doctor confirmation or cancel appointments anytime.
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
