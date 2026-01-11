import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { ActiveCommute } from './pages/ActiveCommute'
import { NavigationView } from './pages/NavigationView'
import { CommuteHistory } from './pages/CommuteHistory'
import { Settings } from './pages/Settings'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Full-screen navigation view (no layout wrapper) */}
        <Route path="/navigate/:id" element={<NavigationView />} />

        {/* Standard routes with layout */}
        <Route path="/" element={<Layout><Dashboard /></Layout>} />
        <Route path="/commute/:id" element={<Layout><ActiveCommute /></Layout>} />
        <Route path="/history/:id" element={<Layout><CommuteHistory /></Layout>} />
        <Route path="/settings" element={<Layout><Settings /></Layout>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
