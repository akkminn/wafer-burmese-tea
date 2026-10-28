import { useCallback, useState } from 'react'
import { CONFIG } from './config.js'
import Nav from './components/Nav.jsx'
import WaferScroll from './components/WaferScroll.jsx'
import TeaScroll from './components/TeaScroll.jsx'
import VideoReel from './components/VideoReel.jsx'
import Order from './components/Order.jsx'
import Booth from './components/Booth.jsx'
import Footer from './components/Footer.jsx'

export default function App() {
  const [pick, setPick] = useState(null)

  const orderFlavor = useCallback((flavorId) => {
    setPick({ flavorId, at: Date.now() })
    document.getElementById('order')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <>
      <a className="skip" href="#order">Skip to pre-order</a>
      <Nav />
      <main id="top">
        <WaferScroll onOrder={orderFlavor} />
        <TeaScroll onOrder={orderFlavor} />
        <VideoReel />
        <Order pick={pick} />
        <Booth />
      </main>
      <Footer />
      <p className="sr-only">{CONFIG.brand}</p>
    </>
  )
}
