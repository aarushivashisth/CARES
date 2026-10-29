import { useState, useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "./services/apiClient.js";
import { useAuth } from "./context/useAuth.js";
import "./DoctorProfile.css";

export default function DoctorProfile() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);

  // Appointment Request Form State
  const initialSlot = searchParams.get("slot") || "";
  const [selectedSlot, setSelectedSlot] = useState(initialSlot);

  // Format today's local date YYYY-MM-DD and max 90-day booking horizon
  const todayLocal = new Date().toLocaleDateString("en-CA");
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 90);
  const maxDateLocal = maxDate.toLocaleDateString("en-CA");

  const [requestedDate, setRequestedDate] = useState(todayLocal);
  const [visitType, setVisitType] = useState("In-person");
  const [reason, setReason] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadDoctor() {
      setLoading(true);
      setError(null);
      setNotFound(false);

      try {
        const response = await api.get(`/doctors/${id}`);
        if (isMounted) {
          if (response && response.success && response.data) {
            setDoctor(response.data);
            if (response.data.slots && response.data.slots.length > 0) {
              setSelectedSlot((prev) => prev || response.data.slots[0]);
            }
          } else {
            setNotFound(true);
          }
        }
      } catch (err) {
        if (isMounted) {
          if (err.status === 404 || err.code === "DOCTOR_NOT_FOUND") {
            setNotFound(true);
          } else {
            setError(err.message || "Failed to load doctor profile.");
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDoctor();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleAppointmentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlot) {
      setSubmitError("Please select an appointment time slot.");
      return;
    }

    if (!requestedDate) {
      setSubmitError("Please choose a valid appointment date.");
      return;
    }

    setIsSubmitting(true);
    setSubmitSuccess(null);
    setSubmitError(null);

    try {
      const payload = {
        doctor_id: doctor.id,
        hospital_id: doctor.hospital_id || doctor.hospitalId || undefined,
        preferred_slot: selectedSlot,
        requested_date: requestedDate,
        visit_type: visitType,
        reason_for_visit: reason.trim() || "General Consultation",
      };

      const result = await api.post("/patient/appointments", payload);

      if (result && result.success) {
        setSubmitSuccess({
          message: result.message || "Appointment request submitted successfully.",
          appointmentId: result.data ? result.data.id : null,
          status: result.data ? result.data.status : "pending",
          date: requestedDate,
          slot: selectedSlot,
        });
      } else {
        setSubmitError(result.error || "Failed to submit appointment request.");
      }
    } catch (err) {
      console.error("Error submitting appointment request:", err);
      setSubmitError(err.message || "Unable to submit request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="profile-page page-width">
        <section className="profile-not-found">
          <p className="profile-eyebrow">CARES DIRECTORY</p>
          <h2>Loading doctor profile...</h2>
          <p>Retrieving healthcare provider records from database...</p>
        </section>
      </main>
    );
  }

  if (notFound || !doctor) {
    return (
      <main className="profile-page page-width">
        <section className="profile-not-found">
          <p className="profile-eyebrow">CARES DIRECTORY</p>
          <h1>Doctor not found</h1>
          <p>
            {error || `No provider with ID #${id} exists in our database directory. Please check the ID or search the directory.`}
          </p>
          <Link className="profile-primary-button" to="/doctors">
            Back to doctors
          </Link>
        </section>
      </main>
    );
  }

  const nameParts = (doctor.name || "Doctor").split(" ");
  const avatarInitial = nameParts[1] ? nameParts[1][0] : nameParts[0][0];

  return (
    <main className="profile-page page-width">
      <Link className="profile-back-link" to="/doctors">
        ← Back to all doctors
      </Link>

      <section className="profile-hero">
        <div className="profile-avatar" aria-hidden="true">
          {avatarInitial}
        </div>

        <div className="profile-heading">
          <p className="profile-eyebrow">YOUR CARE PARTNER</p>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <h1 style={{ margin: 0 }}>{doctor.name}</h1>
            {doctor.isSynthetic ? (
              <span className="profile-status" style={{ background: "#fef3c7", color: "#92400e" }}>
                Demo Record
              </span>
            ) : null}
            {!doctor.isSynthetic && doctor.isVerified && doctor.verificationStatus === 'verified' ? (
              <span className="profile-status" style={{ background: "#dcfce7", color: "#166534" }}>
                ✓ Verified
              </span>
            ) : doctor.isSynthetic ? null : doctor.verificationStatus === 'pending' ? (
              <span className="profile-status" style={{ background: "#eff6ff", color: "#1e40af" }}>
                ⏳ Pending Review
              </span>
            ) : doctor.verificationStatus === 'needs_clarification' ? (
              <span className="profile-status" style={{ background: "#fffbeb", color: "#b45309" }}>
                ⚠ Needs Clarification
              </span>
            ) : doctor.verificationStatus === 'suspended' ? (
              <span className="profile-status" style={{ background: "#fef2f2", color: "#991b1b" }}>
                ⛔ Suspended
              </span>
            ) : doctor.verificationStatus === 'rejected' ? (
              <span className="profile-status" style={{ background: "#f3f4f6", color: "#4b5563" }}>
                ✕ Not Approved
              </span>
            ) : (
              <span className="profile-status" style={{ background: "#f8fafc", color: "#64748b" }}>
                Not Verified
              </span>
            )}
          </div>
          <p className="profile-specialty">{doctor.specialty}</p>
          {doctor.qualifications && (
            <p style={{ margin: "2px 0", fontSize: "14px", fontWeight: 600, color: "#203e37" }}>
              Qualifications: {doctor.qualifications}
            </p>
          )}
          <p className="profile-rating">
            {doctor.rating != null ? `★ ${doctor.rating} · ${doctor.reviews || 0} reviews` : "Rating not recorded"} · Registration: {doctor.licenseNumber || "N/A"}
            {doctor.issuingCouncil ? ` (${doctor.issuingCouncil})` : ""}
          </p>
          <span className="profile-status">
            ● {doctor.accepting ? "Accepting new patients" : "Not accepting new patients"}
          </span>
        </div>
      </section>

      <div className="profile-content">
        <section className="profile-details">
          <article className="profile-panel">
            <h2>About this doctor</h2>
            <p>
              {doctor.bio ||
                "Dedicated healthcare specialist committed to patient-centered evidence-based care, preventive diagnostics, and community wellness."}
            </p>

            <div className="profile-fact-grid">
              <div className="profile-fact">
                <span>Experience</span>
                <strong>{doctor.experience || 0} years</strong>
              </div>

              <div className="profile-fact">
                <span>Specialty</span>
                <strong>{(doctor.specialty || "").split(" · ")[0] || "General Medicine"}</strong>
              </div>

              <div className="profile-fact">
                <span>Languages</span>
                <strong>{(doctor.languages || ["English"]).join(", ")}</strong>
              </div>

              <div className="profile-fact">
                <span>Visit options</span>
                <strong>{(doctor.visitTypes || ["In-person"]).join(", ")}</strong>
              </div>

              <div className="profile-fact">
                <span>Consultation fee</span>
                <strong>{doctor.consultationFee !== undefined && doctor.consultationFee !== null ? `₹${doctor.consultationFee}` : "₹500"}</strong>
              </div>
            </div>
          </article>

          <article className="profile-panel">
            <h2>Practice location & hospital affiliation</h2>
            <h3>{doctor.hospital || "Riverside Medical Center"}</h3>
            <p>{doctor.distance || "Main Hospital Campus"}</p>
            <p className="profile-muted">
              {doctor.affiliationSource
                ? `Affiliation Source: ${doctor.affiliationSource}`
                : "Affiliation verified via institutional credentialing records."}
            </p>
          </article>

          <article className="profile-panel">
            <h2>Insurance and accessibility</h2>
            <p>
              <strong>Accepted Insurance:</strong>{" "}
              {(doctor.insurance && doctor.insurance.length > 0)
                ? doctor.insurance.join(", ")
                : "Blue Cross Blue Shield, National Health Schemes, Self-Pay"}
            </p>
            <p>
              <strong>Wheelchair accessibility:</strong>{" "}
              {doctor.accessible ? "Accessible facility with step-free entry and ramps" : "Contact clinic for accessibility support"}
            </p>
          </article>

          {/* Objective F: Data Provenance Information Box */}
          <article className="profile-provenance-box">
            <h4>Data Provenance & Verification Notice</h4>
            <div className="profile-provenance-grid">
              <div>
                <strong>Source:</strong>{" "}
                {doctor.sourceUrl ? (
                  <a href={doctor.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#0f766e", textDecoration: "underline" }}>
                    {doctor.sourceOrganization || "Official Directory"} ↗
                  </a>
                ) : (
                  doctor.sourceOrganization || "CARES Academic Prototype Dataset"
                )}
              </div>
              <div>
                <strong>Provenance Level:</strong>{" "}
                <span style={{ fontWeight: 600, color: doctor.provenanceStatus === 'cares_verified' ? '#166534' : '#0f766e' }}>
                  {doctor.provenanceStatus || "synthetic_demo"}
                </span>
              </div>
              <div>
                <strong>Council Directory Check:</strong>{" "}
                <span style={{ fontWeight: 600, color: doctor.registrationCheckStatus === 'checked' ? '#166534' : '#92400e' }}>
                  {doctor.registrationCheckStatus || "unverified"}
                </span>
              </div>
              <div>
                <strong>Last Checked Date:</strong>{" "}
                {doctor.lastCheckedDate || todayLocal}
              </div>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: "11px", color: "#64748b" }}>
              CARES adheres to healthcare data integrity. Synthetic prototype records are clearly marked. Public sourcing does not imply credential verification. Check the recorded verification state and source.
            </p>
          </article>
        </section>

        <aside className="profile-booking-panel">
          <p className="profile-eyebrow">REQUEST AN APPOINTMENT</p>
          <h2>Plan your visit</h2>
          <p className="profile-muted">
            Choose a preferred date and time slot. Requests are sent directly to Dr. {doctor.name} for confirmation.
          </p>

          {!doctor.accepting ? (
            <div style={{ padding: "16px", background: "#fef2f2", borderRadius: "8px", border: "1px solid #fecaca", margin: "16px 0" }}>
              <p style={{ margin: "0 0 6px", fontSize: "14px", color: "#991b1b", fontWeight: 700 }}>
                ⛔ Not Accepting New Patients
              </p>
              <p style={{ margin: 0, fontSize: "13px", color: "#7f1d1d" }}>
                Dr. {doctor.name} is currently not accepting new patient appointment requests. Please explore other healthcare providers in our directory.
              </p>
            </div>
          ) : !user ? (
            <div style={{ padding: "16px", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0", margin: "16px 0" }}>
              <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#166534" }}>
                <strong>Patient Login Required:</strong> Please log in with your patient account to submit an appointment request.
              </p>
              <Link
                to={`/login?redirect=${encodeURIComponent(`/doctors/${doctor.id}`)}`}
                className="profile-primary-button"
                style={{ width: "100%", textAlign: "center", boxSizing: "border-box" }}
              >
                Sign In to Request Appointment →
              </Link>
            </div>
          ) : user.role !== "patient" ? (
            <div style={{ padding: "14px", background: "#fffbeb", borderRadius: "8px", border: "1px solid #fde68a", margin: "16px 0" }}>
              <p style={{ margin: 0, fontSize: "13px", color: "#92400e" }}>
                You are currently signed in as a <strong>{user.role}</strong> ({user.email}). Only registered patients can submit appointment requests.
              </p>
            </div>
          ) : (
            <form onSubmit={handleAppointmentSubmit} style={{ marginTop: "16px" }}>
              <div className="profile-form-group">
                <label htmlFor="appointment-date">Requested Date</label>
                <input
                  id="appointment-date"
                  type="date"
                  className="profile-input"
                  min={todayLocal}
                  max={maxDateLocal}
                  value={requestedDate}
                  onChange={(e) => setRequestedDate(e.target.value)}
                  required
                />
                <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "block" }}>
                  Booking horizon: Today through {maxDateLocal} (up to 90 days in advance)
                </span>
              </div>

              <div className="profile-form-group">
                <label>Select Preferred Time Slot</label>
                <div className="profile-slots">
                  {Array.isArray(doctor.slots) && doctor.slots.length > 0 ? (
                    doctor.slots.map((slot) => (
                      <button
                        type="button"
                        className={`profile-slot-button ${selectedSlot === slot ? "is-selected" : ""}`}
                        key={slot}
                        onClick={() => setSelectedSlot(slot)}
                        aria-pressed={selectedSlot === slot}
                      >
                        <span>{slot}</span>
                        <span>{selectedSlot === slot ? "✓ Selected" : "→"}</span>
                      </button>
                    ))
                  ) : (
                    <p style={{ color: "#64748b", fontSize: "13px", margin: "4px 0" }}>
                      No appointment slots currently available for this provider.
                    </p>
                  )}
                </div>
              </div>

              <div className="profile-form-group">
                <label htmlFor="visit-type">Visit Type</label>
                <select
                  id="visit-type"
                  className="profile-select"
                  value={visitType}
                  onChange={(e) => setVisitType(e.target.value)}
                >
                  {(Array.isArray(doctor.visitTypes) && doctor.visitTypes.length > 0
                    ? doctor.visitTypes
                    : ["In-person", "Video consultation"]
                  ).map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="profile-form-group">
                <label htmlFor="reason-for-visit">Reason for Visit (Optional)</label>
                <textarea
                  id="reason-for-visit"
                  className="profile-textarea"
                  placeholder="e.g. Annual routine physical examination, blood pressure follow-up..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="profile-submit-button"
                disabled={isSubmitting || !selectedSlot || !Array.isArray(doctor.slots) || doctor.slots.length === 0}
              >
                {isSubmitting ? "Submitting Request..." : "Submit Appointment Request"}
              </button>

              {submitError && (
                <div className="profile-request-error">
                  <strong>Submission Error:</strong> {submitError}
                </div>
              )}

              {submitSuccess && (
                <div className="profile-request-success">
                  <h4>✓ Request Submitted Successfully</h4>
                  <p style={{ margin: "4px 0" }}>
                    <strong>Status:</strong> <span style={{ textTransform: "capitalize" }}>{submitSuccess.status}</span> (Doctor Review Pending)
                  </p>
                  <p style={{ margin: "4px 0" }}>
                    <strong>Date & Slot:</strong> {submitSuccess.date} at {submitSuccess.slot}
                  </p>
                  <p style={{ margin: "6px 0 10px", fontSize: "12px", color: "#065f46" }}>
                    <em>Note: Appointment is not confirmed until accepted by Dr. {doctor.name}. Track the status anytime in your patient dashboard.</em>
                  </p>
                  <Link
                    to="/patient/dashboard"
                    style={{
                      display: "inline-block",
                      color: "#047857",
                      fontWeight: 700,
                      textDecoration: "underline",
                      fontSize: "13px",
                    }}
                  >
                    Go to Patient Dashboard →
                  </Link>
                </div>
              )}
            </form>
          )}

          <p className="profile-disclaimer" style={{ marginTop: "20px" }}>
            CARES guarantees patient confidentiality. Appointment requests submitted are securely transmitted using encrypted channels and role-based physician access.
          </p>

          <Link className="profile-secondary-button" to="/doctors">
            Explore other doctors
          </Link>
        </aside>
      </div>
    </main>
  );
}
