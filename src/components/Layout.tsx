import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { rangeCompetenciaAtual, formatarCompetencia, competenciaAtual } from '../utils/notas'

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar (mobile) */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-base font-semibold text-gray-800">Indaiá</h1>
          <div className="w-9" />
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="bg-brand-700 px-4 py-3 text-center">
            <p className="text-xs font-medium text-brand-200 uppercase tracking-wide">Competência atual</p>
            <p className="text-base font-bold text-white mt-0.5">
              {formatarCompetencia(competenciaAtual())} &nbsp;·&nbsp; {rangeCompetenciaAtual()}
            </p>
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
