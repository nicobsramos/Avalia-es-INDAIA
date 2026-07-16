import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { LoadingSpinner } from '../../components/LoadingSpinner'

interface UsuarioAcesso {
  id: string
  nome: string
  email: string
  role: string
  ver_tudo: boolean
  setores: string[]
  ultimo_acesso: string | null
}

const SETOR_COR: Record<string, string> = {
  Cozinha: 'bg-orange-100 text-orange-700',
  Bar: 'bg-indigo-100 text-indigo-700',
  Atendimento: 'bg-teal-100 text-teal-700',
}

function roleLabel(role: string, verTudo: boolean) {
  if (verTudo) return { label: 'Admin', cls: 'bg-purple-100 text-purple-700' }
  if (role === 'leitura') return { label: 'Leitura', cls: 'bg-gray-100 text-gray-500' }
  return { label: 'Líder', cls: 'bg-blue-100 text-blue-700' }
}

function formatUltimoAcesso(iso: string | null): { texto: string; cls: string } {
  if (!iso) return { texto: 'Nunca acessou', cls: 'text-gray-400' }
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 2) return { texto: 'Agora mesmo', cls: 'text-green-600 font-semibold' }
  if (mins < 60) return { texto: `Há ${mins} min`, cls: 'text-green-600' }
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return { texto: `Há ${hrs}h`, cls: 'text-green-600' }
  const days = Math.floor(hrs / 24)
  if (days === 1) return { texto: 'Ontem', cls: 'text-yellow-600' }
  if (days < 7) return { texto: `Há ${days} dias`, cls: 'text-yellow-600' }
  if (days < 30) return { texto: `Há ${days} dias`, cls: 'text-gray-500' }
  return {
    texto: new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    cls: 'text-gray-400',
  }
}

function useAcessos() {
  return useQuery<{ usuarios: UsuarioAcesso[] }>({
    queryKey: ['acessos'],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token ?? ''
      const res = await fetch('/api/acessos', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Erro ao carregar')
      }
      return res.json()
    },
    staleTime: 1000 * 60 * 2,
  })
}

export function Acessos() {
  const { data, isLoading, error } = useAcessos()
  const usuarios = data?.usuarios ?? []

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Acessos</h2>
        {!isLoading && (
          <span className="text-xs text-gray-400">{usuarios.length} usuário{usuarios.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {isLoading && <LoadingSpinner text="Carregando acessos..." />}

      {error && (
        <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-4">
          {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && usuarios.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
          Nenhum usuário encontrado para seu setor.
        </div>
      )}

      {!isLoading && !error && usuarios.length > 0 && (
        <div className="space-y-2">
          {usuarios.map((u, idx) => {
            const acesso = formatUltimoAcesso(u.ultimo_acesso)
            const role = roleLabel(u.role, u.ver_tudo)
            return (
              <div
                key={u.id}
                className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3"
              >
                {/* Posição */}
                <span className="text-xs text-gray-300 font-mono w-5 shrink-0 text-right">{idx + 1}</span>

                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm shrink-0">
                  {u.nome.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900 truncate">{u.nome}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${role.cls}`}>
                      {role.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                    {u.setores.length === 0 ? (
                      <span className="text-xs text-gray-400">Sem setor</span>
                    ) : (
                      u.setores.map((s) => (
                        <span key={s} className={`text-xs px-1.5 py-0.5 rounded font-medium ${SETOR_COR[s] ?? 'bg-gray-100 text-gray-600'}`}>
                          {s}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Último acesso */}
                <div className="text-right shrink-0">
                  <span className={`text-xs ${acesso.cls}`}>{acesso.texto}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
