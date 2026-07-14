import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Usuario } from '../types'

interface AuthContextValue {
  session: Session | null
  user: User | null
  perfil: Usuario | null
  loading: boolean
  perfilReady: boolean
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
  const [perfilReady, setPerfilReady] = useState(false)
  const [mustChangePassword, setMustChangePassword] = useState(false)

  async function carregarPerfil(userId: string) {
    try {
      const deadline = <T,>(ms: number) => new Promise<T | null>((resolve) => setTimeout(() => resolve(null), ms))

      const resultado = await Promise.race([
        supabase
          .from('usuarios')
          .select('id, nome, role, setores_avaliacao, pode_nutri, pode_orcamento, status, unidades_ids, ver_tudo')
          .eq('id', userId)
          .single()
          .then((r) => r.data),
        deadline(8_000),
      ])

      if (resultado) {
        setPerfil(resultado as Usuario)
        return
      }

      // Fallback: tenta sem as colunas novas (status, unidades_ids)
      const fallbackData = await Promise.race([
        supabase
          .from('usuarios')
          .select('id, nome, role, setores_avaliacao, pode_nutri')
          .eq('id', userId)
          .single()
          .then((r) => r.data),
        deadline(5_000),
      ])

      if (fallbackData) {
        const fallbackRole = (fallbackData as any).role as string
        const safeStatus = fallbackRole === 'leitura' ? 'pendente' : 'ativo'
        setPerfil({ ...(fallbackData as any), status: safeStatus, unidades_ids: null } as Usuario)
      }
    } finally {
      // Sempre marca como pronto — mesmo se ambas as queries falharem/travarem
      setPerfilReady(true)
    }
  }

  useEffect(() => {
    let initialized = false

    // Desbloqueia o loading na primeira chamada — só ocorre uma vez
    function markInit() {
      if (!initialized) {
        initialized = true
        setLoading(false)
      }
    }

    // Segurança: se nenhum evento chegar em 4s, desbloqueia de qualquer forma
    const timeout = setTimeout(markInit, 4_000)

    // onAuthStateChange dispara INITIAL_SESSION imediatamente do localStorage,
    // sem chamada de rede — é a fonte mais rápida para o estado inicial da sessão.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user) {
        const meta = session.user.user_metadata as { must_change_password?: boolean }
        setMustChangePassword(event === 'PASSWORD_RECOVERY' || !!meta?.must_change_password)
        // Carrega perfil em background — não bloqueia o loading
        carregarPerfil(session.user.id).catch(() => setPerfilReady(true))
      } else {
        setPerfil(null)
        setPerfilReady(true)
        setMustChangePassword(false)
      }

      // Primeiro evento (INITIAL_SESSION) desbloqueia a tela imediatamente
      markInit()
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
    <AuthContext.Provider value={{ session, user, perfil, loading, perfilReady, mustChangePassword, signIn, signOut, updatePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
