import React, { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogIn,
  LogOut,
  Layers,
  ArrowRight,
  Eye,
  EyeOff,
  MapPin,
  Search,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { User } from 'firebase/auth';
import { DriveFileItem, GoogleSheetsConfig } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  auth,
  googleSignIn,
  googleLogout,
  listDriveSpreadsheets,
  ensureCheckinsTab,
  getAccessToken,
  extractSpreadsheetId
} from '../services/googleWorkspace';

interface GoogleSheetsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  token: string | null;
  config: GoogleSheetsConfig;
  onSaveConfig: (cfg: GoogleSheetsConfig) => void;
  onLoadFromSheets: (
    fixedSheetId: string,
    motorizedSheetId?: string,
    coordinatesSheetId?: string,
    explicitToken?: string | null
  ) => Promise<{ schoolsCount: number; staffCount: number; coordinatesCount?: number }>;
  onAuthSuccess?: (user: User, token: string) => void;
}

export const GoogleSheetsConfigModal: React.FC<GoogleSheetsConfigModalProps> = ({
  isOpen,
  onClose,
  user: propUser,
  token: propToken,
  config,
  onSaveConfig,
  onLoadFromSheets,
  onAuthSuccess
}) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [driveFilter, setDriveFilter] = useState('');
  const [copiedDomain, setCopiedDomain] = useState(false);

  // Local token fallback
  const [localToken, setLocalToken] = useState<string | null>(propToken || getAccessToken());
  const [localUser, setLocalUser] = useState<User | null>(propUser || auth.currentUser);

  const [fixedSheetId, setFixedSheetId] = useState(config.fixedStaffSheetId || '');
  const [motorizedSheetId, setMotorizedSheetId] = useState(config.motorizedStaffSheetId || '');
  const [coordinatesSheetId, setCoordinatesSheetId] = useState(config.coordinatesSheetId || '');
  const [tabName, setTabName] = useState(config.checkinsTabName || 'Check-ins_Eleicoes2026');
  const [operationalPass, setOperationalPass] = useState(config.operationalPassword || '40BPMI');
  const [showOperationalPass, setShowOperationalPass] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);

  const activeToken = propToken || localToken || getAccessToken();
  const activeUser = propUser || localUser || auth.currentUser;
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const firebaseProjectId = firebaseConfig.projectId || 'gen-lang-client-0174045756';

  const handleCopyDomain = async () => {
    if (!currentHostname) return;
    try {
      await navigator.clipboard.writeText(currentHostname);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2500);
    } catch {
      // clipboard fallback
    }
  };

  // Sync prop changes
  useEffect(() => {
    if (propToken) setLocalToken(propToken);
    if (propUser) setLocalUser(propUser);
  }, [propToken, propUser]);

  useEffect(() => {
    setFixedSheetId(config.fixedStaffSheetId || '');
    setMotorizedSheetId(config.motorizedStaffSheetId || '');
    setCoordinatesSheetId(config.coordinatesSheetId || '');
    setTabName(config.checkinsTabName || 'Check-ins_Eleicoes2026');
    setOperationalPass(config.operationalPassword || '40BPMI');
  }, [config]);

  // Load drive files on open if token is present
  useEffect(() => {
    if (isOpen && activeToken && driveFiles.length === 0) {
      loadFiles(activeToken);
    }
  }, [isOpen, activeToken, driveFiles.length]);

  const loadFiles = async (tokenToUse: string) => {
    setLoadingFiles(true);
    setErrorMsg(null);
    try {
      const files = await listDriveSpreadsheets(tokenToUse);
      setDriveFiles(files);
    } catch (err: any) {
      console.warn('Erro ao listar arquivos do Drive:', err);
      if (err?.message?.includes('401') || err?.message?.includes('expirou')) {
        setLocalToken(null);
        setErrorMsg('Sua sessão da Conta Google expirou (401). Clique no botão "Entrar com o Google" para reconectar.');
      } else {
        setErrorMsg('Não foi possível listar as planilhas do Google Drive. Verifique a conexão ou informe o link/ID diretamente.');
      }
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleSignIn = async () => {
    setIsLoggingIn(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const authResult = await googleSignIn();
      if (authResult?.accessToken) {
        setLocalToken(authResult.accessToken);
        setLocalUser(authResult.user);
        if (onAuthSuccess) {
          onAuthSuccess(authResult.user, authResult.accessToken);
        }
        await loadFiles(authResult.accessToken);
      }
    } catch (err: any) {
      const isPopupClosed =
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        err?.message?.includes('popup-closed-by-user');

      if (isPopupClosed) {
        console.info('Login Google cancelado: a janela de autenticação foi fechada antes da confirmação.');
        setErrorMsg('A janela de login foi fechada. Clique em "Entrar com o Google" para prosseguir.');
      } else {
        console.error('Sign-in error:', err);
        const isUnauthorizedDomain =
          err?.code === 'auth/unauthorized-domain' ||
          err?.message?.includes('auth/unauthorized-domain') ||
          err?.message?.includes('unauthorized-domain');

        if (isUnauthorizedDomain) {
          setErrorMsg('auth/unauthorized-domain');
        } else {
          setErrorMsg(err.message || 'Falha ao autenticar com a Conta Google.');
        }
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await googleLogout();
    setLocalToken(null);
    setLocalUser(null);
    setDriveFiles([]);
  };

  const handleTestAndSave = async (overrideToken?: string | null) => {
    const effectiveToken = overrideToken !== undefined ? overrideToken : (activeToken || getAccessToken());

    const cleanFixedId = extractSpreadsheetId(fixedSheetId);
    if (!cleanFixedId) {
      setErrorMsg('Selecione ou informe ao menos a planilha do Efetivo Fixo (Postos Eleitorais).');
      return;
    }

    const cleanMotorizedId = motorizedSheetId ? extractSpreadsheetId(motorizedSheetId) : undefined;
    const cleanCoordinatesId = coordinatesSheetId ? extractSpreadsheetId(coordinatesSheetId) : undefined;
    const cleanTab = tabName.trim() || 'Check-ins_Eleicoes2026';

    setIsTesting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // 1. If effectiveToken exists, ensure checkin tab exists with audit headers
      if (effectiveToken) {
        try {
          await ensureCheckinsTab(cleanFixedId, cleanTab, effectiveToken);
        } catch (tabErr) {
          console.warn('Não foi possível verificar/criar aba de check-ins no Sheets (verifique permissões):', tabErr);
        }
      }

      // 2. Load data from sheets (works with token or via public share link)
      const stats = await onLoadFromSheets(cleanFixedId, cleanMotorizedId, cleanCoordinatesId, effectiveToken);

      const fixedFile = driveFiles.find((f) => f.id === cleanFixedId);
      const motorizedFile = cleanMotorizedId ? driveFiles.find((f) => f.id === cleanMotorizedId) : undefined;
      const coordinatesFile = cleanCoordinatesId ? driveFiles.find((f) => f.id === cleanCoordinatesId) : undefined;

      onSaveConfig({
        fixedStaffSheetId: cleanFixedId,
        fixedStaffSheetName: fixedFile?.name || config.fixedStaffSheetName || 'Planilha Efetivo Fixo',
        motorizedStaffSheetId: cleanMotorizedId || '',
        motorizedStaffSheetName: motorizedFile?.name || config.motorizedStaffSheetName || 'Planilha Efetivo Motorizado',
        coordinatesSheetId: cleanCoordinatesId || '',
        coordinatesSheetName: coordinatesFile?.name || config.coordinatesSheetName || 'Planilha de Coordenadas GPS',
        checkinsTabName: cleanTab,
        autoSync: true,
        lastSyncTime: new Date().toLocaleTimeString('pt-BR'),
        operationalPassword: operationalPass.trim().toUpperCase() || '40BPMI'
      });

      setTestSuccess(true);
      const coordStats = stats.coordinatesCount ? `, ${stats.coordinatesCount} coordenadas GPS` : '';
      setSuccessMsg(
        effectiveToken
          ? `Planilhas validadas com sucesso! ${stats.schoolsCount} postos eleitorais, ${stats.staffCount} militares de apoio/ronda${coordStats} carregados.`
          : `Planilhas públicas lidas e sincronizadas com sucesso! ${stats.schoolsCount} postos eleitorais, ${stats.staffCount} militares de apoio/ronda${coordStats} carregados.`
      );

      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err: any) {
      console.warn('Falha no teste/sincronização de planilhas:', err);
      if (err?.message?.includes('401') || err?.message?.includes('expirou')) {
        setLocalToken(null);
        setErrorMsg(
          'Sua sessão da Conta Google expirou (401). Por favor, clique no botão "Entrar com o Google" acima para reconectar sua conta.'
        );
      } else {
        setErrorMsg(
          err.message ||
            'Erro ao sincronizar com o Google Sheets. Verifique se a planilha está compartilhada como "Qualquer pessoa com o link pode ver" ou se você está conectado com uma conta autorizada.'
        );
      }
    } finally {
      setIsTesting(false);
    }
  };

  const filteredDriveFiles = driveFilter.trim()
    ? driveFiles.filter((f) => f.name.toLowerCase().includes(driveFilter.trim().toLowerCase()))
    : driveFiles;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-xl w-full p-3.5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 max-h-[94vh] sm:max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-[#0F2B48]">
                Integração Google Drive & Google Sheets
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                Conecte as planilhas de efetivo e configure a gravação dos check-ins
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-4 text-xs overflow-y-auto pr-1">
          {/* Auth State Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {activeUser && activeToken ? (
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-blue-700 text-white font-extrabold flex items-center justify-center text-sm shadow-xs">
                  {activeUser.email?.charAt(0).toUpperCase() || 'P'}
                </div>
                <div>
                  <div className="font-extrabold text-slate-800 text-xs">
                    {activeUser.displayName || activeUser.email}
                  </div>
                  <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Conta Google Conectada com Sucesso
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <strong className="text-slate-800 text-xs block">
                  Autenticação Google Workspace
                </strong>
                <span className="text-[11px] text-slate-500">
                  Faça login para listar e ler as planilhas do seu Google Drive.
                </span>
              </div>
            )}

            <div>
              {activeUser && activeToken ? (
                <button
                  onClick={handleSignOut}
                  className="px-3.5 py-2 text-[11px] font-bold text-slate-600 hover:text-rose-700 hover:bg-rose-50 border border-slate-300 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Desconectar
                </button>
              ) : (
                <button
                  id="btn-google-signin"
                  onClick={handleSignIn}
                  disabled={isLoggingIn}
                  className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 font-bold border border-slate-300 rounded-lg transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isLoggingIn ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                  )}
                  <span>Entrar com o Google</span>
                </button>
              )}
            </div>
          </div>

          {errorMsg && (
            errorMsg.includes('unauthorized-domain') ? (
              <div className="p-4 bg-amber-50/95 border-2 border-amber-300 rounded-xl text-amber-950 flex flex-col gap-3 shadow-xs animate-in fade-in">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-200 text-amber-900 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-5 h-5 text-amber-700" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-black text-xs sm:text-sm text-amber-950">
                      Domínio Não Autorizado no Firebase Authentication
                    </h5>
                    <p className="text-[11px] sm:text-xs text-amber-900 leading-relaxed font-medium">
                      O aplicativo está rodando neste endereço hospedado, mas o Firebase bloqueia o login do Google até que este domínio seja incluído na lista de <strong>Domínios autorizados</strong> do projeto.
                    </p>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Domínio a autorizar:</span>
                    <code className="text-xs font-mono font-black text-slate-900 break-all select-all">
                      {currentHostname || 'localhost'}
                    </code>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyDomain}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
                  >
                    {copiedDomain ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedDomain ? 'Copiado!' : 'Copiar Domínio'}</span>
                  </button>
                </div>

                <div className="text-[11.5px] text-amber-950 bg-amber-100/60 p-3 rounded-lg border border-amber-200/80 space-y-1.5">
                  <div className="font-black text-xs text-amber-900">Como autorizar (passo a passo simples):</div>
                  <ol className="list-decimal list-inside space-y-1 pl-1 text-[11px] font-medium text-amber-900">
                    <li>Clique no botão abaixo para abrir as configurações de Autenticação do Firebase Console.</li>
                    <li>Role até a seção <strong>"Domínios autorizados"</strong> (Authorized domains) e clique em <strong>"Adicionar domínio"</strong>.</li>
                    <li>Cole o domínio <code className="bg-white px-1.5 py-0.5 rounded font-mono font-bold text-slate-900 border border-amber-300">{currentHostname}</code> e clique em <strong>Salvar</strong>.</li>
                    <li>Retorne aqui e clique em <strong>"Entrar com o Google"</strong>.</li>
                  </ol>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <a
                    href={`https://console.firebase.google.com/project/${firebaseProjectId}/authentication/settings`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir Configurações no Firebase Console</span>
                  </a>

                  <button
                    type="button"
                    disabled={isTesting}
                    onClick={() => handleTestAndSave(null)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                    title="Se as planilhas estiverem configuradas como 'Qualquer pessoa com o link pode ver', os dados serão lidos e sincronizados imediatamente sem precisar de login."
                  >
                    <span>Sincronizar Planilha Pública Sem Login</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div className="leading-tight font-medium">{errorMsg}</div>
              </div>
            )
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
              <div className="leading-tight font-bold">{successMsg}</div>
            </div>
          )}

          {/* Google Drive Search Filter & Refresh */}
          {driveFiles.length > 0 && (
            <div className="p-2.5 bg-slate-100/90 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <input
                  type="text"
                  value={driveFilter}
                  onChange={(e) => setDriveFilter(e.target.value)}
                  placeholder="Pesquisar nas planilhas do Drive (ex: Coordenadas, Efetivo, Rondas)..."
                  className="bg-transparent border-none text-xs text-slate-800 placeholder-slate-400 outline-none w-full font-medium"
                />
                {driveFilter && (
                  <button
                    type="button"
                    onClick={() => setDriveFilter('')}
                    className="text-slate-400 hover:text-slate-600 text-xs px-1 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => activeToken && loadFiles(activeToken)}
                disabled={loadingFiles}
                className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 shrink-0 px-2 py-1 rounded-md hover:bg-blue-50 transition cursor-pointer"
                title="Atualizar lista de planilhas do Google Drive"
              >
                <RefreshCw className={`w-3 h-3 ${loadingFiles ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Recarregar Drive</span>
              </button>
            </div>
          )}

          {/* Planilha 1: Efetivo Fixo */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-slate-800 font-extrabold block">
                1. Planilha do Efetivo Fixo (Postos Eleitorais):
              </label>
              {loadingFiles && (
                <span className="text-slate-400 font-normal text-[11px] flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin text-blue-600" /> Carregando Google Drive...
                </span>
              )}
            </div>

            {driveFiles.length > 0 ? (
              <select
                value={fixedSheetId}
                onChange={(e) => setFixedSheetId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white outline-none focus:border-blue-600"
              >
                <option value="">Selecione a planilha do seu Google Drive...</option>
                {filteredDriveFiles.map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={fixedSheetId}
                onChange={(e) => setFixedSheetId(e.target.value)}
                placeholder="Selecione acima ou cole o Link/ID da planilha de Efetivo Fixo"
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 bg-white outline-none focus:border-blue-600 font-mono"
              />
            )}
            <span className="text-[10px] text-slate-400 mt-1 block">
              Contém as colunas de Posto/Escola, Município, Bairro e os policiais dos turnos Manhã e Tarde.
            </span>
          </div>

          {/* Planilha 2: Efetivo Motorizado */}
          <div>
            <label className="block text-slate-800 font-extrabold mb-1.5">
              2. Planilha do Efetivo Motorizado (Ronda e Supervisão):
            </label>
            {driveFiles.length > 0 ? (
              <select
                value={motorizedSheetId}
                onChange={(e) => setMotorizedSheetId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white outline-none focus:border-blue-600"
              >
                <option value="">Selecione a planilha de viaturas/ronda (opcional)...</option>
                {filteredDriveFiles.map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={motorizedSheetId}
                onChange={(e) => setMotorizedSheetId(e.target.value)}
                placeholder="Selecione acima ou cole o Link/ID da planilha de Efetivo Motorizado"
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 bg-white outline-none focus:border-blue-600 font-mono"
              />
            )}
            <span className="text-[10px] text-slate-400 mt-1 block">
              Contém as viaturas, oficiais de ronda, supervisores de companhia e condutores.
            </span>
          </div>

          {/* Planilha 3: Coordenadas dos Postos Eleitorais */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-slate-800 font-extrabold flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                3. Planilha das Coordenadas dos Postos Eleitorais (GPS / Latitude e Longitude):
              </label>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Geolocalização
              </span>
            </div>
            {driveFiles.length > 0 ? (
              <select
                value={coordinatesSheetId}
                onChange={(e) => setCoordinatesSheetId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white outline-none focus:border-blue-600"
              >
                <option value="">Selecione a planilha de coordenadas do seu Google Drive...</option>
                {filteredDriveFiles.map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={coordinatesSheetId}
                onChange={(e) => setCoordinatesSheetId(e.target.value)}
                placeholder="Selecione acima ou cole o Link/ID da planilha de Coordenadas"
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 bg-white outline-none focus:border-blue-600 font-mono"
              />
            )}
            <span className="text-[10px] text-slate-400 mt-1 block">
              Contém as escolas e suas coordenadas GPS (Latitude e Longitude), logradouro e bairro. Compatível com colunas separadas (Lat e Long), coluna única combinada (Coordenadas/GPS), links do Google Maps, DMS e formatação com vírgula ou ponto. Validação automática de 150m no check-in.
            </span>
          </div>

          {/* Modo Estritamente Leitura (Sheets Read-Only) */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl">
            <div className="flex items-center gap-2 mb-1.5">
              <Layers className="w-4 h-4 text-blue-700" />
              <label className="text-blue-950 font-extrabold text-xs">
                4. Modo Estritamente Leitura (Gravação Desativada):
              </label>
            </div>
            <div className="p-2.5 bg-white rounded-lg border border-blue-200 text-xs text-blue-950 font-medium leading-relaxed">
              Conforme determinação operacional, a integração com o Google Sheets opera <strong>estritamente para leitura e importação das planilhas</strong> do efetivo e dos postos eleitorais. O sistema <strong>não grava nem altera nenhuma linha</strong> nas suas planilhas do Google Drive.
            </div>
          </div>

          {/* Senha Operacional de Supervisão */}
          <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl">
            <div className="flex items-center justify-between mb-1">
              <label className="text-amber-950 font-extrabold text-xs">
                5. Senha Operacional da P/3 (para Oficiais e Rondas):
              </label>
              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                Personalizável
              </span>
            </div>
            <div className="relative">
              <input
                type={showOperationalPass ? 'text' : 'password'}
                value={operationalPass}
                onChange={(e) => setOperationalPass(e.target.value.toUpperCase())}
                placeholder="Definir senha autorizada"
                className="w-full pl-3 pr-10 py-2 bg-white rounded-lg border border-amber-300 text-xs font-mono font-bold text-slate-800 outline-none focus:border-amber-600 uppercase tracking-widest"
              />
              <button
                type="button"
                onClick={() => setShowOperationalPass(!showOperationalPass)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title={showOperationalPass ? 'Ocultar senha' : 'Ver senha'}
              >
                {showOperationalPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-amber-800 mt-1.5 leading-tight">
              Esta é a senha que você passará aos Oficiais e Rondas para liberarem o Painel Geral no celular deles. Você pode alterá-la quando quiser.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-xl transition cursor-pointer min-h-[42px]"
          >
            Fechar
          </button>

          <button
            id="btn-sync-sheets-confirm"
            type="button"
            disabled={isTesting}
            onClick={() => handleTestAndSave()}
            className="w-full sm:w-auto px-5 py-2.5 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
          >
            {isTesting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Validando Planilhas...
              </>
            ) : testSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Validado com Sucesso!
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4" />
                Validar e Sincronizar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
