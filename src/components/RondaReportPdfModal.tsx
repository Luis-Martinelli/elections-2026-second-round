import React from 'react';
import { Download, X, FileText, CheckCircle2, AlertTriangle, Sun, Moon } from 'lucide-react';
import { RondaRecord, StaffMember, SchoolItem } from '../types';
import { getRondaShift } from './SectorRondasTab';

interface RondaReportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  rondas: RondaRecord[];
  officerStaff?: StaffMember;
  sectorSchools: SchoolItem[];
  officerRank: string;
  officerName: string;
  officerRe: string;
  sectorName: string;
}

const RANK_HIERARCHY: Array<{ prefix: string; priority: number }> = [
  { prefix: 'TEN CEL', priority: 1 },
  { prefix: 'TC', priority: 1 },
  { prefix: 'MAJ', priority: 2 },
  { prefix: 'CAP', priority: 3 },
  { prefix: '1º TEN', priority: 4 },
  { prefix: '1 TEN', priority: 4 },
  { prefix: '2º TEN', priority: 5 },
  { prefix: '2 TEN', priority: 5 },
  { prefix: 'ASP OF', priority: 6 },
  { prefix: 'ASP', priority: 6 },
  { prefix: 'SUBTEN', priority: 7 },
  { prefix: 'SUB TEN', priority: 7 },
  { prefix: '1º SGT', priority: 8 },
  { prefix: '1 SGT', priority: 8 },
  { prefix: '2º SGT', priority: 9 },
  { prefix: '2 SGT', priority: 9 },
  { prefix: '3º SGT', priority: 10 },
  { prefix: '3 SGT', priority: 10 },
  { prefix: 'CB', priority: 11 },
  { prefix: 'SD', priority: 12 }
];

function getOfficerRankPriority(rank?: string, name?: string): number {
  const normRank = (rank || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[º°]/g, 'º')
    .trim();

  for (const item of RANK_HIERARCHY) {
    if (normRank.includes(item.prefix)) {
      return item.priority;
    }
  }

  const normName = (name || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[º°]/g, 'º')
    .trim();

  for (const item of RANK_HIERARCHY) {
    if (normName.startsWith(item.prefix)) {
      return item.priority;
    }
  }

  return 99;
}

