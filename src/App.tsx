import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ClienteHome from './components/ClienteHome'
import AdminLoginPage from './components/AdminLoginPage'
import AdminPanel from './components/AdminPanel'
import ScanPage from './components/ScanPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ClienteHome />} />
        <Route path="/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/scan/:clienteId" element={<ScanPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
