import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Download,
  Table,
  CheckCircle,
  Filter,
  FileCheck2,
  Trash2,
  Check,
  FileSpreadsheet,
  ArrowLeft,
  FileDown,
  Eye,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { SchoolItem, CheckInRecord, RondaRecord } from '../types';
import { normalizeText } from '../utils/normalize';
import { normalizeCityName } from '../utils/municipality';
import {
  isSchoolFullDay,
  isMorningCheckedIn,
  isAfternoonCheckedIn
} from '../utils/checkinStatus';

interface ReportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  schools: SchoolItem[];
  checkIns: CheckInRecord[];
  rondas: RondaRecord[];
  effectiveShift: 'MANHA' | 'TARDE' | 'TODOS';
  onClearTestData?: () => void | Promise<void>;
}

export const ReportExportModal: React.FC<ReportExportModalProps> = ({
  isOpen,
  onClose,
  schools,
  checkIns,
  rondas,
  effectiveShift,
  onClearTestData
}) => {
  const [reportType, setReportType] = useState<'pending' | 'confirmed' | 'rondas' | 'full'>('pending');
  const [format, setFormat] = useState<'csv' | 'print'>('print');
  const [selectedCity, setSelectedCity] = useState<string>('TODOS');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearedSuccess, setClearedSuccess] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const cities = useMemo(() => {
    const rawCities = schools
      .map((s) => normalizeCityName(s.city?.trim()))
      .filter((c): c is string => Boolean(c && c.length > 1));
    const unique = Array.from(new Set(rawCities));
    unique.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return ['TODOS', ...unique];
  }, [schools]);

  useEffect(() => {
    if (selectedCity !== 'TODOS' && !cities.includes(selectedCity)) {
      setSelectedCity('TODOS');
    }
  }, [cities, selectedCity]);

  // Filtered dataset according to city
  const filteredSchools = useMemo(() => {
    if (selectedCity === 'TODOS') return schools;
    const targetNorm = normalizeCityName(selectedCity);
    return schools.filter((s) => normalizeCityName(s.city || '') === targetNorm);
  }, [schools, selectedCity]);

  const filteredCheckIns = useMemo(() => {
    if (selectedCity === 'TODOS') return checkIns;
    const targetNorm = normalizeCityName(selectedCity);
    return checkIns.filter((c) => normalizeCityName(c.city || '') === targetNorm);
  }, [checkIns, selectedCity]);

  const filteredRondas = useMemo(() => {
    if (selectedCity === 'TODOS') return rondas;
    const targetNorm = normalizeCityName(selectedCity);
    return rondas.filter((r) => normalizeCityName(r.city || '') === targetNorm);
  }, [rondas, selectedCity]);

  if (!isOpen) return null;

  const getReportTitle = () => {
    switch (reportType) {
      case 'pending':
        return 'Relatório de Postos Eleitorais Pendentes de Check-in';
      case 'confirmed':
        return 'Relatório de Auditoria de Presença e Telemetria GPS';
      case 'rondas':
        return 'Relatório de Fiscalização e Rondas Militares';
      case 'full':
        return 'Panorama Geral Consolidado de Todos os Postos';
      default:
        return 'Relatório Operacional';
    }
  };

  // CSV Export logic with UTF-8 BOM and Blob download
  const handleExportCsv = () => {
    const csvRows: string[][] = [];

    if (reportType === 'pending') {
      csvRows.push([
        'Município',
        'Posto Eleitoral',
        'Zona',
        'Bairro',
        'Turno Pendente',
        'Graduação',
        'RE Policial',
        'Nome Policial',
        'Telefone'
      ]);

      filteredSchools.forEach((s) => {
        const amOk = isMorningCheckedIn(s, checkIns);
        const pmOk = isAfternoonCheckedIn(s, checkIns);
        const isFull = isSchoolFullDay(s);
        const pmOfficer = s.pm?.name ? s.pm : (isFull ? s.am : s.pm);

        if (effectiveShift === 'MANHA' || effectiveShift === 'TODOS') {
          if (!amOk) {
            csvRows.push([
              s.city || '',
              s.school || '',
              s.zone || '',
              s.bairro || '',
              'Manhã (06h-13h)',
              s.am?.rank || 'Policial',
              s.am?.re || '—',
              s.am?.name || 'Aguardando escala',
              s.am?.phone || '—'
            ]);
          }
        }

        if (effectiveShift === 'TARDE' || effectiveShift === 'TODOS') {
          if (!pmOk) {
            csvRows.push([
              s.city || '',
              s.school || '',
              s.zone || '',
              s.bairro || '',
              'Tarde (13h-Término)',
              pmOfficer?.rank || 'Policial',
              pmOfficer?.re || '—',
              pmOfficer?.name || 'Aguardando escala',
              pmOfficer?.phone || '—'
            ]);
          }
        }
      });
    } else if (reportType === 'confirmed') {
      csvRows.push([
        'Data/Hora',
        'Protocolo',
        'RE',
        'Posto/Graduação',
        'Nome Policial',
        'Turno',
        'Posto Eleitoral',
        'Município',
        'Distância do Posto (m)',
        'Status do Raio 500m'
      ]);

      filteredCheckIns.forEach((c) => {
        csvRows.push([
          c.time || '',
          c.protocol || '',
          c.officerRe || '',
          c.rank || '',
          c.officerName || '',
          c.shift || '',
          c.schoolName || '',
          c.city || '',
          c.distanceMeters !== null && c.distanceMeters !== undefined ? `${c.distanceMeters}m` : 'N/D',
          c.isOutOfRange ? 'ALERTA: ACIMA DE 150M' : 'CONFORME'
        ]);
      });
    } else if (reportType === 'rondas') {
      csvRows.push([
        'Horário',
        'Rondante',
        'RE',
        'Posto Eleitoral Fiscalizado',
        'Município',
        'Situação Encontrada',
        'Observação / Ocorrência'
      ]);

      filteredRondas.forEach((r) => {
        csvRows.push([
          r.time || '',
          `${r.rank || ''} ${r.officerName || ''}`.trim(),
          r.officerRe || '',
          r.schoolName || '',
          r.city || '',
          r.situation === 'sem' ? 'Sem Novidades' : 'Com Alteração',
          r.obs || ''
        ]);
      });
    } else {
      // Full general list
      csvRows.push([
        'Município',
        'Posto Eleitoral',
        'Zona',
        'Bairro',
        'Turno Manhã - RE',
        'Turno Manhã - Nome',
        'Turno Manhã - Tel',
        'Status Manhã',
        'Turno Tarde - RE',
        'Turno Tarde - Nome',
        'Turno Tarde - Tel',
        'Status Tarde'
      ]);

      filteredSchools.forEach((s) => {
        const amOk = isMorningCheckedIn(s, checkIns);
        const pmOk = isAfternoonCheckedIn(s, checkIns);
        const isFull = isSchoolFullDay(s);
        const pmOfficer = s.pm?.name ? s.pm : (isFull ? s.am : s.pm);

        csvRows.push([
          s.city || '',
          s.school || '',
          s.zone || '',
          s.bairro || '',
          s.am?.re || '—',
          `${s.am?.rank || ''} ${s.am?.name || 'Aguardando'}`.trim(),
          s.am?.phone || '—',
          amOk ? 'CONFIRMADO' : 'PENDENTE',
          pmOfficer?.re || '—',
          `${pmOfficer?.rank || ''} ${pmOfficer?.name || (isFull ? s.am?.name : 'Aguardando')}`.trim(),
          pmOfficer?.phone || '—',
          pmOk ? (isFull && amOk ? 'CONFIRMADO (DIA INTEIRO)' : 'CONFIRMADO') : 'PENDENTE'
        ]);
      });
    }

    const csvContent =
      '\uFEFF' +
      csvRows.map((e) => e.map((val) => `"${(val || '').replace(/"/g, '""')}"`).join(';')).join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Relatorio_Operacional_40BPMI_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Generate self-contained standalone HTML report for 1-click printing or saving
  const generateStandaloneHtml = (): string => {
    const title = getReportTitle();
    const city = selectedCity === 'TODOS' ? 'Todos os Municípios da Circunscrição' : selectedCity;
    const dateStr = new Date().toLocaleDateString('pt-BR');
    const timeStr = new Date().toLocaleTimeString('pt-BR');

    let tableHeaders = '';
    let tableRows = '';

    if (reportType === 'pending') {
      tableHeaders = `
        <th>Município</th>
        <th>Posto Eleitoral</th>
        <th>Turno</th>
        <th>Policial Militar</th>
        <th>RE</th>
        <th>Telefone</th>
      `;
      filteredSchools.forEach((s) => {
        const amOk = isMorningCheckedIn(s, checkIns);
        const pmOk = isAfternoonCheckedIn(s, checkIns);
        const isFull = isSchoolFullDay(s);
        const pmOfficer = s.pm?.name ? s.pm : (isFull ? s.am : s.pm);

        if (!amOk) {
          tableRows += `
            <tr>
              <td>${s.city || ''}</td>
              <td><strong>${s.school || ''}</strong></td>
              <td style="color:#b45309;font-weight:bold;">Manhã</td>
              <td>${s.am?.rank || ''} ${s.am?.name || ''}</td>
              <td style="font-family:monospace;">${s.am?.re || '—'}</td>
              <td>${s.am?.phone || '—'}</td>
            </tr>
          `;
        }
        if (!pmOk) {
          tableRows += `
            <tr>
              <td>${s.city || ''}</td>
              <td><strong>${s.school || ''}</strong></td>
              <td style="color:#be123c;font-weight:bold;">Tarde</td>
              <td>${pmOfficer?.rank || ''} ${pmOfficer?.name || ''}</td>
              <td style="font-family:monospace;">${pmOfficer?.re || '—'}</td>
              <td>${pmOfficer?.phone || '—'}</td>
            </tr>
          `;
        }
      });
    } else if (reportType === 'confirmed') {
      tableHeaders = `
        <th>Hora</th>
        <th>Protocolo</th>
        <th>RE</th>
        <th>Policial Militar</th>
        <th>Posto Eleitoral</th>
        <th>Turno</th>
        <th>Distância</th>
        <th>Conformidade</th>
      `;
      filteredCheckIns.forEach((c) => {
        tableRows += `
          <tr>
            <td>${c.time || ''}</td>
            <td style="font-family:monospace;">${c.protocol || ''}</td>
            <td style="font-family:monospace;">${c.officerRe || ''}</td>
            <td>${c.rank || ''} ${c.officerName || ''}</td>
            <td><strong>${c.schoolName || ''}</strong></td>
            <td>${c.shift || ''}</td>
            <td>${c.distanceMeters !== null && c.distanceMeters !== undefined ? `${c.distanceMeters}m` : 'N/D'}</td>
            <td style="color:${c.isOutOfRange ? '#dc2626' : '#16a34a'};font-weight:bold;">
              ${c.isOutOfRange ? 'ALERTA > 150M' : 'CONFORME'}
            </td>
          </tr>
        `;
      });
    } else if (reportType === 'rondas') {
      tableHeaders = `
        <th>Horário</th>
        <th>Rondante / Supervisor</th>
        <th>RE</th>
        <th>Posto Fiscalizado</th>
        <th>Município</th>
        <th>Situação</th>
        <th>Observações</th>
      `;
      filteredRondas.forEach((r) => {
        tableRows += `
          <tr>
            <td>${r.time || ''}</td>
            <td>${r.rank || ''} ${r.officerName || ''}</td>
            <td style="font-family:monospace;">${r.officerRe || ''}</td>
            <td><strong>${r.schoolName || ''}</strong></td>
            <td>${r.city || ''}</td>
            <td style="font-weight:bold;color:${r.situation === 'sem' ? '#16a34a' : '#dc2626'};">
              ${r.situation === 'sem' ? 'Sem Novidades' : 'Com Alteração'}
            </td>
            <td>${r.obs || '—'}</td>
          </tr>
        `;
      });
    } else {
      tableHeaders = `
        <th>Município</th>
        <th>Posto Eleitoral</th>
        <th>Efetivo Manhã</th>
        <th>Status Manhã</th>
        <th>Efetivo Tarde</th>
        <th>Status Tarde</th>
      `;
      filteredSchools.forEach((s) => {
        const amOk = isMorningCheckedIn(s, checkIns);
        const pmOk = isAfternoonCheckedIn(s, checkIns);
        const isFull = isSchoolFullDay(s);
        const pmOfficer = s.pm?.name ? s.pm : (isFull ? s.am : s.pm);

        tableRows += `
          <tr>
            <td>${s.city || ''}</td>
            <td><strong>${s.school || ''}</strong></td>
            <td>${s.am?.rank || ''} ${s.am?.name || ''} (RE ${s.am?.re || '—'})</td>
            <td style="font-weight:bold;color:${amOk ? '#16a34a' : '#dc2626'};">
              ${amOk ? 'OK' : 'PENDENTE'}
            </td>
            <td>${pmOfficer?.rank || ''} ${pmOfficer?.name || ''} (RE ${pmOfficer?.re || '—'})</td>
            <td style="font-weight:bold;color:${pmOk ? '#16a34a' : '#dc2626'};">
              ${pmOk ? (isFull && amOk ? 'OK (DIA INTEIRO)' : 'OK') : 'PENDENTE'}
            </td>
          </tr>
        `;
      });
    }

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${title} - 40º BPM/I Eleições 2026</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 16px; background: #fff; font-size: 11px; line-height: 1.4; }
    .header { text-align: center; border-bottom: 2px solid #0f2b48; padding-bottom: 12px; margin-bottom: 16px; }
    .header h1 { font-size: 13px; font-weight: 900; margin: 0; text-transform: uppercase; color: #0f2b48; letter-spacing: 0.5px; }
    .header h2 { font-size: 11px; font-weight: 800; margin: 3px 0 0; text-transform: uppercase; color: #334155; }
    .header h3 { font-size: 11px; font-weight: 700; margin: 2px 0 0; text-transform: uppercase; color: #475569; }
    .header p { font-size: 10px; font-weight: 600; margin: 3px 0 0; color: #64748b; }
    .meta-bar { display: flex; justify-content: space-between; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 12px; font-size: 11px; }
    .kpi-boxes { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; text-align: center; }
    .kpi-box { border: 1px solid #cbd5e1; padding: 6px; background: #f8fafc; border-radius: 4px; }
    .kpi-box span { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #64748b; display: block; }
    .kpi-box strong { font-size: 13px; color: #0f2b48; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 10px; }
    th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; font-weight: 800; color: #334155; }
    td { border: 1px solid #e2e8f0; padding: 5px 8px; }
    tr:nth-child(even) { background: #f8fafc; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10px; color: #64748b; }
    .signature { text-align: center; width: 220px; border-top: 1px solid #0f2b48; padding-top: 4px; }
    .signature strong { display: block; color: #0f2b48; font-size: 10px; text-transform: uppercase; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Polícia Militar do Estado de São Paulo</h1>
    <h2>Comando de Policiamento do Interior Sete (CPI-7)</h2>
    <h3>Quadragésimo Batalhão de Polícia Militar do Interior (40º BPM/I)</h3>
    <p>3ª Seção do Estado-Maior (P/3) · Operação Eleições 2026</p>
  </div>
  <div class="meta-bar">
    <div>
      <strong style="text-transform:uppercase;color:#0f2b48;">${title}</strong><br>
      <span>Circunscrição: <strong>${city}</strong></span>
    </div>
    <div style="text-align:right;">
      <span>Data: <strong>${dateStr}</strong></span><br>
      <span>Hora: <strong>${timeStr}</strong></span>
    </div>
  </div>
  <div class="kpi-boxes">
    <div class="kpi-box">
      <span>Total de Postos</span>
      <strong>${filteredSchools.length}</strong>
    </div>
    <div class="kpi-box">
      <span>Check-ins Manhã</span>
      <strong>${filteredSchools.filter((s) => isMorningCheckedIn(s, checkIns)).length}</strong>
    </div>
    <div class="kpi-box">
      <span>Check-ins Tarde</span>
      <strong>${filteredSchools.filter((s) => isAfternoonCheckedIn(s, checkIns)).length}</strong>
    </div>
    <div class="kpi-box">
      <span>Fiscalizações / Rondas</span>
      <strong>${filteredRondas.length}</strong>
    </div>
  </div>
  <table>
    <thead>
      <tr>${tableHeaders}</tr>
    </thead>
    <tbody>
      ${tableRows || '<tr><td colspan="8" style="text-align:center;padding:16px;color:#64748b;">Nenhum registro encontrado para os filtros selecionados.</td></tr>'}
    </tbody>
  </table>
  <div class="footer">
    <div>Relatório gerado pelo Sistema Operacional 40º BPM/I Eleições 2026.</div>
    <div class="signature">
      <strong>Oficial de Operações / P/3</strong>
      <span>40º BPM/I - CPI-7</span>
    </div>
  </div>
</body>
</html>`;
  };

  const handleDownloadHtml = () => {
    const html = generateStandaloneHtml();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Relatorio_Oficial_40BPMI_${reportType}_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Main action handler: always opens preview for print, or downloads CSV for excel
  const handleMainAction = () => {
    if (format === 'csv') {
      handleExportCsv();
    } else {
      setShowPreview(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:overflow-visible">
      {/* Official PMESP Print-Only Document - Used directly by browser when window.print() triggers */}
      <div className="hidden print:block w-full bg-white text-black p-8 font-sans">
        {/* PMESP Official Letterhead */}
        <div className="text-center border-b-2 border-black pb-4 mb-6">
          <div className="text-[14px] font-black uppercase tracking-wider">
            POLÍCIA MILITAR DO ESTADO DE SÃO PAULO
          </div>
          <div className="text-[12px] font-extrabold uppercase tracking-wide mt-0.5">
            COMANDO DE POLICIAMENTO DO INTERIOR SETE (CPI-7)
          </div>
          <div className="text-[12px] font-bold uppercase tracking-wide">
            QUADRAGÉSIMO BATALHÃO DE POLÍCIA MILITAR DO INTERIOR (40º BPM/I)
          </div>
          <div className="text-[11px] font-semibold text-slate-700 uppercase mt-0.5">
            3ª Seção do Estado-Maior (P/3) · Operação Eleições 2026
          </div>
        </div>

        {/* Report Title & Metadata */}
        <div className="flex items-center justify-between border-b border-slate-300 pb-3 mb-4 text-xs">
          <div>
            <span className="font-extrabold text-sm uppercase block">
              {getReportTitle()}
            </span>
            <span className="text-slate-600">
              Circunscrição: <strong>{selectedCity === 'TODOS' ? 'Todos os Municípios' : selectedCity}</strong>
            </span>
          </div>
          <div className="text-right font-mono text-[11px]">
            <div>Emissão: <strong>{new Date().toLocaleDateString('pt-BR')}</strong></div>
            <div>Horário: <strong>{new Date().toLocaleTimeString('pt-BR')}</strong></div>
          </div>
        </div>

        {/* Summary Quantitative Banner */}
        <div className="grid grid-cols-4 gap-2 mb-6 text-center text-xs border border-slate-300 p-2.5 bg-slate-50">
          <div>
            <span className="text-slate-500 block text-[10px] font-bold uppercase">Total Escolas</span>
            <strong className="text-sm">{filteredSchools.length}</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] font-bold uppercase">Check-ins Manhã</span>
            <strong className="text-sm">
              {filteredSchools.filter((s) => isMorningCheckedIn(s, checkIns)).length}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] font-bold uppercase">Check-ins Tarde</span>
            <strong className="text-sm">
              {filteredSchools.filter((s) => isAfternoonCheckedIn(s, checkIns)).length}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] font-bold uppercase">Rondas Registradas</span>
            <strong className="text-sm">{filteredRondas.length}</strong>
          </div>
        </div>

        {/* Printable Data Table */}
        <table className="w-full text-[10px] border-collapse border border-slate-300">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-300 text-left">
              {reportType === 'pending' && (
                <>
                  <th className="p-1.5 border-r border-slate-300">Município</th>
                  <th className="p-1.5 border-r border-slate-300">Posto Eleitoral</th>
                  <th className="p-1.5 border-r border-slate-300">Turno</th>
                  <th className="p-1.5 border-r border-slate-300">Policial Militar</th>
                  <th className="p-1.5 border-r border-slate-300">RE</th>
                  <th className="p-1.5">Telefone</th>
                </>
              )}
              {reportType === 'confirmed' && (
                <>
                  <th className="p-1.5 border-r border-slate-300">Hora</th>
                  <th className="p-1.5 border-r border-slate-300">Protocolo</th>
                  <th className="p-1.5 border-r border-slate-300">RE</th>
                  <th className="p-1.5 border-r border-slate-300">Policial Militar</th>
                  <th className="p-1.5 border-r border-slate-300">Posto Eleitoral</th>
                  <th className="p-1.5 border-r border-slate-300">Turno</th>
                  <th className="p-1.5">Distância / Raio</th>
                </>
              )}
              {reportType === 'rondas' && (
                <>
                  <th className="p-1.5 border-r border-slate-300">Horário</th>
                  <th className="p-1.5 border-r border-slate-300">Rondante / Supervisor</th>
                  <th className="p-1.5 border-r border-slate-300">RE</th>
                  <th className="p-1.5 border-r border-slate-300">Posto Fiscalizado</th>
                  <th className="p-1.5 border-r border-slate-300">Município</th>
                  <th className="p-1.5">Situação / Observações</th>
                </>
              )}
              {reportType === 'full' && (
                <>
                  <th className="p-1.5 border-r border-slate-300">Município</th>
                  <th className="p-1.5 border-r border-slate-300">Posto Eleitoral</th>
                  <th className="p-1.5 border-r border-slate-300">Efetivo Manhã</th>
                  <th className="p-1.5 border-r border-slate-300">Status Manhã</th>
                  <th className="p-1.5 border-r border-slate-300">Efetivo Tarde</th>
                  <th className="p-1.5">Status Tarde</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {reportType === 'pending' &&
              filteredSchools.map((s, i) => {
                const amOk = isMorningCheckedIn(s, checkIns);
                const pmOk = isAfternoonCheckedIn(s, checkIns);
                const isFull = isSchoolFullDay(s);
                const pmOfficer = s.pm?.name ? s.pm : (isFull ? s.am : s.pm);

                return (
                  <React.Fragment key={`prt-pnd-${s.id || s.school}-${i}`}>
                    {!amOk && (
                      <tr className="border-b border-slate-200">
                        <td className="p-1.5 border-r border-slate-200">{s.city}</td>
                        <td className="p-1.5 border-r border-slate-200 font-bold">{s.school}</td>
                        <td className="p-1.5 border-r border-slate-200 font-semibold text-amber-800">Manhã</td>
                        <td className="p-1.5 border-r border-slate-200">{s.am?.rank} {s.am?.name}</td>
                        <td className="p-1.5 border-r border-slate-200 font-mono">{s.am?.re || '—'}</td>
                        <td className="p-1.5">{s.am?.phone || '—'}</td>
                      </tr>
                    )}
                    {!pmOk && (
                      <tr className="border-b border-slate-200">
                        <td className="p-1.5 border-r border-slate-200">{s.city}</td>
                        <td className="p-1.5 border-r border-slate-200 font-bold">{s.school}</td>
                        <td className="p-1.5 border-r border-slate-200 font-semibold text-rose-800">Tarde</td>
                        <td className="p-1.5 border-r border-slate-200">{pmOfficer?.rank} {pmOfficer?.name}</td>
                        <td className="p-1.5 border-r border-slate-200 font-mono">{pmOfficer?.re || '—'}</td>
                        <td className="p-1.5">{pmOfficer?.phone || '—'}</td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

            {reportType === 'confirmed' &&
              filteredCheckIns.map((c, i) => (
                <tr key={`prt-chk-${c.id || i}`} className="border-b border-slate-200">
                  <td className="p-1.5 border-r border-slate-200 font-mono">{c.time}</td>
                  <td className="p-1.5 border-r border-slate-200 font-mono">{c.protocol}</td>
                  <td className="p-1.5 border-r border-slate-200 font-mono">{c.officerRe}</td>
                  <td className="p-1.5 border-r border-slate-200">{c.rank} {c.officerName}</td>
                  <td className="p-1.5 border-r border-slate-200 font-bold">{c.schoolName}</td>
                  <td className="p-1.5 border-r border-slate-200">{c.shift}</td>
                  <td className="p-1.5">
                    {c.distanceMeters !== null && c.distanceMeters !== undefined ? `${c.distanceMeters}m` : 'N/D'}{' '}
                    {c.isOutOfRange ? '(Alerta > 150m)' : '(Conforme)'}
                  </td>
                </tr>
              ))}

            {reportType === 'rondas' &&
              filteredRondas.map((r, i) => (
                <tr key={`prt-rnd-${r.id || i}`} className="border-b border-slate-200">
                  <td className="p-1.5 border-r border-slate-200 font-mono">{r.time}</td>
                  <td className="p-1.5 border-r border-slate-200">{r.rank} {r.officerName}</td>
                  <td className="p-1.5 border-r border-slate-200 font-mono">{r.officerRe}</td>
                  <td className="p-1.5 border-r border-slate-200 font-bold">{r.schoolName}</td>
                  <td className="p-1.5 border-r border-slate-200">{r.city}</td>
                  <td className="p-1.5">
                    <strong>{r.situation === 'sem' ? 'Sem Novidades' : 'Com Alteração'}</strong>
                    {r.obs ? ` - ${r.obs}` : ''}
                  </td>
                </tr>
              ))}

            {reportType === 'full' &&
              filteredSchools.map((s, i) => {
                const amOk = isMorningCheckedIn(s, checkIns);
                const pmOk = isAfternoonCheckedIn(s, checkIns);
                const isFull = isSchoolFullDay(s);
                const pmOfficer = s.pm?.name ? s.pm : (isFull ? s.am : s.pm);

                return (
                  <tr key={`prt-ful-${s.id || s.school}-${i}`} className="border-b border-slate-200">
                    <td className="p-1.5 border-r border-slate-200">{s.city}</td>
                    <td className="p-1.5 border-r border-slate-200 font-bold">{s.school}</td>
                    <td className="p-1.5 border-r border-slate-200">
                      {s.am?.rank} {s.am?.name} (RE {s.am?.re || '—'})
                    </td>
                    <td className="p-1.5 border-r border-slate-200 font-bold">
                      {amOk ? 'OK' : 'PENDENTE'}
                    </td>
                    <td className="p-1.5 border-r border-slate-200">
                      {pmOfficer?.rank} {pmOfficer?.name} (RE {pmOfficer?.re || '—'})
                    </td>
                    <td className="p-1.5 font-bold">
                      {pmOk ? (isFull && amOk ? 'OK (DIA)' : 'OK') : 'PENDENTE'}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>

        {/* Official Closing Signature Block */}
        <div className="mt-12 pt-6 border-t border-slate-300 flex justify-between items-end text-xs">
          <div className="text-slate-500 text-[10px]">
            Relatório gerado pelo Sistema de Gestão Operacional 40º BPM/I Eleições 2026.
          </div>
          <div className="text-center w-64 border-t border-black pt-1">
            <div className="font-bold uppercase text-[11px]">Oficial de Operações / P/3</div>
            <div className="text-[10px] text-slate-600">40º BPM/I - CPI-7</div>
          </div>
        </div>
      </div>

      {/* Screen Interactive Modal */}
      <div className={`bg-white rounded-t-2xl sm:rounded-2xl w-full p-3.5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 print:hidden max-h-[94vh] sm:max-h-[92vh] flex flex-col transition-all ${
        showPreview ? 'max-w-4xl' : 'max-w-xl'
      }`}>
        {/* VIEW 1: Document Preview Mode */}
        {showPreview ? (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Preview Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar às Opções</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadHtml}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-extrabold rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  title="Baixar arquivo do relatório oficial"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Arquivo</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Document Content */}
            <div className="mt-3 flex-1 overflow-y-auto p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-4">
              {/* Document Header */}
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs text-center">
                <div className="text-xs sm:text-sm font-black uppercase text-[#0F2B48] tracking-wider">
                  POLÍCIA MILITAR DO ESTADO DE SÃO PAULO
                </div>
                <div className="text-[11px] sm:text-xs font-extrabold uppercase text-slate-700 mt-0.5">
                  COMANDO DE POLICIAMENTO DO INTERIOR SETE (CPI-7)
                </div>
                <div className="text-[11px] sm:text-xs font-bold uppercase text-slate-600">
                  QUADRAGÉSIMO BATALHÃO DE POLÍCIA MILITAR DO INTERIOR (40º BPM/I)
                </div>
                <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase mt-0.5">
                  3ª Seção do Estado-Maior (P/3) · Operação Eleições 2026
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-left gap-2">
                  <div>
                    <strong className="text-xs text-blue-900 block uppercase font-black">
                      {getReportTitle()}
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      Circunscrição: <strong>{selectedCity === 'TODOS' ? 'Todos os Municípios' : selectedCity}</strong>
                    </span>
                  </div>
                  <div className="text-right text-[11px] font-mono text-slate-500">
                    <div>Data: <strong>{new Date().toLocaleDateString('pt-BR')}</strong></div>
                    <div>Horário: <strong>{new Date().toLocaleTimeString('pt-BR')}</strong></div>
                  </div>
                </div>

                {/* Summary quantitative chips */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-100 text-center">
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Total Postos</span>
                    <strong className="text-sm text-slate-800">{filteredSchools.length}</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Check-ins Manhã</span>
                    <strong className="text-sm text-emerald-700">
                      {filteredSchools.filter((s) => isMorningCheckedIn(s, checkIns)).length}
                    </strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Check-ins Tarde</span>
                    <strong className="text-sm text-sky-700">
                      {filteredSchools.filter((s) => isAfternoonCheckedIn(s, checkIns)).length}
                    </strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Fiscalizações</span>
                    <strong className="text-sm text-purple-700">{filteredRondas.length}</strong>
                  </div>
                </div>
              </div>

              {/* Table Data Preview */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700">
                      {reportType === 'pending' && (
                        <>
                          <th className="p-2 border-r border-slate-200">Município</th>
                          <th className="p-2 border-r border-slate-200">Posto Eleitoral</th>
                          <th className="p-2 border-r border-slate-200">Turno</th>
                          <th className="p-2 border-r border-slate-200">Policial Militar</th>
                          <th className="p-2 border-r border-slate-200">RE</th>
                          <th className="p-2">Telefone</th>
                        </>
                      )}
                      {reportType === 'confirmed' && (
                        <>
                          <th className="p-2 border-r border-slate-200">Hora</th>
                          <th className="p-2 border-r border-slate-200">Protocolo</th>
                          <th className="p-2 border-r border-slate-200">RE</th>
                          <th className="p-2 border-r border-slate-200">Policial Militar</th>
                          <th className="p-2 border-r border-slate-200">Posto Eleitoral</th>
                          <th className="p-2 border-r border-slate-200">Turno</th>
                          <th className="p-2">Distância</th>
                        </>
                      )}
                      {reportType === 'rondas' && (
                        <>
                          <th className="p-2 border-r border-slate-200">Horário</th>
                          <th className="p-2 border-r border-slate-200">Rondante</th>
                          <th className="p-2 border-r border-slate-200">RE</th>
                          <th className="p-2 border-r border-slate-200">Posto Fiscalizado</th>
                          <th className="p-2 border-r border-slate-200">Município</th>
                          <th className="p-2">Situação</th>
                        </>
                      )}
                      {reportType === 'full' && (
                        <>
                          <th className="p-2 border-r border-slate-200">Município</th>
                          <th className="p-2 border-r border-slate-200">Posto Eleitoral</th>
                          <th className="p-2 border-r border-slate-200">Manhã</th>
                          <th className="p-2 border-r border-slate-200">Status</th>
                          <th className="p-2 border-r border-slate-200">Tarde</th>
                          <th className="p-2">Status</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {reportType === 'pending' &&
                      filteredSchools.map((s, i) => {
                        const amOk = isMorningCheckedIn(s, checkIns);
                        const pmOk = isAfternoonCheckedIn(s, checkIns);
                        const isFull = isSchoolFullDay(s);
                        const pmOfficer = s.pm?.name ? s.pm : (isFull ? s.am : s.pm);

                        return (
                          <React.Fragment key={`prev-pnd-${s.id || s.school}-${i}`}>
                            {!amOk && (
                              <tr className="border-b border-slate-100 hover:bg-amber-50/50">
                                <td className="p-2 border-r border-slate-100">{s.city}</td>
                                <td className="p-2 border-r border-slate-100 font-bold">{s.school}</td>
                                <td className="p-2 border-r border-slate-100 font-semibold text-amber-800">Manhã</td>
                                <td className="p-2 border-r border-slate-100">{s.am?.rank} {s.am?.name}</td>
                                <td className="p-2 border-r border-slate-100 font-mono">{s.am?.re || '—'}</td>
                                <td className="p-2">{s.am?.phone || '—'}</td>
                              </tr>
                            )}
                            {!pmOk && (
                              <tr className="border-b border-slate-100 hover:bg-rose-50/50">
                                <td className="p-2 border-r border-slate-100">{s.city}</td>
                                <td className="p-2 border-r border-slate-100 font-bold">{s.school}</td>
                                <td className="p-2 border-r border-slate-100 font-semibold text-rose-800">Tarde</td>
                                <td className="p-2 border-r border-slate-100">{pmOfficer?.rank} {pmOfficer?.name}</td>
                                <td className="p-2 border-r border-slate-100 font-mono">{pmOfficer?.re || '—'}</td>
                                <td className="p-2">{pmOfficer?.phone || '—'}</td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}

                    {reportType === 'confirmed' &&
                      filteredCheckIns.map((c, i) => (
                        <tr key={`prev-chk-${c.id || i}`} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-2 border-r border-slate-100 font-mono">{c.time}</td>
                          <td className="p-2 border-r border-slate-100 font-mono">{c.protocol}</td>
                          <td className="p-2 border-r border-slate-100 font-mono">{c.officerRe}</td>
                          <td className="p-2 border-r border-slate-100">{c.rank} {c.officerName}</td>
                          <td className="p-2 border-r border-slate-100 font-bold">{c.schoolName}</td>
                          <td className="p-2 border-r border-slate-100">{c.shift}</td>
                          <td className="p-2">
                            {c.distanceMeters !== null && c.distanceMeters !== undefined ? `${c.distanceMeters}m` : 'N/D'}{' '}
                            <span className={c.isOutOfRange ? 'text-red-600 font-bold' : 'text-emerald-600 font-bold'}>
                              {c.isOutOfRange ? '(Alerta)' : '(Conforme)'}
                            </span>
                          </td>
                        </tr>
                      ))}

                    {reportType === 'rondas' &&
                      filteredRondas.map((r, i) => (
                        <tr key={`prev-rnd-${r.id || i}`} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-2 border-r border-slate-100 font-mono">{r.time}</td>
                          <td className="p-2 border-r border-slate-100">{r.rank} {r.officerName}</td>
                          <td className="p-2 border-r border-slate-100 font-mono">{r.officerRe}</td>
                          <td className="p-2 border-r border-slate-100 font-bold">{r.schoolName}</td>
                          <td className="p-2 border-r border-slate-100">{r.city}</td>
                          <td className="p-2 font-semibold">
                            <span className={r.situation === 'sem' ? 'text-emerald-700' : 'text-red-700'}>
                              {r.situation === 'sem' ? 'Sem Novidades' : 'Com Alteração'}
                            </span>
                          </td>
                        </tr>
                      ))}

                    {reportType === 'full' &&
                      filteredSchools.map((s, i) => {
                        const amOk = isMorningCheckedIn(s, checkIns);
                        const pmOk = isAfternoonCheckedIn(s, checkIns);
                        const isFull = isSchoolFullDay(s);
                        const pmOfficer = s.pm?.name ? s.pm : (isFull ? s.am : s.pm);

                        return (
                          <tr key={`prev-ful-${s.id || s.school}-${i}`} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="p-2 border-r border-slate-100">{s.city}</td>
                            <td className="p-2 border-r border-slate-100 font-bold">{s.school}</td>
                            <td className="p-2 border-r border-slate-100">
                              {s.am?.rank} {s.am?.name}
                            </td>
                            <td className="p-2 border-r border-slate-100 font-bold">
                              <span className={amOk ? 'text-emerald-700' : 'text-red-700'}>
                                {amOk ? 'OK' : 'PENDENTE'}
                              </span>
                            </td>
                            <td className="p-2 border-r border-slate-100">
                              {pmOfficer?.rank} {pmOfficer?.name}
                            </td>
                            <td className="p-2 font-bold">
                              <span className={pmOk ? 'text-emerald-700' : 'text-red-700'}>
                                {pmOk ? (isFull && amOk ? 'OK (DIA)' : 'OK') : 'PENDENTE'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Official Closing Signature Block in preview */}
              <div className="bg-white p-4 rounded-lg border border-slate-200 flex justify-between items-end text-xs">
                <div className="text-slate-500 text-[10px]">
                  Relatório gerado pelo Sistema de Gestão Operacional 40º BPM/I Eleições 2026.
                </div>
                <div className="text-center w-56 border-t border-slate-800 pt-1">
                  <div className="font-bold uppercase text-[10px] text-slate-800">Oficial de Operações / P/3</div>
                  <div className="text-[9px] text-slate-500">40º BPM/I - CPI-7</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* VIEW 2: Report Configuration Mode */
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-[#0F2B48]">
                    Exportação de Relatórios Operacionais (P/3)
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                    Despacho e controle do Comando 40º BPM/I Eleições 2026
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form options */}
            <div className="mt-3 space-y-3.5 text-xs overflow-y-auto pr-1 flex-1">
              {/* Report scope */}
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">
                  Tipo de Relatório a Gerar:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReportType('pending')}
                    className={`p-3 rounded-xl border text-left font-bold transition flex items-center gap-2.5 cursor-pointer ${
                      reportType === 'pending'
                        ? 'bg-amber-50 border-amber-500 text-amber-900 ring-1 ring-amber-500'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Filter className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <div className="font-extrabold">Postos Pendentes</div>
                      <div className="text-[10px] font-normal text-slate-500">
                        Escolas sem check-in no turno
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReportType('confirmed')}
                    className={`p-3 rounded-xl border text-left font-bold transition flex items-center gap-2.5 cursor-pointer ${
                      reportType === 'confirmed'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-extrabold">Check-ins Auditados</div>
                      <div className="text-[10px] font-normal text-slate-500">
                        Presenças confirmadas e GPS
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReportType('rondas')}
                    className={`p-3 rounded-xl border text-left font-bold transition flex items-center gap-2.5 cursor-pointer ${
                      reportType === 'rondas'
                        ? 'bg-purple-50 border-purple-500 text-purple-900 ring-1 ring-purple-500'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <FileCheck2 className="w-4 h-4 text-purple-600 shrink-0" />
                    <div>
                      <div className="font-extrabold">Fiscalizações / Rondas</div>
                      <div className="text-[10px] font-normal text-slate-500">
                        Vistorias e fiscalizações
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReportType('full')}
                    className={`p-3 rounded-xl border text-left font-bold transition flex items-center gap-2.5 cursor-pointer ${
                      reportType === 'full'
                        ? 'bg-blue-50 border-blue-500 text-blue-900 ring-1 ring-blue-500'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Table className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <div className="font-extrabold">Panorama Completo</div>
                      <div className="text-[10px] font-normal text-slate-500">
                        Todos os postos e turnos
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* City filter */}
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">
                  Filtrar por Município:
                </label>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white outline-none"
                >
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c === 'TODOS'
                        ? 'Todos os Municípios da Circunscrição'
                        : c === 'VOTORANTIM'
                        ? 'VOTORANTIM / Votoratim'
                        : c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Format selection */}
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">
                  Formato de Saída:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormat('csv')}
                    className={`p-2.5 rounded-xl border text-xs font-extrabold transition flex items-center justify-center gap-2 cursor-pointer ${
                      format === 'csv'
                        ? 'bg-blue-50 border-blue-600 text-blue-900 ring-1 ring-blue-500'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                    Planilha Excel / CSV
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormat('print')}
                    className={`p-2.5 rounded-xl border text-xs font-extrabold transition flex items-center justify-center gap-2 cursor-pointer ${
                      format === 'print'
                        ? 'bg-blue-50 border-blue-600 text-blue-900 ring-1 ring-blue-500'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Download className="w-4 h-4 text-blue-600" />
                    Relatório Oficial P/3 (HTML)
                  </button>
                </div>
              </div>

              {/* Clean Test Data Section */}
              {onClearTestData && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="bg-red-50/60 border border-red-200 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <Trash2 className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-extrabold text-red-900 block text-xs">
                            Zerar Dados de Testes do Sistema
                          </span>
                          <span className="text-[11px] text-red-700 block mt-0.5">
                            Zera todos os check-ins ({checkIns.length}) e fiscalizações ({rondas.length}) de teste do banco de dados para iniciar a operação oficial.
                          </span>
                        </div>
                      </div>

                      {isClearing ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-800 text-[11px] font-bold rounded-lg shrink-0">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Zerando...</span>
                        </div>
                      ) : !showClearConfirm ? (
                        <button
                          type="button"
                          onClick={() => setShowClearConfirm(true)}
                          className="px-2.5 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 text-[11px] font-bold rounded-lg transition border border-red-300 shrink-0 cursor-pointer"
                        >
                          Zerar Dados
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={async () => {
                              setIsClearing(true);
                              try {
                                await onClearTestData();
                                setShowClearConfirm(false);
                                setClearedSuccess(true);
                                setTimeout(() => setClearedSuccess(false), 5000);
                              } finally {
                                setIsClearing(false);
                              }
                            }}
                            className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[11px] font-extrabold rounded-lg transition shadow-xs cursor-pointer"
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowClearConfirm(false)}
                            className="px-2 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold rounded-lg transition cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </div>

                    {clearedSuccess && (
                      <div className="mt-2.5 p-2 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center gap-1.5 text-emerald-800 text-[11px] font-bold animate-in fade-in">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Banco de dados zerado com sucesso! Pronto para a Eleição Oficial.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-xl transition cursor-pointer min-h-[42px]"
              >
                Cancelar
              </button>

              <button
                id="btn-confirm-export"
                type="button"
                onClick={handleMainAction}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-extrabold text-white bg-blue-700 hover:bg-blue-800 active:scale-[0.98] rounded-xl transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
              >
                {format === 'print' ? <Eye className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                <span>
                  {format === 'print' ? 'Visualizar e Baixar Relatório Oficial' : 'Gerar e Baixar Planilha (CSV)'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
