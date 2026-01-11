import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { ActiveCommute } from './pages/ActiveCommute'
import { CommuteHistory } from './pages/CommuteHistory'
import { Settings } from './pages/Settings'

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/commute/:id" element={<ActiveCommute />} />
          <Route path="/history/:id" element={<CommuteHistory />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
