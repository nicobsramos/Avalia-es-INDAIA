import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Usuario } from '../types'

interface AuthContextValue {
  session: Session | null
  user: User | null
  perfil: Usuario | null
  loading: boolean
  mustChangePassword: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [mustChangePassword, setMustChangePassword] = useState(false)

  async function carregarPerfil(userId: string) {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nome, role, setores_avaliacao, pode_nutri, status, unidades_ids')
      .eq('id', userId)
      .single()
    if (data) {
      setPerfil(data as Usuario)
      return
    }
    // Fallback: coluna status/unidades_ids ainda não existe no banco
    const { data: fallback } = await supabase
      .from('usuarios')
      .select('id, nome, role, setores_avaliacao, pode_nutri')
      .eq('id', userId)
      .single()
    if (fallback) {
      // leitura users are created post-migration, so if the fallback fires for one it means
      // the schema is inconsistent — default to 'pendente' (deny access) rather than grant it.
      const fallbackRole = (fallback as any).role as string
      const safeStatus = fallbackRole === 'leitura' ? 'pendente' : 'ativo'
      setPerfil({ ...(fallback as any), status: safeStatus, unidades_ids: null } as Usuario)
    }
  }

  useEffect(() => {
    // Fallback: se algo travar (rede lenta, erro silencioso), desbloqueia em 10s
    const timeout = setTimeout(() => setLoading(false), 10_000)

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          const meta = session.user.user_metadata as { must_change_password?: boolean }
          setMustChangePassword(!!meta?.must_change_password)
          try { await carregarPerfil(session.user.id) } catch { /* perfil indisponível, segue */ }
        }
      })
      .catch(() => { /* getSession falhou, trata como sem sessão */ })
      .finally(() => {
        clearTimeout(timeout)
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        const meta = session.user.user_metadata as { must_change_password?: boolean }
        setMustChangePassword(event === 'PASSWORD_RECOVERY' || !!meta?.must_change_password)
        try { await carregarPerfil(session.user.id) } catch { /* perfil indisponível */ }
      } else {
        setPerfil(null)
        setMustChangePassword(false)
      }
    })

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error as Error | null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      data: { must_change_password: false },
    })
    if (!error) setMustChangePassword(false)
    return { error: error as Error | null }
  }

  return (
    <AuthContext.Provider value={{ session, user, perfil, loading, mustChangePassword, signIn, signOut, updatePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
