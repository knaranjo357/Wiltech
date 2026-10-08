import { RepairLoader } from './RepairLoader';
import { countryFetch } from '../services/countryRequest';
import React, { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, RefreshCcw, CheckCircle2, QrCode } from 'lucide-react';

import { selectWhatsappLine, type WhatsappLineId as WppSourceId } from '../utils/countryConfig';

type WppQrConnectProps = {
  country: string;
  availableSources: WppSourceId[];
  /** Permite personalizar el nombre de cada número si se desea */
  labels?: Record<WppSourceId, string>;
  /** Números a mostrar cuando el endpoint falle (conectado OK) */
  connectedNumbers?: Partial<Record<WppSourceId, string>>;
  /** Sede por defecto al abrir el componente */
  defaultSource?: WppSourceId;
};

type ParsedStatus = { connected?: boolean; number?: string | null };

const responseRecord = (payload: unknown): Record<string, unknown> => {
  const value: unknown = Array.isArray(payload) ? payload[0] : payload;
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
};

export const WppQrConnect: React.FC<WppQrConnectProps> = ({
  country,
  availableSources,
  labels,
  connectedNumbers,
  defaultSource = 1,
}) => {
  const storageKey = `wppqr:selectedSource:${country}`;
  const [activeTab, setActiveTab] = useState<WppSourceId | null>(() => {
    try {
      return selectWhatsappLine(availableSources, localStorage.getItem(storageKey), defaultSource);
    } catch { /* Use the country default when storage is unavailable. */ }
    return selectWhatsappLine(availableSources, null, defaultSource);
  });
  const requestId = useRef(0);

  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [connectedNumber, setConnectedNumber] = useState<string | null>(null);

  // Generar el endpoint dinámicamente basado en la pestaña activa
  const currentEndpoint = 'https://n8n.alliasoft.com/webhook/wiltech/wppconnect';

  const parseBase64 = useCallback((payload: unknown): string | null => {
    const obj = responseRecord(payload);
    if (!obj) return null;
    const raw: unknown =
      obj.base64 ?? obj.image ?? obj.qr ?? obj.qr_code ?? obj.data ?? null;
    if (typeof raw !== "string" || raw.length === 0) return null;
    return raw.startsWith("data:image") ? raw : `data:image/png;base64,${raw}`;
  }, []);

  const parseStatus = useCallback((payload: unknown): ParsedStatus | null => {
    const obj = responseRecord(payload);
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
  }, []);

  const fetchQR = useCallback(async (signal?: AbortSignal) => {
    if (activeTab === null || !availableSources.includes(activeTab)) return;
    const handleFallback = () => {
      setConnected(true);
      setConnectedNumber(connectedNumbers?.[activeTab] || null);
    };
    const currentRequest = ++requestId.current;
    try {
      setLoading(true);
      setImgSrc(null);
      setConnected(null);
      setConnectedNumber(null);

      const url = new URL(currentEndpoint);
      url.searchParams.set('id_instancia', String(activeTab));
      url.searchParams.set("_", String(Date.now()));

      const res = await countryFetch(url.toString(), { method: "GET", cache: "no-store", signal });
      if (currentRequest !== requestId.current || signal?.aborted) return;

      if (!res.ok) {
        handleFallback();
        return;
      }

      let data: unknown = null;
      try {
        data = await res.json();
      } catch {
        if (currentRequest !== requestId.current || signal?.aborted) return;
        handleFallback();
        return;
      }
      if (currentRequest !== requestId.current || signal?.aborted) return;

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
    } catch {
      if (currentRequest === requestId.current && !signal?.aborted) handleFallback();
    } finally {
      if (currentRequest === requestId.current && !signal?.aborted) setLoading(false);
    }
  }, [activeTab, availableSources, connectedNumbers, currentEndpoint, parseBase64, parseStatus]);

  useEffect(() => {
    if (activeTab === null) return;
    try { localStorage.setItem(storageKey, String(activeTab)); } catch { /* Storage may be disabled. */ }
    const controller = new AbortController();
    void fetchQR(controller.signal);
    return () => { controller.abort(); };
  }, [activeTab, storageKey, fetchQR]);

  const sourceName = activeTab === null ? '' : labels?.[activeTab] || `WhatsApp ${activeTab}`;

  if (activeTab === null) return <div className="card p-8 text-center"><h1 className="wt-page-title">Canales de WhatsApp · {country}</h1><p className="mt-4 text-slate-500">No hay líneas disponibles para este país.</p></div>;

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
            <div><h1 className="wt-page-title">Canales de WhatsApp</h1><p className="mt-1 text-sm text-slate-500">{country} · {availableSources.length} {availableSources.length === 1 ? 'línea disponible' : 'líneas disponibles'}</p></div>
          </div>
          <button
            onClick={() => void fetchQR()}
            disabled={loading}
            className="group flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-white hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? <RepairLoader variant="icon" /> : <RefreshCcw className={`w-4 h-4 ${loading ? "" : "group-hover:rotate-180 transition-transform duration-500"}`} />}
          </button>
        </div>

        {/* Grid Selection */}
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-2">
          {availableSources.map((id) => {
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
              <div className="absolute -inset-1 bg-gradient-to-br from-zinc-600 to-black rounded-[52px] opacity-10 blur-xl group-hover:opacity-20 transition-opacity" />
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
               <RepairLoader variant="icon" className="repair-loader--large" />
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
