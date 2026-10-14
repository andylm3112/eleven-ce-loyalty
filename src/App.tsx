import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ClienteHome from './components/ClienteHome'
import AdminLoginPage from './components/AdminLoginPage'
import AdminPanel from './components/AdminPanel'
import ScanPage from './components/ScanPage'
import AgendaCliente from './components/AgendaCliente'
import AgendaAdmin from './components/AgendaAdmin'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ClienteHome />} />
        <Route path="/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/scan/:clienteId" element={<ScanPage />} />
        <Route path="/agendar" element={<AgendaCliente />} />
        <Route path="/admin/agenda" element={<AgendaAdmin />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
