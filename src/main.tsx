import './wdyr'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/app/app'
import '@/styles/global.css'
import '@radix-ui/themes/styles.css'
import { DevTools } from 'jotai-devtools'
import 'jotai-devtools/styles.css'

if (import.meta.env?.MODE === 'development') {
  const { default: wdyr } = await import(
    '@welldone-software/why-did-you-render'
  )
  wdyr(React, {
    trackAllPureComponents: true,
    logOnDifferentValues: true,
    collapseGroups: true
  })
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DevTools />
    <App />
  </React.StrictMode>
)
