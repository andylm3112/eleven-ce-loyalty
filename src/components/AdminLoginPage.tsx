import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    // Si ya hay sesión, redirigir
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        const redirect = sessionStorage.getItem('redirect_after_login')
        if (redirect) {
          sessionStorage.removeItem('redirect_after_login')
          navigate(redirect)
        } else {
          navigate('/admin')
        }
      }
    }
    checkSession()
  }, [navigate])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }

      if (!data.user) {
        setError('Error al iniciar sesión')
        setLoading(false)
        return
      }

      // Verificar que sea administrador
      const { data: admin, error: adminError } = await supabase
        .from('administradores')
        .select('*')
        .eq('email', data.user.email)
        .single()

      if (adminError || !admin) {
        await supabase.auth.signOut()
        setError('No tienes permisos de administrador')
        setLoading(false)
        return
      }

      // Redirigir
      const redirect = sessionStorage.getItem('redirect_after_login')
      if (redirect) {
        sessionStorage.removeItem('redirect_after_login')
        navigate(redirect)
      } else {
        navigate('/admin')
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      setError('Error al iniciar sesión')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#D4AF37] mb-2">ELEVEN CE STUDIOS</h1>
          <p className="text-gray-400">Panel de Administración</p>
        </div>

        <form onSubmit={handleLogin} className="bg-zinc-900 border border-[#D4AF37] rounded-lg p-8">
          <div className="mb-6">
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-black border border-zinc-700 rounded focus:border-[#D4AF37] focus:outline-none text-white"
              placeholder="admin@elevence.com"
              required
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-black border border-zinc-700 rounded focus:border-[#D4AF37] focus:outline-none text-white"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded text-red-200 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#D4AF37] hover:bg-[#B8941F] text-black font-bold py-3 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="text-center mt-6">
          <a href="/" className="text-[#D4AF37] hover:underline text-sm">
            ← Volver a inicio
          </a>
        </div>
      </div>
    </div>
  )
}
