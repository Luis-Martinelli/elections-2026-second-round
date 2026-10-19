import React, { useState } from 'react';
import { Shield, Clock, FileSpreadsheet, Download, CheckCircle, RefreshCw, Menu, X, Radio, LogOut, UserCheck, Unlink, Cloud, Home, RotateCcw } from 'lucide-react';
import { User } from 'firebase/auth';
import { DeviceBinding } from '../types';
import { Brasao40BPMI } from './Brasao40BPMI';
import { useClock } from '../utils/useClock';

interface HeaderProps {
  user: User | null;
  onOpenSheetsConfig: () => void;
  onOpenReportExport: () => void;
  onQuickSync?: () => void;
  hasSheetsConfigured: boolean;
  isSyncing: boolean;
  onLogout?: () => void;
  isSupervisorMode?: boolean;
  onOpenSupervisorLogin?: () => void;
  deviceBinding?: DeviceBinding | null;
  onUnbindDevice?: () => void;
  cloudConnected?: boolean;
  isQuotaExhausted?: boolean;
  onReconnectCloud?: () => void;
  onClearTestData?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onOpenSheetsConfig,
  onOpenReportExport,
  onQuickSync,
  hasSheetsConfigured,
  isSyncing,
  onLogout,
  isSupervisorMode = false,
  onOpenSupervisorLogin,
  deviceBinding,
  onUnbindDevice,
  cloudConnected = true,
  isQuotaExhausted = false,
  onReconnectCloud,
  onClearTestData
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const currentTime = useClock();
  const hours = new Date().getHours();
  const activeShiftLabel = hours >= 6 && hours < 12 ? 'Turno Manhã' : 'Turno Tarde';

  return (
    <header className="bg-white border-b border-slate-200 static sm:sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand & Identity */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center shrink-0">
              <Brasao40BPMI className="w-8 h-auto sm:w-10 drop-shadow-xs" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h1 className="text-xs sm:text-base font-extrabold text-[#0F2B48] tracking-tight leading-none uppercase truncate">
                  12º BPM/I <span className="hidden xs:inline">· PMESP</span>
                </h1>
                <span className="inline-flex items-center px-1.5 py-0.2 sm:px-2 sm:py-0.5 rounded text-[9px] sm:text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                  CPI-7
                </span>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-900 border border-blue-200">
                  {activeShiftLabel}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 font-semibold mt-0.5 truncate max-w-[200px] xs:max-w-xs sm:max-w-md md:max-w-none">
                Eleições Gerais 2026 · Divisão Operacional (P/3)
              </p>
            </div>
          </div>

          {/* Desktop Controls (hidden on mobile, visible on sm/md+) */}
          <div className="hidden lg:flex items-center gap-2.5 flex-wrap">
            {/* Real-time Status Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
              </span>
              SISTEMA ATIVO
            </div>

            {/* Cloud Status Badge */}
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                cloudConnected
                  ? 'bg-blue-50/80 border-blue-200 text-blue-800'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}
              title={cloudConnected ? 'Sistema online sincronizado em tempo real' : 'Conectando ao sistema...'}
            >
              <Cloud
                className={`w-3.5 h-3.5 ${
                  cloudConnected ? 'text-blue-600' : 'text-amber-600'
                }`}
              />
              <span>{cloudConnected ? 'Sistema Online' : 'Conectando...'}</span>
            </div>

            {/* Clock badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-mono text-xs font-bold">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>{currentTime}</span>
            </div>

            {/* Quick Sync Button */}
            {onQuickSync && (
              <button
                id="btn-header-quick-sync"
                onClick={onQuickSync}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold transition shadow-xs cursor-pointer min-h-[38px] disabled:opacity-50"
                title="Sincronizar escala com as planilhas do Google Sheets"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Planilha'}</span>
              </button>
            )}

            {/* Google Sheets Config Action */}
            <button
              id="btn-header-sheets-config"
              onClick={onOpenSheetsConfig}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold transition shadow-xs cursor-pointer min-h-[38px]"
              title="Configurar Planilhas do Google Sheets"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Planilhas</span>
            </button>

