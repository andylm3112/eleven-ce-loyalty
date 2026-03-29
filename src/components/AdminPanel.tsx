import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdmin } from '../hooks/useAdmin'
import { supabase } from '../lib/supabase'

interface Premio {
  id: string
  fecha: string
  puntos_al_canjear: number
  clientes?: {
    nombre?: string
    telefono?: string
  } | null
  cupones?: {
    nombre?: string
    tipo?: string
  } | null
}

interface Admin {
  id: string
  email: string
  telefono: string
  rol: string
}

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const m = (err as { message?: unknown }).message
    if (typeof m === 'string') return m
  }
  return fallback
}

export default function AdminPanel() {
  const { admin, loading: adminLoading } = useAdmin()
  const navigate = useNavigate()

  const [premios, setPremios] = useState<Premio[]>([])
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Formulario agregar admin
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [nuevoTelefono, setNuevoTelefono] = useState('')
  const [nuevoRol, setNuevoRol] = useState<'admin' | 'dueño'>('admin')
  const [agregandoAdmin, setAgregandoAdmin] = useState(false)

  useEffect(() => {
    if (!adminLoading && !admin) {
      sessionStorage.setItem('redirect_after_login', '/admin')
      navigate('/login')
    }
  }, [admin, adminLoading, navigate])

  useEffect(() => {
    if (admin) {
      void cargarDatos()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarga cuando cambia el usuario admin
  }, [admin])

  const cargarDatos = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: premiosData, error: premiosError } = await supabase
        .from('historial_premios')
        .select(`
          id,
          fecha,
          puntos_al_canjear,
          clientes (nombre, telefono),
          cupones (nombre, tipo)
        `)
        .order('fecha', { ascending: false })
        .limit(50)

      if (premiosError) throw premiosError
      setPremios((premiosData || []) as unknown as Premio[])

      if (admin?.rol === 'dueño') {
        const { data: adminsData, error: adminsError } = await supabase
          .from('administradores')
          .select('*')
          .order('created_at', { ascending: false })

        if (adminsError) throw adminsError
        setAdmins((adminsData || []) as Admin[])
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error al cargar datos'))
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const handleAgregarAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAgregandoAdmin(true)
    setError(null)

    try {
      const { data: negocio, error: negocioError } = await supabase
        .from('negocios')
        .select('id')
        .eq('nombre', 'ELEVEN CE STUDIOS')
        .single()

      if (negocioError) throw negocioError
      if (!negocio) throw new Error('Negocio no encontrado')

      // Verificar que el email no exista
      const { data: existente, error: existenteError } = await supabase
        .from('administradores')
        .select('id')
        .eq('email', nuevoEmail)
        .maybeSingle()

      if (existenteError) throw existenteError
      if (existente) {
        setError('Este email ya está registrado como administrador')
        return
      }

      const { error: insertError } = await supabase.from('administradores').insert({
        negocio_id: negocio.id,
        email: nuevoEmail,
        telefono: nuevoTelefono,
        rol: nuevoRol,
      })

      if (insertError) throw insertError

      setNuevoEmail('')
      setNuevoTelefono('')
      setNuevoRol('admin')

      await cargarDatos()

      alert(
        '✅ Administrador agregado. Ahora debe crear su cuenta en Authentication de Supabase con este email.'
      )
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error al agregar administrador'))
    } finally {
      setAgregandoAdmin(false)
    }
  }

  const handleEliminarAdmin = async (adminId: string, email: string) => {
    if (adminId === admin?.id) {
      alert('No puedes eliminarte a ti mismo')
      return
    }

    if (!confirm(`¿Eliminar al administrador ${email}?`)) {
      return
    }

    try {
      const { error } = await supabase.from('administradores').delete().eq('id', adminId)
      if (error) throw error

      await cargarDatos()
      alert('✅ Administrador eliminado')
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error al eliminar administrador'))
    }
  }

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-[#D4AF37] border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (!admin) {
    return null
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-[#D4AF37] mb-2">ELEVEN CE STUDIOS</h1>
            <p className="text-gray-400">Panel de Administración</p>
            <p className="text-sm text-gray-500">
              Sesión: {admin.email} ({admin.rol})
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-6 py-2 bg-red-900 hover:bg-red-800 rounded transition font-bold"
          >
            Cerrar Sesión
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded text-red-200">{error}</div>
        )}

        <div className="bg-zinc-900 border border-[#D4AF37] rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-[#D4AF37] mb-4">📋 Historial de Premios</h2>

          {premios.length === 0 ? (
            <p className="text-gray-400">No hay premios canjeados aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-zinc-700">
                    <th className="pb-3 pr-4">Cliente</th>
                    <th className="pb-3 pr-4">Teléfono</th>
                    <th className="pb-3 pr-4">Cupón</th>
                    <th className="pb-3 pr-4">Tipo</th>
                    <th className="pb-3 pr-4">Puntos</th>
                    <th className="pb-3">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {premios.map((premio) => (
                    <tr key={premio.id} className="border-b border-zinc-800">
                      <td className="py-3 pr-4">{premio.clientes?.nombre || 'N/A'}</td>
                      <td className="py-3 pr-4 text-gray-400">{premio.clientes?.telefono || 'N/A'}</td>
                      <td className="py-3 pr-4 font-bold">{premio.cupones?.nombre || 'N/A'}</td>
                      <td className="py-3 pr-4">
                        <span className="text-xs bg-[#D4AF37] text-black px-2 py-1 rounded font-bold">
                          {premio.cupones?.tipo === '2x1' ? '2x1' : 'GRATIS'}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-[#D4AF37]">{premio.puntos_al_canjear}</td>
                      <td className="py-3 text-sm text-gray-400">{formatearFecha(premio.fecha)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {admin.rol === 'dueño' && (
          <div className="bg-zinc-900 border border-[#D4AF37] rounded-lg p-6">
            <h2 className="text-2xl font-bold text-[#D4AF37] mb-4">👥 Gestión de Equipo</h2>

            <form
              onSubmit={handleAgregarAdmin}
              className="mb-6 p-4 bg-black rounded-lg border border-zinc-700"
            >
              <h3 className="text-lg font-bold mb-4">Agregar Administrador</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm mb-2">Email</label>
                  <input
                    type="email"
                    value={nuevoEmail}
                    onChange={(e) => setNuevoEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded focus:border-[#D4AF37] focus:outline-none"
                    placeholder="admin@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm mb-2">Teléfono</label>
                  <input
                    type="tel"
                    value={nuevoTelefono}
                    onChange={(e) => setNuevoTelefono(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded focus:border-[#D4AF37] focus:outline-none"
                    placeholder="6621234567"
                    minLength={10}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm mb-2">Rol</label>
                  <select
                    value={nuevoRol}
                    onChange={(e) => setNuevoRol(e.target.value as 'admin' | 'dueño')}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded focus:border-[#D4AF37] focus:outline-none"
                  >
                    <option value="admin">Admin</option>
                    <option value="dueño">Dueño</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={agregandoAdmin}
                className="w-full md:w-auto px-6 py-2 bg-[#D4AF37] hover:bg-[#B8941F] text-black font-bold rounded transition disabled:opacity-50"
              >
                {agregandoAdmin ? 'Agregando...' : '+ Agregar Administrador'}
              </button>

              <p className="text-xs text-gray-500 mt-3">
                ⚠️ Después de agregar, debes crear la cuenta en Supabase Authentication con el mismo email.
              </p>
            </form>

            <div>
              <h3 className="text-lg font-bold mb-3">Administradores Actuales</h3>
              <div className="space-y-2">
                {admins.map((a) => (
                  <div
                    key={a.id}
                    className="flex justify-between items-center p-3 bg-black rounded border border-zinc-700"
                  >
                    <div>
                      <p className="font-bold">{a.email}</p>
                      <p className="text-sm text-gray-400">
                        {a.telefono} • {a.rol}
                      </p>
                    </div>
                    {a.id !== admin.id && (
                      <button
                        onClick={() => handleEliminarAdmin(a.id, a.email)}
                        className="px-4 py-1 bg-red-900 hover:bg-red-800 rounded transition text-sm"
                      >
                        Eliminar
                      </button>
                    )}
                    {a.id === admin.id && <span className="text-xs text-[#D4AF37]">(Tú)</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
