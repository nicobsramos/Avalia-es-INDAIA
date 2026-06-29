import { useAuth } from '../context/AuthContext'

export function AguardandoAprovacao() {
  const { perfil, signOut } = useAuth()
  const recusado = perfil?.status === 'recusado'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-900 to-brand-700 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 text-center space-y-5">
        {recusado ? (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Acesso não autorizado</h2>
              <p className="text-sm text-gray-500 mt-2">
                Sua solicitação de acesso não foi aprovada. Entre em contato com o administrador do sistema para mais informações.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Aguardando aprovação</h2>
              <p className="text-sm text-gray-500 mt-2">
                Olá, <strong>{perfil?.nome}</strong>! Sua solicitação foi recebida e está sendo analisada pelo administrador. Você receberá acesso assim que for aprovado.
              </p>
            </div>
          </>
        )}

        <button
          onClick={signOut}
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-lg transition-colors text-sm"
        >
          Sair
        </button>
      </div>
    </div>
  )
}
