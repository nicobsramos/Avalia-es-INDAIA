const SISTEMA_INDAIA_URL = 'https://sistema.eventosindaia.com.br'

const CAMINHO = ['Operacional', 'Avaliações', 'Checklists']

export function ChecklistDiario() {
  return (
    <div className="px-4 py-8 max-w-lg mx-auto">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 space-y-6">

        {/* Ícone */}
        <div className="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-brand-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>

        {/* Título e explicação */}
        <div className="text-center space-y-3">
          <h2 className="text-xl font-bold text-gray-900">
            Os checklists mudaram de lugar
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            O preenchimento dos checklists de <strong>abertura</strong> e <strong>fechamento</strong> passou
            para o sistema Indaiá. A partir de agora é por lá que o time registra o dia a dia.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Tudo o que já foi preenchido aqui <strong>continua disponível</strong> no novo sistema —
            nenhum checklist foi perdido.
          </p>
        </div>

        {/* Caminho no novo sistema */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2.5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            Onde encontrar por lá
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {CAMINHO.map((passo, i) => (
              <span key={passo} className="flex items-center gap-1.5">
                {i > 0 && (
                  <svg className="w-3.5 h-3.5 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
                <span className={`text-sm px-2 py-1 rounded-lg font-medium ${
                  i === CAMINHO.length - 1
                    ? 'bg-brand-100 text-brand-700 font-semibold'
                    : 'bg-white border border-gray-200 text-gray-700'
                }`}>
                  {passo}
                </span>
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-500 pt-0.5">
            O preenchimento é o mesmo de sempre — só mudou o endereço.
          </p>
        </div>

        {/* Ação */}
        <div className="space-y-3">
          <a
            href={SISTEMA_INDAIA_URL}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-4 rounded-xl transition-colors text-base flex items-center justify-center gap-2"
          >
            Ir para o sistema Indaiá
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
          <p className="text-xs text-gray-400 text-center break-all">
            sistema.eventosindaia.com.br
          </p>
        </div>

      </div>
    </div>
  )
}
