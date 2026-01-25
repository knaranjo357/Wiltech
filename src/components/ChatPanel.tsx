import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Repeat2, Copy, Check, ArrowDown, MessageCircle, AlertTriangle, Fingerprint } from 'lucide-react';
import { Client } from '../types/client';
import { ApiService } from '../services/apiService';
import { ChatBubble, ChatMsg } from './ChatBubble';

export type ChatPanelProps = {
  client: Client;
  /** Se envía automáticamente con cada request si viene definido */
  source: string | null | undefined;
};

// Mantenemos el helper, pero ya no lo usaremos para bloquear la UI
const coerceNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'bigint') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Toma el valor "crudo" para mostrar y para enviar (evita problemas de precisión con IDs largos)
const getRawSubscriberId = (c: any): unknown =>
  c?.subscriber_id ?? c?.subscriberId ?? c?.sub_id ?? null;

export const ChatPanel: React.FC<ChatPanelProps> = ({ client, source }) => {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- scroll control ---
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Datos clave
  const hasWhatsapp = Boolean(client?.whatsapp);
  const phone = useMemo(
    () => (client?.whatsapp ?? '').replace('@s.whatsapp.net', ''),
    [client?.whatsapp]
  );

  // Valor crudo (String | Number)
  const rawSubscriberId = getRawSubscriberId(client);
  
  // Display en UI
  const subscriberIdDisplay =
    rawSubscriberId === null || rawSubscriberId === undefined || rawSubscriberId === ''
      ? '—'
      : String(rawSubscriberId);

  // Validamos si tenemos ALGO con que enviar (WhatsApp O SubscriberID)
  const hasContactMethod = hasWhatsapp || (rawSubscriberId !== null && rawSubscriberId !== undefined && rawSubscriberId !== '');

  const scrollToBottom = (smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      const atBottom = distance < 30; // Un poco más de margen
      stickToBottomRef.current = atBottom;
      setShowJumpToBottom(!atBottom);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (stickToBottomRef.current) {
      requestAnimationFrame(() => requestAnimationFrame(() => scrollToBottom(false)));
    }
  }, [msgs]);

  // Auto-resize del textarea
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = 'auto'; // Reset para calcular bien si se borra texto
    ta.style.height = Math.min(150, ta.scrollHeight) + 'px';
  }, [input]);

  // --- Cargar historial ---
  const loadConversation = async () => {
    // Intentamos cargar si tiene whatsapp, si no, intentamos con lo que haya
    if (!hasWhatsapp && !rawSubscriberId) return; 

    try {
      setLoading(true);
      setError(null);
      const body: any = { whatsapp: client.whatsapp };
      
      // Enviamos el source si existe, o subscriber_id si no hay whatsapp
      if (source) body.source = source;
      if (!hasWhatsapp && rawSubscriberId) body.subscriber_id = rawSubscriberId;

      const resp = await ApiService.post<any[]>('/conversacion', body);
      const normalized: ChatMsg[] = Array.isArray(resp)
        ? resp.map((it, idx) => ({
            id: it?.id ?? idx,
            type:
              it?.message?.type === 'human' ||
              it?.message?.type === 'ai' ||
              it?.message?.type === 'system'
                ? it.message.type
                : 'ai',
            content: String(it?.message?.content ?? '').trim(),
            createdAt: it?.createdAt ?? it?.timestamp ?? undefined,
          }))
        : [];
      setMsgs(normalized);

      stickToBottomRef.current = true;
      requestAnimationFrame(() => requestAnimationFrame(() => scrollToBottom(false)));
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch (e: any) {
      // No mostramos error invasivo si es solo carga inicial
      console.error('Error cargando chat:', e);
      // setError(e?.message || 'No se pudo cargar la conversación');
    } finally {
      setLoading(false);
    }
  };

  // Cargar historial
  useEffect(() => {
    loadConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.whatsapp, source]);

  // --- Enviar Mensaje (MODIFICADO) ---
  const sendMessage = async () => {
    const text = input.trim();
    // Validar: debe tener texto Y (tener whatsapp O tener subscriber_id)
    if (!text || !hasContactMethod) return;

    stickToBottomRef.current = true;

    // Mensaje optimista
    const optimistic: ChatMsg = {
      id: `local-${Date.now()}`,
      type: 'ai', 
      content: text,
      createdAt: Date.now(),
    };
    setMsgs((prev) => [...prev, optimistic]);
    setInput('');
    setSending(true);
    setError(null);

    try {
      // Lógica solicitada:
      // 1. Si source es null/vacio -> "Directo". Si tiene source -> usarlo.
      const finalSource = source || 'Directo';

      const body: any = {
        whatsapp: client.whatsapp,
        mensaje: text,
        source: finalSource,
      };

      // 2. Adjuntamos subscriber_id solo si existe (raw, sin forzar null si no existe)
      if (rawSubscriberId !== null && rawSubscriberId !== undefined && rawSubscriberId !== '') {
         body.subscriber_id = rawSubscriberId;
      }

      await ApiService.post('/enviarmensaje', body);
      
      // Recargar para confirmar IDs y estado real
      await loadConversation();
    } catch (e: any) {
      setError(e?.message || 'No se pudo enviar el mensaje');
      setMsgs((prev) => prev.filter((m) => m.id !== optimistic.id)); // Eliminar optimista si falló
      setInput(text); // Restaurar texto
      inputRef.current?.focus();
    } finally {
      setSending(false);
    }
  };

  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedSub, setCopiedSub] = useState(false);

  const copyPhone = async () => {
    try {
      if (!phone) return;
      await navigator.clipboard.writeText(phone);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 1200);
    } catch {}
  };

  const copySubscriberId = async () => {
    try {
      if (subscriberIdDisplay === '—') return;
      await navigator.clipboard.writeText(subscriberIdDisplay);
      setCopiedSub(true);
      setTimeout(() => setCopiedSub(false), 1200);
    } catch {}
  };

  // Habilitamos envío si hay texto y algún método de contacto
  const canSend = hasContactMethod && !!input.trim() && !sending;

  return (
    <div className="flex flex-col h-full min-h-0 bg-white border-l border-gray-100/50">
      
      {/* === Header === */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-4 bg-white/80 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold shrink-0 shadow-sm">
            {client?.nombre?.trim()?.[0]?.toUpperCase() || 'C'}
          </div>
          
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 leading-tight truncate">
              {client?.nombre || 'Cliente sin nombre'}
            </h3>
            
            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 flex-wrap">
              {/* Phone Badge */}
              <div className="flex items-center gap-1 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                 <MessageCircle className="w-3 h-3 text-green-500" />
                 <span className="font-mono">{phone || '—'}</span>
                 {phone && (
                    <button onClick={copyPhone} className="ml-1 hover:text-indigo-600 transition-colors" title="Copiar">
                       {copiedPhone ? <Check className="w-3 h-3 text-green-600"/> : <Copy className="w-3 h-3"/>}
                    </button>
                 )}
              </div>

              {/* Sub ID Badge */}
              <div className="flex items-center gap-1 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                 <Fingerprint className="w-3 h-3 text-purple-500" />
                 <span className="font-mono max-w-[80px] truncate" title={subscriberIdDisplay}>{subscriberIdDisplay}</span>
                 <button 
                    onClick={copySubscriberId} 
                    className="ml-1 hover:text-indigo-600 transition-colors disabled:opacity-30" 
                    title="Copiar ID"
                    disabled={subscriberIdDisplay === '—'}
                 >
                    {copiedSub ? <Check className="w-3 h-3 text-green-600"/> : <Copy className="w-3 h-3"/>}
                 </button>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={loadConversation}
          disabled={!hasContactMethod || loading}
          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all disabled:opacity-50"
          title="Actualizar conversación"
        >
          <Repeat2 className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* === Messages Area === */}
      <div className="flex-1 relative overflow-hidden bg-[#F8F9FC]">
        <div
          ref={scrollRef}
          className="absolute inset-0 overflow-y-auto p-4 space-y-4 overscroll-contain"
        >
          {/* Alerta solo si NO hay forma de contacto */}
          {!hasContactMethod && (
            <div className="flex gap-3 p-3 rounded-xl bg-red-50 border border-red-100 text-red-800 text-sm mx-auto max-w-md shadow-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-500" />
              <div>
                <p className="font-bold">Contacto no disponible</p>
                <p className="text-red-700/80 text-xs mt-0.5">
                  Este cliente no tiene WhatsApp ni Subscriber ID. No es posible enviar mensajes.
                </p>
              </div>
            </div>
          )}

          {/* Loading & Empty States */}
          {loading && msgs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-400 animate-pulse">
               <div className="w-2 h-2 rounded-full bg-gray-300"></div>
               <span className="text-xs">Cargando mensajes...</span>
            </div>
          )}

          {error && (
            <div className="p-3 text-center text-xs text-red-600 bg-red-50 rounded-xl border border-red-100 mx-auto max-w-xs">
              {error}
            </div>
          )}

          {!loading && !error && msgs.length === 0 && hasContactMethod && (
             <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                <MessageCircle className="w-10 h-10 opacity-20" />
                <p className="text-sm">No hay mensajes aún</p>
             </div>
          )}

          {/* Lista de Mensajes */}
          {msgs.map((m) => (
            <ChatBubble key={m.id} msg={m} />
          ))}
          
          <div className="h-2"></div>
        </div>

        {/* Scroll To Bottom Button */}
        {showJumpToBottom && (
          <div className="absolute bottom-4 right-4 z-20 animate-in fade-in slide-in-from-bottom-2">
            <button
              onClick={() => scrollToBottom(true)}
              className="p-2 bg-white/90 backdrop-blur text-indigo-600 rounded-full shadow-lg border border-indigo-100 hover:bg-indigo-50 transition-all hover:scale-105 active:scale-95"
            >
              <ArrowDown className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* === Composer === */}
      <div className="p-4 bg-white border-t border-gray-100">
        <div className="relative flex flex-col gap-2">
           <form
              onSubmit={(e) => {
                e.preventDefault();
                if (canSend) sendMessage();
              }}
              className="relative"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={!hasContactMethod ? 'No se puede enviar mensajes...' : 'Escribe un mensaje...'}
                disabled={!hasContactMethod}
                className={`w-full bg-gray-50 border rounded-2xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all resize-none max-h-[150px]
                   ${!hasContactMethod
                      ? 'border-gray-200 text-gray-400 cursor-not-allowed' 
                      : 'border-gray-200 text-gray-900 focus:border-indigo-500 focus:ring-indigo-500/10 placeholder-gray-400'
                   }
                `}
                rows={1}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' && !e.shiftKey) || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
                    e.preventDefault();
                    if (canSend) sendMessage();
                  }
                }}
              />
              
              <div className="absolute right-2 bottom-2">
                 <button
                    type="submit"
                    disabled={!canSend}
                    className="p-2 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                      bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-md shadow-indigo-200
                    "
                 >
                    {sending ? (
                       <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                       <Send className="w-4 h-4" />
                    )}
                 </button>
              </div>
           </form>

           {/* Footer Info */}
           <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                 <span>Source:</span>
                 <span className="font-mono font-medium text-gray-600 bg-gray-50 px-1 rounded">
                    {source || 'Directo (auto)'}
                 </span>
              </div>
              <span className={`text-[10px] transition-colors ${input.length > 500 ? 'text-orange-500' : 'text-gray-300'}`}>
                 {input.length} chars
              </span>
           </div>
        </div>
      </div>
    </div>
  );
};