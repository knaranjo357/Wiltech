import React, { useEffect, useState } from "react";
import { MapPin, RefreshCcw, CheckCircle2, QrCode } from "lucide-react";

// Definimos los IDs de las 8 conexiones
type WppSourceId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

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
  // Estado para la pestaña activa (1 al 8)
  const [activeTab, setActiveTab] = useState<WppSourceId>(() => {
    try {
      const saved = localStorage.getItem("wppqr:selectedSource");
      const num = parseInt(saved || "");
      if (num >= 1 && num <= 8) return num as WppSourceId;
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
    <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-6 max-w-4xl mx-auto">
      <div className="flex flex-col gap-5 mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
            <QrCode className="w-6 h-6 text-indigo-600" />
            Central de Conexiones
          </h2>
          <button
            onClick={fetchQR}
            disabled={loading}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
            title="Refrescar estado"
          >
            <RefreshCcw className={`w-5 h-5 text-gray-600 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Tabs de los 8 números */}
        <div className="flex flex-wrap gap-2 p-1 bg-gray-50 rounded-xl border border-gray-100">
          {([1, 2, 3, 4, 5, 6, 7, 8] as WppSourceId[]).map((id) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 min-w-[100px] py-2 px-3 rounded-lg text-sm font-medium transition-all
                ${
                  activeTab === id
                    ? "bg-white text-indigo-600 shadow-sm ring-1 ring-black/5"
                    : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
                }`}
            >
              {labels?.[id] || `Línea ${id}`}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[400px] border border-dashed border-gray-200">
        <div className="mb-4 flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-sm font-semibold">
          <MapPin className="w-4 h-4" />
          {sourceName}
        </div>

        {imgSrc ? (
          <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
            <div className="bg-white p-4 rounded-2xl shadow-lg border border-gray-100">
              <img
                src={imgSrc}
                alt="QR Code"
                className="w-[280px] h-[280px] md:w-[320px] md:h-[320px] object-contain"
              />
            </div>
            <div className="text-center">
              <p className="text-gray-700 font-medium">Escanea para conectar esta línea</p>
              <p className="text-xs text-gray-400 mt-1">El código se actualiza automáticamente</p>
            </div>
          </div>
        ) : connected ? (
          <div className="w-full max-w-md p-6 rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-900 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="bg-emerald-100 p-3 rounded-full">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Línea Conectada</h3>
                <p className="text-emerald-700/80 text-sm mt-1">
                  La conexión con <b>{sourceName}</b> está activa y funcionando.
                </p>
                {connectedNumber && (
                  <div className="mt-4 px-3 py-1 bg-white/50 rounded-lg inline-block border border-emerald-200">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 mr-2">Número:</span>
                    <span className="font-mono font-bold">{connectedNumber}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
            <span className="text-gray-500 font-medium">
              {loading ? "Verificando conexión..." : "Esperando respuesta..."}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};