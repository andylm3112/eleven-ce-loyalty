import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Admin } from '../types'

export const useAdmin = () => {
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkSession()
  }, [])

  const checkSession = async () => {
    try {
      setLoading(true)
      setError(null)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user?.email) {
        setAdmin(null)
        setLoading(false)
        return
      }

      const { data: adminData, error: adminError } = await supabase
        .from('administradores')
        .select('*')
        .eq('email', session.user.email)
        .single()

      if (adminError) {
        console.error('Error buscando admin:', adminError)
        setError('No tienes permisos de administrador')
        setAdmin(null)
      } else {
        setAdmin(adminData)
      }
    } catch (err) {
      console.error('Error verificando sesión:', err)
      setError('Error al verificar sesión')
    } finally {
      setLoading(false)
    }
  }

  return { admin, loading, error, checkSession }
}
