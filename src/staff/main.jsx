import React from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/outfit/400.css'
import '@fontsource/outfit/600.css'
import '@fontsource/outfit/700.css'
import '@fontsource/outfit/800.css'
import './walkin.css'
import WalkInApp from './WalkInApp.jsx'

createRoot(document.getElementById('staff-root')).render(<WalkInApp />)
