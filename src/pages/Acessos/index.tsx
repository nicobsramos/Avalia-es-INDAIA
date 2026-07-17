import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { LoadingSpinner } from '../../components/LoadingSpinner'

const ADMIN_EMAIL = 'n.ramos.indaia@gmail.com'

// ─── tipos ───────────────────────────────────────────────────────────────────

interface UsuarioAcesso {
  id: string
  nome: string
  role: string
  ver_tudo: boolean
  setores: string[]
  ultimo_acesso: string | null
}

interface UsuarioAdmin {
  id: string
  nome: string
  email: string
  role: string
  status: string
  unidades_ids: string[] | null
  setores_avaliacao: string[]
  pode_nutri: boolean
  pode_orcamento: boolean
  cargo: string | null
  ultimo_acesso: string | null
}

const CARGOS = [
  'Gestor',
  'Maitre',
  'Pré evento',
  'Limpeza',
  'Chef',
  'Chef Regional',
  'Aux de cozinha',
  'Cozinheiro',
  'Barman/estoquista',
]

interface Solicitacao {
  id: string
  nome: string
  email: string
  unidades: string[]
}

interface Unidade { id: string; nome: string }

// ─── helpers ──────────────────────────────────────────────────────────────────

async function getToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

function extractCidade(nome: string) { return nome.split(' – ')[0] }

const SETOR_COR: Record<string, string> = {
  Cozinha: 'bg-orange-100 text-orange-700',
  Bar: 'bg-indigo-100 text-indigo-700',
  Atendimento: 'bg-teal-100 text-teal-700',
}

const ROLE_LABEL: Record<string, string> = { rede: 'Líder', lider: 'Líder', leitura: 'Leitura' }
const ROLE_COR: Record<string, string> = {
  rede:    'bg-blue-100 text-blue-700',
  lider:   'bg-blue-100 text-blue-700',
  leitura: 'bg-gray-100 text-gray-500',
}

function formatUltimoAcesso(iso: string | null): { texto: string; cls: string } {
  if (!iso) return { texto: 'Nunca acessou', cls: 'text-gray-400' }
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 2)  return { texto: 'Agora mesmo', cls: 'text-green-600 font-semibold' }
  if (mins < 60) return { texto: `Há ${mins} min`, cls: 'text-green-600' }
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return { texto: `Há ${hrs}h`, cls: 'text-green-600' }
  const days = Math.floor(hrs / 24)
  if (days === 1) return { texto: 'Ontem', cls: 'text-yellow-600' }
  if (days < 7)  return { texto: `Há ${days} dias`, cls: 'text-yellow-600' }
  if (days < 30) return { texto: `Há ${days} dias`, cls: 'text-gray-500' }
  return {
    texto: new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    cls: 'text-gray-400',
  }
}

// ─── view simples (Lais / Gean / Karina / Flavia) ────────────────────────────

function useAcessos() {
  return useQuery<{ usuarios: UsuarioAcesso[] }>({
    queryKey: ['acessos'],
    queryFn: async () => {
      const token = await getToken()
      const res = await fetch('/api/acessos', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Erro ao carregar')
      }
      return res.json()
    },
    staleTime: 1000 * 60 * 2,
  })
}

