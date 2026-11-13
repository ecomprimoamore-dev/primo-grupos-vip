import React, { useState, useEffect } from 'react';
import { Tag, Sparkles, Flame, CheckCircle, ShieldAlert, ArrowRight, Loader2, Store as StoreIcon, ExternalLink } from 'lucide-react';
import { api } from '../../services/api';

interface VipCapturePageProps {
  slug: string;
  onNavigateToAdmin?: () => void;
  onSelectStore?: (slug: string) => void;
  allStores?: { slug: string; name: string }[];
}

export const VipCapturePage: React.FC<VipCapturePageProps> = ({
  slug,
  onNavigateToAdmin,
  onSelectStore,
  allStores = [],
}) => {
  const [storeData, setStoreData] = useState<{
    id: string;
    name: string;
    slug: string;
    description: string;
    logoUrl?: string;
    isActive: boolean;
    hasAvailableGroups: boolean;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirectSuccess, setRedirectSuccess] = useState<{
    inviteUrl: string;
    groupName: string;
  } | null>(null);

  // Load store details
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    setRedirectSuccess(null);

    api
      .getStorePublic(slug, true)
      .then((data) => {
        if (isMounted) {
          setStoreData(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Loja não encontrada');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [slug]);

  const handleJoinClick = async () => {
    if (joining || !storeData) return;

    setJoining(true);
    setError(null);

    try {
      // Generate a unique idempotency key for this session
      const idempotencyKey = `clk_${slug}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const res = await api.joinVipGroup(slug, idempotencyKey);

      setRedirectSuccess({
        inviteUrl: res.inviteUrl,
        groupName: res.groupName,
      });

      // Give immediate visual feedback and redirect
      setTimeout(() => {
        try {
          window.location.href = res.inviteUrl;
        } catch {
          // If browser prevents direct redirect, fallback link is shown in UI
        }
      }, 500);
    } catch (err: any) {
      setError(err.message || 'Não foi possível entrar no grupo no momento. Tente novamente.');
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      {/* Top Demo Bar for Testing (Subtle floating helper) */}
      <div className="w-full bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 py-2.5 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="font-semibold text-slate-700 whitespace-nowrap">Unidades VIP:</span>
          {allStores.map((s) => (
            <button
              key={s.slug}
              onClick={() => onSelectStore && onSelectStore(s.slug)}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap font-medium ${
                s.slug.toLowerCase() === slug.toLowerCase()
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
        {onNavigateToAdmin && (
          <button
            onClick={onNavigateToAdmin}
            className="flex items-center gap-1.5 px-3 py-1 font-medium text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 rounded transition-colors shrink-0 ml-2"
          >
            <StoreIcon className="w-3.5 h-3.5 text-slate-500" />
            <span>Painel Admin</span>
          </button>
        )}
      </div>

      {/* Main Public Capture Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 md:py-16">
        <div className="w-full max-w-md mx-auto">
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-8 text-center flex flex-col items-center justify-center min-h-[380px]">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
              <p className="text-sm font-medium text-slate-600">Carregando informações da unidade...</p>
            </div>
          ) : error && !storeData ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-8 text-center">
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Unidade Não Encontrada</h2>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                A URL <span className="font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">/vip/{slug}</span> não corresponde a nenhuma unidade ativa cadastrada.
              </p>
              {onSelectStore && allStores.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Acessar unidade disponível:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {allStores.map((s) => (
                      <button
                        key={s.slug}
                        onClick={() => onSelectStore(s.slug)}
                        className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : storeData && !storeData.isActive ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-8 text-center">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Unidade Temporariamente Inativa</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                As entradas para o grupo VIP da unidade <strong className="text-slate-800">{storeData.name}</strong> estão temporariamente pausadas. Por favor, consulte nossa equipe física no balcão.
              </p>
            </div>
          ) : storeData ? (
            <div className="bg-white rounded-3xl border border-slate-200/70 shadow-sm p-6 sm:p-9 relative overflow-hidden transition-all">
              {/* Top Unit Pill & Brand Logo */}
              <div className="text-center mb-6">
                {/* Brand Logo */}
                <div className="mx-auto mb-4 w-20 h-20 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center p-2">
                  <img
                    src={storeData.logoUrl || '/logo.png'}
                    alt={storeData.name}
                    className="w-full h-full object-contain drop-shadow-xs"
                  />
                </div>

                {/* Unit identification */}
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Unidade {storeData.name}</span>
                </div>

                {/* Primary Title */}
                <h1 className="text-2xl sm:text-[1.75rem] font-bold text-slate-950 tracking-tight leading-snug">
                  Entre para o nosso Grupo VIP!
                </h1>

                {/* Subtitle / Description */}
                <p className="text-sm text-slate-600 mt-2.5 leading-relaxed max-w-sm mx-auto">
                  {storeData.description ||
                    'Receba ofertas exclusivas, promoções especiais e lançamentos em primeira mão.'}
                </p>
              </div>

              {/* 3 Mandatory Benefits */}
              <div className="space-y-3.5 my-7 pt-2 border-t border-slate-100">
                {/* Benefit 1 */}
                <div className="flex items-start gap-3.5 p-3 rounded-xl bg-slate-50/70 hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 leading-tight">
                      Ofertas exclusivas
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5 leading-normal">
                      Preços especiais e condições diferenciadas reservadas somente aos membros.
                    </p>
                  </div>
                </div>

                {/* Benefit 2 */}
                <div className="flex items-start gap-3.5 p-3 rounded-xl bg-slate-50/70 hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 leading-tight">
                      Novidades em primeira mão
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5 leading-normal">
                      Seja notificado sobre novos produtos e coleções antes do público geral.
                    </p>
                  </div>
                </div>

                {/* Benefit 3 */}
                <div className="flex items-start gap-3.5 p-3 rounded-xl bg-slate-50/70 hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 leading-tight">
                      Promoções especiais
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5 leading-normal">
                      Ações relâmpago e benefícios pensados especialmente para clientes frequentes.
                    </p>
                  </div>
                </div>
              </div>

              {/* Error message if all groups are full or failure */}
              {error && (
                <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs leading-relaxed flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <div>
                    <span className="font-semibold">Aviso:</span> {error}
                  </div>
                </div>
              )}

              {/* Success / Redirect notification */}
              {redirectSuccess ? (
                <div className="space-y-3 my-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                  <CheckCircle className="w-7 h-7 text-emerald-600 mx-auto" />
                  <p className="text-sm font-semibold text-emerald-950">
                    Você está sendo direcionado para o WhatsApp!
                  </p>
                  <p className="text-xs text-emerald-800">
                    Grupo selecionado: <span className="font-bold">{redirectSuccess.groupName}</span>
                  </p>
                  <a
                    href={redirectSuccess.inviteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
                  >
                    <span>Clique aqui se não abrir automaticamente</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                /* Primary CTA Button (WhatsApp Inspired Green) */
                <button
                  onClick={handleJoinClick}
                  disabled={joining}
                  className="w-full relative group overflow-hidden py-4 px-6 bg-[#25D366] hover:bg-[#20ba59] active:scale-[0.99] text-white font-extrabold text-sm sm:text-base tracking-wide rounded-2xl shadow-md shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-80 disabled:cursor-not-allowed"
                >
                  {joining ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>IDENTIFICANDO GRUPO ATIVO...</span>
                    </>
                  ) : (
                    <>
                      {/* WhatsApp Icon SVG */}
                      <svg
                        className="w-5 h-5 fill-current shrink-0"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19.01L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.53 7.36C9.36 7.36 9.09 7.42 8.86 7.68C8.63 7.93 7.97 8.55 7.97 9.83C7.97 11.11 8.9 12.34 9.03 12.51C9.16 12.69 10.83 15.26 13.4 16.37C14.02 16.63 14.5 16.79 14.88 16.91C15.5 17.11 16.06 17.08 16.5 17.02C17 16.94 18.03 16.39 18.25 15.77C18.47 15.15 18.47 14.62 14.62 14.51C18.34 14.46 18.17 14.37 17.82 14.2C17.47 14.02 15.74 13.17 15.42 13.06C15.1 12.94 14.86 12.89 14.63 13.24C14.4 13.59 13.73 14.37 13.53 14.6C13.33 14.83 13.12 14.86 12.77 14.68C12.43 14.51 11.32 14.15 10 12.97C8.97 12.06 8.28 10.93 8.08 10.59C7.88 10.24 8.06 10.05 8.23 9.88C8.39 9.72 8.59 9.47 8.76 9.27C8.93 9.07 9 8.92 9.11 8.69C9.23 8.46 9.17 8.25 9.09 8.08C9 7.92 8.35 6.32 8.08 5.67C7.81 5.03 7.55 5.12 7.36 5.12" />
                      </svg>
                      <span>ENTRAR NO GRUPO VIP</span>
                      <ArrowRight className="w-4 h-4 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>
              )}

              {/* Discreet Privacy / Visibility Notice */}
              <div className="mt-4 text-center">
                <p className="text-[11px] text-slate-600 leading-normal max-w-xs mx-auto">
                  Informação importante: Ao ingressar, o seu número de telefone poderá ficar visível
                  para os demais participantes do grupo no WhatsApp.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </main>

      {/* Clean Minimal Footer */}
      <footer className="w-full text-center py-4 px-4 text-xs text-slate-600 border-t border-slate-100">
        <span>© {new Date().getFullYear()} Grupo VIP Oficial</span>
        <span className="mx-2">·</span>
        <span>Acesso seguro para clientes presenciais</span>
      </footer>
    </div>
  );
};
