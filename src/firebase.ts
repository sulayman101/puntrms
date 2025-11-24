import { initializeApp } from 'firebase/app'
import { getAnalytics, isSupported } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: 'AIzaSyC-P1DcSZEZX1Q-EZh9qwu2xCYX4P9fHRo',
  authDomain: 'puntrms.firebaseapp.com',
  projectId: 'puntrms',
  storageBucket: 'puntrms.firebasestorage.app',
  messagingSenderId: '900549435238',
  appId: '1:900549435238:web:7c9bad4361d897dd9d72a7',
  measurementId: 'G-QLF3PZ51X3',
}

const app = initializeApp(firebaseConfig)

// Only enable analytics in the browser when supported.
const analyticsPromise = isSupported().then((ok) => (ok ? getAnalytics(app) : null))

export { app, analyticsPromise }
