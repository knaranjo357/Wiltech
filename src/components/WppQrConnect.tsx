import React, { useEffect, useState } from "react";
import { MapPin, RefreshCcw, CheckCircle2, QrCode } from "lucide-react";

type Source = "Wiltech" | "WiltechBga";

type WppQrConnectProps = {
  /** Endpoint Bogotá (Wiltech) */
  endpointWiltech?: string;
  /** Endpoint Bucaramanga (WiltechBga) */
  endpointWiltechBga?: string;
  /** Sede por defecto al abrir el componente */
  defaultSource?: Source;
  /** Números a mostrar cuando el endpoint falle (conectado OK) */
  connectedNumbers?: Partial<Record<Source, string>>;
};

type ParsedStatus = { connected?: boolean; number?: string | null };

const DEFAULT_ENDPOINTS: Record<Source, string> = {
  Wiltech: "https://n8n.alliasoft.com/webhook/wiltech/wpp",
  WiltechBga: "https://n8n.alliasoft.com/webhook/wiltech/wppBga",
};

const SOURCE_LABEL: Record<Source, string> = {
  Wiltech: "Bogotá",
  WiltechBga: "Bucaramanga",
};

export const WppQrConnect: React.FC<WppQrConnectProps> = ({
  endpointWiltech = DEFAULT_ENDPOINTS.Wiltech,
  endpointWiltechBga = DEFAULT_ENDPOINTS.WiltechBga,
  defaultSource,
  connectedNumbers,
}) => {
  const [source, setSource] = useState<Source>(() => {
    try {
      const saved = localStorage.getItem("wppqr:selectedSource") as Source | null;
      if (saved === "Wiltech" || saved === "WiltechBga") return saved;
    } catch {}
    return defaultSource ?? "Wiltech";
  });

  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [connectedNumber, setConnectedNumber] = useState<string | null>(null);
  const [errText, setErrText] = useState<string | null>(null);

  const currentEndpoint = source === "Wiltech" ? endpointWiltech : endpointWiltechBga;

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

    const connected =
      obj.connected === true ||
      obj.status === "connected" ||
      obj.state === "connected";

    const numberCandidate =
      obj.number ??
      obj.phone ??
      obj.whatsapp ??
      obj.msisdn ??
      obj.client ??
      obj.session ??
      null;

    const number =
      typeof numberCandidate === "string" && numberCandidate.trim().length > 0
        ? String(numberCandidate)
        : null;

    if (connected || number) return { connected, number };
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
      url.searchParams.set("_", String(Date.now())); // evitar caché

      const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });

      // Si el endpoint falla, tratamos como conectado OK
      if (!res.ok) {
        const fallbackNumber =
          (connectedNumbers && connectedNumbers[source]) || null;
        setConnected(true);
        setConnectedNumber(fallbackNumber);
        setErrText(null);
        return;
      }

      // Intentamos JSON
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // Si no es JSON válido, tratamos como conectado OK
        const fallbackNumber =
          (connectedNumbers && connectedNumbers[source]) || null;
        setConnected(true);
        setConnectedNumber(fallbackNumber);
        setErrText(null);
        return;
      }

      // 1) ¿Trae imagen? => No está conectado (hay que escanear)
      const src = parseBase64(data);
      if (src) {
        setImgSrc(src);
        setConnected(false);
        setConnectedNumber(null);
        return;
      }

      // 2) ¿Trae estado conectado/number?
      const status = parseStatus(data);
      if (status?.connected || status?.number) {
        setConnected(true);
        setConnectedNumber(
          status?.number ||
            (connectedNumbers && connectedNumbers[source]) ||
            null
        );
        return;
      }

      // 3) Si no hay nada claro, asumimos conectado OK
      setConnected(true);
      setConnectedNumber(
        (connectedNumbers && connectedNumbers[source]) || null
      );
    } catch (e: any) {
      // Error de red/parseo => conectado OK con número de fallback (si lo hay)
      const fallbackNumber =
        (connectedNumbers && connectedNumbers[source]) || null;
      setConnected(true);
      setConnectedNumber(fallbackNumber);
      setErrText(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem("wppqr:selectedSource", source);
    } catch {}
    // cada vez que cambie la sede, recargamos
    fetchQR();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, currentEndpoint]);

  return (
    <div className="bg-white/90 border border-gray-200 rounded-2xl shadow-xl p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <QrCode className="w-5 h-5 text-indigo-600" />
          Conecta WhatsApp
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-sm">
            <MapPin className="w-4 h-4" />
            <span className="font-medium">Sede:</span>
            <span className="font-semibold">{SOURCE_LABEL[source]}</span>
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setSource("Wiltech")}
              className={`px-3 py-1.5 rounded-lg text-sm border transition
                ${
                  source === "Wiltech"
                    ? "bg-white border-blue-500 ring-2 ring-blue-200"
                    : "bg-white border-gray-200 hover:bg-gray-50"
                }`}
            >
              Bogotá
            </button>
            <button
              onClick={() => setSource("WiltechBga")}
              className={`px-3 py-1.5 rounded-lg text-sm border transition
                ${
                  source === "WiltechBga"
                    ? "bg-white border-blue-500 ring-2 ring-blue-200"
                    : "bg-white border-gray-200 hover:bg-gray-50"
                }`}
            >
              Bucaramanga
            </button>
          </div>

          <button
            onClick={fetchQR}
            disabled={loading}
            className="px-3 py-2 rounded-lg text-sm border border-gray-200 bg-white hover:bg-gray-50 inline-flex items-center gap-2"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {/* Estados */}
      {errText && (
        <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {errText}
        </div>
      )}

      <div className="flex items-center justify-center py-4">
        {/* 1) Si hay imagen => NO conectado (mostrar QR) */}
        {imgSrc ? (
          <div className="flex flex-col items-center gap-3">
            <img
              src={imgSrc}
              alt="QR de conexión WhatsApp"
              className="w-[280px] h-[280px] md:w-[340px] md:h-[340px] object-contain rounded-xl border border-gray-100 shadow-md"
            />
            <p className="text-sm text-gray-600">
              Escanea el QR para conectar <b>{SOURCE_LABEL[source]}</b>.
            </p>
          </div>
        ) : connected ? (
          // 2) Conectado satisfactoriamente (por error del endpoint o respuesta de estado)
          <div className="w-full max-w-lg p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 mt-0.5" />
              <div>
                <p className="font-semibold">
                  {SOURCE_LABEL[source]} está conectado satisfactoriamente.
                </p>
                <p className="text-sm mt-1">
                  {connectedNumber
                    ? <>Número: <span className="font-mono">{connectedNumber}</span></>
                    : "La sesión está activa."}
                </p>
              </div>
            </div>
          </div>
        ) : (
          // 3) Cargando o sin QR disponible
          <div className="flex items-center space-x-3 py-10">
            <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
            <span className="text-gray-600 text-sm">
              {loading ? "Cargando QR…" : "Sin QR disponible."}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
