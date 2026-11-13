import React, { useState, useEffect } from 'react';
import { Store, VipGroup } from '../../types';
import { api } from '../../services/api';
import {
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  Sparkles,
  Sliders,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Play,
  Loader2,
  Info,
  Check,
  ShieldCheck,
} from 'lucide-react';

interface GroupManagerProps {
  stores: Store[];
  initialStoreId?: string;
  onRefreshStores: () => void;
}

export const GroupManager: React.FC<GroupManagerProps> = ({
  stores,
  initialStoreId,
  onRefreshStores,
}) => {
  const [selectedStoreId, setSelectedStoreId] = useState<string>(
    initialStoreId || (stores.length > 0 ? stores[0].id : '')
  );
  const [groups, setGroups] = useState<VipGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Group Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<VipGroup | null>(null);
  const [name, setName] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [clickLimit, setClickLimit] = useState(800);
  const [displayOrder, setDisplayOrder] = useState(1);
  const [isActive, setIsActive] = useState(true);

  // Simulation State
  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<string | null>(null);

  const selectedStore = stores.find((s) => s.id === selectedStoreId);

  const loadGroups = async (storeId: string) => {
    if (!storeId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getGroups(storeId);
      setGroups(data);
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar grupos da loja');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStoreId) {
      loadGroups(selectedStoreId);
    }
  }, [selectedStoreId]);

  const openCreateModal = () => {
    setEditingGroup(null);
    const nextOrder = groups.length > 0 ? Math.max(...groups.map((g) => g.displayOrder)) + 1 : 1;
    const nextNum = String(nextOrder).padStart(2, '0');
    setName(`Grupo VIP ${nextNum} - ${selectedStore?.name || 'Loja'}`);
    setInviteUrl(`https://chat.whatsapp.com/invite/Exemplo${selectedStore?.slug || 'Vip'}${nextNum}`);
    setClickLimit(800);
    setDisplayOrder(nextOrder);
    setIsActive(true);
    setModalOpen(true);
  };

  const openEditModal = (group: VipGroup) => {
    setEditingGroup(group);
    setName(group.name);
    setInviteUrl(group.inviteUrl);
    setClickLimit(group.clickLimit);
    setDisplayOrder(group.displayOrder);
    setIsActive(group.isActive);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStoreId) return;

    // Validate WhatsApp invite link
    const trimmedUrl = inviteUrl.trim();
    if (!trimmedUrl.includes('chat.whatsapp.com') && !trimmedUrl.startsWith('http')) {
      alert('Por favor insira um link de convite válido do WhatsApp (ex: https://chat.whatsapp.com/...)');
      return;
    }

    try {
      if (editingGroup) {
        await api.updateGroup(editingGroup.id, {
          name,
          inviteUrl: trimmedUrl,
          clickLimit: Number(clickLimit),
          displayOrder: Number(displayOrder),
          isActive,
        });
      } else {
        await api.createGroup({
          storeId: selectedStoreId,
          name,
          inviteUrl: trimmedUrl,
          clickLimit: Number(clickLimit),
          displayOrder: Number(displayOrder),
          isActive,
        });
      }
      setModalOpen(false);
      loadGroups(selectedStoreId);
      onRefreshStores();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar grupo');
    }
  };

  const handleDelete = async (group: VipGroup) => {
    if (!window.confirm(`Tem certeza que deseja excluir o "${group.name}"?`)) return;
    try {
      await api.deleteGroup(group.id);
      loadGroups(selectedStoreId);
      onRefreshStores();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir grupo');
    }
  };

  const handleResetClicks = async (group: VipGroup) => {
    if (
      !window.confirm(
        `Zerar o contador de cliques do "${group.name}"? Os cliques voltarão para 0 e o grupo poderá receber novos direcionamentos.`
      )
    ) {
      return;
    }
    try {
      await api.resetGroupClicks(group.id);
      loadGroups(selectedStoreId);
      onRefreshStores();
    } catch (err: any) {
      alert(err.message || 'Erro ao zerar contador');
    }
  };

  const handleToggleActive = async (group: VipGroup) => {
    try {
      await api.updateGroup(group.id, { isActive: !group.isActive });
      loadGroups(selectedStoreId);
      onRefreshStores();
    } catch (err: any) {
      alert(err.message || 'Erro ao alternar status');
    }
  };

  const handleToggleDistributionMode = async (mode: 'automatic' | 'manual') => {
    if (!selectedStore) return;
    try {
      await api.updateStore(selectedStore.id, { distributionMode: mode });
      onRefreshStores();
    } catch (err: any) {
      alert(err.message || 'Erro ao alterar modo de distribuição');
    }
  };

  const handleSetManualActiveGroup = async (groupId: string) => {
    if (!selectedStore) return;
    try {
      await api.updateStore(selectedStore.id, {
        distributionMode: 'manual',
        manualActiveGroupId: groupId,
      });
      onRefreshStores();
    } catch (err: any) {
      alert(err.message || 'Erro ao definir grupo ativo');
    }
  };

  const handleSimulate = async (count: number) => {
    if (!selectedStore || simulating) return;
    setSimulating(true);
    setSimulationResult(null);
    try {
      const res = await api.simulateClicks(selectedStore.slug, count);
      setSimulationResult(res.message);
      await loadGroups(selectedStore.id);
      onRefreshStores();
    } catch (err: any) {
      alert(err.message || 'Falha na simulação');
    } finally {
      setSimulating(false);
    }
  };

  // Find which group is currently receiving clicks according to backend rules
  const currentEligibleGroup =
    selectedStore?.distributionMode === 'manual'
      ? groups.find((g) => g.id === selectedStore.manualActiveGroupId && g.isActive)
      : groups.find((g) => g.isActive && g.currentClicks < g.clickLimit);

  return (
    <div className="space-y-6">
      {/* Top Header & Store Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Gerenciamento de Grupos VIP & Distribuição
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Cadastre os links de convite do WhatsApp, defina a ordem de transbordo e os limites de cliques.
          </p>
        </div>

        {/* Store Picker */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Unidade:</label>
          <select
            value={selectedStoreId}
            onChange={(e) => setSelectedStoreId(e.target.value)}
            className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 shadow-xs focus:ring-1 focus:ring-slate-900"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.slug})
              </option>
            ))}
          </select>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors shrink-0 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Grupo VIP</span>
          </button>
        </div>
      </div>

      {/* Distribution Strategy Control Card */}
      {selectedStore && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Lógica de Distribuição:
                </span>
                <span className="text-sm font-bold text-slate-900">{selectedStore.name}</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                {selectedStore.distributionMode === 'automatic'
                  ? 'Modo Automático: O sistema direciona os clientes para o primeiro grupo ativo em ordem sequencial. Ao atingir o limite configurado (ex: 800 cliques), avança automaticamente para o próximo grupo no backend de forma atômica.'
                  : 'Modo Manual: Todos os acessos são direcionados exclusivamente para o grupo selecionado por você, independentemente do limite de cliques atingido.'}
              </p>
            </div>

            {/* Mode Toggle Controls */}
            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl shrink-0">
              <button
                onClick={() => handleToggleDistributionMode('automatic')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  selectedStore.distributionMode === 'automatic'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Automático (Transbordo)</span>
              </button>
              <button
                onClick={() => handleToggleDistributionMode('manual')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  selectedStore.distributionMode === 'manual'
                    ? 'bg-white text-amber-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-amber-600" />
                <span>Manual (Fixo)</span>
              </button>
            </div>
          </div>

          {/* Test Simulator Bar */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50/70 p-3 rounded-xl">
            <div className="flex items-center gap-2">
              <Play className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-semibold text-slate-800">Testar Distribuição em Tempo Real:</span>
              <span className="text-slate-500 hidden sm:inline">
                Simule cliques de clientes para conferir a troca automática entre grupos
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSimulate(1)}
                disabled={simulating}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                +1 Clique
              </button>
              <button
                onClick={() => handleSimulate(50)}
                disabled={simulating}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                +50 Cliques
              </button>
              <button
                onClick={() => handleSimulate(200)}
                disabled={simulating}
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                +200 Cliques
              </button>
            </div>
          </div>

          {simulationResult && (
            <div className="mt-2 text-xs font-medium text-emerald-700 bg-emerald-50/90 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center justify-between">
              <span>{simulationResult}</span>
              <span className="text-[11px] font-mono text-emerald-600">Atualizado</span>
            </div>
          )}
        </div>
      )}

      {/* WhatsApp Transparency Disclaimer Notice */}
      <div className="flex items-start gap-3 p-3.5 bg-blue-50/70 border border-blue-200/70 rounded-xl text-xs text-blue-900 leading-relaxed">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold text-blue-950">Aviso sobre Métricas:</strong> Os
          contadores acima refletem <span className="underline">direcionamentos e cliques</span> no
          botão de entrada pelo cliente, não participantes confirmados dentro do aplicativo do WhatsApp.
          Não são utilizadas APIs não oficiais para proteger o número da sua empresa.
        </div>
      </div>

      {/* Groups List Table / Cards */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Carregando grupos da unidade...</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <p className="text-sm font-semibold text-slate-800 mb-1">Nenhum grupo cadastrado nesta unidade</p>
          <p className="text-xs text-slate-500 mb-4">
            Cadastre o primeiro grupo VIP com seu respectivo link de convite do WhatsApp.
          </p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors"
          >
            Cadastrar Grupo 01
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const isFull = group.currentClicks >= group.clickLimit;
            const percent = Math.min(100, Math.round((group.currentClicks / group.clickLimit) * 100));
            const isCurrentTarget = currentEligibleGroup?.id === group.id;

            return (
              <div
                key={group.id}
                className={`bg-white rounded-2xl border transition-all p-5 ${
                  isCurrentTarget
                    ? 'border-emerald-500 ring-2 ring-emerald-500/10 shadow-sm'
                    : 'border-slate-200/90 shadow-xs'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Info & Order */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-sm shrink-0 ${
                        isCurrentTarget
                          ? 'bg-emerald-600 text-white'
                          : isFull
                          ? 'bg-slate-100 text-slate-400 border border-slate-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {group.displayOrder}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-slate-900 text-sm truncate">{group.name}</h4>

                        {/* Routing State Tag */}
                        {isCurrentTarget && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                            <span>GRUPO ATIVO ATUAL</span>
                          </span>
                        )}

                        {isFull && (
                          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            CAPACIDADE ATINGIDA ({group.clickLimit})
                          </span>
                        )}

                        {!group.isActive && (
                          <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            Inativo
                          </span>
                        )}
                      </div>

                      {/* Invite URL */}
                      <div className="flex items-center gap-2 mt-1">
                        <a
                          href={group.inviteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center gap-1 truncate max-w-sm"
                        >
                          <span>{group.inviteUrl}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Progress Bar */}
                  <div className="w-full md:w-64 shrink-0">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500 font-medium">Capacidade de Cliques:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {group.currentClicks.toLocaleString('pt-BR')} /{' '}
                        {group.clickLimit.toLocaleString('pt-BR')} ({percent}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isFull
                            ? 'bg-slate-400'
                            : percent > 85
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 justify-end">
                    {/* Manual Select Button */}
                    {selectedStore?.distributionMode === 'manual' && (
                      <button
                        onClick={() => handleSetManualActiveGroup(group.id)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                          selectedStore.manualActiveGroupId === group.id
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                        title="Tornar este grupo o ativo permanente em modo manual"
                      >
                        <Check className="w-3 h-3" />
                        <span>{selectedStore.manualActiveGroupId === group.id ? 'Ativo' : 'Selecionar'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleResetClicks(group)}
                      title="Zerar cliques deste grupo"
                      className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEditModal(group)}
                      title="Editar configurações do grupo"
                      className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(group)}
                      title="Excluir grupo"
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create or Edit VIP Group */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 relative">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {editingGroup ? 'Editar Grupo VIP' : 'Cadastrar Grupo VIP'}
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              Unidade associada: <strong className="text-slate-800">{selectedStore?.name}</strong>
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome do Grupo *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Grupo VIP 01 - Barigui"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-slate-900 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Link de Convite do WhatsApp *
                </label>
                <input
                  type="url"
                  required
                  value={inviteUrl}
                  onChange={(e) => setInviteUrl(e.target.value)}
                  placeholder="https://chat.whatsapp.com/invite/..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:bg-white focus:border-slate-900 transition-colors"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Cole o link de convite oficial gerado pelo aplicativo WhatsApp.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Limite de Cliques *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100000"
                    required
                    value={clickLimit}
                    onChange={(e) => setClickLimit(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:bg-white focus:border-slate-900 transition-colors"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Ex: 800 cliques</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ordem de Transbordo *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:bg-white focus:border-slate-900 transition-colors"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">1º, 2º, 3º...</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status do Grupo
                </label>
                <select
                  value={isActive ? 'true' : 'false'}
                  onChange={(e) => setIsActive(e.target.value === 'true')}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                >
                  <option value="true">Ativo (pode receber direcionamentos)</option>
                  <option value="false">Inativo (ignorado pelo transbordo)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  {editingGroup ? 'Salvar Grupo' : 'Cadastrar Grupo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
