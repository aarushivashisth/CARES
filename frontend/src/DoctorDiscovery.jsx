import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import "./DoctorDiscovery.css";
import { doctors } from "./doctorData.js";



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

  const updateFilter = (name, checked) => {
    setFilters((previous) => ({
      ...previous,
      [name]: checked,
    }));
  };

  const filteredDoctors = useMemo(() => {
    return doctors.filter((doctor) => {
      const searchText = search.location.trim().toLowerCase();

      const matchesSpecialty =
        search.specialty === "All specialties" ||
        doctor.specialty
          .toLowerCase()
          .includes(search.specialty.toLowerCase()) ||
        doctor.name.toLowerCase().includes(search.specialty.toLowerCase());

      const matchesLocation =
        !searchText ||
        doctor.hospital.toLowerCase().includes(searchText) ||
        doctor.distance.toLowerCase().includes(searchText);

      const matchesInsurance =
        search.insurance === "Any insurance" ||
        doctor.insurance.includes(search.insurance);

      const selectedAvailability = [];

      if (filters.today) selectedAvailability.push("Today");
      if (filters.next3Days) selectedAvailability.push("Next 3 days");
      if (filters.thisWeek) selectedAvailability.push("This week");

      const matchesAvailability =
        selectedAvailability.length === 0 ||
        selectedAvailability.some((item) =>
          doctor.availability.includes(item)
        );

      const selectedLanguages = [];

      if (filters.english) selectedLanguages.push("English");
      if (filters.spanish) selectedLanguages.push("Spanish");
      if (filters.mandarin) selectedLanguages.push("Mandarin");

      const matchesLanguage =
        selectedLanguages.length === 0 ||
        selectedLanguages.some((language) =>
          doctor.languages.includes(language)
        );

      const selectedVisitTypes = [];

      if (filters.inPerson) selectedVisitTypes.push("In-person");
      if (filters.video) selectedVisitTypes.push("Video consultation");

      const matchesVisitType =
        selectedVisitTypes.length === 0 ||
        selectedVisitTypes.some((type) => doctor.visitTypes.includes(type));

      const matchesAccepting =
        !filters.accepting || doctor.accepting;

      const matchesGender =
        !filters.female || doctor.gender === "Female";

      const matchesAccessibility =
        !filters.accessible || doctor.accessible;

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
  }, [search, filters]);

  const resetFilters = () => {
    setSpecialty("All specialties");
    setLocation("");
    setInsurance("Any insurance");

    setSearch({
      specialty: "All specialties",
      location: "",
      insurance: "Any insurance",
    });

    setFilters({
      ...initialFilters,
      next3Days: false,
      inPerson: false,
      accepting: false,
    });
  };

  return (
    <main className="doctor-page">
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
            placeholder="Enter a hospital name"
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
          <h2>
            {filteredDoctors.length}{" "}
            {filteredDoctors.length === 1 ? "doctor" : "doctors"} who fit your
            search
          </h2>

          {filteredDoctors.map((doctor) => (
            <article className="doctor-card" key={doctor.id}>
              <div className="doctor-card-main">
                <div className="doctor-avatar">
                  {doctor.name.split(" ")[1][0]}
                </div>

                <div className="doctor-info">
                  <h3>{doctor.name}</h3>
                  <p className="doctor-specialty">{doctor.specialty}</p>
                  <p>
                    ★ {doctor.rating} ({doctor.reviews} reviews) ·{" "}
                    {doctor.experience} years in practice
                  </p>
                  <p>
                    {doctor.hospital} · {doctor.distance}
                  </p>
                  <p>
                    {doctor.languages.join(", ")} ·{" "}
                    {doctor.visitTypes.join(" & ")} visits
                  </p>
                </div>

                <div className="doctor-profile">
                  <span className="doctor-status">
                    ●{" "}
                    {doctor.accepting
                      ? "Accepting new patients"
                      : "Not accepting new patients"}
                  </span>

                  <p>Next available · Sample times</p>

                  <button
                    type="button"
                    onClick={() =>
                      window.alert(
                        `Profile for ${doctor.name} — demo only`
                      )
                    }
                  >
                    View profile ↗
                  </button>
                </div>
              </div>

              <div className="doctor-card-slots">
                <span>✓ Sample appointment slots</span>

                <div>
                  {doctor.slots.map((slot) => (
                    <button
                      type="button"
                      key={slot}
                      onClick={() =>
                        window.alert(
                          `${slot} selected for ${doctor.name} — demo only`
                        )
                      }
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          ))}

          {filteredDoctors.length === 0 && (
            <p>
              No doctors match your search. Try changing your specialty or
              filters.
            </p>
          )}

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