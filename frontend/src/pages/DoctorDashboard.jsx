import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/apiClient.js';
import './Dashboard.css';

export default function DoctorDashboard() {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);

  const [verificationData, setVerificationData] = useState(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [vForm, setVForm] = useState({
    licenseNumber: '',
    issuingCouncil: '',
    qualifications: '',
    affiliationRequested: '',
    evidenceTitle: '',
    evidenceIssuer: '',
  });
  const [clarificationResponseText, setClarificationResponseText] = useState('');

  const loadDoctorData = useCallback(async () => {
    try {
      setError(null);
      const [resDash, resVerif] = await Promise.all([
        api.get('/doctor/portal/dashboard'),
        api.get('/doctor/portal/verification'),
      ]);
      if (resDash.success) {
        setData(resDash.data);
      }
      if (resVerif.success) {
        setVerificationData(resVerif.data);
        if (resVerif.data?.doctor) {
          setVForm(prev => ({
            ...prev,
            licenseNumber: resVerif.data.doctor.licenseNumber || '',
            issuingCouncil: resVerif.data.doctor.issuingCouncil || '',
            qualifications: resVerif.data.doctor.qualifications || '',
          }));
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load physician console.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDoctorData();
  }, [loadDoctorData]);

  const handleVerificationSubmit = async (e) => {
    e.preventDefault();
    setVerificationLoading(true);
    setActionNotice(null);

    try {
      const payload = {
        licenseNumber: vForm.licenseNumber.trim(),
        issuingCouncil: vForm.issuingCouncil.trim(),
        qualifications: vForm.qualifications.trim(),
        affiliationRequested: vForm.affiliationRequested.trim(),
        supportingEvidence: [
          {
            type: 'professional_registration_certificate',
            title: vForm.evidenceTitle.trim() || 'State Medical Council Certificate',
            issuer: vForm.evidenceIssuer.trim() || vForm.issuingCouncil.trim(),
            verifiedMetadataOnly: true,
          }
        ]
      };

      const res = await api.post('/doctor/portal/verification/submit', payload);
      if (res.success) {
        setActionNotice({
          type: 'success',
          message: 'Verification application submitted successfully. An administrator will review your credentials.',
        });
        await loadDoctorData();
      } else {
        setActionNotice({
          type: 'error',
          message: res.error || 'Failed to submit verification application.',
        });
      }
    } catch (err) {
      setActionNotice({
        type: 'error',
        message: err.message || 'Error submitting verification.',
      });
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleClarificationSubmit = async (e) => {
    e.preventDefault();
    if (!clarificationResponseText.trim()) return;
    setVerificationLoading(true);
    setActionNotice(null);

    try {
      const res = await api.post('/doctor/portal/verification/clarify', {
        clarificationResponse: clarificationResponseText.trim(),
      });
      if (res.success) {
        setActionNotice({
          type: 'success',
          message: 'Clarification submitted. Your application has returned to pending administrative review.',
        });
        setClarificationResponseText('');
        await loadDoctorData();
      } else {
        setActionNotice({
          type: 'error',
          message: res.error || 'Failed to submit clarification.',
        });
      }
    } catch (err) {
      setActionNotice({
        type: 'error',
        message: err.message || 'Error submitting clarification.',
      });
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleStatusChange = async (appointmentId, newStatus) => {
    setUpdatingId(appointmentId);
    setActionNotice(null);

    try {
      const res = await api.patch(`/doctor/portal/appointments/${appointmentId}/status`, {
        status: newStatus,
        notes: `Physician updated status to ${newStatus}`,
      });

      if (res.success) {
        setActionNotice({
          type: 'success',
          message: `Appointment #${appointmentId} has been successfully ${newStatus}.`,
        });
        // Refresh appointment list to reflect current database status
        await loadDoctorData();
      } else {
        setActionNotice({
          type: 'error',
          message: res.error || `Failed to update appointment to ${newStatus}.`,
        });
      }
    } catch (err) {
      console.error('Failed to update appointment status:', err);
      setActionNotice({
        type: 'error',
        message: err.message || `Unable to ${newStatus} appointment #${appointmentId}.`,
      });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <main className="dashboard-page page-width">
      <div className="dashboard-banner">
        <span className="dashboard-banner-badge">Doctor Portal</span>
        <span>
          Live physician management console connected to CARES relational appointment registry.
        </span>
      </div>

      <header className="dashboard-header">
        <div className="dashboard-title-wrap">
          <p className="dashboard-eyebrow">PHYSICIAN CONSOLE</p>
          <h1>{data?.profile?.name || user?.email}</h1>
          <p className="dashboard-user-meta">
            {data?.profile?.specialty} · License: {data?.profile?.licenseNumber}
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
        <p style={{ color: '#168044', padding: '24px 0' }}>Loading physician console...</p>
      ) : error ? (
        <div className="login-alert-error">Failed to load physician data: {error}</div>
      ) : (
        <>
          <section className="dashboard-metrics-grid">
            <div className="dashboard-metric-card">
              <p>Verification Status</p>
              <strong style={{ color: data?.profile?.isVerified ? '#03543f' : '#92400e', fontSize: '20px' }}>
                {data?.profile?.isVerified ? '✓ Verified Provider' : '⏳ Pending Review'}
              </strong>
            </div>
            <div className="dashboard-metric-card">
              <p>Patient Requests</p>
              <strong>{data?.metrics?.totalRequests || (data?.appointments || []).length}</strong>
            </div>
            <div className="dashboard-metric-card">
              <p>Configured Slots</p>
              <strong>{data?.profile?.slots?.length || 0} Slots</strong>
            </div>
          </section>

          <div className="dashboard-panels-grid">
            <div>
              <article className="dashboard-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>Incoming Appointment Requests</h2>
                  <button
                    type="button"
                    onClick={loadDoctorData}
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
                      const isPending = appt.status === 'pending' || appt.status === 'requested';
                      const isBusy = updatingId === appt.id;

                      return (
                        <div className="dashboard-list-item" key={appt.id}>
                          <div className="dashboard-list-info" style={{ flex: '1 1 250px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <h3 style={{ margin: 0 }}>{appt.patient_name || `Patient #${appt.patient_id}`}</h3>
                              <span style={{ fontSize: '11px', color: '#64748b' }}>Req #{appt.id}</span>
                            </div>
                            <p>
                              <strong>Date:</strong> {appt.requested_date || 'Date not specified'} · <strong>Time:</strong> {appt.preferred_slot}
                            </p>
                            <p style={{ marginTop: '4px', color: '#68776e' }}>
                              <strong>Type:</strong> {appt.visit_type} · <strong>Reason:</strong> {appt.reason_for_visit || 'Routine Consultation'}
                            </p>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                            <span className={`status-badge ${appt.status}`}>
                              ● {appt.status}
                            </span>

                            {isPending && (
                              <div className="dashboard-action-buttons">
                                <button
                                  type="button"
                                  className="dashboard-accept-btn"
                                  disabled={isBusy}
                                  onClick={() => handleStatusChange(appt.id, 'accepted')}
                                >
                                  {isBusy ? 'Saving...' : '✓ Accept'}
                                </button>
                                <button
                                  type="button"
                                  className="dashboard-decline-btn"
                                  disabled={isBusy}
                                  onClick={() => handleStatusChange(appt.id, 'declined')}
                                >
                                  {isBusy ? 'Saving...' : '✕ Decline'}
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
                    <strong>No incoming appointment requests currently pending</strong>
                    Patient consultation requests will appear here as they are submitted through the discovery directory.
                  </div>
                )}
              </article>
            </div>

            <div>
              <aside className="dashboard-panel" style={{ marginBottom: '20px' }}>
                <h2>Credential Verification & Registration</h2>
                {(() => {
                  const vStatus = verificationData?.doctor?.verificationStatus || 'not_submitted';
                  const app = verificationData?.application;

                  if (vStatus === 'verified') {
                    return (
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontWeight: 700, marginBottom: '6px' }}>
                          <span>✓ Official Credential Verification Active</span>
                        </div>
                        <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#14532d' }}>
                          Your medical registration has been verified against the official medical council directory. Your profile displays the public verified badge.
                        </p>
                        <div style={{ fontSize: '12px', color: '#374151', lineHeight: '1.6' }}>
                          <div><strong>Registration #:</strong> {verificationData?.doctor?.licenseNumber}</div>
                          <div><strong>Issuing Council:</strong> {verificationData?.doctor?.issuingCouncil || 'State Medical Council'}</div>
                          <div><strong>Qualifications:</strong> {verificationData?.doctor?.qualifications || 'Medical Degree'}</div>
                          {verificationData?.doctor?.verifiedAt && (
                            <div><strong>Verified On:</strong> {verificationData?.doctor?.verifiedAt}</div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  if (vStatus === 'needs_clarification') {
                    return (
                      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '14px' }}>
                        <div style={{ color: '#b45309', fontWeight: 700, marginBottom: '6px' }}>
                          ⚠ Clarification Requested by Administrator
                        </div>
                        <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#78350f', background: '#fef3c7', padding: '8px 12px', borderRadius: '6px' }}>
                          "{app?.clarification_request || 'Please provide updated registration council details.'}"
                        </p>
                        <form onSubmit={handleClarificationSubmit}>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                            Your Clarification Response:
                          </label>
                          <textarea
                            rows={3}
                            value={clarificationResponseText}
                            onChange={(e) => setClarificationResponseText(e.target.value)}
                            placeholder="Provide requested details or registration confirmation..."
                            required
                            style={{ width: '100%', boxSizing: 'border-box', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', marginBottom: '8px' }}
                          />
                          <button
                            type="submit"
                            disabled={verificationLoading}
                            className="dashboard-accept-btn"
                            style={{ width: '100%', padding: '8px' }}
                          >
                            {verificationLoading ? 'Submitting...' : 'Submit Clarification Response →'}
                          </button>
                        </form>
                      </div>
                    );
                  }

                  if (vStatus === 'pending') {
                    return (
                      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '14px' }}>
                        <div style={{ color: '#1e40af', fontWeight: 700, marginBottom: '6px' }}>
                          ⏳ Application Under Administrative Review
                        </div>
                        <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#1e3a8a' }}>
                          Your credentials are submitted and undergoing primary source verification against medical council registries. You will receive an update once an administrator reviews your submission.
                        </p>
                        <div style={{ fontSize: '12px', color: '#4b5563' }}>
                          <div><strong>License #:</strong> {verificationData?.doctor?.licenseNumber}</div>
                          <div><strong>Council:</strong> {verificationData?.doctor?.issuingCouncil || 'Submitted Council'}</div>
                          <div><strong>Qualifications:</strong> {verificationData?.doctor?.qualifications}</div>
                        </div>
                      </div>
                    );
                  }

                  if (vStatus === 'suspended') {
                    return (
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '14px' }}>
                        <div style={{ color: '#991b1b', fontWeight: 700, marginBottom: '6px' }}>
                          ⛔ Verification Suspended
                        </div>
                        <p style={{ margin: 0, fontSize: '13px', color: '#7f1d1d' }}>
                          Reason: {app?.decision_reason || 'Administrative policy review or lapsed council registration.'}
                        </p>
                      </div>
                    );
                  }

                  // Default: not_submitted, unverified, or rejected
                  return (
                    <div>
                      {vStatus === 'rejected' && (
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '10px', marginBottom: '12px', fontSize: '12px', color: '#991b1b' }}>
                          <strong>Previous Submission Rejected:</strong> {app?.decision_reason || 'Unable to confirm registration.'}
                        </div>
                      )}
                      <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#4b5563' }}>
                        Submit your professional medical registration to earn the official CARES Verified badge.
                      </p>
                      <form onSubmit={handleVerificationSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151' }}>
                            Registration / License Number *
                          </label>
                          <input
                            type="text"
                            value={vForm.licenseNumber}
                            onChange={(e) => setVForm({ ...vForm, licenseNumber: e.target.value })}
                            placeholder="e.g. PMC-2015-8492"
                            required
                            style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151' }}>
                            Issuing Medical Council *
                          </label>
                          <input
                            type="text"
                            value={vForm.issuingCouncil}
                            onChange={(e) => setVForm({ ...vForm, issuingCouncil: e.target.value })}
                            placeholder="e.g. Punjab Medical Council (PMC) / NMC"
                            required
                            style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151' }}>
                            Degrees & Qualifications *
                          </label>
                          <input
                            type="text"
                            value={vForm.qualifications}
                            onChange={(e) => setVForm({ ...vForm, qualifications: e.target.value })}
                            placeholder="e.g. MBBS, MD (Internal Medicine)"
                            required
                            style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151' }}>
                            Affiliation Request
                          </label>
                          <input
                            type="text"
                            value={vForm.affiliationRequested}
                            onChange={(e) => setVForm({ ...vForm, affiliationRequested: e.target.value })}
                            placeholder="e.g. PGIMER Sector 12 / Fortis Mohali"
                            style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151' }}>
                            Supporting Evidence Document Title
                          </label>
                          <input
                            type="text"
                            value={vForm.evidenceTitle}
                            onChange={(e) => setVForm({ ...vForm, evidenceTitle: e.target.value })}
                            placeholder="e.g. State Medical Council Registration Certificate 2024"
                            style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={verificationLoading}
                          className="dashboard-accept-btn"
                          style={{ width: '100%', marginTop: '6px', padding: '8px' }}
                        >
                          {verificationLoading ? 'Submitting Application...' : 'Submit Credentials for Verification'}
                        </button>
                      </form>
                    </div>
                  );
                })()}
              </aside>

              <aside className="dashboard-panel">
                <h2>Clinical Practice Details</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: '#68776e', display: 'block', fontSize: '11px' }}>SPECIALTY</span>
                    <strong>{data?.profile?.specialty}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#68776e', display: 'block', fontSize: '11px' }}>LICENSE</span>
                    <strong>{data?.profile?.licenseNumber}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#68776e', display: 'block', fontSize: '11px' }}>ISSUING COUNCIL</span>
                    <strong>{verificationData?.doctor?.issuingCouncil || 'Not specified'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#68776e', display: 'block', fontSize: '11px' }}>QUALIFICATIONS</span>
                    <strong>{verificationData?.doctor?.qualifications || 'MBBS / Specialist'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#68776e', display: 'block', fontSize: '11px' }}>AFFILIATED HOSPITAL</span>
                    <strong>Riverside Medical Center</strong>
                  </div>
                </div>
              </aside>

              <div className="dashboard-placeholder-card">
                <strong>⚡ Appointment State Management</strong>
                Doctors can accept or decline pending patient appointment requests. Status updates are audited in real time and recorded in SQLite.
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
