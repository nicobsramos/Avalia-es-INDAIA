import { useState, useEffect, useRef, type FormEvent } from 'react'
import { UNIDADES } from '../utils/unidades'

interface Props {
  onVoltar: () => void
}

export function SolicitarAcesso({ onVoltar }: Props) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [senhaConfirm, setSenhaConfirm] = useState('')
  const [senhaVisivel, setSenhaVisivel] = useState(false)
  const [unidadesSelecionadas, setUnidadesSelecionadas] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [enviado, setEnviado] = useState(false)
  const erroRef = useRef<HTMLDivElement>(null)

  // Rola até a mensagem de erro sempre que ela aparecer
  useEffect(() => {
    if (erro) erroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [erro])

  function toggleUnidade(id: string) {
    setUnidadesSelecionadas((prev) =>
      prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')

    if (senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return }
    if (senha !== senhaConfirm) { setErro('As senhas não coincidem.'); return }
    if (unidadesSelecionadas.length === 0) { setErro('Selecione ao menos uma unidade.'); return }

    setEnviando(true)
    try {
      const res = await fetch('/api/solicitar-acesso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          password: senha,
          unidades_nomes: unidadesSelecionadas,
        }),
      })

      let json: any = {}
      try { json = await res.json() } catch { /* body vazio */ }

      if (!res.ok) {
        setErro(json?.error ?? `Erro ${res.status}. Tente novamente.`)
        return
      }
      setEnviado(true)
    } catch {
      setErro('Erro de conexão. Verifique sua internet e tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  if (enviado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-900 to-brand-700 px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 text-center space-y-5">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Solicitação enviada!</h2>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              Sua solicitação foi recebida e está aguardando aprovação do administrador.
              Você receberá acesso assim que for aprovado.
            </p>
          </div>
          <button
            onClick={onVoltar}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            Voltar para o login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-900 to-brand-700 px-4 py-8 flex items-start justify-center">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 my-4">
        <div className="text-center mb-5">
          <h1 className="text-2xl font-extrabold text-brand-900">Grupo Indaiá</h1>
          <p className="text-sm text-gray-500 mt-1">Solicitar acesso</p>
        </div>

        {/* Erro sempre no topo, antes dos campos */}
        {erro && (
          <div ref={erroRef} className="mb-4 text-sm text-red-700 bg-red-50 border border-red-300 rounded-xl px-4 py-3 font-medium">
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Seu nome"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <div className="relative">
              <input
                type={senhaVisivel ? 'text' : 'password'}
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Mínimo 6 caracteres"
              />
              <button
                type="button"
                onClick={() => setSenhaVisivel((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {senhaVisivel ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar senha</label>
            <input
              type={senhaVisivel ? 'text' : 'password'}
              required
              value={senhaConfirm}
              onChange={(e) => setSenhaConfirm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Repita a senha"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unidade(s) <span className="text-gray-400 font-normal">(pode selecionar mais de uma)</span>
            </label>
            <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-52 overflow-y-auto">
              {UNIDADES.map((u) => {
                const checked = unidadesSelecionadas.includes(u.nome)
                return (
                  <label
                    key={u.nome}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${checked ? 'bg-brand-50' : 'hover:bg-gray-50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleUnidade(u.nome)}
                      className="w-4 h-4 accent-brand-600 shrink-0"
                    />
                    <span className="text-sm text-gray-800">{u.nome}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white font-semibold py-3 rounded-xl transition-colors text-sm mt-2"
          >
            {enviando ? 'Enviando solicitação...' : 'Solicitar acesso'}
          </button>

          <button
            type="button"
            onClick={onVoltar}
            className="w-full text-sm text-gray-500 hover:text-gray-700 py-1"
          >
            Voltar para o login
          </button>
        </form>
      </div>
    </div>
  )
}
