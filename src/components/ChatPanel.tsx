import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Repeat2, Copy, Check, ArrowDown, MessageCircle, AlertTriangle, Fingerprint, MessageSquare, RefreshCw } from 'lucide-react';
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
    if (!hasWhatsapp && !rawSubscriberId) return; 

    try {
      setLoading(true);
      setError(null);
      const body: any = { whatsapp: client.whatsapp };
      
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
      console.error('Error cargando chat:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversation();
  }, [client?.whatsapp, source]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !hasContactMethod) return;

    stickToBottomRef.current = true;

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
      const finalSource = source || 'Directo';

      const body: any = {
        whatsapp: client.whatsapp,
        mensaje: text,
        source: finalSource,
      };

      if (rawSubscriberId !== null && rawSubscriberId !== undefined && rawSubscriberId !== '') {
         body.subscriber_id = rawSubscriberId;
      }

      await ApiService.post('/enviarmensaje', body);
      await loadConversation();
    } catch (e: any) {
      setError(e?.message || 'No se pudo enviar el mensaje');
      setMsgs((prev) => prev.filter((m) => m.id !== optimistic.id)); 
      setInput(text); 
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

  const canSend = hasContactMethod && !!input.trim() && !sending;

  return (
    <div className="flex-1 flex flex-col w-full h-full min-h-0 bg-white border-l border-slate-100 overflow-hidden relative">
      
      {/* Background Subtle Pattern */}
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4f46e5 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />

      {/* === Header === */}
      <div className="relative z-10 px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-white/70 backdrop-blur-xl">
        <div className="flex items-center gap-4 min-w-0">
          <div className="relative">
             <div className="absolute inset-0 bg-slate-800 blur-xl opacity-20" />
             <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-900 text-white flex items-center justify-center font-black shadow-xl shadow-indigo-100 relative z-10 border border-white/20">
               <span>{client?.nombre?.trim()?.[0]?.toUpperCase() || 'C'}</span>
             </div>
          </div>
          
          <div className="min-w-0">
            <h3 className="text-lg font-black text-slate-900 leading-tight truncate tracking-tight">
              {client?.nombre || 'Cliente sin nombre'}
            </h3>
            
            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500 font-black uppercase tracking-[0.1em] flex-wrap">
              {/* Phone Badge */}
              <div className="flex items-center gap-1.5 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-sm">
                 <MessageCircle className="w-3 h-3 text-emerald-500" />
                 <span className="font-mono">{phone || '—'}</span>
                 {phone && (
                    <button onClick={copyPhone} className="ml-1 hover:text-slate-800 transition-colors" title="Copiar">
                       {copiedPhone ? <Check className="w-3 h-3 text-emerald-600"/> : <Copy className="w-3 h-3"/>}
                    </button>
                 )}
              </div>

              {/* Sub ID Badge */}
              <div className="flex items-center gap-1.5 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-sm">
                 <Fingerprint className="w-3 h-3 text-slate-600" />
                 <span className="font-mono max-w-[100px] truncate" title={subscriberIdDisplay}>{subscriberIdDisplay}</span>
                 <button 
                    onClick={copySubscriberId} 
                    className="ml-1 hover:text-slate-800 transition-colors disabled:opacity-30" 
                    title="Copiar ID"
                    disabled={subscriberIdDisplay === '—'}
                 >
                    {copiedSub ? <Check className="w-3 h-3 text-emerald-600"/> : <Copy className="w-3 h-3"/>}
                 </button>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={loadConversation}
          disabled={!hasContactMethod || loading}
          className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-slate-800 hover:border-slate-200 shadow-sm transition-all active:scale-95 disabled:opacity-50"
          title="Actualizar conversación"
        >
          <Repeat2 className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* === Messages Area === */}
      <div className="flex-1 relative overflow-hidden bg-[#F8F9FC]/50 backdrop-blur-sm">
        <div
          ref={scrollRef}
          className="absolute inset-0 overflow-y-auto p-6 space-y-6 overscroll-contain custom-scrollbar"
        >
          {!hasContactMethod && (
            <div className="flex gap-4 p-5 rounded-3xl bg-red-50/80 backdrop-blur-sm border border-red-100 text-red-800 text-sm mx-auto max-w-md shadow-xl animate-in fade-in slide-in-from-top-4">
              <AlertTriangle className="w-6 h-6 shrink-0 text-red-500" />
              <div>
                <p className="font-black uppercase tracking-wider text-xs mb-1">Contacto no disponible</p>
                <p className="text-red-700/70 text-xs leading-relaxed">
                  Este cliente no cuenta con WhatsApp ni Subscriber ID configurado.
                </p>
              </div>
            </div>
          )}

          {loading && msgs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
               <div className="relative">
                  <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
                  <MessageCircle className="absolute inset-0 m-auto w-5 h-5 text-slate-700/50" />
               </div>
               <span className="text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Cargando Conversación</span>
            </div>
          )}

          {error && (
            <div className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-red-600 bg-red-50 rounded-2xl border border-red-100 mx-auto max-w-xs shadow-lg">
              {error}
            </div>
          )}

          {!loading && !error && msgs.length === 0 && hasContactMethod && (
             <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-4 py-20">
                <div className="w-20 h-20 rounded-[40px] bg-slate-100 flex items-center justify-center border border-white shadow-xl relative group">
                   <div className="absolute inset-0 bg-slate-800 blur-3xl opacity-0 group-hover:opacity-10 transition-opacity" />
                   <MessageSquare className="w-8 h-8 text-slate-200" />
                </div>
                <p className="text-xs font-black uppercase tracking-[0.2em]">No hay mensajes aún</p>
             </div>
          )}

          {msgs.map((m) => (
            <ChatBubble key={m.id} msg={m} />
          ))}
          
          <div className="h-4"></div>
        </div>

        {/* Scroll To Bottom Button */}
        {showJumpToBottom && (
          <div className="absolute bottom-6 right-6 z-20 animate-in fade-in slide-in-from-bottom-2">
            <button
              onClick={() => scrollToBottom(true)}
              className="w-11 h-11 flex items-center justify-center bg-slate-900 text-white rounded-2xl shadow-2xl hover:bg-slate-900 transition-all hover:-translate-y-1 active:scale-95 group"
            >
              <ArrowDown className="w-5 h-5 group-hover:animate-bounce" />
            </button>
          </div>
        )}
      </div>

      {/* === Composer === */}
      <div className="relative z-10 p-6 bg-white border-t border-slate-100">
        <div className="max-w-4xl mx-auto w-full relative">
           <div className="relative group transition-all duration-300">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={!hasContactMethod ? 'Canal de comunicación inactivo...' : 'Escribe tu respuesta aquí...'}
                disabled={!hasContactMethod}
                className={`w-full bg-slate-50 border rounded-3xl px-6 py-5 pr-20 text-[14px] leading-relaxed focus:outline-none focus:ring-4 focus:ring-slate-700/5 focus:bg-white focus:border-slate-600 transition-all resize-none max-h-[180px] font-medium
                   ${!hasContactMethod
                      ? 'border-slate-100 text-slate-300 cursor-not-allowed opacity-50' 
                      : 'border-slate-200 text-slate-900 placeholder-slate-400 shadow-sm'
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
              
              <div className="absolute right-3 bottom-3">
                 <button
                    type="button"
                    onClick={sendMessage}
                    disabled={!canSend}
                    className="w-12 h-12 flex items-center justify-center bg-slate-900 text-white hover:bg-slate-900 rounded-2xl transition-all duration-300 shadow-xl hover:shadow-slate-900/20 disabled:opacity-20 disabled:shadow-none active:scale-90"
                 >
                    {sending ? (
                       <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                       <Send className="w-5 h-5" />
                    )}
                 </button>
              </div>
           </div>

           {/* Footer Info */}
           <div className="flex items-center justify-between px-2 mt-4">
              <div className="flex items-center gap-3">
                 <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fuente:</span>
                    <span className="text-[10px] font-black text-slate-800 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200 shadow-sm">
                       {source || 'Autodetección'}
                    </span>
                 </div>
                 <div className="w-1 h-1 rounded-full bg-slate-200" />
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{input.length} caracteres</span>
              </div>
              
              {hasContactMethod && (
                 <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Chat Activo</span>
                 </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};