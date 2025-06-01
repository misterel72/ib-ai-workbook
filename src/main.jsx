import React from 'react'
import ReactDOM from 'react-dom/client'
import WrappedApp from './App.jsx' // Changed back
import './index.css' 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WrappedApp /> {/* Changed back */}
  </React.StrictMode>,
)