function ViewSimples() {
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
            const roleCls = u.ver_tudo
              ? 'bg-purple-100 text-purple-700'
              : u.role === 'leitura' ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700'
            const roleLabel = u.ver_tudo ? 'Admin' : u.role === 'leitura' ? 'Leitura' : 'Líder'
            return (
              <div key={u.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-xs text-gray-300 font-mono w-5 shrink-0 text-right">{idx + 1}</span>
                <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm shrink-0">
                  {u.nome.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900 truncate">{u.nome}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${roleCls}`}>{roleLabel}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                    {u.setores.length === 0
                      ? <span className="text-xs text-gray-400">Sem setor</span>
                      : u.setores.map((s) => (
                          <span key={s} className={`text-xs px-1.5 py-0.5 rounded font-medium ${SETOR_COR[s] ?? 'bg-gray-100 text-gray-600'}`}>{s}</span>
                        ))}
                  </div>
                </div>
                <span className={`text-xs shrink-0 ${acesso.cls}`}>{acesso.texto}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── view admin (Nico) ────────────────────────────────────────────────────────

function ViewAdmin() {
  const { user } = useAuth()
  const isMaster = user?.email === ADMIN_EMAIL
  const [lista, setLista] = useState<Solicitacao[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [setores, setSetores] = useState<string[]>([])
  const [loadingPend, setLoadingPend] = useState(true)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [processando, setProcessando] = useState<string | null>(null)
  const [filtroCidade, setFiltroCidade] = useState('')
  const [filtroSetor, setFiltroSetor] = useState('')

  // modal edição
  const [editandoUser, setEditandoUser] = useState<UsuarioAdmin | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editRole, setEditRole] = useState<'lider' | 'leitura'>('lider')
  const [editUnidades, setEditUnidades] = useState<string[]>([])
  const [editSetores, setEditSetores] = useState<string[]>([])
  const [editPodeNutri, setEditPodeNutri] = useState(false)
  const [editPodeOrcamento, setEditPodeOrcamento] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [apagando, setApagando] = useState<string | null>(null)
  const [salvandoCargo, setSalvandoCargo] = useState<string | null>(null)

  async function carregarPendentes() {
    setLoadingPend(true)
    const token = await getToken()
    const res = await fetch('/api/admin-solicitacoes', { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) setLista(await res.json())
    setLoadingPend(false)
  }

  async function carregarUsuarios() {
    setLoadingUsers(true)
    const token = await getToken()
    const res = await fetch('/api/admin-usuarios', { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) {
      const json = await res.json()
      setUsuarios(
        (json.usuarios ?? []).slice().sort((a: UsuarioAdmin, b: UsuarioAdmin) => {
          if (!a.ultimo_acesso && !b.ultimo_acesso) return 0
          if (!a.ultimo_acesso) return 1
          if (!b.ultimo_acesso) return -1
          return new Date(b.ultimo_acesso).getTime() - new Date(a.ultimo_acesso).getTime()
        }),
      )
      setUnidades(json.unidades ?? [])
      setSetores(json.setores ?? [])
    }
    setLoadingUsers(false)
  }

  useEffect(() => { carregarPendentes(); carregarUsuarios() }, [])

  async function agir(userId: string, acao: 'aprovar' | 'recusar') {
    setProcessando(userId)
    const token = await getToken()
    const res = await fetch('/api/admin-solicitacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId, acao }),
    })
    if (!res.ok) { alert('Erro ao processar.'); setProcessando(null); return }
    setLista((prev) => prev.filter((s) => s.id !== userId))
    carregarUsuarios()
    setProcessando(null)
  }

  function abrirEdicao(u: UsuarioAdmin) {
    setEditandoUser(u)
    setEditNome(u.nome)
    setEditRole(u.role === 'leitura' ? 'leitura' : 'lider')
    setEditUnidades(u.unidades_ids ?? [])
    setEditSetores(u.setores_avaliacao ?? [])
    setEditPodeNutri(u.pode_nutri ?? false)
    setEditPodeOrcamento(u.pode_orcamento ?? false)
  }

  async function salvar() {
    if (!editandoUser) return
    setSalvando(true)
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
        pode_orcamento: editPodeOrcamento,
      }),
    })
    if (!res.ok) { alert('Erro ao salvar.'); setSalvando(false); return }
    setUsuarios((prev) => prev.map((u) =>
      u.id === editandoUser.id
        ? { ...u, nome: editNome.trim() || u.nome, role: editRole, unidades_ids: editUnidades.length > 0 ? editUnidades : null, setores_avaliacao: editSetores, pode_nutri: editPodeNutri, pode_orcamento: editPodeOrcamento }
        : u,
    ))
    setEditandoUser(null)
    setSalvando(false)
  }

  async function atualizarCargo(userId: string, cargo: string | null) {
    setSalvandoCargo(userId)
    const token = await getToken()
    const res = await fetch('/api/admin-usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId, cargo }),
    })
    if (res.ok) {
      setUsuarios((prev) => prev.map((u) => u.id === userId ? { ...u, cargo } : u))
    } else {
      alert('Erro ao atualizar cargo.')
    }
    setSalvandoCargo(null)
  }

  async function apagarUsuario(u: UsuarioAdmin) {
    if (!confirm(`Apagar o usuário "${u.nome}" (${u.email})?\n\nEsta ação não pode ser desfeita.`)) return
    setApagando(u.id)
    const token = await getToken()
    const res = await fetch('/api/admin-usuarios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId: u.id }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      alert('Erro ao apagar: ' + ((body as { error?: string }).error ?? 'Erro desconhecido'))
    } else {
      setUsuarios((prev) => prev.filter((x) => x.id !== u.id))
    }
    setApagando(null)
  }

  const cidades = useMemo(() => [...new Set(unidades.map((u) => extractCidade(u.nome)))].sort(), [unidades])

  const usuariosFiltrados = useMemo(() =>
    usuarios.filter((u) => {
      if (filtroSetor && !u.setores_avaliacao.includes(filtroSetor)) return false
      if (filtroCidade) {
        if (!u.unidades_ids || u.unidades_ids.length === 0) return true
        const cids = u.unidades_ids.map((id) => extractCidade(unidades.find((un) => un.id === id)?.nome ?? ''))
        if (!cids.includes(filtroCidade)) return false
      }
      return true
    }), [usuarios, unidades, filtroCidade, filtroSetor])

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-8">

      {/* Pendentes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Acessos pendentes</h2>
          <button onClick={carregarPendentes} className="text-sm text-brand-600 hover:underline">Atualizar</button>
        </div>
        {loadingPend && <LoadingSpinner text="Carregando..." />}
        {!loadingPend && lista.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-400 text-sm">
            Nenhuma solicitação pendente.
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
            <div className="flex flex-wrap gap-1.5">
              {s.unidades.length > 0
                ? s.unidades.map((u) => <span key={u} className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">{u}</span>)
                : <span className="text-xs text-gray-400">Sem unidade</span>}
            </div>
            <div className="flex gap-3">
              <button disabled={processando === s.id} onClick={() => agir(s.id, 'aprovar')}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold py-2.5 rounded-lg text-sm">
                {processando === s.id ? '...' : 'Aprovar'}
              </button>
              <button disabled={processando === s.id} onClick={() => agir(s.id, 'recusar')}
                className="flex-1 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 font-semibold py-2.5 rounded-lg text-sm border border-red-200">
                Recusar
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Usuários */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Usuários</h2>
          <button onClick={carregarUsuarios} className="text-sm text-brand-600 hover:underline">Atualizar</button>
        </div>

        {!loadingUsers && unidades.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <select value={filtroCidade} onChange={(e) => setFiltroCidade(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">Todas as cidades</option>
              {cidades.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filtroSetor} onChange={(e) => setFiltroSetor(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">Todos os setores</option>
              {setores.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {(filtroCidade || filtroSetor) && (
              <span className="text-xs text-gray-500 self-center">{usuariosFiltrados.length} de {usuarios.length}</span>
            )}
          </div>
        )}

        {loadingUsers && <LoadingSpinner text="Carregando usuários..." />}

        {!loadingUsers && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            {usuariosFiltrados.map((u) => {
              const acesso = formatUltimoAcesso(u.ultimo_acesso)
              return (
                <div key={u.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{u.nome}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COR[u.role] ?? 'bg-gray-100 text-gray-500'}`}>
                          {ROLE_LABEL[u.role] ?? u.role}
                        </span>
                        {u.pode_nutri && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Nutri</span>}
                        {u.pode_orcamento && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Orçamento</span>}
                      </div>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{u.email}</p>
                      {u.setores_avaliacao.length > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">{u.setores_avaliacao.join(', ')}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <select
                          value={u.cargo ?? ''}
                          disabled={salvandoCargo === u.id}
                          onChange={(e) => atualizarCargo(u.id, e.target.value || null)}
                          className="text-xs border border-gray-200 rounded-md px-2 py-1 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-brand-400 disabled:opacity-50"
                        >
                          <option value="">— Cargo —</option>
                          {CARGOS.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        {salvandoCargo === u.id && <span className="text-xs text-gray-400">Salvando…</span>}
                      </div>
                      <span className={`text-xs mt-1 block ${acesso.cls}`}>{acesso.texto}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => abrirEdicao(u)}
                        className="text-xs text-brand-600 hover:text-brand-700 font-medium px-2 py-1 rounded hover:bg-brand-50 transition-colors">
                        Editar
                      </button>
                      {isMaster && (
                        <button
                          disabled={apagando === u.id}
                          onClick={() => apagarUsuario(u)}
                          className="text-xs text-red-400 hover:text-red-600 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-40"
                          title="Apagar usuário"
                        >
                          {apagando === u.id ? '…' : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal edição */}
      {editandoUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-gray-900">Editar · {editandoUser.nome}</h3>

            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Nome</label>
              <input type="text" value={editNome} onChange={(e) => setEditNome(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 mb-2 block">Perfil de acesso</label>
              <div className="flex gap-2">
                {(['lider', 'leitura'] as const).map((r) => (
                  <button key={r} onClick={() => setEditRole(r)}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors ${editRole === r ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                    {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 mb-2 block">
                Setores operacionais <span className="font-normal text-gray-400">(vazio = todos)</span>
              </label>
              <div className="space-y-1.5">
                {setores.map((s) => {
                  const marcado = editSetores.includes(s)
                  return (
                    <label key={s} className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${marcado ? 'bg-brand-50 border-brand-300' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                      <input type="checkbox" checked={marcado} onChange={() => setEditSetores((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])}
                        className="accent-brand-600 w-4 h-4 shrink-0" />
                      <span className="text-sm text-gray-800">{s}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 mb-2 block">Seg. Alimentar & 5S</label>
              <label className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${editPodeNutri ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                <input type="checkbox" checked={editPodeNutri} onChange={(e) => setEditPodeNutri(e.target.checked)} className="accent-emerald-600 w-4 h-4 shrink-0" />
                <span className="text-sm text-gray-800">Pode lançar avaliações de Seg. Alimentar</span>
              </label>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 mb-2 block">Orçamento</label>
              <label className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${editPodeOrcamento ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                <input type="checkbox" checked={editPodeOrcamento} onChange={(e) => setEditPodeOrcamento(e.target.checked)} className="accent-amber-600 w-4 h-4 shrink-0" />
                <span className="text-sm text-gray-800">Pode ver a tela de Orçamento</span>
              </label>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 mb-2 block">
                Unidades com acesso <span className="font-normal text-gray-400">(vazio = todas)</span>
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {unidades.map((u) => {
                  const marcada = editUnidades.includes(u.id)
                  return (
                    <label key={u.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${marcada ? 'bg-brand-50 border-brand-300' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                      <input type="checkbox" checked={marcada} onChange={() => setEditUnidades((prev) => prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id])}
                        className="accent-brand-600 w-4 h-4 shrink-0" />
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

// ─── export principal ─────────────────────────────────────────────────────────

export function Acessos() {
  const { user, perfil } = useAuth()
  const isAdmin = user?.email === ADMIN_EMAIL || perfil?.ver_tudo === true

  // Flavia vê a tela simples mas apenas setor Cozinha (filtrado na API)
  if (isAdmin) return <ViewAdmin />
  return <ViewSimples />
}
