import React, { useState } from 'react';
import { Store } from '../../types';
import { api } from '../../services/api';
import { 
  Plus, 
  ExternalLink, 
  Copy, 
  Check, 
  Edit3, 
  Trash2, 
  QrCode as QrCodeIcon, 
  Power, 
  CheckCircle2, 
  Sliders, 
  Sparkles, 
  Loader2 
} from 'lucide-react';

interface StoreManagerProps {
  stores: Store[];
  onRefresh: () => void;
  onSelectStoreForQr: (slug: string) => void;
  onSelectStoreForGroups: (storeId: string) => void;
}

export const StoreManager: React.FC<StoreManagerProps> = ({
  stores,
  onRefresh,
  onSelectStoreForQr,
  onSelectStoreForGroups,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState(
    'Receba ofertas exclusivas, promoções especiais e lançamentos em primeira mão.'
  );
  const [logoUrl, setLogoUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [distributionMode, setDistributionMode] = useState<'automatic' | 'manual'>('automatic');

  const openCreateModal = () => {
    setEditingStore(null);
    setName('');
    setSlug('');
    setDescription('Receba ofertas exclusivas, promoções especiais e lançamentos em primeira mão.');
    setLogoUrl('');
    setIsActive(true);
    setDistributionMode('automatic');
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (store: Store) => {
    setEditingStore(store);
    setName(store.name);
    setSlug(store.slug);
    setDescription(store.description);
    setLogoUrl(store.logoUrl || '');
    setIsActive(store.isActive);
    setDistributionMode(store.distributionMode);
    setError(null);
    setModalOpen(true);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!editingStore) {
      // Auto-generate slug from name
      const autoSlug = val
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setSlug(autoSlug);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      if (editingStore) {
        await api.updateStore(editingStore.id, {
          name,
          slug,
          description,
          logoUrl,
          isActive,
          distributionMode,
        });
      } else {
        await api.createStore({
          name,
          slug,
          description,
          logoUrl,
          isActive,
          distributionMode,
        });
      }
      setModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar loja');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (store: Store) => {
    try {
      await api.updateStore(store.id, { isActive: !store.isActive });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erro ao alterar status');
    }
  };

  const handleDelete = async (store: Store) => {
    if (
      !window.confirm(
        `Tem certeza que deseja excluir a loja "${store.name}"? Todos os grupos e métricas associados serão removidos.`
      )
    ) {
      return;
    }
    try {
      await api.deleteStore(store.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir');
    }
  };

  const copyPublicUrl = (storeSlug: string) => {
    const origin = window.location.origin;
    const url = `${origin}/vip/${storeSlug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(storeSlug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Gerenciamento de Lojas</h2>
          <p className="text-xs text-slate-500 mt-1">
            Cadastre novas unidades físicas, gerencie URLs públicas e configure a forma de distribuição.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors shrink-0 shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Nova Loja</span>
        </button>
      </div>

      {/* Stores Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {stores.map((store) => {
          const publicUrl = `${window.location.origin}/vip/${store.slug}`;

          return (
            <div
              key={store.id}
              className={`bg-white rounded-2xl border transition-all ${
                store.isActive ? 'border-slate-200/90 shadow-xs' : 'border-slate-200/50 opacity-75 bg-slate-50/50'
              }`}
            >
              <div className="p-5">
                {/* Store Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/90 flex items-center justify-center shrink-0 overflow-hidden p-1 shadow-xs">
                      <img
                        src={store.logoUrl || '/logo.png'}
                        alt={store.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-base truncate">{store.name}</h3>
                        <span
                          className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            store.isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {store.isActive ? 'Ativa' : 'Pausada'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">/vip/{store.slug}</span>
                    </div>
                  </div>

                  {/* Actions Dropdown / Quick buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditModal(store)}
                      title="Editar informações da loja"
                      className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(store)}
                      title="Excluir loja"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-600 line-clamp-2 mb-4 leading-relaxed">
                  {store.description}
                </p>

                {/* Distribution Mode Badge */}
                <div className="flex items-center justify-between py-2.5 px-3 bg-slate-50 rounded-xl border border-slate-100 text-xs mb-4">
                  <span className="text-slate-500 font-medium">Modo de Distribuição:</span>
                  <span className="font-semibold text-slate-800 inline-flex items-center gap-1.5">
                    {store.distributionMode === 'automatic' ? (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Automático (por limites)</span>
                      </>
                    ) : (
                      <>
                        <Sliders className="w-3.5 h-3.5 text-amber-600" />
                        <span>Manual (grupo fixo)</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Public Link Box */}
                <div className="flex items-center justify-between gap-2 p-2 bg-slate-100/70 rounded-xl border border-slate-200/60 mb-4">
                  <div className="text-[11px] font-mono text-slate-700 truncate select-all px-1">
                    {publicUrl}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => copyPublicUrl(store.slug)}
                      className="p-1 text-slate-500 hover:text-slate-900 hover:bg-white rounded transition-colors"
                      title="Copiar URL"
                    >
                      {copiedSlug === store.slug ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <a
                      href={`/vip/${store.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-slate-500 hover:text-slate-900 hover:bg-white rounded transition-colors"
                      title="Abrir página pública"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => onSelectStoreForGroups(store.id)}
                    className="w-full py-2 px-3 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-center"
                  >
                    Gerenciar Grupos
                  </button>
                  <button
                    onClick={() => onSelectStoreForQr(store.slug)}
                    className="w-full py-2 px-3 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    <QrCodeIcon className="w-3.5 h-3.5" />
                    <span>Ver QR Code</span>
                  </button>
                </div>
              </div>

              {/* Status Toggle Bar */}
              <div className="px-5 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Status da Captação:</span>
                <button
                  onClick={() => handleToggleActive(store)}
                  className={`inline-flex items-center gap-1 font-medium transition-colors cursor-pointer ${
                    store.isActive ? 'text-emerald-600 hover:text-emerald-700' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{store.isActive ? 'Desativar Unidade' : 'Ativar Unidade'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Create or Edit Store */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 relative">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {editingStore ? 'Editar Unidade' : 'Cadastrar Nova Unidade'}
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              Cada loja terá sua URL permanente exclusiva para direcionamento presencial.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome da Loja / Unidade *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ex: Barigui, Pátio Batel, Shopping Mueller..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-slate-900 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  URL Slug (exclusiva) *
                </label>
                <div className="flex items-center">
                  <span className="bg-slate-100 border border-r-0 border-slate-200 px-3 py-2 text-xs font-mono text-slate-500 rounded-l-xl">
                    /vip/
                  </span>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="barigui"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-r-xl text-sm font-mono text-slate-900 focus:bg-white focus:border-slate-900 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descrição na Página Pública
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mensagem de boas-vindas e benefícios..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-slate-900 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  URL do Logotipo (Opcional)
                </label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://exemplo.com/logo.png"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-slate-900 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Modo de Distribuição
                  </label>
                  <select
                    value={distributionMode}
                    onChange={(e) => setDistributionMode(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                  >
                    <option value="automatic">Automático (por limites de cliques)</option>
                    <option value="manual">Manual (grupo fixo selecionado)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status Inicial
                  </label>
                  <select
                    value={isActive ? 'true' : 'false'}
                    onChange={(e) => setIsActive(e.target.value === 'true')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                  >
                    <option value="true">Ativa (recebendo acessos)</option>
                    <option value="false">Pausada (temporariamente inativa)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingStore ? 'Salvar Alterações' : 'Criar Unidade'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
