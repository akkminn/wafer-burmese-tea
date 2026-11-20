import { CONFIG } from '../config.js'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <img className="footer-logo" src="img/logo-large.webp" alt={`${CONFIG.brand} logo`} />
        <p>{CONFIG.descriptor} · {CONFIG.tagline}</p>
        <small>Team 2 · IRS 154 Entrepreneurship Concept in Economy · {CONFIG.event.campus}</small>
      </div>
    </footer>
  )
}
