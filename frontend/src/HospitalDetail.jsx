import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "./services/apiClient.js";
import { normalizeDepartmentName } from "./utils/hospitalUtils.js";
import "./HospitalDetail.css";

export default function HospitalDetail() {
  const { id } = useParams();
  const [hospital, setHospital] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadFacility() {
      // Validate ID format before calling backend
      const numericId = parseInt(id, 10);
      if (isNaN(numericId) || numericId <= 0 || String(numericId) !== String(id).trim()) {
        if (isMounted) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setNotFound(false);

        const response = await api.get(`/hospitals/${numericId}`);

        if (!isMounted) return;

        if (response && response.success && response.data) {
          setHospital(response.data);
        } else {
          setNotFound(true);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error("Error fetching hospital details:", err);
        if (err.status === 404 || (err.message && err.message.toLowerCase().includes("not found"))) {
          setNotFound(true);
        } else {
          setError(err.message || "Failed to load facility information from server.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadFacility();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <main className="hospital-detail-page">
        <div className="hospital-detail-loading" role="status">
          <p>Loading facility information...</p>
        </div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="hospital-detail-page">
        <Link to="/hospitals" className="hospital-back-link">
          ← Back to Hospital Directory
        </Link>
        <div className="hospital-detail-error" role="alert">
          <h2>Facility Not Found</h2>
          <p>
            The healthcare facility you are looking for does not exist or may have been removed.
          </p>
          <Link to="/hospitals" className="affiliated-view-profile-btn" style={{ display: 'inline-block' }}>
            Browse All Facilities
          </Link>
        </div>
      </main>
    );
  }

  if (error || !hospital) {
    return (
      <main className="hospital-detail-page">
        <Link to="/hospitals" className="hospital-back-link">
          ← Back to Hospital Directory
        </Link>
        <div className="hospital-detail-error" role="alert">
          <h2>Error Loading Facility</h2>
          <p>{error || "Unable to retrieve facility details."}</p>
          <Link to="/hospitals" className="affiliated-view-profile-btn" style={{ display: 'inline-block' }}>
            Return to Directory
          </Link>
        </div>
      </main>
    );
  }

  const isSynthetic = Boolean(hospital.isSynthetic);
  const isVerified = Boolean(!isSynthetic && hospital.isVerified && hospital.verificationStatus === 'verified');
  const isSourced = !isSynthetic && hospital.provenanceStatus === 'publicly_sourced';
  const rawDepartments = Array.isArray(hospital.departments) ? hospital.departments : [];
  const departments = rawDepartments.map(normalizeDepartmentName).filter(Boolean);
  const affiliatedDoctors = Array.isArray(hospital.affiliatedDoctors) ? hospital.affiliatedDoctors : [];

  return (
    <main className="hospital-detail-page">
      <Link to="/hospitals" className="hospital-back-link">
        ← Back to Hospital Directory
      </Link>

      {/* Emergency Guidance and Directory Notice */}
      <section className="hospital-emergency-notice-banner" role="region" aria-label="Emergency and Public Directory Notice">
        <div className="emergency-notice-body">
          <span className="emergency-notice-icon" aria-hidden="true">🚨</span>
          <div className="emergency-notice-text">
            <strong>Emergency Guidance (India):</strong> For life-threatening emergencies, dial <strong>112</strong> (or <strong>108</strong> for ambulance services) immediately.
            Do not rely on CARES to verify real-time emergency capacity or bed availability.
            Facility details, capabilities, and operating schedules are based on static public directory records and may change.
          </div>
        </div>
      </section>

      {/* Facility Hero */}
      <section className="hospital-detail-hero" aria-label="Facility Summary">
        <div className="hospital-detail-avatar" aria-hidden="true">
          🏥
        </div>
        <div className="hospital-detail-heading">
          <p className="hospital-detail-eyebrow">HEALTHCARE FACILITY PROFILE</p>
          <h1>{hospital.name}</h1>
          <p className="hospital-detail-address">
            📍 {hospital.address}{hospital.city ? `, ${hospital.city}` : ""}{hospital.state ? `, ${hospital.state}` : ""}
          </p>

          <div className="hospital-detail-badges">
            {/* Provenance Badge */}
            {isSynthetic ? (
              <span className="hospital-badge demo" title="Synthetic demonstration record">
                Demo Record
              </span>
            ) : isSourced ? (
              <span className="hospital-badge sourced" title="Sourced from official hospital public directories">
                Official Sourced
              </span>
            ) : null}

            {/* Verification Badge */}
            {isVerified ? (
              <span className="hospital-badge verified" title="CARES Verified Facility">
                ✓ Verified
              </span>
            ) : !isSynthetic ? (
              <span className="hospital-badge unverified" title="Credentials and licensing not verified by CARES administrators">
                Not Verified
              </span>
            ) : null}

            {/* Emergency Service Badge */}
            {hospital.emergencyAvailable === true ? (
              <span className="hospital-badge emergency" title="Reported in public directory as providing emergency services">
                {hospital.operatingHours?.emergency === '24/7' ? '🚨 24/7 Emergency (Directory Reported)' : 'Emergency services listed — hours unknown'}
              </span>
            ) : hospital.emergencyAvailable === false ? (
              <span className="hospital-badge no-emergency" title="No dedicated 24/7 emergency unit">
                Non-Emergency Facility
              </span>
            ) : (
              <span className="hospital-badge no-emergency" title="Emergency availability not confirmed in directory">
                Emergency Availability: Not Stated
              </span>
            )}

            {/* Crowd Level - Only displayed for synthetic demo data with explicit demo labeling */}
            {isSynthetic && hospital.crowdLevel ? (
              <span className={`hospital-badge crowd-${hospital.crowdLevel.toLowerCase()} crowd-demo`} title="Simulated demonstration crowd level">
                Demo Crowd: {hospital.crowdLevel}
              </span>
            ) : null}
          </div>
        </div>
      </section>

      {/* Main Grid: Details + Sidebar */}
      <div className="hospital-detail-grid">
        <div className="hospital-detail-main">
          {/* Clinical Departments */}
          <section className="hospital-detail-panel" aria-label="Clinical Departments">
            <h2>Clinical Departments & Specialties</h2>
            {departments.length > 0 ? (
              <div className="hospital-departments-grid">
                {departments.map((dept, idx) => (
                  <span key={idx} className="hospital-department-badge">
                    {dept}
                  </span>
                ))}
              </div>
            ) : (
              <p>Specialty departments not currently listed for this facility.</p>
            )}
          </section>

          {/* Affiliated Clinicians */}
          <section className="hospital-detail-panel" aria-label="Affiliated Clinicians">
            <h2>Affiliated Medical Staff ({affiliatedDoctors.length})</h2>
            {affiliatedDoctors.length === 0 ? (
              <p>No affiliated clinicians currently listed in the CARES network for this facility.</p>
            ) : (
              <div className="affiliated-clinicians-list">
                {affiliatedDoctors.map((doc) => {
                  const docInitials = (doc.fullName || doc.name || "Dr")
                    .split(" ")
                    .filter((p) => !p.startsWith("Dr") && !p.startsWith("Prof"))
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2) || "MD";

                  const isDocVerified = Boolean(!doc.isSynthetic && doc.isVerified && doc.verificationStatus === 'verified');

                  return (
                    <article key={doc.id} className="affiliated-clinician-card">
                      <div className="affiliated-clinician-info">
                        <div className="affiliated-clinician-avatar" aria-hidden="true">
                          {docInitials}
                        </div>
                        <div className="affiliated-clinician-details">
                          <h4>{doc.fullName || doc.name}</h4>
                          <p>{doc.specialty}</p>
                          {(doc.affiliationRole || doc.roleAtFacility) && (
                            <span className="affiliated-clinician-role">
                              {doc.affiliationRole || doc.roleAtFacility}
                            </span>
                          )}
                          {(doc.qualifications || doc.experienceYears || doc.experience) && (
                            <p style={{ fontSize: '12px', color: '#65756c', marginTop: '2px' }}>
                              {doc.qualifications ? doc.qualifications : ''}
                              {(doc.experienceYears || doc.experience) ? ` • ${(doc.experienceYears || doc.experience)} yrs exp` : ''}
                            </p>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {doc.isSynthetic ? (
                          <span className="hospital-badge demo">Demo Data</span>
                        ) : isDocVerified ? (
                          <span className="hospital-badge verified">✓ Verified</span>
                        ) : (
                          <span className="hospital-badge unverified">Not Verified</span>
                        )}

                        <Link
                          to={`/doctors/${doc.id}`}
                          className="affiliated-view-profile-btn"
                          aria-label={`View doctor profile for ${doc.fullName || doc.name}`}
                        >
                          View Profile →
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Provenance Box */}
          <section className="hospital-provenance-box" aria-label="Facility Provenance">
            <h4>Data Provenance & Institutional Notice</h4>
            <div className="hospital-provenance-grid">
              <div>
                <strong>Information Source:</strong>{" "}
                {hospital.sourceUrl ? (
                  <a
                    href={hospital.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#0f766e", textDecoration: "underline" }}
                  >
                    {hospital.sourceOrganization || "Official Healthcare Directory"} ↗
                  </a>
                ) : (
                  hospital.sourceOrganization || "CARES Verified Network Database"
                )}
              </div>
              <div>
                <strong>Provenance Classification:</strong>{" "}
                <span style={{ fontWeight: 600, color: hospital.provenanceStatus === 'cares_verified' ? '#166534' : '#0f766e' }}>
                  {hospital.provenanceStatus || "synthetic_demo"}
                </span>
              </div>
              {hospital.lastCheckedDate && (
                <div>
                  <strong>Last Public Verification Check:</strong> {hospital.lastCheckedDate}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar: Contact & Operating Hours */}
        <aside className="hospital-detail-sidebar" aria-label="Facility Contact & Hours">
          <section className="hospital-detail-panel">
            <h2>Contact Information</h2>
            <div className="hospital-contact-list">
              <div className="hospital-contact-item">
                <span>📍</span>
                <span>{hospital.address}, {hospital.city}, {hospital.state}</span>
              </div>
              {hospital.phone ? (
                <div className="hospital-contact-item">
                  <span>📞</span>
                  <a href={`tel:${hospital.phone}`}>{hospital.phone}</a>
                </div>
              ) : (
                <div className="hospital-contact-item" style={{ color: '#65756c' }}>
                  <span>📞</span>
                  <span>Contact hospital administration</span>
                </div>
              )}
              {hospital.websiteUrl && (
                <div className="hospital-contact-item">
                  <span>🌐</span>
                  <a href={hospital.websiteUrl} target="_blank" rel="noopener noreferrer">
                    Official Website ↗
                  </a>
                </div>
              )}
            </div>
          </section>

          {hospital.operatingHours && typeof hospital.operatingHours === 'object' && (
            <section className="hospital-detail-panel">
              <h2>Operating Schedule</h2>
              <table className="hospital-hours-table">
                <tbody>
                  {hospital.operatingHours.regular && (
                    <tr>
                      <td>OPD / Regular</td>
                      <td>{hospital.operatingHours.regular}</td>
                    </tr>
                  )}
                  {hospital.operatingHours.emergency && (
                    <tr>
                      <td>Emergency Services</td>
                      <td>{hospital.operatingHours.emergency}</td>
                    </tr>
                  )}
                  {hospital.operatingHours.opd && (
                    <tr>
                      <td>Specialist Clinics</td>
                      <td>{hospital.operatingHours.opd}</td>
                    </tr>
                  )}
                  {hospital.operatingHours.specialty_clinics && (
                    <tr>
                      <td>Referral / Specialty Clinics</td>
                      <td>{hospital.operatingHours.specialty_clinics}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p className="schedule-disclaimer">
                ℹ️ Operating hours reflect static public directory records and may vary on holidays, weekends, or during administrative shifts. Please confirm directly with facility reception.
              </p>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
