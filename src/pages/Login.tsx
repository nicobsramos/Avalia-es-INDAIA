import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { SolicitarAcesso } from './SolicitarAcesso'

export function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [senhaVisivel, setSenhaVisivel] = useState(false)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  const [modoSolicitar, setModoSolicitar] = useState(false)
  const [modoRecuperacao, setModoRecuperacao] = useState(false)
  const [emailRecuperacao, setEmailRecuperacao] = useState('')
  const [recuperacaoEnviada, setRecuperacaoEnviada] = useState(false)
  const [recuperacaoLoading, setRecuperacaoLoading] = useState(false)
  const [recuperacaoErro, setRecuperacaoErro] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    const { error } = await signIn(email, senha)
    setLoading(false)
    if (error) setErro('E-mail ou senha inválidos.')
  }

  async function handleRecuperacao(e: FormEvent) {
    e.preventDefault()
    setRecuperacaoErro('')
    setRecuperacaoLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(emailRecuperacao, {
      redirectTo: window.location.origin,
    })
    setRecuperacaoLoading(false)
    if (error) {
      setRecuperacaoErro('Não foi possível enviar o e-mail. Verifique o endereço.')
    } else {
      setRecuperacaoEnviada(true)
    }
  }

  if (modoSolicitar) {
    return <SolicitarAcesso onVoltar={() => setModoSolicitar(false)} />
  }

  if (modoRecuperacao) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-900 to-brand-700 px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-extrabold text-brand-900">Grupo Indaiá</h1>
            <p className="text-sm text-gray-500 mt-1">Recuperar senha</p>
          </div>

          {recuperacaoEnviada ? (
            <div className="space-y-4 text-center">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-sm text-green-700 font-medium">E-mail enviado!</p>
                <p className="text-xs text-green-600 mt-1">
                  Verifique sua caixa de entrada e clique no link para redefinir a senha.
                </p>
              </div>
              <button
                onClick={() => { setModoRecuperacao(false); setRecuperacaoEnviada(false); setEmailRecuperacao('') }}
                className="text-sm text-brand-600 hover:underline"
              >
                Voltar para o login
              </button>
            </div>
          ) : (
            <form onSubmit={handleRecuperacao} className="space-y-4">
              <p className="text-sm text-gray-500">
                Informe seu e-mail e enviaremos um link para redefinir sua senha.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={emailRecuperacao}
                  onChange={(e) => setEmailRecuperacao(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="seu@email.com"
                />
              </div>

              {recuperacaoErro && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {recuperacaoErro}
                </p>
              )}

              <button
                type="submit"
                disabled={recuperacaoLoading}
                className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
              >
                {recuperacaoLoading ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>

              <button
                type="button"
                onClick={() => setModoRecuperacao(false)}
                className="w-full text-sm text-gray-500 hover:text-gray-700 py-1"
              >
                Voltar para o login
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-900 to-brand-700 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold text-brand-900">Grupo Indaiá</h1>
          <p className="text-sm text-gray-500 mt-1">Avaliação de Unidades</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              required
              autoComplete="email"
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
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setSenhaVisivel((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {senhaVisivel ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {erro && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <div className="text-center space-y-2">
            <button
              type="button"
              onClick={() => { setModoRecuperacao(true); setEmailRecuperacao(email) }}
              className="text-sm text-brand-600 hover:underline block w-full"
            >
              Esqueci minha senha
            </button>
            <div className="border-t border-gray-100 pt-2">
              <button
                type="button"
                onClick={() => setModoSolicitar(true)}
                className="text-sm text-gray-500 hover:text-brand-600 hover:underline"
              >
                Não tenho cadastro — Solicitar acesso
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
