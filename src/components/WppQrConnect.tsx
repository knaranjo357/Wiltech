import React, { useEffect, useState } from "react";
import { MapPin, RefreshCcw, CheckCircle2, QrCode } from "lucide-react";

// Definimos los IDs de las 8 conexiones
type WppSourceId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

type WppQrConnectProps = {
  /** Permite personalizar el nombre de cada número si se desea */
  labels?: Record<WppSourceId, string>;
  /** Números a mostrar cuando el endpoint falle (conectado OK) */
  connectedNumbers?: Partial<Record<WppSourceId, string>>;
  /** Sede por defecto al abrir el componente */
  defaultSource?: WppSourceId;
};

type ParsedStatus = { connected?: boolean; number?: string | null };

export const WppQrConnect: React.FC<WppQrConnectProps> = ({
  labels,
  connectedNumbers,
  defaultSource = 1,
}) => {
  // Estado para la pestaña activa (1 al 15)
  const [activeTab, setActiveTab] = useState<WppSourceId>(() => {
    try {
      const saved = localStorage.getItem("wppqr:selectedSource");
      const num = parseInt(saved || "");
      if (num >= 1 && num <= 15) return num as WppSourceId;
    } catch {}
    return defaultSource;
  });

  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [connectedNumber, setConnectedNumber] = useState<string | null>(null);
  const [errText, setErrText] = useState<string | null>(null);

  // Generar el endpoint dinámicamente basado en la pestaña activa
  const currentEndpoint = `https://n8n.alliasoft.com/webhook/wiltech/wppconnect${activeTab}`;

  const parseBase64 = (payload: any): string | null => {
    const obj = Array.isArray(payload) ? payload[0] : payload;
    if (!obj) return null;
    const raw: unknown =
      obj.base64 ?? obj.image ?? obj.qr ?? obj.qr_code ?? obj.data ?? null;
    if (typeof raw !== "string" || raw.length === 0) return null;
    return raw.startsWith("data:image") ? raw : `data:image/png;base64,${raw}`;
  };

  const parseStatus = (payload: any): ParsedStatus | null => {
    const obj = Array.isArray(payload) ? payload[0] : payload;
    if (!obj || typeof obj !== "object") return null;

    const isConnected =
      obj.connected === true ||
      obj.status === "connected" ||
      obj.state === "connected";

    const numberCandidate =
      obj.number ?? obj.phone ?? obj.whatsapp ?? obj.msisdn ?? obj.client ?? obj.session ?? null;

    const number =
      typeof numberCandidate === "string" && numberCandidate.trim().length > 0
        ? String(numberCandidate)
        : null;

    if (isConnected || number) return { connected: isConnected, number };
    return null;
  };

  const fetchQR = async () => {
    try {
      setLoading(true);
      setErrText(null);
      setImgSrc(null);
      setConnected(null);
      setConnectedNumber(null);

      const url = new URL(currentEndpoint);
      url.searchParams.set("_", String(Date.now()));

      const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });

      if (!res.ok) {
        handleFallback();
        return;
      }

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        handleFallback();
        return;
      }

      // 1) ¿Trae imagen?
      const src = parseBase64(data);
      if (src) {
        setImgSrc(src);
        setConnected(false);
        return;
      }

      // 2) ¿Trae estado?
      const status = parseStatus(data);
      if (status?.connected || status?.number) {
        setConnected(true);
        setConnectedNumber(status?.number || (connectedNumbers && connectedNumbers[activeTab]) || null);
        return;
      }

      handleFallback();
    } catch (e) {
      handleFallback();
    } finally {
      setLoading(false);
    }
  };

  const handleFallback = () => {
    const fallbackNumber = (connectedNumbers && connectedNumbers[activeTab]) || null;
    setConnected(true);
    setConnectedNumber(fallbackNumber);
    setErrText(null);
  };

  useEffect(() => {
    localStorage.setItem("wppqr:selectedSource", String(activeTab));
    fetchQR();
  }, [activeTab]);

  const sourceName = labels?.[activeTab] || `WhatsApp ${activeTab}`;

  return (
    <div className="bg-white/70 backdrop-blur-xl border border-white shadow-2xl rounded-[40px] p-8 sm:p-10 max-w-5xl mx-auto overflow-hidden relative group/card">
      {/* Decorative Blur */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-slate-800/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
      
      <div className="flex flex-col gap-6 mb-8 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-slate-900 text-white shadow-lg">
              <QrCode className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Canales de WhatsApp</h2>
          </div>
          <button
            onClick={fetchQR}
            disabled={loading}
            className="group flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-white hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"}`} />
          </button>
        </div>

        {/* Grid Selection */}
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-2">
          {([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as WppSourceId[]).map((id) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`
                  flex flex-col items-center justify-center p-2 rounded-xl border transition-all duration-200
                  ${isActive 
                    ? "bg-slate-900 border-slate-900 text-white shadow-lg scale-105 z-10" 
                    : "bg-white border-slate-100 text-slate-400 hover:border-slate-200 hover:text-slate-600"
                  }
                `}
              >
                <span className="text-[10px] font-black leading-none mb-1 opacity-50">LÍNEA</span>
                <span className="text-lg font-black leading-none">{id}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Display Area */}
      <div className="relative min-h-[460px] flex flex-col items-center justify-center rounded-[32px] border border-dashed border-slate-200 bg-slate-50/40 p-10 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
             style={{ backgroundImage: "radial-gradient(#4f46e5 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

        <div className="mb-8 flex items-center gap-2.5 px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-full text-xs font-black uppercase tracking-[0.15em] shadow-sm relative z-10 transition-transform hover:scale-105">
          <MapPin className="w-4 h-4 text-slate-700" />
          {sourceName}
        </div>

        {imgSrc ? (
          <div className="flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-700 relative z-10">
            <div className="p-8 bg-white rounded-[48px] shadow-2xl border border-slate-100/50 relative group">
              <div className="absolute -inset-1 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-[52px] opacity-10 blur-xl group-hover:opacity-20 transition-opacity" />
              <img
                src={imgSrc}
                alt="WhatsApp QR Code"
                className="w-[280px] h-[280px] md:w-[340px] md:h-[340px] relative z-20 grayscale hover:grayscale-0 transition-all duration-700"
              />
            </div>
            
            <div className="text-center">
              <p className="text-slate-800 font-black text-2xl tracking-tight">Escanea el Código QR</p>
            </div>
          </div>
        ) : connected ? (
          <div className="w-full max-w-md p-10 rounded-[40px] bg-white border border-emerald-100 shadow-2xl shadow-emerald-500/5 animate-in fade-in slide-in-from-bottom-8 duration-700 relative z-10">
            <div className="flex flex-col items-center text-center gap-6">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500 blur-2xl opacity-20 animate-pulse" />
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white rounded-3xl flex items-center justify-center shadow-xl relative z-10">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Conectado</h3>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">
                  Línea <span className="text-slate-800 font-bold">{sourceName}</span> activa.
                </p>
              </div>

              {connectedNumber && (
                <div className="w-full mt-2 p-5 bg-slate-50 rounded-[28px] border border-slate-100 flex flex-col items-center gap-1 group/num hover:bg-slate-100/50 transition-colors">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Número Vinculado</span>
                  <span className="text-xl font-black text-slate-700 font-mono tracking-tighter">{connectedNumber}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 relative z-10">
            <div className="relative">
               <div className="w-16 h-16 border-[6px] border-slate-200 rounded-full shadow-inner" />
               <div className="absolute inset-0 w-16 h-16 border-[6px] border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="text-center">
              <span className="text-slate-800 font-bold block">Verificando...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};