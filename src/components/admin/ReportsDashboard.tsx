import React, { useState, useEffect } from 'react';
import { DashboardMetrics } from '../../types';
import { api } from '../../services/api';
import {
  Users,
  MousePointerClick,
  Percent,
  Layers,
  RefreshCw,
  Info,
  Clock,
  ArrowUpRight,
  TrendingUp,
  ShieldCheck,
  Building2,
} from 'lucide-react';

interface ReportsDashboardProps {
  onRefreshTrigger?: () => void;
}

export const ReportsDashboard: React.FC<ReportsDashboardProps> = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMetrics();
      setMetrics(data);
    } catch (err: any) {
      setError(err.message || 'Falha ao buscar relatórios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Relatórios & Análise de Conversão
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Métricas em tempo real de acessos presenciais, direcionamentos e capacidade dos grupos VIP.
          </p>
        </div>
        <button
          onClick={fetchMetrics}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          <span>Atualizar Dados</span>
        </button>
      </div>

      {/* Mandatory Clarification Notice */}
      <div className="flex items-start gap-3 p-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-xs text-amber-900 leading-relaxed shadow-xs">
        <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold text-amber-950">Regra de Conversão:</strong> A taxa de
          conversão representa os <span className="underline">cliques no botão de convite</span>{' '}
          divididos pelo total de acessos às páginas das lojas. Ela indica intenção real de entrada no
          ponto de venda, e não membros efetivamente confirmados dentro do aplicativo do WhatsApp.
        </div>
      </div>

      {metrics && (
        <>
          {/* 4 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Acessos */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
                <span>Total de Acessos</span>
                <Users className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-950 font-mono tabular-nums">
                {metrics.totalAccesses.toLocaleString('pt-BR')}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Visualizações via QR Code</p>
            </div>

            {/* KPI 2: Cliques */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
                <span>Total de Direcionamentos</span>
                <MousePointerClick className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 font-mono tabular-nums">
                {metrics.totalClicks.toLocaleString('pt-BR')}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Cliques no botão do WhatsApp</p>
            </div>

            {/* KPI 3: Taxa de Conversão */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
                <span>Taxa de Conversão</span>
                <Percent className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-950 font-mono tabular-nums">
                {metrics.conversionRate}%
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Cliques ÷ Acessos às páginas</p>
            </div>

            {/* KPI 4: Unidades & Grupos */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
                <span>Lojas & Grupos VIP</span>
                <Layers className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-950 font-mono tabular-nums">
                {metrics.activeStores}{' '}
                <span className="text-base font-normal text-slate-400">
                  / {metrics.groupMetrics.length} grp
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Unidades ativas na rede</p>
            </div>
          </div>

          {/* Section: Resultados por Loja */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-500" />
                <h3 className="font-bold text-slate-900 text-sm">Resultados por Loja / Unidade</h3>
              </div>
              <span className="text-xs text-slate-400">{metrics.storeMetrics.length} unidades</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-6 py-3">Unidade</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Acessos</th>
                    <th className="px-6 py-3 text-right">Cliques</th>
                    <th className="px-6 py-3 text-right">Conversão</th>
                    <th className="px-6 py-3">Grupo VIP Atual</th>
                    <th className="px-6 py-3 text-center">Grupos Cheios</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metrics.storeMetrics.map((sm) => (
                    <tr key={sm.storeId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-3.5 font-bold text-slate-900">
                        {sm.storeName}
                        <span className="block text-[11px] font-mono font-normal text-slate-400">
                          /vip/{sm.storeSlug}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            sm.isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {sm.isActive ? 'Ativa' : 'Pausada'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono tabular-nums text-slate-700">
                        {sm.totalAccesses.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono tabular-nums font-semibold text-emerald-600">
                        {sm.totalClicks.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono tabular-nums font-bold text-slate-900">
                        {sm.conversionRate}%
                      </td>
                      <td className="px-6 py-3.5 text-slate-800 font-medium truncate max-w-xs">
                        {sm.activeGroupName || 'Nenhum ativo'}
                      </td>
                      <td className="px-6 py-3.5 text-center font-mono tabular-nums text-slate-500">
                        {sm.fullGroups} de {sm.totalGroups}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section: Resultados por Grupo VIP */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-500" />
                <h3 className="font-bold text-slate-900 text-sm">Desempenho por Grupo VIP</h3>
              </div>
              <span className="text-xs text-slate-400">
                {metrics.groupMetrics.length} grupos cadastrados
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-6 py-3">Ordem & Grupo</th>
                    <th className="px-6 py-3">Loja</th>
                    <th className="px-6 py-3 text-right">Cliques Atuais</th>
                    <th className="px-6 py-3 text-right">Limite</th>
                    <th className="px-6 py-3">Utilização da Capacidade</th>
                    <th className="px-6 py-3 text-center">Estado Atual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metrics.groupMetrics.map((gm) => {
                    const isFull = gm.currentClicks >= gm.clickLimit;

                    return (
                      <tr key={gm.groupId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-3.5 font-bold text-slate-900">
                          <span className="font-mono text-slate-400 mr-2">#{gm.displayOrder}</span>
                          {gm.groupName}
                        </td>
                        <td className="px-6 py-3.5 text-slate-600">{gm.storeName}</td>
                        <td className="px-6 py-3.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {gm.currentClicks.toLocaleString('pt-BR')}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono tabular-nums text-slate-500">
                          {gm.clickLimit.toLocaleString('pt-BR')}
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="w-48">
                            <div className="flex items-center justify-between text-[11px] mb-1 font-mono text-slate-500">
                              <span>{gm.percentFull}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isFull
                                    ? 'bg-slate-400'
                                    : gm.percentFull > 80
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${gm.percentFull}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          {gm.isCurrentRoutingTarget ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                              <span>Ativo Agora</span>
                            </span>
                          ) : isFull ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                              Esgotado
                            </span>
                          ) : !gm.isActive ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700">
                              Pausado
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700">
                              Em Espera
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section: Histórico de Direcionamentos Recentes */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Histórico Recente de Direcionamentos
                </h3>
              </div>
              <span className="text-xs text-slate-400">Últimos eventos registrados</span>
            </div>

            {metrics.recentEvents.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">Nenhum evento registrado ainda.</p>
            ) : (
              <div className="space-y-2">
                {metrics.recentEvents.slice(0, 10).map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <div>
                        <span className="font-bold text-slate-900">{ev.storeName}</span>
                        <span className="text-slate-400 mx-2">→</span>
                        <span className="text-slate-700">{ev.groupName}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px] tabular-nums">
                      <span>{new Date(ev.createdAt).toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
