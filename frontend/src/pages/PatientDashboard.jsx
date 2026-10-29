import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/useAuth.js';
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

  // Milestone 6: Edit Patient Profile State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone: '',
    gender: 'Prefer not to say',
    date_of_birth: '',
    emergency_contact: '',
    city: 'Chandigarh',
  });
  const [profileErrors, setProfileErrors] = useState({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileModalError, setProfileModalError] = useState(null);

  const modalRef = useRef(null);
  const triggerRef = useRef(null);

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
    let isMounted = true;
    async function init() {
      try {
        setError(null);
        const res = await api.get('/patient/dashboard');
        if (!isMounted) return;
        if (res.success) {
          setData(res.data);
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load patient portal data.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, []);

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

  const handleOpenEditProfile = (e) => {
    triggerRef.current = e?.currentTarget || document.activeElement;
    if (data?.profile) {
      setProfileForm({
        full_name: data.profile.full_name || '',
        phone: data.profile.phone || '',
        gender: data.profile.gender || 'Prefer not to say',
        date_of_birth: data.profile.date_of_birth || '',
        emergency_contact: data.profile.emergency_contact || '',
        city: data.profile.city || 'Chandigarh',
      });
    }
    setProfileErrors({});
    setProfileModalError(null);
    setIsEditingProfile(true);
  };

  const handleCloseEditProfile = () => {
    setIsEditingProfile(false);
    setProfileErrors({});
    setProfileModalError(null);
    setTimeout(() => {
      triggerRef.current?.focus?.();
    }, 0);
  };

  // Keyboard accessibility: Escape to dismiss, initial focus, and Tab focus trap
  useEffect(() => {
    if (!isEditingProfile) return;

    const focusTimer = setTimeout(() => {
      if (modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length > 0) {
          focusable[0].focus();
        }
      }
    }, 10);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCloseEditProfile();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusables = Array.from(
          modalRef.current.querySelectorAll(
            'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || !modalRef.current.contains(document.activeElement)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement || !modalRef.current.contains(document.activeElement)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEditingProfile]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const errors = {};

    const trimmedName = profileForm.full_name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      errors.full_name = 'Full name must be at least 2 characters.';
    } else if (trimmedName.length > 100) {
      errors.full_name = 'Full name cannot exceed 100 characters.';
    }

    if (profileForm.phone && profileForm.phone.trim()) {
      const trimmedPhone = profileForm.phone.trim();
      const phoneRegex = /^[+0-9()\-\s]{7,25}$/;
      const digitsOnly = trimmedPhone.replace(/\D/g, '');
      if (!phoneRegex.test(trimmedPhone) || digitsOnly.length < 7 || digitsOnly.length > 15) {
        errors.phone = 'Phone number must be between 7 and 25 valid phone characters.';
      }
    }

    if (profileForm.date_of_birth && profileForm.date_of_birth.trim()) {
      const today = new Date().toISOString().split('T')[0];
      if (profileForm.date_of_birth.trim() > today) {
        errors.date_of_birth = 'Date of birth cannot be in the future.';
      }
    }

    if (profileForm.emergency_contact && profileForm.emergency_contact.trim().length > 200) {
      errors.emergency_contact = 'Emergency contact cannot exceed 200 characters.';
    }

    if (profileForm.city && profileForm.city.trim().length > 100) {
      errors.city = 'City cannot exceed 100 characters.';
    }

    if (Object.keys(errors).length > 0) {
      setProfileErrors(errors);
      return;
    }

    setProfileSaving(true);
    setProfileErrors({});
    setProfileModalError(null);

    try {
      const res = await api.put('/patient/profile', {
        full_name: trimmedName,
        phone: profileForm.phone.trim() || null,
        gender: profileForm.gender,
        date_of_birth: profileForm.date_of_birth.trim() || null,
        emergency_contact: profileForm.emergency_contact.trim() || null,
        city: profileForm.city.trim() || 'Chandigarh',
      });

      if (res.success) {
        setData((prev) => ({
          ...prev,
          profile: res.data,
        }));
        handleCloseEditProfile();
        setActionNotice({
          type: 'success',
          message: 'Your patient profile has been updated successfully.',
        });
      } else {
        setProfileModalError(res.error || 'Failed to update profile.');
      }
    } catch (err) {
      setProfileModalError(err.message || 'Error updating profile. Please try again.');
    } finally {
      setProfileSaving(false);
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
          <p><Link to="/home-care">Care at Home — request support and track enquiries</Link></p>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h2 style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>Patient Profile</h2>
                  <button
                    type="button"
                    onClick={handleOpenEditProfile}
                    className="secondary-button"
                    style={{ fontSize: '12px', padding: '4px 10px' }}
                  >
                    ✎ Edit
                  </button>
                </div>
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
                    <span style={{ color: '#68776e', display: 'block', fontSize: '11px' }}>DATE OF BIRTH</span>
                    <strong>{data?.profile?.date_of_birth || 'Not specified'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#68776e', display: 'block', fontSize: '11px' }}>CITY</span>
                    <strong>{data?.profile?.city || 'Chandigarh'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#68776e', display: 'block', fontSize: '11px' }}>EMERGENCY CONTACT</span>
                    <strong>{data?.profile?.emergency_contact || 'None listed'}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOpenEditProfile}
                  className="secondary-button"
                  style={{ width: '100%', marginTop: '16px', fontSize: '13px', textAlign: 'center' }}
                >
                  ✎ Edit Profile
                </button>
              </aside>

              <div className="dashboard-placeholder-card">
                <strong>⚡ Appointment Management Active</strong>
                Requests submitted are securely audited in real-time. You can track doctor confirmation or cancel appointments anytime.
              </div>
            </div>
          </div>
        </>
      )}

      {/* Milestone 6 & 7: Accessible Edit Profile Modal */}
      {isEditingProfile && (
        <div
          ref={modalRef}
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-profile-title"
          aria-describedby="edit-profile-desc"
        >
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h2 id="edit-profile-title">Edit Patient Profile</h2>
                <p id="edit-profile-desc" style={{ fontSize: '12px', color: '#68776e', margin: '2px 0 0' }}>
                  Update your personal and emergency contact details.
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                aria-label="Close modal"
                onClick={handleCloseEditProfile}
              >
                ✕
              </button>
            </div>

            {profileModalError && (
              <div
                style={{
                  padding: '10px 14px',
                  marginBottom: '16px',
                  borderRadius: '6px',
                  background: '#fde8e8',
                  color: '#9b1c1c',
                  border: '1px solid #f8b4b4',
                  fontSize: '13px',
                }}
              >
                {profileModalError}
              </div>
            )}

            <form onSubmit={handleSaveProfile}>
              <div className="modal-field">
                <label htmlFor="edit-full-name">Full Name *</label>
                <input
                  id="edit-full-name"
                  type="text"
                  className={`modal-input ${profileErrors.full_name ? 'error' : ''}`}
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                  placeholder="Your full legal name"
                  required
                />
                {profileErrors.full_name && (
                  <span className="field-error-text">{profileErrors.full_name}</span>
                )}
              </div>

              <div className="modal-field">
                <label htmlFor="edit-phone">Phone Number</label>
                <input
                  id="edit-phone"
                  type="tel"
                  className={`modal-input ${profileErrors.phone ? 'error' : ''}`}
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  placeholder="e.g. 555-0192 or +91-9876543210"
                />
                {profileErrors.phone ? (
                  <span className="field-error-text">{profileErrors.phone}</span>
                ) : (
                  <span className="field-help-text">Standard contact number for appointment alerts</span>
                )}
              </div>

              <div className="modal-field">
                <label htmlFor="edit-gender">Gender</label>
                <select
                  id="edit-gender"
                  className="modal-select"
                  value={profileForm.gender}
                  onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>

              <div className="modal-field">
                <label htmlFor="edit-dob">Date of Birth</label>
                <input
                  id="edit-dob"
                  type="date"
                  max={new Date().toISOString().split('T')[0]}
                  className={`modal-input ${profileErrors.date_of_birth ? 'error' : ''}`}
                  value={profileForm.date_of_birth}
                  onChange={(e) => setProfileForm({ ...profileForm, date_of_birth: e.target.value })}
                />
                {profileErrors.date_of_birth && (
                  <span className="field-error-text">{profileErrors.date_of_birth}</span>
                )}
              </div>

              <div className="modal-field">
                <label htmlFor="edit-emergency-contact">Emergency Contact</label>
                <input
                  id="edit-emergency-contact"
                  type="text"
                  maxLength={200}
                  className={`modal-input ${profileErrors.emergency_contact ? 'error' : ''}`}
                  value={profileForm.emergency_contact}
                  onChange={(e) => setProfileForm({ ...profileForm, emergency_contact: e.target.value })}
                  placeholder="e.g. Vikram Sharma (555-0193)"
                />
                {profileErrors.emergency_contact && (
                  <span className="field-error-text">{profileErrors.emergency_contact}</span>
                )}
              </div>

              <div className="modal-field">
                <label htmlFor="edit-city">City</label>
                <input
                  id="edit-city"
                  type="text"
                  maxLength={100}
                  className={`modal-input ${profileErrors.city ? 'error' : ''}`}
                  value={profileForm.city}
                  onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                  placeholder="e.g. Chandigarh"
                />
                {profileErrors.city && (
                  <span className="field-error-text">{profileErrors.city}</span>
                )}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={profileSaving}
                  onClick={handleCloseEditProfile}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={profileSaving}
                >
                  {profileSaving ? 'Saving Profile...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
