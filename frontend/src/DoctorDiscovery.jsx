import { Link } from "react-router-dom";
import { useEffect, useMemo, useState, useCallback } from "react";
import "./DoctorDiscovery.css";
import { api } from "./services/apiClient.js";
import { doctors as fallbackDoctors } from "./doctorData.js";

const initialFilters = {
  next3Days: true,
  today: false,
  thisWeek: false,
  inPerson: true,
  video: false,
  english: false,
  spanish: false,
  mandarin: false,
  accepting: true,
  female: false,
  accessible: false,
};

export default function DoctorDiscovery() {
  const [specialty, setSpecialty] = useState("All specialties");
  const [location, setLocation] = useState("");
  const [insurance, setInsurance] = useState("Any insurance");

  const [search, setSearch] = useState({
    specialty: "All specialties",
    location: "",
    insurance: "Any insurance",
  });

  const [filters, setFilters] = useState(initialFilters);
  const [doctorRecords, setDoctorRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/doctors");
      if (response && response.success && Array.isArray(response.data)) {
        setDoctorRecords(response.data);
      } else {
        setDoctorRecords([]);
      }
    } catch (err) {
      console.error("Error fetching provider directory:", err);
      setError(err.message || "Unable to load doctors from database.");
      // If offline/fallback needed, populate fallbackDoctors so UI remains functional
      if (fallbackDoctors && fallbackDoctors.length > 0) {
        setDoctorRecords(fallbackDoctors);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const response = await api.get("/doctors");
        if (isMounted) {
          if (response && response.success && Array.isArray(response.data)) {
            setDoctorRecords(response.data);
          } else {
            setDoctorRecords([]);
          }
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Error fetching provider directory:", err);
          setError(err.message || "Unable to load doctors from database.");
          if (fallbackDoctors && fallbackDoctors.length > 0) {
            setDoctorRecords(fallbackDoctors);
          }
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const updateFilter = (name, checked) => {
    setFilters((previous) => ({
      ...previous,
      [name]: checked,
    }));
  };

  const filteredDoctors = useMemo(() => {
    return (doctorRecords || []).filter((doctor) => {
      const docName = doctor.name || "";
      const docSpecialty = doctor.specialty || "";
      const docHospital = doctor.hospital || "";
      const docDistance = doctor.distance || "";
      const docInsurance = Array.isArray(doctor.insurance) ? doctor.insurance : [];
      const docLanguages = Array.isArray(doctor.languages) ? doctor.languages : [];
      const docVisitTypes = Array.isArray(doctor.visitTypes) ? doctor.visitTypes : [];
      const docAvailability = Array.isArray(doctor.availability)
        ? doctor.availability
        : ["Next 3 days", "This week"];
      const docGender = doctor.gender || (docName.includes("Maya") || docName.includes("Sofia") ? "Female" : "Male");

      const searchText = search.location.trim().toLowerCase();

      const matchesSpecialty =
        search.specialty === "All specialties" ||
        docSpecialty.toLowerCase().includes(search.specialty.toLowerCase()) ||
        docName.toLowerCase().includes(search.specialty.toLowerCase());

      const matchesLocation =
        !searchText ||
        docHospital.toLowerCase().includes(searchText) ||
        docDistance.toLowerCase().includes(searchText) ||
        docName.toLowerCase().includes(searchText);

      const matchesInsurance =
        search.insurance === "Any insurance" ||
        docInsurance.some((ins) => ins.toLowerCase().includes(search.insurance.toLowerCase()));

      const selectedAvailability = [];
      if (filters.today) selectedAvailability.push("Today");
      if (filters.next3Days) selectedAvailability.push("Next 3 days");
      if (filters.thisWeek) selectedAvailability.push("This week");

      const matchesAvailability =
        selectedAvailability.length === 0 ||
        selectedAvailability.some((item) => docAvailability.includes(item));

      const selectedLanguages = [];
      if (filters.english) selectedLanguages.push("English");
      if (filters.spanish) selectedLanguages.push("Spanish");
      if (filters.mandarin) selectedLanguages.push("Mandarin");

      const matchesLanguage =
        selectedLanguages.length === 0 ||
        selectedLanguages.some((language) => docLanguages.includes(language));

      const selectedVisitTypes = [];
      if (filters.inPerson) selectedVisitTypes.push("In-person");
      if (filters.video) selectedVisitTypes.push("Video consultation");

      const matchesVisitType =
        selectedVisitTypes.length === 0 ||
        selectedVisitTypes.some((type) => docVisitTypes.includes(type));

      const matchesAccepting =
        !filters.accepting || Boolean(doctor.accepting);

      const matchesGender =
        !filters.female || docGender === "Female";

      const matchesAccessibility =
        !filters.accessible || Boolean(doctor.accessible);

      return (
        matchesSpecialty &&
        matchesLocation &&
        matchesInsurance &&
        matchesAvailability &&
        matchesLanguage &&
        matchesVisitType &&
        matchesAccepting &&
        matchesGender &&
        matchesAccessibility
      );
    });
  }, [doctorRecords, search, filters]);

  const resetFilters = () => {
    setSpecialty("All specialties");
    setLocation("");
    setInsurance("Any insurance");

    setSearch({
      specialty: "All specialties",
      location: "",
      insurance: "Any insurance",
    });

    setFilters(initialFilters);
  };

  return (
    <main className="doctor-page page-width">
      <section className="doctor-intro">
        <p className="doctor-eyebrow">FIND YOUR CARE PARTNER</p>
        <h1>Good care starts with the right person.</h1>
        <p>
          Find the expertise you need, with the understanding you deserve.
        </p>
      </section>

      <form
        className="doctor-search"
        onSubmit={(event) => {
          event.preventDefault();

          setSearch({
            specialty,
            location,
            insurance,
          });
        }}
      >
        <label>
          Specialty or doctor
          <select
            value={specialty}
            onChange={(event) => setSpecialty(event.target.value)}
          >
            <option>All specialties</option>
            <option>Primary Care</option>
            <option>Cardiology</option>
          </select>
        </label>

        <label>
          Location or hospital
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Enter a hospital or doctor name"
          />
        </label>

        <label>
          Insurance
          <select
            value={insurance}
            onChange={(event) => setInsurance(event.target.value)}
          >
            <option>Any insurance</option>
            <option>Blue Cross Blue Shield</option>
            <option>Other insurance</option>
          </select>
        </label>

        <button type="submit">Search doctors →</button>
      </form>

      <section className="doctor-results" id="doctor-results">
        <aside className="doctor-filters">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <h2>Filters</h2>
            <button type="button" onClick={resetFilters}>
              Reset
            </button>
          </div>

          <p>Availability</p>

          <label>
            <input
              type="checkbox"
              checked={filters.next3Days}
              onChange={(event) =>
                updateFilter("next3Days", event.target.checked)
              }
            />
            Next 3 days
          </label>

          <label>
            <input
              type="checkbox"
              checked={filters.today}
              onChange={(event) =>
                updateFilter("today", event.target.checked)
              }
            />
            Today
          </label>

          <label>
            <input
              type="checkbox"
              checked={filters.thisWeek}
              onChange={(event) =>
                updateFilter("thisWeek", event.target.checked)
              }
            />
            This week
          </label>

          <hr />

          <p>Visit type</p>

          <label>
            <input
              type="checkbox"
              checked={filters.inPerson}
              onChange={(event) =>
                updateFilter("inPerson", event.target.checked)
              }
            />
            In-person
          </label>

          <label>
            <input
              type="checkbox"
              checked={filters.video}
              onChange={(event) =>
                updateFilter("video", event.target.checked)
              }
            />
            Video consultation
          </label>

          <hr />

          <p>Language</p>

          <label>
            <input
              type="checkbox"
              checked={filters.english}
              onChange={(event) =>
                updateFilter("english", event.target.checked)
              }
            />
            English
          </label>

          <label>
            <input
              type="checkbox"
              checked={filters.spanish}
              onChange={(event) =>
                updateFilter("spanish", event.target.checked)
              }
            />
            Spanish
          </label>

          <label>
            <input
              type="checkbox"
              checked={filters.mandarin}
              onChange={(event) =>
                updateFilter("mandarin", event.target.checked)
              }
            />
            Mandarin
          </label>

          <hr />

          <p>Care preferences</p>

          <label>
            <input
              type="checkbox"
              checked={filters.accepting}
              onChange={(event) =>
                updateFilter("accepting", event.target.checked)
              }
            />
            Accepting new patients
          </label>

          <label>
            <input
              type="checkbox"
              checked={filters.female}
              onChange={(event) =>
                updateFilter("female", event.target.checked)
              }
            />
            Female doctor
          </label>

          <label>
            <input
              type="checkbox"
              checked={filters.accessible}
              onChange={(event) =>
                updateFilter("accessible", event.target.checked)
              }
            />
            Wheelchair accessible
          </label>
        </aside>

        <div className="doctor-list">
          {loading && (
            <div className="doctor-status-banner">
              <h3>Loading healthcare providers...</h3>
              <p>Connecting to CARES relational database...</p>
            </div>
          )}

          {error && (
            <div className="doctor-status-banner error">
              <h3>Unable to retrieve doctor directory</h3>
              <p>{error}</p>
              <button type="button" className="doctor-retry-button" onClick={fetchDoctors}>
                Retry Search
              </button>
            </div>
          )}

          <h2>
            {filteredDoctors.length}{" "}
            {filteredDoctors.length === 1 ? "doctor" : "doctors"} who fit your
            search
          </h2>

          {filteredDoctors.map((doctor) => {
            const nameParts = (doctor.name || "Doctor").split(" ");
            const avatarInitial = nameParts[1] ? nameParts[1][0] : nameParts[0][0];

            return (
              <article className="doctor-card" key={doctor.id}>
                <div className="doctor-card-main">
                  <div className="doctor-avatar">
                    {avatarInitial}
                  </div>

                  <div className="doctor-info">
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <h3 style={{ margin: 0 }}>{doctor.name}</h3>
                      {doctor.isSynthetic ? (
                        <span className="doctor-provenance-badge demo" title="Synthetic demonstration record">
                          Demo Data
                        </span>
                      ) : (
                        doctor.provenanceStatus === 'publicly_sourced' && (
                          <span className="doctor-provenance-badge sourced" title="Sourced from official hospital public directories">
                            Official Sourced
                          </span>
                        )
                      )}
                      {!doctor.isSynthetic && doctor.isVerified && doctor.verificationStatus === 'verified' ? (
                        <span className="doctor-provenance-badge verified" title="Verified medical license">
                          ✓ Verified
                        </span>
                      ) : doctor.isSynthetic ? null : doctor.verificationStatus === 'pending' ? (
                        <span className="doctor-provenance-badge pending" title="Verification Under Administrative Review">
                          ⏳ Pending Review
                        </span>
                      ) : doctor.verificationStatus === 'needs_clarification' ? (
                        <span className="doctor-provenance-badge clarification" title="Administrative Clarification In Progress">
                          ⚠ Needs Clarification
                        </span>
                      ) : doctor.verificationStatus === 'suspended' ? (
                        <span className="doctor-provenance-badge suspended" title="Verification Suspended">
                          ⛔ Suspended
                        </span>
                      ) : doctor.verificationStatus === 'rejected' ? (
                        <span className="doctor-provenance-badge rejected" title="Verification Rejected">
                          ✕ Not Approved
                        </span>
                      ) : (
                        <span className="doctor-provenance-badge unverified" title="Credentials Not Verified">
                          Not Verified
                        </span>
                      )}
                    </div>
                    <p className="doctor-specialty">{doctor.specialty}</p>
                    <p>
                      ★ {doctor.rating || "5.0"} ({doctor.reviews || 0} reviews) ·{" "}
                      {doctor.experience || 0} years in practice
                    </p>
                    <p>
                      {doctor.hospital || "Riverside Medical Center"} · {doctor.distance || "Local facility"}
                    </p>
                    <p>
                      {(doctor.languages || []).join(", ") || "English"} ·{" "}
                      {(doctor.visitTypes || []).join(" & ") || "In-person"} visits
                      {doctor.consultationFee !== undefined && doctor.consultationFee !== null && (
                        <span> · ₹{doctor.consultationFee}</span>
                      )}
                      {doctor.accessible && <span> · ♿ Accessible</span>}
                    </p>
                  </div>

                  <div className="doctor-profile">
                    <span
                      className="doctor-status"
                      style={{
                        color: doctor.accepting ? "#168044" : "#991b1b",
                        fontWeight: 600,
                      }}
                    >
                      ●{" "}
                      {doctor.accepting
                        ? "Accepting new patients"
                        : "Not accepting new patients"}
                    </span>

                    <p>{doctor.accepting ? "Next available · Configured slots" : "Consultation booking closed"}</p>

                    <Link className="doctor-view-profile" to={`/doctors/${doctor.id}`}>
                      View profile ↗
                    </Link>
                  </div>
                </div>

                <div className="doctor-card-slots">
                  <span>{doctor.accepting ? "✓ Available appointment slots" : "⛔ New requests closed"}</span>

                  <div>
                    {doctor.accepting ? (
                      (doctor.slots && doctor.slots.length > 0) ? (
                        doctor.slots.map((slot) => (
                          <Link
                            key={slot}
                            to={`/doctors/${doctor.id}?slot=${encodeURIComponent(slot)}`}
                            style={{
                              textDecoration: "none",
                              padding: "6px 12px",
                              borderRadius: "6px",
                              background: "#ffffff",
                              border: "1px solid #dce2da",
                              color: "#168044",
                              fontWeight: 600,
                              fontSize: "12px",
                              display: "inline-block",
                            }}
                          >
                            {slot}
                          </Link>
                        ))
                      ) : (
                        <span style={{ fontSize: "12px", color: "#64748b" }}>
                          No public slots listed · View profile
                        </span>
                      )
                    ) : (
                      <span style={{ fontSize: "12px", color: "#991b1b", fontWeight: 500 }}>
                        Dr. {doctor.name} is currently not accepting new patient appointment requests.
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}

          {filteredDoctors.length === 0 ? (
            <div className="doctor-empty-state">
              <span className="doctor-empty-icon" aria-hidden="true">
                🔍
              </span>
              <h3>No doctors match your search</h3>
              <p>
                Try adjusting your filters, location, or specialty to see available providers.
              </p>
              <button
                type="button"
                className="doctor-reset-button"
                onClick={resetFilters}
              >
                Reset all filters
              </button>
            </div>
          ) : null}

          <p className="doctor-disclaimer">
            Demonstration directory. Doctors, ratings, insurance information,
            accessibility, and appointment times are illustrative. Confirm
            provider details before booking.
          </p>
        </div>
      </section>

      <section className="doctor-bottom-banner">
        <div>
          <h2>The right fit is more than a specialty.</h2>
          <p>
            Explore a doctor's approach, languages and experience before
            choosing your next visit.
          </p>
        </div>

        <a href="#doctor-results">How to choose a doctor ↗</a>
      </section>
    </main>
  );
}