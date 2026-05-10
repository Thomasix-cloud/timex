'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subWeeks,
  subMonths,
} from 'date-fns';
import { BarChart3, Download, FileText } from 'lucide-react';

type ProjectReport = {
  name: string;
  color: string;
  totalSeconds: number;
  count: number;
};

type DayReport = {
  date: string;
  totalSeconds: number;
  count: number;
};

type Client = { id: string; name: string; color: string };

const sourceFilters = [
  { key: 'all', label: 'All' },
  { key: 'tracker', label: 'Tracker' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'manual', label: 'Manual' },
] as const;
type SourceKey = (typeof sourceFilters)[number]['key'];

const periods = [
  { key: 'today', label: 'Today' },
  { key: 'this-week', label: 'This Week' },
  { key: 'last-week', label: 'Last Week' },
  { key: 'this-month', label: 'This Month' },
  { key: 'last-month', label: 'Last Month' },
] as const;
type PeriodKey = (typeof periods)[number]['key'];

type DetailEntry = {
  date: string;
  project: string;
  tag: string;
  description: string;
  hours: number;
  client: string;
  billable: boolean;
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatHours(seconds: number): string {
  return (seconds / 3600).toFixed(1);
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<PeriodKey>('this-week');
  const [projectData, setProjectData] = useState<ProjectReport[]>([]);
  const [dayData, setDayData] = useState<DayReport[]>([]);
  const [detailData, setDetailData] = useState<DetailEntry[]>([]);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtersReady, setFiltersReady] = useState(false);

  // Filter state
  const [sourceFilter, setSourceFilter] = useState<SourceKey>('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [billableFilter, setBillableFilter] = useState('all');
  const [clients, setClients] = useState<Client[]>([]);

  // Load saved filters from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('reports-filters');
      if (saved) {
        const f = JSON.parse(saved);
        if (f.period && periods.some((p) => p.key === f.period)) setPeriod(f.period);
        if (f.source && sourceFilters.some((s) => s.key === f.source)) setSourceFilter(f.source);
        if (f.client) setClientFilter(f.client);
        if (f.billable) setBillableFilter(f.billable);
      }
    } catch {}
    setFiltersReady(true);
  }, []);

  // Persist filters to localStorage
  useEffect(() => {
    if (!filtersReady) return;
    localStorage.setItem('reports-filters', JSON.stringify({
      period,
      source: sourceFilter,
      client: clientFilter,
      billable: billableFilter,
    }));
  }, [period, sourceFilter, clientFilter, billableFilter, filtersReady]);

  useEffect(() => {
    fetch('/api/clients')
      .then((r) => (r.ok ? r.json() : []))
      .then(setClients);
  }, []);

  const getDateRange = () => {
    const now = new Date();
    switch (period) {
      case 'today':
        return { from: startOfDay(now), to: endOfDay(now) };
      case 'this-week':
        return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'last-week': {
        const lw = subWeeks(now, 1);
        return { from: startOfWeek(lw, { weekStartsOn: 1 }), to: endOfWeek(lw, { weekStartsOn: 1 }) };
      }
      case 'this-month':
        return { from: startOfMonth(now), to: endOfMonth(now) };
      case 'last-month': {
        const lm = subMonths(now, 1);
        return { from: startOfMonth(lm), to: endOfMonth(lm) };
      }
    }
  };

  useEffect(() => {
    if (!filtersReady) return;
    const fetchReports = async () => {
      setLoading(true);
      const { from, to } = getDateRange();
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      if (sourceFilter !== 'all') params.set('source', sourceFilter);
      if (clientFilter !== 'all') params.set('clientId', clientFilter);
      if (billableFilter === 'billable') params.set('billable', 'true');
      if (billableFilter === 'non-billable') params.set('billable', 'false');

      const [projectRes, dayRes, detailRes] = await Promise.all([
        fetch(`/api/reports?${params}&groupBy=project`),
        fetch(`/api/reports?${params}&groupBy=day`),
        fetch(`/api/reports?${params}&groupBy=detail`),
      ]);

      if (projectRes.ok) setProjectData(await projectRes.json());
      if (dayRes.ok) setDayData(await dayRes.json());
      if (detailRes.ok) setDetailData(await detailRes.json());
      setLoading(false);
    };

    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, sourceFilter, clientFilter, billableFilter, filtersReady]);

  const totalSeconds = projectData.reduce((s, p) => s + p.totalSeconds, 0);
  const maxDaySeconds = Math.max(...dayData.map((d) => d.totalSeconds), 1);

  const { from, to } = getDateRange();
  const periodLabel = `${format(from, 'dd.MM.yyyy')} - ${format(to, 'dd.MM.yyyy')}`;
  const monthLabel = format(from, 'yyMM');

  const buildFilterParams = () => {
    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
      groupBy: 'detail',
    });
    if (sourceFilter !== 'all') params.set('source', sourceFilter);
    if (clientFilter !== 'all') params.set('clientId', clientFilter);
    if (billableFilter === 'billable') params.set('billable', 'true');
    if (billableFilter === 'non-billable') params.set('billable', 'false');
    return params;
  };

  const fetchDetailEntries = async (): Promise<DetailEntry[]> => {
    const params = buildFilterParams();
    const res = await fetch(`/api/reports?${params}`);
    if (!res.ok) return [];
    return res.json();
  };

  const getClientName = () => {
    if (clientFilter !== 'all') {
      return clients.find((c) => c.id === clientFilter)?.name ?? '';
    }
    return '';
  };

  const exportCSV = async () => {
    const entries = await fetchDetailEntries();
    const clientName = getClientName();

    const rows: string[][] = [];
    rows.push(['Výkaz odpracovaných hodin']);
    if (clientName) rows.push(['Zákazník:', clientName]);
    rows.push(['Měsíc:', monthLabel]);
    rows.push([]);
    rows.push(['Datum', 'Zakázka', 'Modul', 'Popis', 'Hodiny']);
    entries.forEach((e) => {
      rows.push([
        format(new Date(e.date), 'dd.MM.yyyy'),
        e.project,
        e.tag,
        e.description,
        e.hours.toFixed(2).replace('.', ','),
      ]);
    });
    rows.push([]);
    const totalHours = entries.reduce((s, e) => s + e.hours, 0);
    rows.push(['', '', '', 'Celkem', totalHours.toFixed(2).replace('.', ',')]);

    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `!${monthLabel}_Vykaz${clientName ? '-' + clientName : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    const entries = await fetchDetailEntries();
    const clientName = getClientName();
    const totalHours = entries.reduce((s, e) => s + e.hours, 0);

    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();

    // Load Roboto font for Czech diacritics
    const fontRes = await fetch('/fonts/Roboto-Regular.ttf');
    const fontBuf = await fontRes.arrayBuffer();
    const fontBase64 = btoa(String.fromCharCode(...new Uint8Array(fontBuf)));
    doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold');
    doc.setFont('Roboto');

    // Header
    doc.setFontSize(18);
    doc.text('Výkaz odpracovaných hodin', 14, 20);

    doc.setFontSize(11);
    let y = 30;
    if (clientName) {
      doc.setFont('Roboto', 'bold');
      doc.text('Zákazník:', 14, y);
      doc.setFont('Roboto', 'normal');
      doc.text(clientName, 50, y);
      y += 7;
    }
    doc.setFont('Roboto', 'bold');
    doc.text('Měsíc:', 14, y);
    doc.setFont('Roboto', 'normal');
    doc.text(monthLabel, 50, y);
    y += 10;

    // Table
    const body = entries.map((e) => [
      format(new Date(e.date), 'dd.MM.yyyy'),
      e.project,
      e.tag,
      e.description,
      e.hours.toFixed(2).replace('.', ','),
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Datum', 'Zakázka', 'Úloha', 'Popis', 'Hodiny']],
      body,
      foot: [['', '', '', 'Celkem', totalHours.toFixed(2).replace('.', ',')]],
      showFoot: 'lastPage',
      theme: 'grid',
      headStyles: { fillColor: [139, 195, 74], textColor: [0, 0, 0], fontStyle: 'bold' },
      footStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold' },
      styles: { fontSize: 9, font: 'Roboto', cellPadding: 1 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 30 },
        2: { cellWidth: 25 },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 20, halign: 'right' },
      },
      didParseCell: (data: { section: string; column: { index: number }; cell: { styles: { halign: string } } }) => {
        if (data.section === 'foot' && data.column.index === 4) {
          data.cell.styles.halign = 'right';
        }
      },
    });

    // Add page footer with page numbers
    const pageCount = doc.getNumberOfPages();
    const fileName = `!${monthLabel}_Vykaz${clientName ? '-' + clientName : ''}`;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('Roboto', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100);
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      doc.text(fileName, 14, pageH - 10);
      doc.text(`str.${i}/${pageCount}`, pageW - 14, pageH - 10, { align: 'right' });
    }

    doc.save(`${fileName}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            disabled={loading || projectData.length === 0}
          >
            <Download className="mr-1 h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportPDF}
            disabled={loading || projectData.length === 0}
          >
            <FileText className="mr-1 h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-sm">Filters</span>
            <div className="flex gap-0.5 shrink-0">
              {periods.map((p) => (
                <Button
                  key={p.key}
                  variant={period === p.key ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setPeriod(p.key)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-0.5 shrink-0">
              <Button
                variant={clientFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setClientFilter('all')}
              >
                All
              </Button>
              {clients.map((c) => (
                <Button
                  key={c.id}
                  variant={clientFilter === c.id ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setClientFilter(c.id)}
                >
                  <div className="mr-1 h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </Button>
              ))}
            </div>
            <div className="h-4 w-px bg-border shrink-0" />
            <div className="flex gap-0.5 shrink-0">
              <Button
                variant={billableFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setBillableFilter('all')}
              >
                All
              </Button>
              <Button
                variant={billableFilter === 'billable' ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setBillableFilter('billable')}
              >
                Bill
              </Button>
              <Button
                variant={billableFilter === 'non-billable' ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setBillableFilter('non-billable')}
              >
                NonBill
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {(() => {
        const billableHours = detailData.filter(e => e.billable).reduce((s, e) => s + e.hours, 0);
        const nonBillableHours = detailData.filter(e => !e.billable).reduce((s, e) => s + e.hours, 0);
        const totalHrs = billableHours + nonBillableHours;
        const billablePct = totalHrs > 0 ? Math.round((billableHours / totalHrs) * 100) : 0;
        // Gauge: semicircle from 180° to 0° (left to right)
        const r = 34;
        const halfC = Math.PI * r; // semicircle circumference
        const fillArc = (billablePct / 100) * halfC;
        return (
          <div className="flex items-center gap-4">
            <Card className="flex-1">
              <CardContent className="flex items-center justify-between py-3 px-4">
                <div className="flex items-center gap-5">
                  {/* Gauge */}
                  <div className="relative shrink-0" style={{ width: 80, height: 48 }}>
                    <svg width="80" height="48" viewBox="0 0 80 48" className="overflow-visible">
                      {/* Background arc */}
                      <path
                        d="M 6 44 A 34 34 0 0 1 74 44"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="7"
                        strokeLinecap="round"
                        className="text-muted/40"
                      />
                      {/* Filled arc */}
                      {totalHrs > 0 && (
                        <path
                          d="M 6 44 A 34 34 0 0 1 74 44"
                          fill="none"
                          stroke="#22c55e"
                          strokeWidth="7"
                          strokeLinecap="round"
                          strokeDasharray={`${fillArc} ${halfC}`}
                        />
                      )}
                    </svg>
                    {/* Center label */}
                    <div className="absolute inset-0 flex items-end justify-center pb-0.5">
                      <span className="text-sm font-bold">{billablePct}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-xl font-bold">{totalHrs.toFixed(1)}h</p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Billable</p>
                      <p className="text-sm font-bold text-green-600">{billableHours.toFixed(1)}h</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/40 shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Non-billable</p>
                      <p className="text-sm font-bold text-muted-foreground">{nonBillableHours.toFixed(1)}h</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Projects</p>
                  <p className="text-xl font-bold">{projectData.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      <Tabs defaultValue="byProject">
        <TabsList>
          <TabsTrigger value="byProject">By Project</TabsTrigger>
          <TabsTrigger value="byDay">By Day</TabsTrigger>
        </TabsList>

        <TabsContent value="byProject" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Time by Project</CardTitle>
            </CardHeader>
            <CardContent>
              {projectData.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <BarChart3 className="mb-2 h-8 w-8" />
                  <p>No data for this period</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {projectData
                    .sort((a, b) => b.totalSeconds - a.totalSeconds)
                    .map((project) => {
                      const percent =
                        totalSeconds > 0
                          ? (project.totalSeconds / totalSeconds) * 100
                          : 0;
                      const isExpanded = expandedProject === project.name;
                      const projectEntries = detailData.filter((e) => e.project === project.name);
                      return (
                        <div key={project.name}>
                          <div
                            className="space-y-1 cursor-pointer rounded-md p-2 hover:bg-muted/50 transition-colors"
                            onClick={() => setExpandedProject(isExpanded ? null : project.name)}
                          >
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <svg
                                  className={`h-3 w-3 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                                <div
                                  className="h-3 w-3 rounded-full shrink-0"
                                  style={{ backgroundColor: project.color }}
                                />
                                <span className="font-medium">
                                  {project.name}
                                </span>
                              </div>
                              <span className="text-muted-foreground flex items-center gap-2">
                                <span className="text-foreground font-medium">{formatHours(project.totalSeconds)}h</span>
                                <span>({percent.toFixed(0)}%)</span>
                                {billableFilter === 'all' && <span>{projectEntries.filter(e => !e.billable).reduce((s, e) => s + e.hours, 0).toFixed(1)}h</span>}
                                {billableFilter === 'all' && <span className="text-green-600">{projectEntries.filter(e => e.billable).reduce((s, e) => s + e.hours, 0).toFixed(1)}h</span>}
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-muted ml-8">
                              <div
                                className="h-2 rounded-full transition-all"
                                style={{
                                  width: `${percent}%`,
                                  backgroundColor: project.color,
                                }}
                              />
                            </div>
                          </div>
                          {isExpanded && projectEntries.length > 0 && (
                            <div className="ml-8 mt-1 mb-2 overflow-x-auto rounded-md border">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b bg-muted/50">
                                    <th className="px-3 py-1.5 text-left font-medium">Datum</th>
                                    <th className="px-3 py-1.5 text-left font-medium">Úloha</th>
                                    <th className="px-3 py-1.5 text-left font-medium">Popis</th>
                                    {billableFilter !== 'billable' && <th className="pl-1 pr-2 py-1.5 text-right font-medium w-16">Hodiny(0)</th>}
                                    {billableFilter !== 'non-billable' && <th className="pl-1 pr-2 py-1.5 text-right font-medium w-16">Hodiny($)</th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {projectEntries.map((e, i) => (
                                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                                      <td className="px-3 py-1 whitespace-nowrap">{format(new Date(e.date), 'dd.MM.yyyy')}</td>
                                      <td className="px-3 py-1">{e.tag}</td>
                                      <td className="px-3 py-1">{e.description}</td>
                                      {billableFilter !== 'billable' && <td className="pl-1 pr-2 py-1 text-right whitespace-nowrap">{!e.billable ? e.hours.toFixed(2).replace('.', ',') : ''}</td>}
                                      {billableFilter !== 'non-billable' && <td className="pl-1 pr-2 py-1 text-right whitespace-nowrap">{e.billable ? e.hours.toFixed(2).replace('.', ',') : ''}</td>}
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t bg-muted/50 font-medium">
                                    <td className="px-3 py-1.5" colSpan={3}>Celkem</td>
                                    {billableFilter !== 'billable' && <td className="pl-1 pr-2 py-1.5 text-right">
                                      {projectEntries.filter(e => !e.billable).reduce((s, e) => s + e.hours, 0).toFixed(2).replace('.', ',')}
                                    </td>}
                                    {billableFilter !== 'non-billable' && <td className="pl-1 pr-2 py-1.5 text-right">
                                      {projectEntries.filter(e => e.billable).reduce((s, e) => s + e.hours, 0).toFixed(2).replace('.', ',')}
                                    </td>}
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="byDay" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily Hours</CardTitle>
            </CardHeader>
            <CardContent>
              {dayData.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <BarChart3 className="mb-2 h-8 w-8" />
                  <p>No data for this period</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {dayData.map((day) => {
                    const percent = maxDaySeconds > 0 ? (day.totalSeconds / maxDaySeconds) * 100 : 0;
                    const isExpanded = expandedDay === day.date;
                    const dayEntries = detailData.filter((e) => e.date === day.date);
                    return (
                      <div key={day.date}>
                        <div
                          className="space-y-1 cursor-pointer rounded-md p-2 hover:bg-muted/50 transition-colors"
                          onClick={() => setExpandedDay(isExpanded ? null : day.date)}
                        >
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <svg
                                className={`h-3 w-3 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                              <span className="font-medium">
                                {format(new Date(day.date), 'EEE dd.MM.yyyy')}
                              </span>
                              <span className="text-muted-foreground text-xs">
                                ({day.count} {day.count === 1 ? 'entry' : 'entries'})
                              </span>
                            </div>
                            <span className="text-muted-foreground flex items-center gap-2">
                              <span className="text-foreground font-medium">{formatHours(day.totalSeconds)}h</span>
                              {billableFilter === 'all' && <span>{dayEntries.filter(e => !e.billable).reduce((s, e) => s + e.hours, 0).toFixed(1)}h</span>}
                              {billableFilter === 'all' && <span className="text-green-600">{dayEntries.filter(e => e.billable).reduce((s, e) => s + e.hours, 0).toFixed(1)}h</span>}
                            </span>
                          </div>
                          <div className="h-4 rounded-full bg-muted ml-5">
                            <div
                              className="h-4 rounded-full transition-all"
                              style={{ width: `${percent}%`, backgroundColor: '#8bc34a' }}
                            />
                          </div>
                        </div>
                        {isExpanded && dayEntries.length > 0 && (
                          <div className="ml-8 mt-1 mb-2 overflow-x-auto rounded-md border">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/50">
                                  <th className="px-3 py-1.5 text-left font-medium">Zakázka</th>
                                  <th className="px-3 py-1.5 text-left font-medium">Úloha</th>
                                  <th className="px-3 py-1.5 text-left font-medium">Popis</th>
                                  {billableFilter !== 'billable' && <th className="pl-1 pr-2 py-1.5 text-right font-medium w-16">Hodiny(0)</th>}
                                  {billableFilter !== 'non-billable' && <th className="pl-1 pr-2 py-1.5 text-right font-medium w-16">Hodiny($)</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {dayEntries.map((e, i) => (
                                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                                    <td className="px-3 py-1">{e.project}</td>
                                    <td className="px-3 py-1">{e.tag}</td>
                                    <td className="px-3 py-1">{e.description}</td>
                                    {billableFilter !== 'billable' && <td className="pl-1 pr-2 py-1 text-right whitespace-nowrap">{!e.billable ? e.hours.toFixed(2).replace('.', ',') : ''}</td>}
                                    {billableFilter !== 'non-billable' && <td className="pl-1 pr-2 py-1 text-right whitespace-nowrap">{e.billable ? e.hours.toFixed(2).replace('.', ',') : ''}</td>}
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t bg-muted/50 font-medium">
                                  <td className="px-3 py-1.5" colSpan={3}>Celkem</td>
                                  {billableFilter !== 'billable' && <td className="pl-1 pr-2 py-1.5 text-right">
                                    {dayEntries.filter(e => !e.billable).reduce((s, e) => s + e.hours, 0).toFixed(2).replace('.', ',')}
                                  </td>}
                                  {billableFilter !== 'non-billable' && <td className="pl-1 pr-2 py-1.5 text-right">
                                    {dayEntries.filter(e => e.billable).reduce((s, e) => s + e.hours, 0).toFixed(2).replace('.', ',')}
                                  </td>}
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
