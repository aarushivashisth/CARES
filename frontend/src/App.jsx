
import './App.css'
import { Routes, Route, Link } from 'react-router-dom'
import DoctorDiscovery from './DoctorDiscovery.jsx'
import SiteLayout from './SiteLayout.jsx'
import DoctorProfile from "./DoctorProfile.jsx";

const services = [
  {
    number: '01 / DISCOVER',
    icon: '♧',
    title: 'Find your person',
    description:
      'Discover doctors by specialty, experience and what matters to you.',
    link: 'Explore doctors',
    href: '#doctors',
  },
  {
    number: '02 / UNDERSTAND',
    icon: '▤',
    title: 'Plan a calmer visit',
    description:
      'Explore hospital departments, crowd levels and estimated waits.',
    link: 'View hospital insights',
    href: '#hospitals',
  },
  {
    number: '03 / GET SUPPORT',
    icon: '⌂',
    title: 'Heal in your own space',
    description:
      'Discover nursing, physiotherapy and recovery support at home.',
    link: 'Find home care',
    href: '#home-care',
  },
  {
    number: '04 / WHEN IT MATTERS',
    icon: '♡',
    title: 'Share what matters',
    description:
      'Prepare essential patient information for your selected hospital.',
    link: 'Emergency information',
    href: '#emergency',
  },
]

const departments = [
  {
    name: 'Primary care',
    crowd: 'Low crowd',
    wait: '15–25 min',
    width: '28%',
    level: 'low',
  },
  {
    name: 'Orthopedics',
    crowd: 'Moderate',
    wait: '30–45 min',
    width: '56%',
    level: 'moderate',
  },
  {
    name: 'Cardiology',
    crowd: 'Low crowd',
    wait: '20–30 min',
    width: '36%',
    level: 'low',
  },
]

