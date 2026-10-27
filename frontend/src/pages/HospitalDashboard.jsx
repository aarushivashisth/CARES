import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/apiClient.js';
import './Dashboard.css';

export default function HospitalDashboard() {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Form states for facility profile
  const [profileForm, setProfileForm] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    phone: '',
    website_url: '',
    regularHours: '08:00 - 20:00',
    emergencyHours: '24/7 Everyday',
    emergency_available: true,
  });

  // Affiliation form state
  const [newAffiliation, setNewAffiliation] = useState({
    doctor_id: '',
    role_at_facility: 'Consultant Physician',
    affiliation_source: 'Official Institutional Roster',
  });
  const [submittingAffiliation, setSubmittingAffiliation] = useState(false);

  const loadHospitalData = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get('/hospital/dashboard');
      if (res.success) {
        setData(res.data);
        const fac = res.data.facility;
        let opHours = { regular: '08:00 - 20:00', emergency: '24/7 Everyday' };
        if (fac?.operating_hours_json) {
          try {
            opHours = JSON.parse(fac.operating_hours_json);
          } catch {
            opHours = { regular: fac.operating_hours_json, emergency: '24/7' };
          }
        }
        setProfileForm({
          name: fac?.name || '',
          address: fac?.address || '',
          city: fac?.city || '',
          state: fac?.state || '',
          phone: fac?.phone || '',
          website_url: fac?.website_url || '',
          regularHours: opHours?.regular || opHours?.opd || '08:00 - 20:00',
          emergencyHours: opHours?.emergency || '24/7 Everyday',
          emergency_available: Boolean(fac?.emergency_available),
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to load facility data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHospitalData();
  }, [loadHospitalData]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setActionNotice(null);

    try {
      const payload = {
        name: profileForm.name.trim(),
        address: profileForm.address.trim(),
        city: profileForm.city.trim(),
        state: profileForm.state.trim(),
        phone: profileForm.phone.trim(),
        website_url: profileForm.website_url.trim(),
        emergency_available: profileForm.emergency_available ? 1 : 0,
        operating_hours_json: JSON.stringify({
          regular: profileForm.regularHours.trim(),
          emergency: profileForm.emergencyHours.trim(),
        }),
      };

      const res = await api.put('/hospital/profile', payload);
      if (res.success) {
        setActionNotice({
          type: 'success',
          text: 'Facility details and operating schedule updated successfully.',
        });
        setIsEditing(false);
        await loadHospitalData();
      } else {
        setActionNotice({
          type: 'error',
          text: res.error || 'Failed to update facility profile.',
        });
      }
    } catch (err) {
      setActionNotice({
        type: 'error',
        text: err.message || 'Error saving facility profile.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddAffiliation = async (e) => {
    e.preventDefault();
    if (!newAffiliation.doctor_id) return;

    setSubmittingAffiliation(true);
    setActionNotice(null);

    try {
      const payload = {
        doctor_id: Number(newAffiliation.doctor_id),
        role_at_facility: newAffiliation.role_at_facility.trim(),
        affiliation_source: newAffiliation.affiliation_source.trim(),
      };

      const res = await api.post('/hospital/affiliations', payload);
      if (res.success) {
        setActionNotice({
          type: 'success',
          text: 'Doctor successfully affiliated with this facility.',
        });
        setNewAffiliation({
          doctor_id: '',
          role_at_facility: 'Consultant Physician',
          affiliation_source: 'Official Institutional Roster',
        });
        await loadHospitalData();
      } else {
        setActionNotice({
          type: 'error',
          text: res.error || 'Failed to add doctor affiliation.',
        });
      }
    } catch (err) {
      setActionNotice({
        type: 'error',
        text: err.message || 'Error affiliating doctor.',
      });
    } finally {
      setSubmittingAffiliation(false);
    }
  };

  const handleRemoveAffiliation = async (doctorId, doctorName) => {
    if (!window.confirm(`Are you sure you want to remove the affiliation for ${doctorName}?`)) {
      return;
    }

    setActionNotice(null);
    try {
      const res = await api.delete(`/hospital/affiliations/${doctorId}`);
      if (res.success) {
        setActionNotice({
          type: 'success',
          text: `Affiliation for ${doctorName} removed successfully.`,
        });
        await loadHospitalData();
      } else {
        setActionNotice({
          type: 'error',
          text: res.error || 'Failed to remove affiliation.',
        });
      }
    } catch (err) {
      setActionNotice({
        type: 'error',
        text: err.message || 'Error removing affiliation.',
      });
    }
  };

  return (
    <main className="dashboard-page page-width">
      <div className="dashboard-banner">
        <span className="dashboard-banner-badge">Hospital Facility Portal</span>
        <span>
          Facility operations console strictly scoped to your assigned healthcare institution.
        </span>
      </div>

      <header className="dashboard-header">
        <div className="dashboard-title-wrap">
          <p className="dashboard-eyebrow">FACILITY OPERATIONS</p>
          <h1>{data?.facility?.name || 'Healthcare Facility'}</h1>
          <p className="dashboard-user-meta">
            {data?.facility?.address}, {data?.facility?.city} · Account: {user?.email}
          </p>
        </div>
        <button type="button" onClick={logout} className="dashboard-logout-button">
          Sign out ⎋
        </button>
      </header>

      {actionNotice && (
        <div
          style={{
            padding: '12px 16px',
            background: actionNotice.type === 'success' ? '#def7ec' : '#fde8e8',
            color: actionNotice.type === 'success' ? '#03543f' : '#9b1c1c',
            border: `1px solid ${actionNotice.type === 'success' ? '#bcf0da' : '#f8b4b4'}`,
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '13px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{actionNotice.text}</span>
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
        <p style={{ color: '#168044', padding: '24px 0' }}>Loading facility data...</p>
      ) : error ? (
        <div className="login-alert-error">Failed to load facility data: {error}</div>
      ) : (
        <>
          <section className="dashboard-metrics-grid">
            <div className="dashboard-metric-card">
              <p>Facility Verification</p>
              <strong style={{ color: data?.facility?.is_verified ? '#03543f' : '#92400e', fontSize: '20px' }}>
                {data?.facility?.is_verified ? '✓ Verified Institution' : 'Pending Verification'}
              </strong>
            </div>
            <div className="dashboard-metric-card">
              <p>Emergency Department</p>
              <strong style={{ color: data?.facility?.emergency_available ? '#03543f' : '#92400e', fontSize: '20px' }}>
                {data?.facility?.emergency_available ? '● Active 24/7' : '○ Not Equipped'}
              </strong>
            </div>
            <div className="dashboard-metric-card">
              <p>Affiliated Doctors</p>
              <strong>{data?.metrics?.totalAffiliatedDoctors || 0} Providers</strong>
            </div>
            <div className="dashboard-metric-card">
              <p>Telemetry Sensors</p>
              <strong style={{ color: '#64748b', fontSize: '16px' }}>Not Configured</strong>
            </div>
          </section>

          <div className="dashboard-panels-grid">
            <div>
              {/* Facility Details & Operating Hours Editor */}
              <article className="dashboard-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h2 style={{ margin: 0 }}>Institution Profile & Operating Schedule</h2>
                  <button
                    type="button"
                    onClick={() => setIsEditing(!isEditing)}
                    style={{
                      background: isEditing ? '#f3f4f6' : '#166534',
                      color: isEditing ? '#374151' : '#ffffff',
                      border: 'none',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {isEditing ? 'Cancel Edit' : 'Edit Facility Info ✎'}
                  </button>
                </div>

                {isEditing ? (
                  <form onSubmit={handleProfileSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                          Facility Name *
                        </label>
                        <input
                          type="text"
                          value={profileForm.name}
                          onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                          required
                          style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                          Official Website URL
                        </label>
                        <input
                          type="url"
                          value={profileForm.website_url}
                          onChange={(e) => setProfileForm({ ...profileForm, website_url: e.target.value })}
                          placeholder="https://hospital.example.org"
                          style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                          Street Address
                        </label>
                        <input
                          type="text"
                          value={profileForm.address}
                          onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                          City
                        </label>
                        <input
                          type="text"
                          value={profileForm.city}
                          onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                          Phone
                        </label>
                        <input
                          type="text"
                          value={profileForm.phone}
                          onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                          OPD / Regular Operating Hours
                        </label>
                        <input
                          type="text"
                          value={profileForm.regularHours}
                          onChange={(e) => setProfileForm({ ...profileForm, regularHours: e.target.value })}
                          placeholder="e.g. Mon–Sat 08:00–14:00"
                          style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                          Emergency Care Hours
                        </label>
                        <input
                          type="text"
                          value={profileForm.emergencyHours}
                          onChange={(e) => setProfileForm({ ...profileForm, emergencyHours: e.target.value })}
                          placeholder="e.g. 24/7 Everyday"
                          style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        id="emergencyAvail"
                        checked={profileForm.emergency_available}
                        onChange={(e) => setProfileForm({ ...profileForm, emergency_available: e.target.checked })}
                      />
                      <label htmlFor="emergencyAvail" style={{ fontSize: '13px', color: '#374151', cursor: 'pointer' }}>
                        Emergency Department operational and accepting trauma admissions
                      </label>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                      <button
                        type="submit"
                        disabled={savingProfile}
                        className="dashboard-accept-btn"
                        style={{ padding: '8px 18px' }}
                      >
                        {savingProfile ? 'Saving...' : 'Save Facility Details'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                    <div><strong>Address:</strong> {data?.facility?.address}, {data?.facility?.city}, {data?.facility?.state}</div>
                    <div><strong>Contact Phone:</strong> {data?.facility?.phone || 'Not listed'}</div>
                    <div>
                      <strong>Official Website:</strong>{' '}
                      {data?.facility?.website_url ? (
                        <a href={data.facility.website_url} target="_blank" rel="noopener noreferrer" style={{ color: '#0f766e', textDecoration: 'underline' }}>
                          {data.facility.website_url} ↗
                        </a>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Unavailable</span>
                      )}
                    </div>
                    <div>
                      <strong>Operating Schedule:</strong>{' '}
                      {profileForm.regularHours} · Emergency: {profileForm.emergencyHours}
                    </div>
                    <div>
                      <strong>Affiliation Source:</strong> {data?.facility?.affiliation_source || 'Institutional Directory'}
                    </div>
                  </div>
                )}
              </article>

              {/* Affiliated Doctors Table & Management */}
              <article className="dashboard-panel">
                <h2>Doctor-Facility Affiliations</h2>
                <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#64748b' }}>
                  Manage physicians authorized to practice at this facility. Affiliations are publicly reflected on doctor cards.
                </p>

                {data?.affiliatedDoctors && data.affiliatedDoctors.length > 0 ? (
                  <div className="dashboard-list">
                    {data.affiliatedDoctors.map((doc) => (
                      <div className="dashboard-list-item" key={doc.id}>
                        <div className="dashboard-list-info">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3 style={{ margin: 0 }}>{doc.full_name}</h3>
                            <span className="status-badge verified" style={{ fontSize: '10px' }}>
                              ✓ Affiliated
                            </span>
                          </div>
                          <p style={{ margin: '4px 0 0' }}>
                            {doc.specialty} · Role: <strong>{doc.role_at_facility}</strong>
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                            Source: {doc.affiliation_source || 'Hospital Roster'} · Checked: {doc.last_checked_date || 'Current'}
                          </p>
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => handleRemoveAffiliation(doc.id, doc.full_name)}
                            style={{
                              padding: '5px 10px',
                              background: '#fef2f2',
                              color: '#991b1b',
                              border: '1px solid #fecaca',
                              borderRadius: '6px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              fontWeight: 600,
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="dashboard-placeholder-card">
                    <strong>No doctors currently affiliated with this facility</strong>
                  </div>
                )}

                {/* Form to affiliate a doctor */}
                {data?.availableDoctors && data.availableDoctors.length > 0 && (
                  <form onSubmit={handleAddAffiliation} style={{ marginTop: '16px', background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ margin: '0 0 10px', fontSize: '14px', color: '#1e293b' }}>
                      + Affiliate a Provider to this Facility
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr auto', gap: '10px', alignItems: 'flex-end' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                          Select Provider *
                        </label>
                        <select
                          value={newAffiliation.doctor_id}
                          onChange={(e) => setNewAffiliation({ ...newAffiliation, doctor_id: e.target.value })}
                          required
                          style={{ width: '100%', boxSizing: 'border-box', padding: '7px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                        >
                          <option value="">-- Choose registered doctor --</option>
                          {data.availableDoctors.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.full_name} ({d.specialty})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                          Role at Facility
                        </label>
                        <input
                          type="text"
                          value={newAffiliation.role_at_facility}
                          onChange={(e) => setNewAffiliation({ ...newAffiliation, role_at_facility: e.target.value })}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '7px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                          Affiliation Source
                        </label>
                        <input
                          type="text"
                          value={newAffiliation.affiliation_source}
                          onChange={(e) => setNewAffiliation({ ...newAffiliation, affiliation_source: e.target.value })}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '7px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={submittingAffiliation}
                        className="dashboard-accept-btn"
                        style={{ padding: '7px 14px', fontSize: '12px' }}
                      >
                        {submittingAffiliation ? 'Saving...' : 'Add Affiliation'}
                      </button>
                    </div>
                  </form>
                )}
              </article>
            </div>

            <div>
              <aside className="dashboard-panel">
                <h2>Clinical Departments</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {data?.facility?.departments && data.facility.departments.length > 0 ? (
                    data.facility.departments.map((dept) => (
                      <div key={dept.name} style={{ borderBottom: '1px solid #edf1eb', paddingBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                          <strong>{dept.name}</strong>
                          <span style={{ color: '#68776e', fontSize: '11px' }}>Standard Outpatient</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: '#68776e', fontSize: '13px' }}>Departments configured on facility record.</p>
                  )}
                </div>
              </aside>

              <aside className="dashboard-panel">
                <h2>Operational Telemetry Notice</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#475569', lineHeight: '1.5' }}>
                  <p style={{ margin: 0 }}>
                    <strong>Live Bed Availability:</strong> <span style={{ color: '#b45309' }}>Data Unavailable</span> (Hospital IoT API link pending integration).
                  </p>
                  <p style={{ margin: 0 }}>
                    <strong>Live Queue Wait Times:</strong> <span style={{ color: '#b45309' }}>Data Unavailable</span> (Estimates are not fabricated as per CARES truth policy).
                  </p>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '11px' }}>
                    CARES strictly adheres to factual representation. Operational metrics are recorded only when live validated sources exist.
                  </p>
                </div>
              </aside>

              <div className="dashboard-placeholder-card">
                <strong>🔒 Multi-Tenant Facility Isolation</strong>
                Hospital managers can only access and update facilities assigned to their authenticated account. Credential verification remains restricted to platform administrators.
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