            {/* Export Report Action */}
            <button
              id="btn-export-reports"
              onClick={onOpenReportExport}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold transition shadow-xs cursor-pointer min-h-[38px]"
              title="Exportar Relatório Operacional (Opção 6A)"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Relatórios P/3</span>
            </button>

            {isSupervisorMode ? (
              <>
                {onUnbindDevice && (
                  <button
                    id="btn-header-unbind-device"
                    onClick={onUnbindDevice}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition shadow-xs cursor-pointer bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 min-h-[38px]"
                    title="Desvincular aparelho celular de policial militar (Gestão P/3)"
                  >
                    <Unlink className="w-3.5 h-3.5 text-rose-600" />
                    <span>Desvincular Aparelho</span>
                    {deviceBinding && (
                      <span className="bg-rose-200/80 text-rose-900 text-[10px] font-mono px-1.5 py-0.5 rounded-md font-black">
                        {deviceBinding.boundRe}
                      </span>
                    )}
                  </button>
                )}
                {onClearTestData && (
                  <button
                    id="btn-header-clear-test-data"
                    onClick={onClearTestData}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 min-h-[38px]"
                    title="Zerar check-ins e fiscalizações de testes para preparar para o dia da Eleição"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-red-600" />
                    <span>Zerar Dados</span>
                  </button>
                )}
                <button
                  id="btn-header-view-officer"
                  onClick={onLogout}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition shadow-xs cursor-pointer bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 min-h-[38px]"
                  title="Voltar para a página inicial"
                >
                  <Home className="w-3.5 h-3.5 text-blue-600" />
                  <span>Página Inicial</span>
                </button>
              </>
            ) : onOpenSupervisorLogin ? (
              <button
                id="btn-header-supervisor"
                onClick={onOpenSupervisorLogin}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition shadow-xs cursor-pointer bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 min-h-[38px]"
                title="Acessar painel geral das escolas (Supervisão / P/3)"
              >
                <Shield className="w-3.5 h-3.5 text-amber-600" />
                <span>Painel P/3</span>
              </button>
            ) : null}

            {onLogout && !isSupervisorMode && (
              <button
                id="btn-header-logout"
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer bg-white hover:bg-red-50 text-slate-600 hover:text-red-700 border border-slate-300 hover:border-red-200 min-h-[38px]"
                title="Sair do Sistema"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500" />
                <span>Sair</span>
              </button>
            )}
          </div>

