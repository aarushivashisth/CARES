import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-main page-width">
        <div className="footer-brand">
          <Link className="footer-logo" to="/">
            CARES
          </Link>
          <p>One stop healthcare. A more human way to care.</p>
        </div>

        <div className="footer-column">
          <strong>Explore care</strong>
          <Link to="/doctors">Find a doctor</Link>
          <Link to="/hospitals">Hospital insights</Link>
          <Link to="/#home-care">Care at home</Link>
        </div>

        <div className="footer-column">
          <strong>Here to help</strong>
          <Link to="/#help">How CARES works</Link>
          <Link to="/#my-care">Patient support</Link>
          <Link to="/emergency">Emergency guidance</Link>
        </div>

        <div className="footer-column">
          <strong>Our commitment</strong>
          <Link to="/#account-note">Privacy and consent</Link>
          <Link to="/#account-note">Terms of use</Link>
          <Link to="/#help">Contact us</Link>
        </div>
      </div>

      <div className="footer-bottom page-width">
        <span>© 2026 CARES Health. Care, connected.</span>
        <span>
          Academic prototype · Sample providers and data · Not a medical service
        </span>
      </div>
    </footer>
  )
}
