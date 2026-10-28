import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "./services/apiClient.js";
import { normalizeDepartmentName } from "./utils/hospitalUtils.js";
import "./HospitalDiscovery.css";

/**
 * HospitalCard Component
 * Displays summary information for a single healthcare facility,
 * adhering strictly to provenance and verification rules.
 */
export function HospitalCard({ hospital }) {
  const rawDepartments = Array.isArray(hospital.departments) ? hospital.departments : [];
  const departments = rawDepartments.map(normalizeDepartmentName).filter(Boolean);

  // Determine provenance & verification badges
  const isSynthetic = Boolean(hospital.isSynthetic);
  const isVerified = Boolean(!isSynthetic && hospital.isVerified && hospital.verificationStatus === 'verified');
  const isSourced = !isSynthetic && hospital.provenanceStatus === 'publicly_sourced';

  return (
    <article className="hospital-card" data-testid={`hospital-card-${hospital.id}`}>
      <div className="hospital-card-header">
        <div className="hospital-icon-avatar" aria-hidden="true">
          🏥
        </div>
        <div className="hospital-card-content">
          <div className="hospital-title-row">
            <h3 style={{ margin: 0 }}>{hospital.name}</h3>

            {/* Provenance Badge */}
            {isSynthetic ? (
              <span className="hospital-badge demo" title="Synthetic demonstration record">
                Demo Data
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

            {/* Emergency Care Badge */}
            {hospital.emergencyAvailable === true ? (
              <span className="hospital-badge emergency" title="Reported in public directory as providing emergency services">
                🚨 24/7 Emergency (Directory Reported)
              </span>
            ) : hospital.emergencyAvailable === false ? (
              <span className="hospital-badge no-emergency" title="No dedicated 24/7 emergency unit">
                Non-Emergency
              </span>
            ) : (
              <span className="hospital-badge no-emergency" title="Emergency availability not confirmed in directory">
                Emergency: Not Stated
              </span>
            )}

            {/* Crowd Level - Only displayed for synthetic demo data with explicit demo labeling */}
            {isSynthetic && hospital.crowdLevel ? (
              <span className={`hospital-badge crowd-${hospital.crowdLevel.toLowerCase()} crowd-demo`} title="Simulated demonstration crowd level">
                Demo Crowd: {hospital.crowdLevel}
              </span>
            ) : null}
          </div>

          <p className="hospital-address-line">
            📍 {hospital.address}{hospital.city ? `, ${hospital.city}` : ""}{hospital.state ? `, ${hospital.state}` : ""}
          </p>

          {/* Operating hours preview if present */}
          {hospital.operatingHours && typeof hospital.operatingHours === 'object' && (
            <div className="hospital-operating-preview">
              {(hospital.operatingHours.regular || hospital.operatingHours.opd) && (
                <span><strong>OPD / Hours:</strong> {hospital.operatingHours.regular || hospital.operatingHours.opd}</span>
              )}
              {hospital.operatingHours.emergency && (
                <span style={{ marginLeft: '12px' }}><strong>Emergency:</strong> {hospital.operatingHours.emergency}</span>
              )}
            </div>
          )}

          {/* Departments preview */}
          {departments.length > 0 && (
            <div className="hospital-departments-preview">
              {departments.slice(0, 4).map((dept, idx) => (
                <span key={idx} className="dept-pill">{dept}</span>
              ))}
              {departments.length > 4 && (
                <span className="dept-pill" style={{ background: '#e2e8f0', color: '#475569' }}>
                  +{departments.length - 4} more
                </span>
              )}
            </div>
          )}

          <div className="hospital-card-footer">
            <span className="hospital-specialists-count">
              👨‍⚕️ {hospital.doctorCount !== undefined ? hospital.doctorCount : 0} Affiliated Clinician{hospital.doctorCount === 1 ? "" : "s"}
            </span>

            <Link
              to={`/hospitals/${hospital.id}`}
              className="hospital-view-link"
              aria-label={`View details for ${hospital.name}`}
            >
              View Facility & Doctors →
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function HospitalDiscovery() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [emergencyOnly, setEmergencyOnly] = useState(false);

  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch hospitals whenever city or emergency filter changes
  const fetchHospitals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedCity && selectedCity.trim()) {
        params.append("city", selectedCity.trim());
      }
      if (emergencyOnly) {
        params.append("emergency", "true");
      }

      const queryString = params.toString();
      const endpoint = `/hospitals${queryString ? `?${queryString}` : ""}`;
      const response = await api.get(endpoint);

      if (response && response.success && Array.isArray(response.data)) {
        setHospitals(response.data);
      } else {
        setHospitals([]);
      }
    } catch (err) {
      console.error("Failed to fetch hospitals:", err);
      setError(err.message || "Failed to load healthcare facilities from server.");
    } finally {
      setLoading(false);
    }
  }, [selectedCity, emergencyOnly]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const params = new URLSearchParams();
        if (selectedCity && selectedCity.trim()) {
          params.append("city", selectedCity.trim());
        }
        if (emergencyOnly) {
          params.append("emergency", "true");
        }

        const queryString = params.toString();
        const endpoint = `/hospitals${queryString ? `?${queryString}` : ""}`;
        const response = await api.get(endpoint);

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
          console.error("Failed to fetch hospitals:", err);
          setError(err.message || "Failed to load healthcare facilities from server.");
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [selectedCity, emergencyOnly]);

  // Client-side text search by hospital name
  const filteredHospitals = useMemo(() => {
    if (!searchTerm.trim()) {
      return hospitals;
    }
    const term = searchTerm.toLowerCase().trim();
    return hospitals.filter((h) => {
      const name = (h.name || "").toLowerCase();
      const address = (h.address || "").toLowerCase();
      const city = (h.city || "").toLowerCase();
      const depts = Array.isArray(h.departments) ? h.departments.join(" ").toLowerCase() : "";
      return name.includes(term) || address.includes(term) || city.includes(term) || depts.includes(term);
    });
  }, [hospitals, searchTerm]);

  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedCity("");
    setEmergencyOnly(false);
  };

  return (
    <main className="hospital-page">
      <header className="hospital-intro">
        <p className="hospital-eyebrow">HEALTHCARE FACILITY NETWORK</p>
        <h1>Find Hospitals & Medical Centers</h1>
        <p>
          Discover verified hospitals, multi-specialty centers, and regional health institutes across Chandigarh and Mohali.
          Filter by emergency readiness, location, and clinical departments.
        </p>
      </header>

      {/* Emergency Guidance and Directory Notice */}
      <section className="hospital-emergency-notice-banner" role="region" aria-label="Emergency and Public Directory Notice">
        <div className="emergency-notice-body">
          <span className="emergency-notice-icon" aria-hidden="true">🚨</span>
          <div className="emergency-notice-text">
            <strong>Emergency Guidance (India):</strong> In a life-threatening medical emergency, call <strong>112</strong> (or <strong>108</strong> for ambulance services) immediately.
            Do not rely on CARES to confirm real-time emergency capacity or bed availability.
            Facility details, capabilities, and operating hours are based on static public directory records and may change.
          </div>
        </div>
      </section>

      {/* Search Bar */}
      <section className="hospital-search-bar" aria-label="Hospital search controls">
        <label htmlFor="hospital-name-search">
          Hospital or Facility Name
          <input
            id="hospital-name-search"
            type="search"
            placeholder="e.g. PGIMER, Fortis, Max Hospital..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </label>

        <label htmlFor="hospital-city-select">
          City / Region
          <select
            id="hospital-city-select"
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
          >
            <option value="">All Cities</option>
            <option value="Chandigarh">Chandigarh</option>
            <option value="SAS Nagar (Mohali)">SAS Nagar (Mohali)</option>
          </select>
        </label>

        <button
          type="button"
          className="hospital-search-btn"
          onClick={fetchHospitals}
        >
          Search Facilities
        </button>
      </section>

      {/* Main Layout: Filters Sidebar + Results List */}
      <div className="hospital-results-layout">
        <aside className="hospital-filters-sidebar" aria-label="Facility filters">
          <div className="hospital-filter-header">
            <h2 style={{ margin: 0 }}>Filter Facilities</h2>
            {(searchTerm || selectedCity || emergencyOnly) && (
              <button
                type="button"
                className="hospital-reset-btn"
                onClick={handleResetFilters}
              >
                Reset filters
              </button>
            )}
          </div>

          <p>Emergency Services</p>
          <label className="hospital-checkbox-label">
            <input
              type="checkbox"
              checked={emergencyOnly}
              onChange={(e) => setEmergencyOnly(e.target.checked)}
            />
            24/7 Emergency Care Only
          </label>

          <hr />

          <p>Quick City Filter</p>
          <label className="hospital-checkbox-label">
            <input
              type="checkbox"
              checked={selectedCity === "Chandigarh"}
              onChange={(e) => setSelectedCity(e.target.checked ? "Chandigarh" : "")}
            />
            Chandigarh Facilities
          </label>
          <label className="hospital-checkbox-label">
            <input
              type="checkbox"
              checked={selectedCity === "SAS Nagar (Mohali)"}
              onChange={(e) => setSelectedCity(e.target.checked ? "SAS Nagar (Mohali)" : "")}
            />
            SAS Nagar (Mohali)
          </label>
        </aside>

        {/* Results Area */}
        <section className="hospital-cards-list" aria-label="Hospital directory results">
          {loading && (
            <div className="hospital-loading-banner" role="status">
              Loading healthcare facilities...
            </div>
          )}

          {error && (
            <div className="hospital-error-state" role="alert">
              <span className="hospital-empty-icon" aria-hidden="true">⚠️</span>
              <h3>Unable to load facilities</h3>
              <p>{error}</p>
              <button
                type="button"
                className="hospital-search-btn"
                onClick={fetchHospitals}
              >
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && (
            <>
              <h2 className="hospital-count-heading">
                Showing {filteredHospitals.length} healthcare {filteredHospitals.length === 1 ? "facility" : "facilities"}
                {selectedCity ? ` in ${selectedCity}` : ""}
                {emergencyOnly ? " with 24/7 emergency care" : ""}
              </h2>

              {filteredHospitals.length === 0 ? (
                <div className="hospital-empty-state">
                  <span className="hospital-empty-icon" aria-hidden="true">🔍</span>
                  <h3>No healthcare facilities found</h3>
                  <p>
                    We couldn't find any facilities matching your search criteria. Try clearing or relaxing your filters.
                  </p>
                  <button
                    type="button"
                    className="hospital-search-btn"
                    onClick={handleResetFilters}
                  >
                    Reset all filters
                  </button>
                </div>
              ) : (
                filteredHospitals.map((hospital) => (
                  <HospitalCard key={hospital.id} hospital={hospital} />
                ))
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
