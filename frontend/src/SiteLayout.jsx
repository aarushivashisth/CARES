
import Navbar from './Navbar.jsx'
import Footer from './Footer.jsx'

export default function SiteLayout({ children }) {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
  )
}
