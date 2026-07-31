import { corClasse, formatarNota } from '../utils/notas'
import type { FuncaoNotas } from '../utils/funcoes'

interface Props {
  funcoes: FuncaoNotas[]
  titulo?: string
}

// Faixa de tiles com a nota média por função (Cozinha, Maitres, Pré evento,
// Barman/Estoquista) — usada no Dashboard e na tela de Avaliações.
export function ResumoFuncoes({ funcoes, titulo = 'Notas por função' }: Props) {
  if (funcoes.length === 0) return null
  return (
    <section>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{titulo}</p>
      <div className={`grid gap-2 ${
        funcoes.length >= 4 ? 'grid-cols-2 sm:grid-cols-4'
        : funcoes.length === 3 ? 'grid-cols-3'
        : funcoes.length === 2 ? 'grid-cols-2'
        : 'grid-cols-1'
      }`}>
        {funcoes.map((f) => (
          <div key={f.key} className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-center">
            <p className="text-[11px] text-gray-400 mb-0.5 leading-tight">{f.label}</p>
            <span className={`text-base font-bold ${corClasse(f.nota)}`}>{formatarNota(f.nota)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