          {/* Compact Mobile Quick Action Bar (< lg) */}
          <div className="flex lg:hidden items-center gap-1.5 shrink-0">
            {/* Quick sync button on mobile */}
            {onQuickSync && (
              <button
                onClick={onQuickSync}
                disabled={isSyncing}
                className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 flex items-center justify-center transition active:scale-95 disabled:opacity-50"
                title="Sincronizar com Google Sheets"
                aria-label="Sincronizar Planilha"
              >
                <RefreshCw className={`w-4 h-4 text-emerald-700 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            )}

            {/* Quick report button on mobile */}
            <button
              onClick={onOpenReportExport}
              className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-300 text-slate-700 flex items-center justify-center transition active:scale-95"
              title="Relatórios"
              aria-label="Relatórios Operacionais"
            >
              <Download className="w-4 h-4 text-slate-600" />
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="w-10 h-10 rounded-xl bg-[#0F2B48] text-white flex items-center justify-center transition active:scale-95 shadow-xs"
              aria-label="Menu móvel"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Status & Clock on Mobile Drawer */}
            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
              <div className="inline-flex items-center gap-1.5 font-bold text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Sistema Ativo</span>
              </div>
              <div className={`inline-flex items-center gap-1.5 font-bold ${cloudConnected ? 'text-blue-800' : 'text-slate-600'}`}>
                <Cloud className={`w-3.5 h-3.5 ${cloudConnected ? 'text-blue-600' : 'text-slate-500'}`} />
                <span>{cloudConnected ? 'Nuvem Conectada' : 'Conectando...'}</span>
              </div>
              <div className="inline-flex items-center gap-1 font-mono font-bold text-slate-700">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>{currentTime}</span>
              </div>
            </div>

            {/* Shift label */}
            <div className="text-[11px] font-bold text-slate-500 bg-blue-50/70 border border-blue-200 px-3 py-1.5 rounded-xl flex items-center justify-between">
              <span>Turno em Operação:</span>
              <span className="font-extrabold text-blue-900 uppercase">{activeShiftLabel}</span>
            </div>

            {/* Quick Sync in Mobile Drawer */}
            {onQuickSync && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onQuickSync();
                }}
                disabled={isSyncing}
                className="w-full py-2.5 px-3.5 rounded-xl text-xs font-extrabold bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center justify-center gap-2 transition min-h-[44px]"
              >
                <RefreshCw className={`w-4 h-4 text-emerald-700 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar com Planilha Google Sheets'}</span>
              </button>
            )}

            {/* Config Sheets in Mobile Drawer */}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenSheetsConfig();
              }}
              className="w-full py-2.5 px-3.5 rounded-xl text-xs font-extrabold bg-white border border-slate-300 text-slate-700 flex items-center justify-center gap-2 transition min-h-[44px]"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Configurações das Planilhas Sheets</span>
            </button>

            {/* Export Reports button in drawer */}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenReportExport();
              }}
              className="w-full py-2.5 px-3.5 rounded-xl text-xs font-extrabold bg-white border border-slate-300 text-slate-700 flex items-center justify-center gap-2 transition min-h-[44px]"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>Exportar Relatórios Operacionais</span>
            </button>

            {/* Mode Switch in Mobile Drawer */}
            {isSupervisorMode ? (
              <>
                {onUnbindDevice && (
                  <button
                    id="btn-mobile-unbind-device"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onUnbindDevice();
                    }}
                    className="w-full py-2.5 px-3.5 rounded-xl text-xs font-black bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-between transition min-h-[44px] cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Unlink className="w-4 h-4 text-rose-600" />
                      <span>Desvincular Aparelho</span>
                    </div>
                    {deviceBinding && (
                      <span className="bg-rose-200/80 text-rose-900 text-[10px] font-mono px-2 py-0.5 rounded-md font-black">
                        RE: {deviceBinding.boundRe}
                      </span>
                    )}
                  </button>
                )}
                {onClearTestData && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onClearTestData();
                    }}
                    className="w-full py-2.5 px-3.5 rounded-xl text-xs font-bold bg-red-50 border border-red-200 text-red-700 flex items-center justify-center gap-2 transition min-h-[44px] cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4 text-red-600" />
                    <span>Zerar Dados de Testes do Sistema</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogout?.();
                  }}
                  className="w-full py-2.5 px-3.5 rounded-xl text-xs font-black bg-blue-50 border border-blue-200 text-blue-800 flex items-center justify-center gap-2 transition min-h-[44px]"
                >
                  <Home className="w-4 h-4 text-blue-600" />
                  <span>Página Inicial</span>
                </button>
              </>
            ) : onOpenSupervisorLogin ? (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenSupervisorLogin();
                }}
                className="w-full py-2.5 px-3.5 rounded-xl text-xs font-black bg-amber-50 border border-amber-300 text-amber-900 flex items-center justify-center gap-2 transition min-h-[44px]"
              >
                <Shield className="w-4 h-4 text-amber-600" />
                <span>Acessar Painel Geral (Supervisão / P/3)</span>
              </button>
            ) : null}

            {onLogout && !isSupervisorMode && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLogout();
                }}
                className="w-full py-2.5 px-3.5 rounded-xl text-xs font-extrabold bg-red-50 border border-red-200 text-red-700 flex items-center justify-center gap-2 transition min-h-[44px]"
              >
                <LogOut className="w-4 h-4 text-red-600" />
                <span>Sair</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