function HomePage() {
  return (
    <div className="app">
      <main>
        <section className="hero page-width">
          <div className="hero-content">
            <p className="eyebrow">
              CARE FEELS BETTER WHEN IT'S CONNECTED
            </p>

            <h1>
              The right care.
              <br />
              A clearer path.
            </h1>

            <p className="hero-description">
              Find a doctor who listens, plan a hospital visit, or bring
              trusted care home. One thoughtful place to take your next step.
            </p>

            <div className="hero-actions">
              <Link to="/doctors" className="primary-button">
                Find your doctor <span>→</span>
              </Link>

              <a href="#home-care" className="secondary-button">
                Explore care at home
              </a>
            </div>

            <p className="location-note">
              <span>♧</span> Exploring care in Chandigarh, India
              <a href="#hospitals">Change</a>
            </p>
          </div>

          <div className="hero-photo-wrap">
            <img
              className="hero-photo"
              src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=1100&q=85"
              alt="Doctor ready to help patients"
            />

            <div className="photo-message">
              <span className="message-label">
                ● Care that starts with you
              </span>
              <p>
                More understanding.
                <br />
                Less navigating alone.
              </p>
            </div>
          </div>
        </section>

        <section className="benefit-strip page-width">
          <div className="benefit">
            <span className="benefit-icon">♧</span>
            <div>
              <strong>Thoughtfully matched doctors</strong>
              <p>Expertise, language and care preferences</p>
            </div>
          </div>

          <div className="benefit">
            <span className="benefit-icon">⌁</span>
            <div>
              <strong>A clearer hospital picture</strong>
              <p>Understand department crowd patterns</p>
            </div>
          </div>

          <div className="benefit">
            <span className="benefit-icon">⌂</span>
            <div>
              <strong>Care that comes to you</strong>
              <p>Nursing, recovery and everyday support</p>
            </div>
          </div>
        </section>

        <section className="services page-width" id="doctors">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                YOUR HEALTH, WITH A LITTLE LESS FRICTION
              </p>
              <h2>What would help you today?</h2>
            </div>
            <p>Start where you are. We'll help with the next step.</p>
          </div>

          <div className="service-grid">
            {services.map((service) => (
              <a
                className="service-card"
                href={service.href}
                key={service.number}
              >
                <span className="service-icon">{service.icon}</span>
                <span className="service-number">{service.number}</span>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
                <span className="service-link">
                  {service.link} <span>↗</span>
                </span>
              </a>
            ))}
          </div>
        </section>

        <section
          className="insights-banner page-width"
          id="hospitals"
        >
          <div className="insights-copy">
            <p className="eyebrow">
              A LITTLE KNOWLEDGE, A BETTER PLAN
            </p>
            <h2>
              Know a little more
              <br />
              before you go.
            </h2>

            <p>
              Compare departments, explore crowd patterns and see estimated
              waits in one clear view. More context for your non-urgent visit.
            </p>

            <a
              href="#department-insights"
              className="primary-button"
            >
              Explore hospital insights <span>→</span>
            </a>

            <small>
              Illustrative data, not live monitoring. Never delay urgent care
              because of crowd information.
            </small>
          </div>

          <div
            className="hospital-preview"
            id="department-insights"
          >
            <div className="hospital-title">
              <div>
                <h3>CARES Sample Hospital</h3>
                <p>Chandigarh region · Demo data</p>
              </div>
              <span className="demo-pill">● Demo</span>
            </div>

            {departments.map((department) => (
              <div
                className="department"
                key={department.name}
              >
                <div className="department-label">
                  <span>{department.name}</span>
                  <span>
                    {department.crowd} · {department.wait}
                  </span>
                </div>

                <div className="progress-track">
                  <span
                    className={`progress-fill ${department.level}`}
                    style={{ width: department.width }}
                  />
                </div>
              </div>
            ))}

            <p className="snapshot-note">
              Illustrative snapshot · Not a live hospital feed
            </p>
          </div>
        </section>

        <section
          className="homecare-section page-width"
          id="home-care"
        >
          <div className="homecare-photo-wrap">
            <img
              src="/images/home-care.png"
              alt="Caregiver providing support in a home setting"
              className="homecare-photo"
              loading="lazy"
              onError={(event) => {
                event.currentTarget.style.display = 'none'
                event.currentTarget.parentElement.classList.add(
                  'image-unavailable'
                )
              }}
            />

            <div className="image-fallback">
              <span>♡</span>
              <p>Care and comfort, at home</p>
            </div>
          </div>

          <div className="homecare-copy">
            <p className="eyebrow">
              GOOD CARE, FAMILIAR SURROUNDINGS
            </p>

            <h2>
              A helping hand,
              <br />
              right where you feel at home.
            </h2>

            <p>
              From your first day after surgery to everyday recovery, make
              room for recovery with care that comes to you.
            </p>

            <div className="homecare-points">
              <span>✓ Qualified professionals</span>
              <span>✓ Clear visit information</span>
            </div>

            <a
              href="#homecare-options"
              className="primary-button"
            >
              Discover care at home <span>→</span>
            </a>

            <div
              className="homecare-options"
              id="homecare-options"
            >
              <span>Nursing support</span>
              <span>Physiotherapy</span>
              <span>Elder care</span>
            </div>
          </div>
        </section>

        <section className="steps-section page-width">
          <div className="steps-heading">
            <h2>Less searching. More feeling supported.</h2>
            <p className="eyebrow">A SIMPLER NEXT STEP</p>
          </div>

          <div className="steps-grid">
            <article className="step">
              <span className="step-number">01</span>
              <h3>Tell us what you need</h3>
              <p>
                A specialty, a service, a little guidance. Start with what's
                on your mind.
              </p>
            </article>

            <article className="step">
              <span className="step-number">02</span>
              <h3>Find the right fit</h3>
              <p>
                Compare clear, useful information and choose what works for
                you.
              </p>
            </article>

            <article className="step">
              <span className="step-number">03</span>
              <h3>Take your next step</h3>
              <p>
                Request a visit or prepare your information, with you in
                control.
              </p>
            </article>
          </div>
        </section>

        <section
          className="extra-features page-width"
          id="emergency"
        >
          <div className="extra-feature">
            <span className="service-icon">♡</span>
            <h3>Emergency information</h3>
            <p>
              Prepare essential patient details and find emergency resources.
            </p>
            <a href="#emergency-safety">
              View emergency guidance ↗
            </a>
          </div>

          <div className="extra-feature" id="my-care">
            <span className="service-icon">▤</span>
            <h3>Your care, in one place</h3>
            <p>
              A future-ready space for appointments, saved doctors and care
              requests.
            </p>
            <a href="#account-note">
              Explore your care space ↗
            </a>
          </div>

          <div className="extra-feature" id="help">
            <span className="service-icon">?</span>
            <h3>Here to help</h3>
            <p>
              Get help understanding how CARES supports healthcare navigation.
            </p>
            <a href="#account-note">
              Learn about CARES ↗
            </a>
          </div>
        </section>

        <section
          className="closing-section page-width"
          id="account-note"
        >
          <div>
            <h2>Your next chapter in care starts here.</h2>
            <p>Take one small step toward the support you need.</p>
          </div>

          <a href="#doctors" className="primary-button">
            Find your doctor <span>→</span>
          </a>
        </section>

        <section
          className="safety-note page-width"
          id="emergency-safety"
        >
          <strong>Important:</strong> CARES is a healthcare-navigation
          prototype, not an emergency response service or medical diagnosis
          tool. For a medical emergency in India, call 112. Do not delay
          urgent care to use this website. Sample hospital statistics are
          illustrative.
        </section>
      </main>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <SiteLayout>
            <HomePage />
          </SiteLayout>
        }
      />

      <Route
        path="/doctors"
        element={
          <SiteLayout>
            <DoctorDiscovery />
          </SiteLayout>
        }
      />

      {/* ADD THE NEW ROUTE HERE */}
      <Route
        path="/doctors/:id"
        element={
          <SiteLayout>
            <DoctorProfile />
          </SiteLayout>
        }
      />
    </Routes>
  );
}

export default App;