export const RondaReportPdfModal: React.FC<RondaReportPdfModalProps> = ({
  isOpen,
  onClose,
  rondas,
  officerStaff,
  sectorSchools,
  officerRank,
  officerName,
  officerRe,
  sectorName
}) => {
  if (!isOpen) return null;

  // Sort rondas by Officer Rank hierarchy (Ten Cel -> Maj -> Cap -> 1º Ten -> ... -> Sd), then by Name, then by Time
  const sortedRondas = React.useMemo(() => {
    return [...rondas].sort((a, b) => {
      // 1. Rank priority (Ten Cel PM = 1, Maj PM = 2, Cap PM = 3, ...)
      const pA = getOfficerRankPriority(a.rank, a.officerName);
      const pB = getOfficerRankPriority(b.rank, b.officerName);
      if (pA !== pB) return pA - pB;

      // 2. Officer Name
      const nameA = (a.officerName || '').trim();
      const nameB = (b.officerName || '').trim();
      const compName = nameA.localeCompare(nameB, 'pt-BR');
      if (compName !== 0) return compName;

      // 3. Officer RE
      const reA = (a.officerRe || '').trim();
      const reB = (b.officerRe || '').trim();
      const compRe = reA.localeCompare(reB);
      if (compRe !== 0) return compRe;

      // 4. Chronological time for that officer
      const timeA = a.timestamp || 0;
      const timeB = b.timestamp || 0;
      if (timeA !== timeB) return timeA - timeB;

      return (a.time || '').localeCompare(b.time || '');
    });
  }, [rondas]);

  const totalSector = sectorSchools.length;
  const totalRondas = rondas.length;
  const visitedSchoolNames = new Set(rondas.map((r) => r.schoolName.trim().toUpperCase()));
  const totalVisited = visitedSchoolNames.size;
  const totalOccurrences = rondas.filter((r) => r.situation === 'com').length;
  const morningCount = rondas.filter((r) => getRondaShift(r) === 'Manhã').length;
  const afternoonCount = rondas.filter((r) => getRondaShift(r) === 'Tarde').length;
  const coveragePercent = totalSector > 0 ? Math.round((totalVisited / totalSector) * 100) : 0;

  const now = new Date();
  const formattedDate = now.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const formattedTime = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const generateStandaloneHtml = (): string => {
    let rowsHtml = '';
    if (sortedRondas.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="7" style="padding: 16px; text-align: center; color: #64748b; font-style: italic;">
            Nenhuma vistoria de ronda registrada por este militar/equipe neste turno.
          </td>
        </tr>
      `;
    } else {
      sortedRondas.forEach((r, idx) => {
        const isSemNovidade = r.situation === 'sem';
        const shift = getRondaShift(r);
        const shiftBadgeHtml = shift === 'Tarde'
          ? `<span style="background: #ede9fe; color: #5b21b6; border: 1px solid #c4b5fd; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 800;">&#127780; Tarde</span>`
          : `<span style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 800;">&#9728; Manhã</span>`;

        const situacaoHtml = isSemNovidade
          ? `<span style="color: #065f46; font-weight: bold;">&#10003; Sem Novidades (Ordem Mantida)</span>`
          : `<span style="color: #9a3412; font-weight: bold;">&#9888; Ocorr&ecirc;ncia: ${r.obs || 'Alteração registrada'}</span>`;

        const prevRonda = idx > 0 ? sortedRondas[idx - 1] : null;
        const isNewOfficer =
          !prevRonda ||
          prevRonda.officerName !== r.officerName ||
          prevRonda.officerRe !== r.officerRe;

        const borderStyle = isNewOfficer && idx > 0
          ? 'border-top: 2px solid #cbd5e1; border-bottom: 1px solid #e2e8f0; background: #fafafa;'
          : 'border-bottom: 1px solid #e2e8f0;';

        rowsHtml += `
          <tr style="${borderStyle}">
            <td style="padding: 8px 10px; text-align: center; font-family: monospace; font-weight: bold; color: #64748b;">${idx + 1}</td>
            <td style="padding: 8px 10px;">
              <div style="font-weight: 800; color: #0f172a;">${r.rank ? `${r.rank} ` : ''}${r.officerName || 'Não Informado'}</div>
              ${r.officerRe ? `<div style="font-family: monospace; font-size: 10px; color: #64748b;">RE: ${r.officerRe}</div>` : ''}
            </td>
            <td style="padding: 8px 10px; white-space: nowrap;">${shiftBadgeHtml}</td>
            <td style="padding: 8px 10px; font-family: monospace; font-weight: bold; color: #1e293b; white-space: nowrap;">${r.time}</td>
            <td style="padding: 8px 10px; font-weight: bold; color: #0f172a;">${r.schoolName}</td>
            <td style="padding: 8px 10px; font-weight: bold; color: #334155; text-transform: uppercase;">${r.city}</td>
            <td style="padding: 8px 10px;">${situacaoHtml}</td>
          </tr>
        `;
      });
    }

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório de Rondas · 40º BPM/I - ${officerRank} ${officerName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 24px;
      color: #0f172a;
      background: #ffffff;
      font-size: 12px;
      line-height: 1.4;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding-bottom: 14px;
      border-bottom: 2px solid #0f172a;
      margin-bottom: 16px;
    }
    .header img {
      width: 70px;
      height: auto;
      object-fit: contain;
    }
    .header-text h1 {
      margin: 0;
      font-size: 16px;
      text-transform: uppercase;
      font-weight: 900;
      color: #0f172a;
    }
    .header-text .sub {
      font-size: 11px;
      font-weight: bold;
      color: #475569;
      text-transform: uppercase;
    }
    .header-text .title {
      font-size: 13px;
      font-weight: 800;
      color: #1e3a8a;
      margin-top: 2px;
    }
    .header-text .date {
      font-size: 10px;
      color: #64748b;
      margin-top: 2px;
      font-family: monospace;
    }
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 16px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .meta-item .label {
      font-size: 9px;
      font-weight: bold;
      text-transform: uppercase;
      color: #64748b;
    }
    .meta-item .val {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 18px;
    }
    .stat-card {
      padding: 8px 10px;
      border-radius: 6px;
      text-align: center;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
    }
    .stat-card .num {
      font-size: 18px;
      font-weight: 900;
      color: #0f172a;
    }
    .stat-card .lbl {
      font-size: 9px;
      font-weight: bold;
      text-transform: uppercase;
      color: #64748b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-bottom: 24px;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 10px;
      padding: 8px 10px;
      border-bottom: 2px solid #cbd5e1;
      text-align: left;
    }
    td {
      padding: 7px 10px;
      vertical-align: middle;
    }
    .signatures {
      margin-top: 40px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      text-align: center;
      page-break-inside: avoid;
    }
    .sig-line {
      border-top: 1px solid #64748b;
      margin-bottom: 4px;
      width: 80%;
      margin-left: auto;
      margin-right: auto;
    }
    .sig-name {
      font-weight: bold;
      font-size: 11px;
      color: #0f172a;
    }
    .sig-cargo {
      font-size: 10px;
      color: #64748b;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <img src="https://i.imgur.com/3cPH0GM.jpeg" alt="Brasão 40º BPM/I">
    <div class="header-text">
      <div class="sub">Polícia Militar do Estado de São Paulo · CPI-7</div>
      <h1>40º Batalhão de Polícia Militar do Interior</h1>
      <div class="title">RELATÓRIO OPERACIONAL DE FISCALIZAÇÃO DE RONDAS · ELEIÇÕES GERAIS 2026</div>
      <div class="date">Emissão: ${formattedDate} às ${formattedTime}</div>
    </div>
  </div>

  <div class="meta-box">
    <div class="meta-item">
      <div class="label">Encarregado da Ronda</div>
      <div class="val">${officerRank} ${officerName}</div>
      <div style="font-family: monospace; color: #1e3a8a; font-weight: bold;">RE: ${officerRe}</div>
    </div>
    <div class="meta-item">
      <div class="label">Setor de Atuação</div>
      <div class="val">${sectorName}</div>
      <div style="color: #475569;">${officerStaff?.function || 'Supervisão / Ronda Eleições'}</div>
    </div>
    ${officerStaff?.vehicle ? `
      <div class="meta-item">
        <div class="label">Prefixo / Viatura</div>
        <div class="val" style="font-family: monospace;">${officerStaff.vehicle}</div>
      </div>
    ` : ''}
    ${officerStaff?.driver ? `
      <div class="meta-item">
        <div class="label">Motorista / Apoio</div>
        <div class="val">${officerStaff.driver}</div>
      </div>
    ` : ''}
    <div class="meta-item">
      <div class="label">Escala / Turno Previsto</div>
      <div class="val" style="font-size: 11px;">${officerStaff?.shiftRaw || '04/10/2026 - Turno Integral'}</div>
    </div>
  </div>

  <div class="stats-grid" style="grid-template-columns: repeat(5, 1fr);">
    <div class="stat-card">
      <div class="num">${totalSector}</div>
      <div class="lbl">Postos no Setor</div>
    </div>
    <div class="stat-card" style="background: #fef3c7; border-color: #fde68a;">
      <div class="num" style="color: #92400e;">${morningCount}</div>
      <div class="lbl" style="color: #92400e;">Turno Manhã</div>
    </div>
    <div class="stat-card" style="background: #ede9fe; border-color: #c4b5fd;">
      <div class="num" style="color: #5b21b6;">${afternoonCount}</div>
      <div class="lbl" style="color: #5b21b6;">Turno Tarde</div>
    </div>
    <div class="stat-card" style="background: #ecfdf5; border-color: #a7f3d0;">
      <div class="num" style="color: #065f46;">${totalVisited} <span style="font-size: 11px;">(${coveragePercent}%)</span></div>
      <div class="lbl" style="color: #065f46;">Postos Fiscalizados</div>
    </div>
    <div class="stat-card" style="background: #fffbeb; border-color: #fde68a;">
      <div class="num" style="color: #92400e;">${totalOccurrences}</div>
      <div class="lbl" style="color: #92400e;">Ocorrências</div>
    </div>
  </div>

  <div style="font-weight: 800; text-transform: uppercase; font-size: 11px; margin-bottom: 8px; color: #0f172a;">
    Registro de Fiscalizações por Policial / Hierarquia (${sortedRondas.length})
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 30px; text-align: center;">#</th>
        <th style="width: 170px;">Policial / Rondante</th>
        <th style="width: 75px;">Turno</th>
        <th style="width: 100px;">Data / Hora</th>
        <th>Escola / Posto Eleitoral</th>
        <th style="width: 110px;">Município</th>
        <th>Situação Constatada</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="signatures">
    <div>
      <div class="sig-line"></div>
      <div class="sig-name">${officerRank} ${officerName}</div>
      <div class="sig-cargo">RE: ${officerRe} · Encarregado da Ronda</div>
    </div>
    <div>
      <div class="sig-line"></div>
      <div class="sig-name">Coordenação Operacional / P-3</div>
      <div class="sig-cargo">40º BPM/I - Eleições 2026</div>
    </div>
  </div>
</body>
</html>`;
  };

  const handleDownloadHtml = () => {
    try {
      const html = generateStandaloneHtml();
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const cleanName = (officerName || 'Oficial').replace(/[^a-zA-Z0-9]/g, '_');
      link.download = `Relatorio_Rondas_40BPMI_${cleanName}_${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error('Erro ao baixar relatório:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      {/* Modal Card */}
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Top Bar */}
        <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="w-5 h-5 text-blue-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold truncate">
                Relatório Oficial de Rondas · Eleições 2026
              </h3>
              <p className="text-xs text-slate-400 truncate">
                {officerRank} {officerName} (RE: {officerRe}) · {sectorName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDownloadHtml}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
              title="Baixar arquivo do relatório (.html para salvar ou abrir no navegador)"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Arquivo</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">
          {/* Official Document Header */}
          <div className="flex items-center gap-4 pb-4 border-b-2 border-slate-900 text-center sm:text-left">
            <img
              src="https://i.imgur.com/3cPH0GM.jpeg"
              alt="Brasão do 40º BPM/I"
              className="w-16 sm:w-20 h-auto object-contain shrink-0 mx-auto sm:mx-0 drop-shadow-xs"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.includes('/brasao_40bpmi.jpg')) {
                  target.src = '/brasao_40bpmi.jpg';
                }
              }}
            />
            <div className="flex-1">
              <div className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider">
                Polícia Militar do Estado de São Paulo · CPI-7
              </div>
              <h1 className="text-sm sm:text-lg font-black text-slate-900 uppercase tracking-tight">
                40º Batalhão de Polícia Militar do Interior
              </h1>
              <div className="text-xs sm:text-sm font-extrabold text-blue-900 mt-0.5">
                RELATÓRIO OPERACIONAL DE FISCALIZAÇÃO DE RONDAS · ELEIÇÕES GERAIS 2026
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                Emissão do Relatório: {formattedDate} às {formattedTime}
              </div>
            </div>
          </div>

          {/* Operational Team & Shift Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Encarregado da Ronda:</span>
              <strong className="text-slate-900 text-sm font-black">
                {officerRank} {officerName}
              </strong>
              <div className="font-mono text-blue-800 font-bold">RE: {officerRe}</div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Setor de Atuação:</span>
              <strong className="text-slate-900 text-sm font-black">{sectorName}</strong>
              <div className="text-slate-600 font-medium">{officerStaff?.function || 'Fiscalização / Ronda Eleições'}</div>
            </div>

            {officerStaff?.vehicle && (
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Prefixo / Viatura:</span>
                <strong className="text-slate-900 font-mono font-bold">{officerStaff.vehicle}</strong>
              </div>
            )}

            {officerStaff?.driver && (
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Motorista / Apoio:</span>
                <strong className="text-slate-900 font-bold">{officerStaff.driver}</strong>
              </div>
            )}

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Escala / Turno Previsto:</span>
              <strong className="text-slate-900 font-bold">
                {officerStaff?.shiftRaw || '04/10/2026 - Turno Integral'}
              </strong>
            </div>
          </div>

          {/* Productivity Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Postos no Setor</span>
              <span className="text-lg sm:text-2xl font-black text-slate-900">{totalSector}</span>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
              <span className="text-[10px] font-bold text-amber-800 uppercase block">Turno Manhã</span>
              <span className="text-lg sm:text-2xl font-black text-amber-900">{morningCount}</span>
            </div>

            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-center">
              <span className="text-[10px] font-bold text-purple-800 uppercase block">Turno Tarde</span>
              <span className="text-lg sm:text-2xl font-black text-purple-900">{afternoonCount}</span>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
              <span className="text-[10px] font-bold text-emerald-700 uppercase block">Postos Atendidos</span>
              <span className="text-lg sm:text-2xl font-black text-emerald-800">
                {totalVisited} <span className="text-xs font-bold text-emerald-600">({coveragePercent}%)</span>
              </span>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
              <span className="text-[10px] font-bold text-amber-700 uppercase block">Ocorrências</span>
              <span className="text-lg sm:text-2xl font-black text-amber-800">{totalOccurrences}</span>
            </div>
          </div>

          {/* Table of Rondas grouped by Officer and Hierarchy */}
          <div>
            <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center justify-between">
              <span>Registro de Fiscalizações por Policial / Hierarquia ({sortedRondas.length})</span>
              <span className="text-[10px] font-bold text-slate-500">Ordem por Posto e Graduação</span>
            </h4>

            {sortedRondas.length === 0 ? (
              <div className="p-6 bg-slate-50 rounded-xl text-center text-xs text-slate-500 italic border border-slate-200">
                Nenhuma fiscalização registrada por este militar/equipe neste turno.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-300 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-extrabold uppercase text-[10px]">
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3 min-w-[170px]">Policial / Rondante</th>
                      <th className="py-2.5 px-3 w-24">Turno</th>
                      <th className="py-2.5 px-3 w-32">Data / Hora</th>
                      <th className="py-2.5 px-3">Escola / Posto Eleitoral</th>
                      <th className="py-2.5 px-3 w-28">Município</th>
                      <th className="py-2.5 px-3">Situação Constatada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {sortedRondas.map((r, idx) => {
                      const prevRonda = idx > 0 ? sortedRondas[idx - 1] : null;
                      const isNewOfficer =
                        !prevRonda ||
                        prevRonda.officerName !== r.officerName ||
                        prevRonda.officerRe !== r.officerRe;
                      const shift = getRondaShift(r);

                      return (
                        <tr
                          key={r.id || idx}
                          className={`hover:bg-slate-50/80 transition ${
                            isNewOfficer && idx > 0 ? 'border-t-2 border-slate-300 bg-slate-50/40' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-extrabold text-slate-900 text-xs">
                              {r.rank ? `${r.rank} ` : ''}{r.officerName || 'Não Informado'}
                            </div>
                            {r.officerRe && (
                              <div className="text-[10.5px] font-mono text-slate-500 font-semibold">
                                RE: {r.officerRe}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 text-[10.5px] font-black uppercase px-2 py-0.5 rounded-md shadow-2xs ${
                                shift === 'Tarde'
                                  ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                  : 'bg-amber-100 text-amber-900 border border-amber-300'
                              }`}
                            >
                              {shift === 'Tarde' ? (
                                <Moon className="w-3 h-3 text-purple-700" />
                              ) : (
                                <Sun className="w-3 h-3 text-amber-600" />
                              )}
                              <span>{shift}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                            {r.time}
                          </td>
                          <td className="py-2.5 px-3 font-extrabold text-slate-900">
                            {r.schoolName}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-700 uppercase">
                            {r.city}
                          </td>
                          <td className="py-2.5 px-3">
                            {r.situation === 'sem' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-800 font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                Sem Novidades (Ordem Mantida)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-900 font-extrabold">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                Ocorrência: {r.obs || 'Alteração registrada'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Official Signatures Box */}
          <div className="pt-8 pb-4 mt-8 border-t border-slate-300">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-center">
              <div>
                <div className="border-b border-slate-400 w-3/4 mx-auto mb-1"></div>
                <div className="text-xs font-black text-slate-900">
                  {officerRank} {officerName}
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  RE: {officerRe} · Encarregado da Ronda
                </div>
              </div>

              <div>
                <div className="border-b border-slate-400 w-3/4 mx-auto mb-1"></div>
                <div className="text-xs font-black text-slate-900">
                  Coordenação Operacional / P-3
                </div>
                <div className="text-[11px] text-slate-500">
                  40º BPM/I - Eleições 2026
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
