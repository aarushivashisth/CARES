import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/apiClient.js';
import './EmergencyResources.css';

const VERIFIED_HELPLINES = [
  {
    number: '112',
    title: 'National Emergency Helpline (ERSS)',
    category: 'All Emergencies',
    badgeClass: 'standard',
    description:
      'Single unified toll-free emergency number across India for medical, police, fire, and disaster rescue response.',
    timing: '24/7 Toll-Free',
    source: 'Emergency Response Support System (ERSS), Ministry of Home Affairs',
    tel: 'tel:112',
  },
  {
    number: '108',
    title: 'Ambulance & Disaster Medical Service',
    category: 'Ambulance / Trauma',
    badgeClass: 'ambulance',
    description:
      'Dedicated emergency medical dispatch for accident rescue, trauma transport, acute critical illness, and disaster medical relief.',
    timing: '24/7 Toll-Free',
    source: 'National Health Mission (NHM) & State Health Departments',
    tel: 'tel:108',
  },
  {
    number: '102',
    title: 'Maternal & Neonatal Transport',
    category: 'Pregnancy & Infant',
    badgeClass: 'maternal',
    description:
      'Free dedicated transport service for pregnant women in labor and sick infants under national maternal healthcare programs.',
    timing: '24/7 Toll-Free',
    source: 'Janani Shishu Suraksha Karyakram (JSSK), MoHFW',
    tel: 'tel:102',
  },
  {
    number: '1075',
    title: 'National Health Helpline (MoHFW)',
    category: 'Health Advisory',
    badgeClass: 'advisory',
    description:
      'Government health advisory line for public health guidance, epidemic information, central hospital queries, and health schemes.',
    timing: '24/7 Toll-Free',
    source: 'Ministry of Health and Family Welfare (MoHFW)',
    tel: 'tel:1075',
  },
  {
    number: '104',
    title: 'State Medical Advice Helpline',
    category: 'Medical Advice',
    badgeClass: 'telecare',
    description:
      'State-level health information for non-emergency clinical guidance, blood bank directory checks, and public healthcare assistance.',
    timing: '24/7 (In participating states)',
    source: 'State Departments of Health & Family Welfare',
    tel: 'tel:104',
  },
];

const EMERGENCY_STEPS = [
  {
    step: '01',
    title: 'Call Responders Immediately',
    description:
      'Dial 112 or 108 without hesitation for chest pain, sudden numbness, severe breathing difficulty, massive bleeding, or loss of consciousness.',
  },
  {
    step: '02',
    title: 'Provide Clear Location & Landmark',
    description:
      'State your exact address, floor, prominent nearby landmark, and an active callback number to help responders locate you quickly.',
  },
  {
    step: '03',
    title: 'Keep Line Open & Follow Instructions',
    description:
      'Stay on the phone until the dispatcher confirms help is on the way. Listen carefully to operational directions and keep the line clear.',
  },
  {
    step: '04',
    title: 'Do Not Delay Urgent Care',
    description:
      'Never delay life-saving medical care to browse reviews, compare doctor profiles, or check crowds. Proceed immediately to the nearest casualty unit if transport is available.',
  },
];

