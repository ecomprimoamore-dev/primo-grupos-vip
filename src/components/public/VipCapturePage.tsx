import React, { useState, useEffect } from 'react';
import { Tag, Sparkles, Flame, CheckCircle, ShieldAlert, ArrowRight, Loader2, Store as StoreIcon, ExternalLink } from 'lucide-react';
import { api } from '../../services/api';

interface VipCapturePageProps {
  slug: string;
  onNavigateToAdmin?: () => void;
}

export const VipCapturePage: React.FC<VipCapturePageProps> = ({ slug, onNavigateToAdmin }) => {
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
      {onNavigateToAdmin && (
        <div className="w-full bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 py-2.5 flex justify-end text-xs text-slate-500">
          <button
            onClick={onNavigateToAdmin}
            className="flex items-center gap-1.5 px-3 py-1 font-medium text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
          >
            <StoreIcon className="w-3.5 h-3.5 text-slate-500" />
            <span>Painel Admin</span>
          </button>
        </div>
      )}
      {/* Main Public Capture Container */}
      <main className="flex-1 flex items-center justify-center px-3 py-6 min-[375px]:px-4 sm:py-10 md:py-16">
        <div className="w-full max-w-md mx-auto">
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 min-[375px]:p-8 text-center flex flex-col items-center justify-center min-h-[320px] sm:min-h-[380px]">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
              <p className="text-sm font-medium text-slate-600">Carregando informações da unidade...</p>
            </div>
          ) : error && !storeData ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 min-[375px]:p-8 text-center">
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Unidade Não Encontrada</h2>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                A URL <span className="font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">/vip/{slug}</span> não corresponde a nenhuma unidade ativa cadastrada.
              </p>
            </div>
          ) : storeData && !storeData.isActive ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 min-[375px]:p-8 text-center">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Unidade Temporariamente Inativa</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                As entradas para o grupo VIP da unidade <strong className="text-slate-800">{storeData.name}</strong> estão temporariamente pausadas. Por favor, consulte nossa equipe física no balcão.
              </p>
            </div>
          ) : storeData ? (
            <div className="bg-white rounded-3xl border border-slate-200/70 shadow-sm p-4 min-[375px]:p-5 sm:p-9 relative transition-all">
              {/* Top Unit Pill & Brand Logo */}
              <div className="text-center mb-5 sm:mb-6">
                {/* Brand Logo */}
                <img
                  src="/primo-amore-logo.png"
                  alt="Primo Amore"
                  className="block w-full max-w-[250px] h-auto max-h-16 object-contain mx-auto mb-4 min-[375px]:max-h-[4.5rem]"
                />

                {/* Unit identification */}
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Unidade {storeData.name}</span>
                </div>

                {/* Primary Title */}
                <h1 className="flex flex-col items-center font-bold text-slate-950 tracking-tight leading-tight">
                  <span className="block whitespace-nowrap text-[clamp(1.125rem,5.6vw,1.375rem)]">Entre para o nosso</span>
                  <span className="block whitespace-nowrap text-[clamp(1.125rem,5.6vw,1.375rem)]">Grupo VIP!</span>
                </h1>

                {/* Subtitle / Description */}
                <p className="text-[13px] min-[375px]:text-sm text-slate-600 mt-2.5 leading-relaxed max-w-sm mx-auto">
                  {storeData.description ||
                    'Receba ofertas exclusivas, promoções especiais e lançamentos em primeira mão.'}
                </p>
              </div>

              {/* 3 Mandatory Benefits */}
              <div className="space-y-2.5 min-[375px]:space-y-3.5 my-5 min-[375px]:my-6 sm:my-7 pt-2 border-t border-slate-100">
                {/* Benefit 1 */}
                <div className="flex items-start gap-3 p-2.5 min-[375px]:p-3 rounded-xl bg-slate-50/70 hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 leading-tight">
                      Ofertas exclusivas
                    </h2>
                    <p className="text-[13px] text-slate-600 mt-0.5 leading-snug">
                      Preços especiais e condições diferenciadas reservadas somente aos membros.
                    </p>
                  </div>
                </div>

                {/* Benefit 2 */}
                <div className="flex items-start gap-3 p-2.5 min-[375px]:p-3 rounded-xl bg-slate-50/70 hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 leading-tight">
                      Novidades em primeira mão
                    </h2>
                    <p className="text-[13px] text-slate-600 mt-0.5 leading-snug">
                      Seja notificado sobre novos produtos e coleções antes do público geral.
                    </p>
                  </div>
                </div>

                {/* Benefit 3 */}
                <div className="flex items-start gap-3 p-2.5 min-[375px]:p-3 rounded-xl bg-slate-50/70 hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 leading-tight">
                      Promoções especiais
                    </h2>
                    <p className="text-[13px] text-slate-600 mt-0.5 leading-snug">
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
                  className="w-full min-h-14 relative group overflow-hidden py-4 px-3 min-[375px]:px-4 bg-[#25D366] hover:bg-[#20ba59] active:scale-[0.99] text-white font-extrabold text-[12px] min-[375px]:text-sm sm:text-base tracking-wide rounded-2xl shadow-md shadow-emerald-500/25 transition-all flex items-center justify-center gap-1.5 min-[375px]:gap-2 cursor-pointer disabled:opacity-80 disabled:cursor-not-allowed"
                >
                  {joining ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="whitespace-nowrap">IDENTIFICANDO GRUPO ATIVO...</span>
                    </>
                  ) : (
                    <>
                      {/* WhatsApp Icon SVG */}
                      <svg
                        aria-hidden="true"
                        className="w-5 h-5 fill-current shrink-0"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.768.966-.941 1.164-.173.198-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.693.626.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.946L.057 24l6.304-1.654a11.88 11.88 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                      </svg>
                      <span className="whitespace-nowrap">ENTRAR NO GRUPO VIP</span>
                      <ArrowRight className="w-4 h-4 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>
              )}

              {/* Discreet Privacy / Visibility Notice */}
              <div className="mt-4 text-center">
                <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
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
