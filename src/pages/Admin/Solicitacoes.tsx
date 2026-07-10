import { useState, useEffect, useMemo } from 'react'
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
  unidades_ids: string[] | null
  setores_avaliacao: string[]
  pode_nutri: boolean
  ultimo_acesso: string | null
}

function formatarUltimoAcesso(iso: string | null): string {
  if (!iso) return 'Nunca acessou'
  const d = new Date(iso)
  const hoje = new Date()
  const diffMs = hoje.getTime() - d.getTime()
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDias === 0) return 'Hoje às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (diffDias === 1) return 'Ontem às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (diffDias < 7) return `Há ${diffDias} dias`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

interface Unidade {
  id: string
  nome: string
}

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

function extractCidade(unitNome: string): string {
  return unitNome.split(' – ')[0]
}

const ROLE_LABEL: Record<string, string> = { rede: 'Líder', lider: 'Líder', leitura: 'Leitura' }
const ROLE_COR: Record<string, string> = {
  rede:    'bg-blue-100 text-blue-700',
  lider:   'bg-blue-100 text-blue-700',
  leitura: 'bg-gray-100 text-gray-500',
}

export function AdminSolicitacoes() {
  const [lista, setLista] = useState<Solicitacao[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioAtivo[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [setores, setSetores] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingUsuarios, setLoadingUsuarios] = useState(true)
  const [erro, setErro] = useState('')
  const [processando, setProcessando] = useState<string | null>(null)

  // Filtros
  const [filtroCidade, setFiltroCidade] = useState('')
  const [filtroSetor, setFiltroSetor]   = useState('')

  // Modal de edição
  const [editandoUser, setEditandoUser] = useState<UsuarioAtivo | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editRole, setEditRole] = useState<'lider' | 'leitura'>('lider')
  const [editUnidades, setEditUnidades] = useState<string[]>([])
  const [editSetores, setEditSetores] = useState<string[]>([])
  const [editPodeNutri, setEditPodeNutri] = useState(false)
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
        setSetores(json.setores ?? [])
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
    setEditRole(u.role === 'leitura' ? 'leitura' : 'lider')
    setEditUnidades(u.unidades_ids ?? [])
    setEditSetores(u.setores_avaliacao ?? [])
    setEditPodeNutri(u.pode_nutri ?? false)
  }

  function toggleUnidade(id: string) {
    setEditUnidades((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function toggleSetor(nome: string) {
    setEditSetores((prev) =>
      prev.includes(nome) ? prev.filter((x) => x !== nome) : [...prev, nome]
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
          role: editRole,
          unidades_ids: editUnidades.length > 0 ? editUnidades : null,
          setores_avaliacao: editSetores,
          pode_nutri: editPodeNutri,
        }),
      })
      if (!res.ok) { alert('Erro ao salvar.'); return }
      setUsuarios((prev) => prev.map((u) =>
        u.id === editandoUser.id
          ? { ...u, nome: editNome.trim() || u.nome, role: editRole, unidades_ids: editUnidades.length > 0 ? editUnidades : null, setores_avaliacao: editSetores, pode_nutri: editPodeNutri }
          : u
      ))
      setEditandoUser(null)
    } finally {
      setSalvando(false)
    }
  }

  const cidades = useMemo(
    () => [...new Set(unidades.map((u) => extractCidade(u.nome)))].sort(),
    [unidades],
  )

  const usuariosFiltrados = useMemo(() =>
    usuarios.filter((u) => {
      if (filtroSetor && !u.setores_avaliacao.includes(filtroSetor)) return false
      if (filtroCidade) {
        if (!u.unidades_ids || u.unidades_ids.length === 0) return true
        const cidadesDoUsuario = u.unidades_ids
          .map((id) => unidades.find((un) => un.id === id)?.nome ?? '')
          .map((nome) => extractCidade(nome))
        if (!cidadesDoUsuario.includes(filtroCidade)) return false
      }
      return true
    }),
    [usuarios, unidades, filtroCidade, filtroSetor],
  )

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-8">

      {/* ── Solicitações pendentes ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Acessos pendentes</h2>
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

        {/* Filtros */}
        {!loadingUsuarios && unidades.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <select
              value={filtroCidade}
              onChange={(e) => setFiltroCidade(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Todas as cidades</option>
              {cidades.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={filtroSetor}
              onChange={(e) => setFiltroSetor(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Todos os setores</option>
              {setores.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {(filtroCidade || filtroSetor) && (
              <span className="text-xs text-gray-500 self-center">
                {usuariosFiltrados.length} de {usuarios.length} usuários
              </span>
            )}
          </div>
        )}

        {loadingUsuarios && <LoadingSpinner text="Carregando usuários..." />}
        {!loadingUsuarios && usuariosFiltrados.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">Nenhum usuário encontrado.</p>
        )}

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
          {usuariosFiltrados.map((u) => (
            <div key={u.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{u.nome}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COR[u.role] ?? 'bg-gray-100 text-gray-500'}`}>
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                    {u.pode_nutri && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Nutri</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{u.email}</p>
                  {u.setores_avaliacao.length > 0 && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      Setores: {u.setores_avaliacao.join(', ')}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatarUltimoAcesso(u.ultimo_acesso)}
                  </p>
                </div>
                <button onClick={() => abrirEdicao(u)}
                  className="shrink-0 text-xs text-brand-600 hover:text-brand-700 font-medium px-2 py-1 rounded hover:bg-brand-50 transition-colors">
                  Editar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Modal de edição ── */}
      {editandoUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-gray-900">Editar · {editandoUser.nome}</h3>

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

            {/* Role */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-2 block">Perfil de acesso</label>
              <div className="flex gap-2">
                {(['lider', 'leitura'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setEditRole(r)}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                      editRole === r
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
            </div>

            {/* Setores de avaliação operacional */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-2 block">
                Setores operacionais
                <span className="text-gray-400 font-normal ml-1">(deixe vazio para ver todos)</span>
              </label>
              <div className="space-y-1.5">
                {setores.map((s) => {
                  const marcado = editSetores.includes(s)
                  return (
                    <label key={s}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        marcado ? 'bg-brand-50 border-brand-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => toggleSetor(s)}
                        className="accent-brand-600 w-4 h-4 shrink-0"
                      />
                      <span className="text-sm text-gray-800">{s}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Seg. Alimentar */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-2 block">Seg. Alimentar & 5S</label>
              <label className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                editPodeNutri ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}>
                <input
                  type="checkbox"
                  checked={editPodeNutri}
                  onChange={(e) => setEditPodeNutri(e.target.checked)}
                  className="accent-emerald-600 w-4 h-4 shrink-0"
                />
                <span className="text-sm text-gray-800">Pode lançar avaliações de Seg. Alimentar</span>
              </label>
            </div>

            {/* Unidades com acesso */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-2 block">
                Unidades com acesso <span className="font-normal text-gray-400">(deixe vazio para todas)</span>
              </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {unidades.map((u) => {
                    const marcada = editUnidades.includes(u.id)
                    return (
                      <label key={u.id}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                          marcada ? 'bg-brand-50 border-brand-300' : 'bg-white border-gray-200 hover:bg-gray-50'
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
                <p className="text-xs text-gray-400 mt-1">{editUnidades.length === 0 ? 'Todas as unidades' : `${editUnidades.length} de ${unidades.length} selecionadas`}</p>
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
