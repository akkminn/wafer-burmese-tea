import { CONFIG } from '../config.js'

export default function Nav() {
  return (
    <header className="nav">
      <a className="nav-brand" href="#wafer" aria-label={`${CONFIG.shopName} — ${CONFIG.brand}`}>
        <img className="nav-logo" src="img/logo-sticker.webp" alt="" />
        <span className="nav-name">
          <b lang="my">{CONFIG.shopName}</b>
          <small>Wafer Dessert &amp; Burmese Tea</small>
        </span>
      </a>
      <nav className="nav-links" aria-label="Sections">
        <a href="#wafer">Wafer</a>
        <a href="#tea">Tea</a>
        <a href="#videos">Videos</a>
        <a href="#order">Order</a>
        <a href="#booth">Booth</a>
      </nav>
      <a className="btn btn-gold btn-sm" href="#order">
        Pre-order <b>−฿{CONFIG.preorder.discount}</b>
      </a>
    </header>
  )
}
