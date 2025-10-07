import React, { useEffect, useState } from "react";

type WppQrConnectProps = {
  /** Endpoint que devuelve JSON con la propiedad base64 (con o sin prefijo data:image/...). */
  endpoint?: string;
};

export const WppQrConnect: React.FC<WppQrConnectProps> = ({
  endpoint = "https://n8n.alliasoft.com/webhook/wiltech/wpp",
}) => {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const parseBase64 = (payload: any): string | null => {
    const obj = Array.isArray(payload) ? payload[0] : payload;
    if (!obj) return null;
    const raw: unknown = obj.base64 ?? obj.image ?? obj.qr ?? obj.qr_code ?? obj.data;
    if (typeof raw !== "string" || raw.length === 0) return null;
    return raw.startsWith("data:image") ? raw : `data:image/png;base64,${raw}`;
  };

  const fetchQR = async () => {
    try {
      setLoading(true);
      setErr(null);
      const url = new URL(endpoint);
      url.searchParams.set("_", String(Date.now())); // evita cache
      const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const src = parseBase64(data);
      if (!src) throw new Error("No se encontró una imagen base64 válida en la respuesta.");
      setImgSrc(src);
    } catch (e: any) {
      setImgSrc(null);
      setErr(e?.message || "Error al obtener el QR.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQR();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  return (
    <div className="bg-white/90 border border-gray-200 rounded-2xl shadow-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Conecta WhatsApp</h2>
        <button
          onClick={fetchQR}
          disabled={loading}
          className="px-3 py-2 rounded-lg text-sm border border-gray-200 bg-white hover:bg-gray-50"
        >
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {err && (
        <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {err}
        </div>
      )}

      <div className="flex items-center justify-center py-4">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt="QR de conexión WhatsApp"
            className="w-[280px] h-[280px] md:w-[340px] md:h-[340px] object-contain rounded-xl border border-gray-100 shadow-md"
          />
        ) : (
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
