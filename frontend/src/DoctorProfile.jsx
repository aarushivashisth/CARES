
import { Link, useParams } from "react-router-dom";
import { doctors } from "./doctorData.js";
import "./DoctorProfile.css";

export default function DoctorProfile() {
  const { id } = useParams();
  const doctor = doctors.find((item) => item.id === Number(id));

  if (!doctor) {
    return (
      <main className="profile-page">
        <section className="profile-not-found">
          <p className="profile-eyebrow">CARES DIRECTORY</p>
          <h1>Doctor not found</h1>
          <p>This profile may not exist in our demonstration directory.</p>
          <Link className="profile-primary-button" to="/doctors">
            Back to doctors
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="profile-page">
      <Link className="profile-back-link" to="/doctors">
        ← Back to all doctors
      </Link>

      <section className="profile-hero">
        <div className="profile-avatar">
          {doctor.name.split(" ")[1][0]}
        </div>

        <div className="profile-heading">
          <p className="profile-eyebrow">YOUR CARE PARTNER</p>
          <h1>{doctor.name}</h1>
          <p className="profile-specialty">{doctor.specialty}</p>
          <p className="profile-rating">
            ★ {doctor.rating} · {doctor.reviews} sample reviews
          </p>
          <span className="profile-status">
            ● {doctor.accepting
              ? "Accepting new patients"
              : "Not accepting new patients"}
          </span>
        </div>
      </section>

      <div className="profile-content">
        <section className="profile-details">
          <article className="profile-panel">
            <h2>About this doctor</h2>
            <p>
              Explore this provider's specialty, experience and care options
              before deciding whether to book a visit.
            </p>

            <div className="profile-fact-grid">
              <div className="profile-fact">
                <span>Experience</span>
                <strong>{doctor.experience} years</strong>
              </div>

              <div className="profile-fact">
                <span>Specialty</span>
                <strong>{doctor.specialty.split(" · ")[0]}</strong>
              </div>

              <div className="profile-fact">
                <span>Languages</span>
                <strong>{doctor.languages.join(", ")}</strong>
              </div>

              <div className="profile-fact">
                <span>Visit options</span>
                <strong>{doctor.visitTypes.join(", ")}</strong>
              </div>
            </div>
          </article>

          <article className="profile-panel">
            <h2>Practice location</h2>
            <h3>{doctor.hospital}</h3>
            <p>{doctor.distance}</p>
            <p className="profile-muted">
              Location details are illustrative in this demonstration.
            </p>
          </article>

          <article className="profile-panel">
            <h2>Insurance and accessibility</h2>
            <p>
              <strong>Sample insurance:</strong>{" "}
              {doctor.insurance.join(", ")}
            </p>
            <p>
              <strong>Wheelchair accessibility:</strong>{" "}
              {doctor.accessible ? "Listed in demo data" : "Not listed in demo data"}
            </p>
          </article>
        </section>

        <aside className="profile-booking-panel">
          <p className="profile-eyebrow">PLAN YOUR VISIT</p>
          <h2>Sample appointment times</h2>
          <p className="profile-muted">
            Choose a time to continue to the demonstration booking form.
          </p>

          <div className="profile-slots">
            {doctor.slots.map((slot) => (
              <Link
                className="profile-slot-button"
                key={slot}
                to={`/doctors/${doctor.id}/book?time=${encodeURIComponent(slot)}`}
              >
                {slot} <span>→</span>
              </Link>
            ))}
          </div>

          <p className="profile-disclaimer">
            Sample provider information and appointment times only. This
            prototype does not confirm real appointments.
          </p>

          <Link className="profile-secondary-button" to="/doctors">
            Explore other doctors
          </Link>
        </aside>
      </div>
    </main>
  );
}
