import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Store } from '../../types';
import {
  Download,
  Copy,
  Check,
  ExternalLink,
  Printer,
  Sparkles,
  ShieldCheck,
  Smartphone,
  Eye,
} from 'lucide-react';

interface QrCodeManagerProps {
  stores: Store[];
  initialSlug?: string;
}

const storeDisplayNames: Record<string, string> = {
  barigui: 'ParkShoppingBarigüi',
  quadrata: 'Quadratta Mall',
  patio: 'Pátio Batel',
};

export const QrCodeManager: React.FC<QrCodeManagerProps> = ({ stores, initialSlug }) => {
  const [selectedSlug, setSelectedSlug] = useState<string>(
    initialSlug || (stores.length > 0 ? stores[0].slug : '')
  );
  const [qrPngUrl, setQrPngUrl] = useState<string>('');
  const [qrSvgString, setQrSvgString] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const flyerPrintRef = useRef<HTMLDivElement>(null);

  const selectedStore = stores.find((s) => s.slug === selectedSlug) || stores[0];

  // Permanent Public URL
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://seudominio.com';
  const permanentUrl = selectedStore ? `${origin}/vip/${selectedStore.slug}` : '';

  useEffect(() => {
    if (!permanentUrl) return;

    // Generate high resolution PNG data URL
    QRCode.toDataURL(permanentUrl, {
      width: 800,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => setQrPngUrl(url))
      .catch((err) => console.error('Erro ao gerar PNG:', err));

    // Generate clean vector SVG string
    QRCode.toString(permanentUrl, {
      type: 'svg',
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((svg) => setQrSvgString(svg))
      .catch((err) => console.error('Erro ao gerar SVG:', err));
  }, [permanentUrl]);

  const handleCopyUrl = () => {
    if (!permanentUrl) return;
    navigator.clipboard.writeText(permanentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPng = () => {
    if (!qrPngUrl || !selectedStore) return;
    const a = document.createElement('a');
    a.href = qrPngUrl;
    a.download = `qrcode-vip-${selectedStore.slug}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadSvg = () => {
    if (!qrSvgString || !selectedStore) return;
    const blob = new Blob([qrSvgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qrcode-vip-${selectedStore.slug}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrintFlyer = async () => {
    await document.fonts.load('400 64px "Great Vibes"');
    await document.fonts.ready;
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Store Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            QR Codes Permanentes de Captação
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Cada QR Code aponta de forma permanente para a URL da unidade, nunca diretamente ao WhatsApp.
          </p>
        </div>

        {/* Store Selector */}
        <div className="flex w-full max-w-[340px] items-center gap-3">
          <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Unidade:</label>
          <select
            value={selectedSlug}
            onChange={(e) => setSelectedSlug(e.target.value)}
            className="min-w-0 flex-1 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 shadow-xs focus:ring-1 focus:ring-slate-900"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.slug}>
                {storeDisplayNames[s.slug] || s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedStore && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: QR Code Controls & Download Options (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Main Action Card */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6">
              <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm">
                  QR
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    QR Code Oficial · Unidade {selectedStore.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Resolução de alta precisão com correção de erro nível H
                  </p>
                </div>
              </div>

              {/* Permanent URL Showcase */}
              <div className="mb-6">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Destino Permanente do QR Code:
                </label>
                <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="font-mono text-xs text-slate-900 truncate px-2 select-all flex-1">
                    {permanentUrl}
                  </span>
                  <button
                    onClick={handleCopyUrl}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors shrink-0 cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar URL</span>
                      </>
                    )}
                  </button>
                  <a
                    href={`/vip/${selectedStore.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
                    title="Testar URL pública"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  ✓ Mesmo que os grupos de WhatsApp sejam alterados ou esgotados, o material impresso{' '}
                  <strong>nunca precisará ser reimpresso</strong>.
                </p>
              </div>

              {/* Download Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleDownloadPng}
                  disabled={!qrPngUrl}
                  className="py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar QR Code (PNG)</span>
                </button>
                <button
                  onClick={handleDownloadSvg}
                  disabled={!qrSvgString}
                  className="py-3 px-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Vetor (SVG)</span>
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>PNG: 800×800px para redes e displays</span>
                <span>SVG: Vetorial para gráficas e adesivos</span>
              </div>
            </div>

            {/* Instruction Card for Store Staff */}
            <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 shadow-xs">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Boas práticas na loja física</span>
              </h4>
              <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside leading-relaxed">
                <li>Posicione o totem ou adesivo próximo ao caixa ou balcão de atendimento.</li>
                <li>Treine a equipe para convidar o cliente a apontar a câmera enquanto finaliza a compra.</li>
                <li>
                  Reforce o benefício imediato: <em>"Entre para o nosso VIP e receba ofertas exclusivas"</em>.
                </li>
              </ul>
            </div>
          </div>

          {/* Right Column: Physical Display / Stand Preview (5 cols) */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Eye className="w-4 h-4 text-slate-500" />
                  <span>Mockup para Display de Balcão (A5)</span>
                </div>
                <button
                  onClick={handlePrintFlyer}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir</span>
                </button>
              </div>

              {/* Printable Stand Card Preview */}
              <div
                ref={flyerPrintRef}
                className="vip-a5-display relative mx-auto flex aspect-[148/210] w-full max-w-[340px] flex-col items-center justify-between overflow-hidden rounded-[28px] border-2 border-[#263e35] bg-[#FAFAFA] px-6 py-[21px] text-center shadow-lg"
              >
                {/* Keep the logo and store identification as one top block. */}
                <div className="vip-a5-brand flex w-full flex-col items-center gap-2">
                  <img
                    src="/primo-amore-logo.png"
                    alt="Primo Amore"
                    className="vip-a5-logo h-auto w-[70%] object-contain"
                  />
                  <div className="vip-a5-store text-[10px] uppercase tracking-[0.22em] font-semibold text-[#68736d]">
                    Unidade {selectedStore.name}
                  </div>
                </div>

                <div className="vip-a5-content">
                <div className="vip-a5-title-block">
                  <h4 className="vip-a5-title-intro font-serif text-[15px] font-normal tracking-[0.035em] text-[#273b32]">
                    Entre para o nosso
                  </h4>
                  <div className="vip-a5-title-script mt-1.5 font-normal text-[#8FAFC5]">
                    Grupo Vip
                  </div>
                </div>
                  <p className="vip-a5-copy max-w-[250px] text-[11px] leading-relaxed text-[#59645e]">
                    Ofertas exclusivas e lançamentos em primeira mão no seu WhatsApp
                  </p>

                {/* QR Code Canvas / Image */}
                <div className="vip-a5-qr-frame inline-flex rounded-2xl border border-[#e5e1d8] bg-white p-3 shadow-sm">
                  {qrPngUrl ? (
                    <img
                      src={qrPngUrl}
                      alt={`QR Code VIP ${selectedStore.name}`}
                      className="vip-a5-qr h-40 w-40 object-contain"
                    />
                  ) : (
                    <div className="vip-a5-qr flex h-40 w-40 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                      Gerando QR Code...
                    </div>
                  )}
                </div>
                </div>

                {/* Scan Instruction */}
                <div className="vip-a5-footer flex flex-col items-center gap-1.5">
                  <div className="vip-a5-instruction inline-flex items-center gap-1 rounded-full bg-[#edf2ed] px-3 py-1 text-[11px] font-semibold text-[#355342]">
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Aponte a câmera do celular</span>
                  </div>
                  <div className="vip-a5-url max-w-full truncate font-mono text-[10px] text-slate-500">
                    {permanentUrl.replace(/^https?:\/\//, '')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
