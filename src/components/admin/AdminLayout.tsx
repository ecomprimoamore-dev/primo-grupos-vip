import React, { useState, useEffect } from 'react';
import { Store } from '../../types';
import { api, authStorage } from '../../services/api';
import { ReportsDashboard } from './ReportsDashboard';
import { StoreManager } from './StoreManager';
import { GroupManager } from './GroupManager';
import { QrCodeManager } from './QrCodeManager';
import {
  BarChart3,
  Building2,
  Layers,
  QrCode,
  LogOut,
  ExternalLink,
  ShieldCheck,
  Menu,
  X,
} from 'lucide-react';

interface AdminLayoutProps {
  onLogout: () => void;
  onNavigateToPublic: (slug?: string) => void;
}

export type AdminTab = 'reports' | 'stores' | 'groups' | 'qrcodes';

export const AdminLayout: React.FC<AdminLayoutProps> = ({ onLogout, onNavigateToPublic }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('reports');
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreSlugForQr, setSelectedStoreSlugForQr] = useState<string | undefined>(undefined);
  const [selectedStoreIdForGroups, setSelectedStoreIdForGroups] = useState<string | undefined>(undefined);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const loadStores = async () => {
    try {
      const data = await api.getStores();
      setStores(data);
    } catch (err) {
      console.error('Erro ao carregar lojas:', err);
    }
  };

  useEffect(() => {
    loadStores();
  }, []);

  const handleSelectStoreForQr = (slug: string) => {
    setSelectedStoreSlugForQr(slug);
    setActiveTab('qrcodes');
  };

  const handleSelectStoreForGroups = (storeId: string) => {
    setSelectedStoreIdForGroups(storeId);
    setActiveTab('groups');
  };

  const currentUser = authStorage.getUser();

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Top Bar adhering to the Top Bar Contract (§2) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark (Single text element) */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200/90 flex items-center justify-center p-1 shadow-xs shrink-0 overflow-hidden">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
              Sistema de Grupos VIP
            </span>
          </div>

          {/* Zone 2: Navigation Links (Single-line, unboxed hover underlines or quiet active indicators) */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
            <button
              onClick={() => setActiveTab('reports')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'reports'
                  ? 'text-slate-950 border-b-2 border-emerald-600 font-bold'
                  : 'hover:text-slate-950'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Visão Geral & Relatórios</span>
            </button>

            <button
              onClick={() => setActiveTab('stores')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'stores'
                  ? 'text-slate-950 border-b-2 border-emerald-600 font-bold'
                  : 'hover:text-slate-950'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Gerenciar Lojas</span>
            </button>

            <button
              onClick={() => setActiveTab('groups')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'groups'
                  ? 'text-slate-950 border-b-2 border-emerald-600 font-bold'
                  : 'hover:text-slate-950'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Grupos & Distribuição</span>
            </button>

            <button
              onClick={() => setActiveTab('qrcodes')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'qrcodes'
                  ? 'text-slate-950 border-b-2 border-emerald-600 font-bold'
                  : 'hover:text-slate-950'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>QR Codes</span>
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action & Profile Logout */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onNavigateToPublic(stores[0]?.slug || 'barigui')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Ver Página Pública</span>
            </button>

            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              title="Sair do painel administrativo"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 text-slate-700 md:hidden hover:bg-slate-100 rounded-lg"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-2 text-xs font-semibold">
            <button
              onClick={() => {
                setActiveTab('reports');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left py-2 px-3 rounded-lg flex items-center gap-2 ${
                activeTab === 'reports' ? 'bg-slate-100 text-slate-950' : 'text-slate-600'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Visão Geral & Relatórios</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('stores');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left py-2 px-3 rounded-lg flex items-center gap-2 ${
                activeTab === 'stores' ? 'bg-slate-100 text-slate-950' : 'text-slate-600'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Gerenciar Lojas</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('groups');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left py-2 px-3 rounded-lg flex items-center gap-2 ${
                activeTab === 'groups' ? 'bg-slate-100 text-slate-950' : 'text-slate-600'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Grupos & Distribuição</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('qrcodes');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left py-2 px-3 rounded-lg flex items-center gap-2 ${
                activeTab === 'qrcodes' ? 'bg-slate-100 text-slate-950' : 'text-slate-600'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>QR Codes</span>
            </button>
            <button
              onClick={() => {
                onNavigateToPublic(stores[0]?.slug || 'barigui');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left py-2 px-3 rounded-lg flex items-center gap-2 text-emerald-700"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Acessar Página Pública</span>
            </button>
          </div>
        )}
      </header>

      {/* Main Viewport Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'reports' && <ReportsDashboard />}

        {activeTab === 'stores' && (
          <StoreManager
            stores={stores}
            onRefresh={loadStores}
            onSelectStoreForQr={handleSelectStoreForQr}
            onSelectStoreForGroups={handleSelectStoreForGroups}
          />
        )}

        {activeTab === 'groups' && (
          <GroupManager
            stores={stores}
            initialStoreId={selectedStoreIdForGroups}
            onRefreshStores={loadStores}
          />
        )}

        {activeTab === 'qrcodes' && (
          <QrCodeManager stores={stores} initialSlug={selectedStoreSlugForQr} />
        )}
      </main>

      {/* Admin Footer */}
      <footer className="w-full bg-white border-t border-slate-200 py-4 px-4 sm:px-8 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Sessão de Administrador Ativa ({currentUser?.email || 'Administrador'})</span>
        </div>
        <div>
          <span>Distribuição com trava de concorrência atômica</span>
        </div>
      </footer>
    </div>
  );
};