export default function EmergencyResources() {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fetchIndex, setFetchIndex] = useState(0);

  const retryFetch = useCallback(() => {
    setLoading(true);
    setError(null);
    setFetchIndex((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadFacilities() {
      try {
        const response = await api.get('/hospitals?emergency=true');
        if (isMounted) {
          if (response && response.success && Array.isArray(response.data)) {
            setHospitals(response.data);
          } else {
            setHospitals([]);
          }
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to load emergency facilities:', err);
          setError(
            err.message || 'Unable to load facility directory. Please use emergency phone numbers above.'
          );
          setLoading(false);
        }
      }
    }

    loadFacilities();

    return () => {
      isMounted = false;
    };
  }, [fetchIndex]);

  return (
    <div className="emergency-page page-width">
      {/* Urgent Hero Alert Banner */}
      <section className="emergency-hero-banner" aria-label="Urgent Emergency Callout">
        <div className="emergency-hero-header">
          <span className="emergency-hero-icon" aria-hidden="true">🚨</span>
          <div className="emergency-hero-title-group">
            <h1>Emergency Healthcare Resources</h1>
            <p className="emergency-hero-subtitle">
              Immediate contacts, verified hotlines, and guidance for urgent medical situations across India.
            </p>
          </div>
        </div>

        <div className="emergency-disclaimer-box" role="note">
          <strong>Important Disclaimer:</strong> CARES is an academic healthcare navigation prototype and is{' '}
          <strong>not</strong> an emergency dispatch service or medical diagnostic tool. If you or someone near you
          is experiencing a life-threatening medical emergency, call <strong>112</strong> or <strong>108</strong>{' '}
          immediately, or go to the nearest hospital casualty department.
        </div>

        <div className="emergency-quick-actions">
          <a
            href="tel:112"
            className="emergency-call-btn primary-dial"
            aria-label="Call 112 National Emergency Helpline"
          >
            📞 Call 112 (National Emergency)
          </a>
          <a
            href="tel:108"
            className="emergency-call-btn secondary-dial"
            aria-label="Call 108 Ambulance and Trauma Service"
          >
            🚑 Call 108 (Ambulance Service)
          </a>
        </div>
      </section>

      {/* Verified Official Helplines Grid */}
      <section className="emergency-section" aria-labelledby="helplines-heading">
        <div className="emergency-section-header">
          <div className="section-tag">VERIFIED OFFICIAL CONTACTS</div>
          <h2 id="helplines-heading">National Emergency Numbers in India</h2>
          <p>
            Toll-free government helplines. 112, 108, 102, and 1075 operate nationwide; 104 is available in participating states.
          </p>
        </div>

        <div className="helplines-grid">
          {VERIFIED_HELPLINES.map((helpline) => (
            <article key={helpline.number} className="helpline-card" data-testid={`helpline-${helpline.number}`}>
              <div className="helpline-card-top">
                <div className="helpline-number-row">
                  <span className={`helpline-badge ${helpline.badgeClass}`}>{helpline.number}</span>
                  <span className="helpline-hours">{helpline.timing}</span>
                </div>
                <h3>{helpline.title}</h3>
                <p className="helpline-desc">{helpline.description}</p>
                <div className="helpline-source">
                  <span>🏛️</span>
                  <span>{helpline.source}</span>
                </div>
              </div>
              <div className="helpline-action">
                <a
                  href={helpline.tel}
                  className="helpline-call-link"
                  aria-label={`Call ${helpline.number} for ${helpline.title}`}
                >
                  📞 Call {helpline.number}
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Actionable General Guidance */}
      <section className="emergency-section" aria-labelledby="guidance-heading">
        <div className="emergency-section-header">
          <div className="section-tag">ACTIONABLE PROTOCOL</div>
          <h2 id="guidance-heading">What to Do in a Medical Crisis</h2>
          <p>
            Clear operational steps to take while emergency medical services are on their way.
          </p>
        </div>

        <div className="guidance-steps-grid">
          {EMERGENCY_STEPS.map((item) => (
            <article key={item.step} className="guidance-step-card">
              <span className="guidance-step-number">Step {item.step}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Directory Hospitals with Emergency Services */}
      <section className="emergency-section" aria-labelledby="hospitals-heading">
        <div className="emergency-section-header">
          <div className="section-tag">DIRECTORY RESOURCES</div>
          <h2 id="hospitals-heading">Hospitals Reporting Emergency Care</h2>
          <p>
            Facilities in the CARES directory reporting 24/7 casualty or emergency care availability.
          </p>
        </div>

        {loading && (
          <div className="emergency-state-card" data-testid="emergency-loading">
            <p>Loading directory hospitals with emergency care...</p>
          </div>
        )}

        {error && (
          <div className="emergency-state-card error" data-testid="emergency-error" role="alert">
            <p>{error}</p>
            <button
              type="button"
              onClick={retryFetch}
              className="retry-button"
            >
              Retry Loading Facilities
            </button>
          </div>
        )}

        {!loading && !error && hospitals.length === 0 && (
          <div className="emergency-state-card" data-testid="emergency-empty">
            <p>No facilities in the directory currently report 24/7 emergency services.</p>
            <Link to="/hospitals" className="facility-details-link" style={{ display: 'inline-flex' }}>
              Explore Full Hospital Directory →
            </Link>
          </div>
        )}

        {!loading && !error && hospitals.length > 0 && (
          <div className="emergency-hospitals-grid" data-testid="emergency-hospitals-grid">
            {hospitals.map((hospital) => {
              const isSynthetic = Boolean(hospital.isSynthetic);
              const isSourced = !isSynthetic && hospital.provenanceStatus === 'publicly_sourced';
              const emergencyHours =
                hospital.operatingHours?.emergency || 'Reported available (confirm with facility)';
              const regularHours = hospital.operatingHours?.regular || hospital.operatingHours?.opd || 'Hours on record';

              return (
                <article
                  key={hospital.id}
                  className="emergency-facility-card"
                  data-testid={`emergency-facility-${hospital.id}`}
                >
                  <div>
                    <h3>{hospital.name}</h3>

                    <div className="facility-badge-row">
                      <span className="badge-247-emergency">
                        🚨 24/7 Emergency (Directory Reported)
                      </span>
                      {isSynthetic ? (
                        <span className="badge-demo">Demo Facility</span>
                      ) : isSourced ? (
                        <span className="badge-sourced">Official Sourced</span>
                      ) : null}
                    </div>

                    <p className="facility-address">
                      📍 {hospital.address}
                      {hospital.city ? `, ${hospital.city}` : ''}
                      {hospital.state ? `, ${hospital.state}` : ''}
                    </p>

                    <div className="facility-hours-info">
                      <div>
                        <strong>Emergency Department:</strong> {emergencyHours}
                      </div>
                      <div>
                        <strong>OPD / Regular:</strong> {regularHours}
                      </div>
                    </div>
                  </div>

                  <div className="facility-card-actions">
                    {hospital.phone ? (
                      <a
                        href={`tel:${hospital.phone.replace(/[^0-9+]/g, '')}`}
                        className="facility-phone-link"
                        aria-label={`Call ${hospital.name} at ${hospital.phone}`}
                      >
                        📞 Call Hospital: {hospital.phone}
                      </a>
                    ) : (
                      <span className="facility-phone-link" style={{ opacity: 0.7, cursor: 'default' }}>
                        📞 Phone not in directory
                      </span>
                    )}

                    <Link
                      to={`/hospitals/${hospital.id}`}
                      className="facility-details-link"
                      aria-label={`View full details for ${hospital.name}`}
                    >
                      Facility Details & Clinicians →
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="directory-browse-cta">
          <Link to="/hospitals" className="secondary-button">
            Browse All Hospitals in CARES Directory →
          </Link>
          <small>
            Directory listings do not reflect real-time hospital bed occupancy or triage wait times. Always contact the facility or proceed to emergency triage directly.
          </small>
        </div>
      </section>

      {/* Bottom Academic prototype note */}
      <footer className="emergency-academic-footer">
        <strong>Academic Demonstration Notice:</strong> CARES is an educational capstone prototype. Facility records
        and emergency information are compiled for platform demonstration. Never delay urgent medical intervention or
        rely on this prototype for life safety.
      </footer>
    </div>
  );
}
