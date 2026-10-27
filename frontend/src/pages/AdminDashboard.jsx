import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/apiClient.js';
import './Dashboard.css';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);
  const [activeModal, setActiveModal] = useState(null); // { appId, action, applicantName }
  const [modalInput, setModalInput] = useState('');
  const [modalReason, setModalReason] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadAdminData = useCallback(async () => {
    try {
      const [resDash, resVerif] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/verifications'),
      ]);
      if (resDash.success) {
        setData(resDash.data);
      }
      if (resVerif.success) {
        setVerifications(resVerif.data.verifications || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const openReviewModal = (app, action) => {
    setActiveModal({
      appId: app.id,
      applicantUserId: app.user_id,
      applicantName: app.entity_name || app.applicant_email,
      action,
    });
    setModalInput('');
    setModalReason(
      action === 'approved'
        ? 'Verified against official state medical council directory.'
        : ''
    );
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    if (!activeModal) return;

    setSubmittingReview(true);
    setActionMsg(null);

    try {
      const payload = {
        decision: activeModal.action,
        notes: modalReason.trim() || `Administrative ${activeModal.action} decision`,
      };

      if (activeModal.action === 'needs_clarification') {
        payload.clarificationRequest = modalInput.trim();
        payload.decisionReason = 'Additional verification details required.';
      } else if (activeModal.action === 'rejected' || activeModal.action === 'suspended') {
        payload.decisionReason = modalReason.trim() || 'Criteria not met.';
      } else if (activeModal.action === 'approved') {
        payload.decisionReason = modalReason.trim() || 'Verified against primary council registry.';
      }

      const res = await api.post(`/admin/verifications/${activeModal.appId}/review`, payload);
      if (res.success) {
        setActionMsg({
          type: 'success',
          text: `Application #${activeModal.appId} for ${activeModal.applicantName} marked as ${activeModal.action}.`
        });
        setActiveModal(null);
        await loadAdminData();
      } else {
        setActionMsg({
          type: 'error',
          text: res.error || 'Failed to submit review decision.'
        });
      }
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err.message || 'Error processing review decision.'
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <main className="dashboard-page page-width">
      <div className="dashboard-banner">
        <span className="dashboard-banner-badge">Admin Security Console</span>
        <span>
          Platform administration, role provisioning audit, and provider credential verification workflow.
        </span>
      </div>

      <header className="dashboard-header">
        <div className="dashboard-title-wrap">
          <p className="dashboard-eyebrow">SYSTEM & VERIFICATION GOVERNANCE</p>
          <h1>Platform Administration</h1>
          <p className="dashboard-user-meta">
            Officer Session: <strong>{user?.email}</strong> · Role: Administrator
          </p>
        </div>
        <button type="button" onClick={logout} className="dashboard-logout-button">
          Sign out ⎋
        </button>
      </header>

      {actionMsg && (
        <div
          style={{
            padding: '12px 16px',
            background: actionMsg.type === 'success' ? '#def7ec' : '#fde8e8',
            color: actionMsg.type === 'success' ? '#03543f' : '#9b1c1c',
            border: `1px solid ${actionMsg.type === 'success' ? '#bcf0da' : '#f8b4b4'}`,
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '13px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>{actionMsg.text}</span>
          <button
            type="button"
            onClick={() => setActionMsg(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#168044', padding: '24px 0' }}>Loading administration console...</p>
      ) : error ? (
        <div className="login-alert-error">Failed to load admin data: {error}</div>
      ) : (
        <>
          <section className="dashboard-metrics-grid">
            <div className="dashboard-metric-card">
              <p>Registered Patients</p>
              <strong>{data?.metrics?.usersByRole?.patient || 0}</strong>
            </div>
            <div className="dashboard-metric-card">
              <p>Verified Doctors</p>
              <strong>{data?.metrics?.usersByRole?.doctor || 0}</strong>
            </div>
            <div className="dashboard-metric-card">
              <p>Hospitals & Facilities</p>
              <strong>{data?.metrics?.usersByRole?.hospital || 0}</strong>
            </div>
            <div className="dashboard-metric-card">
              <p>Verification Queue</p>
              <strong style={{ color: verifications.length > 0 ? '#1e40af' : '#166534' }}>
                {verifications.length} Submissions
              </strong>
            </div>
          </section>

          <div className="dashboard-panels-grid">
            <div>
              {/* Credential Verification Queue */}
              <article className="dashboard-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h2 style={{ margin: 0 }}>Doctor Credential Review Workflow</h2>
                  <button
                    type="button"
                    onClick={loadAdminData}
                    style={{ background: 'transparent', border: '1px solid #d4ded3', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    ↻ Refresh Queue
                  </button>
                </div>

                {verifications.length > 0 ? (
                  <div className="dashboard-list">
                    {verifications.map((ver) => {
                      const isSelf = user?.id === ver.user_id;
                      let evidenceList = [];
                      if (ver.supporting_evidence_json) {
                        try {
                          evidenceList = JSON.parse(ver.supporting_evidence_json);
                        } catch {
                          evidenceList = [];
                        }
                      }

                      return (
                        <div
                          className="dashboard-list-item"
                          key={ver.id}
                          style={{
                            flexDirection: 'column',
                            alignItems: 'stretch',
                            gap: '10px',
                            background: isSelf ? '#fefce8' : '#ffffff',
                            border: isSelf ? '1px dashed #facc15' : '1px solid #e7eee6'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h3 style={{ margin: 0, fontSize: '15px' }}>
                                  {ver.entity_name || ver.applicant_email}
                                </h3>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>App #{ver.id}</span>
                                {isSelf && (
                                  <span style={{ fontSize: '10px', fontWeight: 700, background: '#fef08a', color: '#854d0e', padding: '2px 6px', borderRadius: '4px' }}>
                                    Your Profile (Self-Approval Prohibited)
                                  </span>
                                )}
                              </div>
                              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#334155' }}>
                                <strong>License / Reg:</strong> {ver.submitted_license_number || 'N/A'} · <strong>Council:</strong> {ver.issuing_council || 'Not provided'}
                              </p>
                              {ver.qualifications && (
                                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#475569' }}>
                                  <strong>Qualifications:</strong> {ver.qualifications}
                                </p>
                              )}
                              {ver.affiliation_requested && (
                                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#0f766e' }}>
                                  <strong>Requested Affiliation:</strong> {ver.affiliation_requested}
                                </p>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className={`status-badge ${ver.status}`}>
                                ● {ver.status}
                              </span>
                            </div>
                          </div>

                          {/* Evidence Metadata Summary */}
                          {evidenceList.length > 0 && (
                            <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', border: '1px solid #e2e8f0' }}>
                              <strong style={{ color: '#475569' }}>Submitted Evidence Metadata:</strong>
                              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                                {evidenceList.map((ev, i) => (
                                  <li key={i}>
                                    {ev.title || 'Registration Document'} {ev.issuer ? `(Issuer: ${ev.issuer})` : ''}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {ver.clarification_request && (
                            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                              <strong style={{ color: '#b45309' }}>Clarification Note:</strong> {ver.clarification_request}
                              {ver.clarification_response && (
                                <p style={{ margin: '4px 0 0', color: '#1e3a8a' }}>
                                  <strong>Doctor Response:</strong> {ver.clarification_response}
                                </p>
                              )}
                            </div>
                          )}

                          {ver.decision_reason && (
                            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                              <strong>Decision Reason:</strong> {ver.decision_reason} {ver.reviewed_by_email ? `(By: ${ver.reviewed_by_email})` : ''}
                            </p>
                          )}

                          {/* Action Buttons for Administrator */}
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                            {ver.status === 'pending' || ver.status === 'needs_clarification' ? (
                              <>
                                <button
                                  type="button"
                                  disabled={isSelf}
                                  onClick={() => openReviewModal(ver, 'approved')}
                                  style={{
                                    padding: '6px 12px',
                                    background: isSelf ? '#9ca3af' : '#177b40',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: isSelf ? 'not-allowed' : 'pointer'
                                  }}
                                  title={isSelf ? 'Cannot approve your own verification' : 'Approve credentials'}
                                >
                                  ✓ Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openReviewModal(ver, 'needs_clarification')}
                                  style={{
                                    padding: '6px 12px',
                                    background: '#d97706',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                  }}
                                >
                                  ? Request Clarification
                                </button>
                                <button
                                  type="button"
                                  disabled={isSelf}
                                  onClick={() => openReviewModal(ver, 'rejected')}
                                  style={{
                                    padding: '6px 12px',
                                    background: isSelf ? '#9ca3af' : '#dc2626',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: isSelf ? 'not-allowed' : 'pointer'
                                  }}
                                >
                                  ✕ Reject
                                </button>
                              </>
                            ) : ver.status === 'approved' ? (
                              <button
                                type="button"
                                disabled={isSelf}
                                onClick={() => openReviewModal(ver, 'suspended')}
                                style={{
                                  padding: '5px 10px',
                                  background: '#b91c1c',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  cursor: isSelf ? 'not-allowed' : 'pointer'
                                }}
                              >
                                ⛔ Suspend Verification
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="dashboard-placeholder-card">
                    <strong>No verification applications currently in queue</strong>
                  </div>
                )}
              </article>

              {/* Administrative Audit Trail */}
              <article className="dashboard-panel">
                <h2>Administrative & Security Audit Trail</h2>
                {data?.recentAuditEvents && data.recentAuditEvents.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {data.recentAuditEvents.slice(0, 10).map((event) => (
                      <div
                        key={event.id}
                        style={{
                          padding: '10px 14px',
                          background: '#f9faf9',
                          border: '1px solid #edf1eb',
                          borderRadius: '6px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '12px'
                        }}
                      >
                        <div>
                          <strong style={{ color: '#177b40' }}>{event.action}</strong>
                          <span style={{ color: '#68776e', marginLeft: '8px' }}>
                            Target: {event.target_type} #{event.target_id} · By: {event.actor_email || 'System'}
                          </span>
                        </div>
                        <span style={{ color: '#88988e' }}>
                          {new Date(event.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#68776e', fontSize: '13px' }}>No audit events logged yet.</p>
                )}
              </article>
            </div>

            <div>
              <aside className="dashboard-panel">
                <h2>Security Architecture Policy</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', lineHeight: '1.6' }}>
                  <p>
                    🔒 <strong>Strict RBAC Enforcement:</strong> All administrative endpoints enforce server-side role verification via signed JWT.
                  </p>
                  <p>
                    🛡️ <strong>Self-Approval Prevention:</strong> Doctors cannot self-approve credentials or bypass state transition checks.
                  </p>
                  <p>
                    📋 <strong>Audit Immutability:</strong> All credential verification events and affiliation updates are logged to <code>audit_events</code>.
                  </p>
                  <p>
                    👁️ <strong>Public Privacy Protection:</strong> Review notes, private evidence metadata, and reviewer IDs are excluded from public discovery APIs.
                  </p>
                </div>
              </aside>

              <div className="dashboard-placeholder-card">
                <strong>⚡ Verification Lifecycle Governance</strong>
                CARES supports comprehensive status transitions: not_submitted → pending → needs_clarification / verified / rejected → suspended.
              </div>
            </div>
          </div>
        </>
      )}

      {/* Review Action Modal */}
      {activeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '10px',
              padding: '24px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', color: '#1f2937' }}>
              Confirm Review Action: <span style={{ textTransform: 'capitalize' }}>{activeModal.action}</span>
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#4b5563' }}>
              Application #{activeModal.appId} for <strong>{activeModal.applicantName}</strong>
            </p>

            <form onSubmit={handleModalSubmit}>
              {activeModal.action === 'needs_clarification' ? (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                    Clarification Inquiries for Applicant *
                  </label>
                  <textarea
                    rows={3}
                    value={modalInput}
                    onChange={(e) => setModalInput(e.target.value)}
                    placeholder="Specify exactly what council details or certificates are required..."
                    required
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                  />
                </div>
              ) : null}

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                  Administrative Note / Justification *
                </label>
                <textarea
                  rows={2}
                  value={modalReason}
                  onChange={(e) => setModalReason(e.target.value)}
                  placeholder="Record primary source verification notes or rejection justification..."
                  required
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  disabled={submittingReview}
                  style={{ padding: '8px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  style={{
                    padding: '8px 16px',
                    background: activeModal.action === 'approved' ? '#166534' : activeModal.action === 'rejected' ? '#dc2626' : '#d97706',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  {submittingReview ? 'Submitting...' : `Confirm ${activeModal.action}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
