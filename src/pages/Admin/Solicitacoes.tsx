import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { LoadingSpinner } from '../../components/LoadingSpinner'

interface Solicitacao {
  id: string
  nome: string
  email: string
  unidades: string[]
}

interface UsuarioAtivo {
  id: string
  nome: string
  email: string
  role: string
  status: string
  unidades_ids: string[]
}

interface Unidade {
  id: string
  nome: string
}

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

const ROLE_LABEL: Record<string, string> = { rede: 'Rede', lider: 'Líder', leitura: 'Leitura' }

export function AdminSolicitacoes() {
  const [lista, setLista] = useState<Solicitacao[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioAtivo[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingUsuarios, setLoadingUsuarios] = useState(true)
  const [erro, setErro] = useState('')
  const [processando, setProcessando] = useState<string | null>(null)

  // Modal de edição
  const [editandoUser, setEditandoUser] = useState<UsuarioAtivo | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editUnidades, setEditUnidades] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    setLoading(true)
    setErro('')
    try {
      const token = await getToken()
      const res = await fetch('/api/admin-solicitacoes', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) { setErro('Erro ao carregar solicitações.'); return }
      setLista(await res.json())
    } catch {
      setErro('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  async function carregarUsuarios() {
    setLoadingUsuarios(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin-usuarios', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        setUsuarios(json.usuarios ?? [])
        setUnidades(json.unidades ?? [])
      }
    } finally {
      setLoadingUsuarios(false)
    }
  }

  useEffect(() => { carregar(); carregarUsuarios() }, [])

  async function agir(userId: string, acao: 'aprovar' | 'recusar') {
    setProcessando(userId)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin-solicitacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId, acao }),
      })
      if (!res.ok) { alert('Erro ao processar ação.'); return }
      setLista((prev) => prev.filter((s) => s.id !== userId))
      carregarUsuarios()
    } finally {
      setProcessando(null)
    }
  }

  function abrirEdicao(u: UsuarioAtivo) {
    setEditandoUser(u)
    setEditNome(u.nome)
    setEditUnidades(u.unidades_ids ?? [])
  }

  function toggleUnidade(id: string) {
    setEditUnidades((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  async function salvar() {
    if (!editandoUser) return
    setSalvando(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin-usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          userId: editandoUser.id,
          nome: editNome.trim() || editandoUser.nome,
          unidades_ids: editUnidades,
        }),
      })
      if (!res.ok) { alert('Erro ao salvar.'); return }
      setUsuarios((prev) => prev.map((u) =>
        u.id === editandoUser.id
          ? { ...u, nome: editNome.trim() || u.nome, unidades_ids: editUnidades }
          : u
      ))
      setEditandoUser(null)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-8">

      {/* ── Solicitações pendentes ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Solicitações de acesso</h2>
          <button onClick={carregar} className="text-sm text-brand-600 hover:underline flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Atualizar
          </button>
        </div>

        {loading && <LoadingSpinner text="Carregando solicitações..." />}
        {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>}
        {!loading && !erro && lista.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-400 text-sm">Nenhuma solicitação pendente.</p>
          </div>
        )}

        {lista.map((s) => (
          <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">{s.nome}</p>
                <p className="text-sm text-gray-500 truncate">{s.email}</p>
              </div>
              <span className="shrink-0 text-xs bg-amber-100 text-amber-700 font-semibold px-2.5 py-1 rounded-full">Pendente</span>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">Unidades solicitadas</p>
              <div className="flex flex-wrap gap-1.5">
                {s.unidades.length > 0 ? s.unidades.map((u) => (
                  <span key={u} className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">{u}</span>
                )) : <span className="text-xs text-gray-400">Não especificadas</span>}
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button disabled={processando === s.id} onClick={() => agir(s.id, 'aprovar')}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">
                {processando === s.id ? '...' : 'Aprovar'}
              </button>
              <button disabled={processando === s.id} onClick={() => agir(s.id, 'recusar')}
                className="flex-1 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 font-semibold py-2.5 rounded-lg transition-colors text-sm border border-red-200">
                Recusar
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Usuários cadastrados ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Usuários</h2>
          <button onClick={carregarUsuarios} className="text-sm text-brand-600 hover:underline flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Atualizar
          </button>
        </div>

        {loadingUsuarios && <LoadingSpinner text="Carregando usuários..." />}

        {!loadingUsuarios && usuarios.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">Nenhum usuário encontrado.</p>
        )}

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
          {usuarios.map((u) => (
            <div key={u.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{u.nome}</p>
                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  {u.unidades_ids.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {u.unidades_ids.length} unidade{u.unidades_ids.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    {ROLE_LABEL[u.role] ?? u.role}
                  </span>
                  <button onClick={() => abrirEdicao(u)}
                    className="text-xs text-brand-600 hover:text-brand-700 font-medium px-2 py-1 rounded hover:bg-brand-50 transition-colors">
                    Editar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Modal de edição ── */}
      {editandoUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-gray-900">Editar usuário</h3>

            {/* Nome */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Nome</label>
              <input
                type="text"
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Unidades */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-2 block">
                Unidades com acesso
              </label>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {unidades.map((u) => {
                  const marcada = editUnidades.includes(u.id)
                  return (
                    <label key={u.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                        marcada
                          ? 'bg-brand-50 border-brand-300'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={marcada}
                        onChange={() => toggleUnidade(u.id)}
                        className="accent-brand-600 w-4 h-4 shrink-0"
                      />
                      <span className="text-sm text-gray-800">{u.nome}</span>
                    </label>
                  )
                })}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                {editUnidades.length} de {unidades.length} selecionadas
              </p>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditandoUser(null)}
                className="flex-1 border border-gray-300 text-gray-700 text-sm font-semibold py-2.5 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button disabled={salvando} onClick={salvar}
                className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
