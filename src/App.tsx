import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CompetenciaProvider } from './context/CompetenciaContext'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { TrocaSenha } from './pages/TrocaSenha'
import { AguardandoAprovacao } from './pages/AguardandoAprovacao'
import { Dashboard } from './pages/Dashboard'
import { Avaliacoes } from './pages/Avaliacoes'
import { NovaAvaliacao } from './pages/Avaliacoes/NovaAvaliacao'
import { DetalheAvaliacao } from './pages/Avaliacoes/DetalheAvaliacao'
import { SegAlimentar5S } from './pages/SegAlimentar5S'
import { NovaAvaliacaoNutri } from './pages/SegAlimentar5S/NovaAvaliacaoNutri'
import { DetalheAvaliacaoNutri } from './pages/SegAlimentar5S/DetalheAvaliacaoNutri'
import { AdminSolicitacoes } from './pages/Admin/Solicitacoes'
import { ChecklistDiario } from './pages/ChecklistDiario'
import { NovoChecklist } from './pages/ChecklistDiario/NovoChecklist'
import { DetalheChecklist } from './pages/ChecklistDiario/DetalheChecklist'
import { LoadingSpinner } from './components/LoadingSpinner'

// Keep in sync with api/admin-solicitacoes.ts ADMIN_EMAIL
const ADMIN_EMAIL = 'n.ramos.indaia@gmail.com'

function SoEscrita({ children }: { children: ReactNode }) {
  const { perfil } = useAuth()
  if (perfil?.role === 'leitura') return <Navigate to="/avaliacoes" replace />
  return <>{children}</>
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

function AppRoutes() {
  const { session, loading, perfilReady, mustChangePassword, perfil, user } = useAuth()

  if (loading || (session && !perfilReady)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Verificando sessão..." />
      </div>
    )
  }

  if (!session) return <Login />
  if (mustChangePassword) return <TrocaSenha />

  if (perfil?.status === 'pendente' || perfil?.status === 'recusado') {
    return <AguardandoAprovacao />
  }

  return (
    <CompetenciaProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="seg-alimentar" element={<SegAlimentar5S />} />
          <Route path="seg-alimentar/nova" element={<SoEscrita><NovaAvaliacaoNutri /></SoEscrita>} />
          <Route path="seg-alimentar/:id" element={<DetalheAvaliacaoNutri />} />
          <Route path="avaliacoes" element={<Avaliacoes />} />
          <Route path="avaliacoes/nova" element={<SoEscrita><NovaAvaliacao /></SoEscrita>} />
          <Route path="avaliacoes/:id" element={<DetalheAvaliacao />} />
          <Route path="checklist-diario" element={<ChecklistDiario />} />
          <Route path="checklist-diario/novo" element={<NovoChecklist />} />
          <Route path="checklist-diario/:id" element={<DetalheChecklist />} />
          {user?.email === ADMIN_EMAIL && (
            <Route path="admin/solicitacoes" element={<AdminSolicitacoes />} />
          )}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </CompetenciaProvider>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
