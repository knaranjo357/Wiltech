// src/components/ChatPanel.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Repeat2, Copy, Check, ArrowDown } from 'lucide-react';
import { Client } from '../types/client';
import { ApiService } from '../services/apiService';
// ⛔️ Sin SourceSelector
import { ChatBubble, ChatMsg } from './ChatBubble';

export type ChatPanelProps = {
  client: Client;
  /** Se envía automáticamente con cada request si viene definido */
  source: string | null | undefined;
};

const coerceNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'bigint') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Toma el valor "crudo" como venga del backend (string | number | bigint | null)
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

  // Valor crudo para MOSTRAR sin perder dígitos
  const rawSubscriberId = getRawSubscriberId(client);
  const subscriberIdDisplay =
    rawSubscriberId === null || rawSubscriberId === undefined || rawSubscriberId === ''
      ? '—'
      : String(rawSubscriberId);

  // Valor numérico para ENVIAR (como lo pides)
  const subscriberIdNumber = useMemo(() => coerceNumber(rawSubscriberId), [rawSubscriberId]);

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
      const atBottom = distance < 8;
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
    ta.style.height = '0px';
    ta.style.height = Math.min(200, ta.scrollHeight) + 'px';
  }, [input]);

  // --- Cargar historial SIEMPRE por WhatsApp ---
  const loadConversation = async () => {
    if (!hasWhatsapp) return; // sin wpp no hay historial visualizable
    try {
      setLoading(true);
      setError(null);
      const body: any = { whatsapp: client.whatsapp };
      if (source) body.source = source;

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
      setError(e?.message || 'No se pudo cargar la conversación');
    } finally {
      setLoading(false);
    }
  };

  // Cargar historial (por whatsapp)
  useEffect(() => {
    loadConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.whatsapp, source]);

  // --- Enviar (requiere subscriber_id numérico) ---
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || subscriberIdNumber == null) return;

    stickToBottomRef.current = true;

    const optimistic: ChatMsg = {
      id: `local-${Date.now()}`,
      type: 'ai', // si quieres que salga como humano, cambia a 'human'
      content: text,
      createdAt: Date.now(),
    };
    setMsgs((prev) => [...prev, optimistic]);
    setInput('');
    setSending(true);
    setError(null);

    try {
      // ⬇️ Incluir whatsapp en el body (además del subscriber_id y el source)
      const body: any = {
        subscriber_id: subscriberIdNumber,
        whatsapp: client.whatsapp, // ✅ agregado
        mensaje: text,
      };
      if (source) body.source = source;

      await ApiService.post('/enviarmensaje', body);
      await loadConversation();
    } catch (e: any) {
      setError(e?.message || 'No se pudo enviar el mensaje');
      setMsgs((prev) => prev.filter((m) => m !== optimistic));
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

  const canSend = subscriberIdNumber != null && !!input.trim() && !sending;

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: '#FFFFFF' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 px-3 py-2 border-b shrink-0"
        style={{ background: '#FFFFFF', borderColor: '#E5E7EB' }}
      >
        <div className="flex items-center gap-2 text-sm" style={{ color: '#6B7280' }}>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-semibold"
            style={{ background: '#EEF2FF', color: '#3730A3', border: '1px solid #E0E7FF' }}
            title="Cliente"
          >
            {client?.nombre?.trim()?.[0]?.toUpperCase() || 'C'}
          </div>
          <div className="leading-tight">
            <div className="font-medium" style={{ color: '#111827' }}>
              {client?.nombre || 'Cliente'}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono">wpp: {phone || '—'}</span>
              {phone && (
                <button
                  onClick={copyPhone}
                  className="p-1 rounded-md"
                  style={{ border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151' }}
                  title="Copiar teléfono"
                >
                  {copiedPhone ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
              <span className="font-mono">subscriber_id: {subscriberIdDisplay}</span>
              <button
                onClick={copySubscriberId}
                className="p-1 rounded-md"
                style={{ border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151' }}
                title={subscriberIdDisplay === '—' ? 'Sin subscriber_id' : 'Copiar subscriber_id'}
                disabled={subscriberIdDisplay === '—'}
              >
                {copiedSub ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Recargar historial: habilitado si hay whatsapp */}
        <div className="flex items-center gap-2">
          <button
            onClick={loadConversation}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm"
            style={{ border: '1px solid #D1D5DB', background: '#FFFFFF', color: '#374151' }}
            title="Recargar"
            disabled={!hasWhatsapp}
          >
            <Repeat2 className="w-4 h-4" /> Actualizar
          </button>
        </div>
      </div>

      {/* Mensajes */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 overscroll-contain"
        style={{ background: '#F6F7FB' }}
        aria-live="polite"
      >
        {!hasWhatsapp && (
          <div
            className="mx-auto max-w-md w-full p-3 rounded-lg text-sm mb-2"
            style={{ border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#B91C1C' }}
          >
            No hay <b>whatsapp</b> disponible para cargar la conversación.
          </div>
        )}

        {subscriberIdNumber == null && hasWhatsapp && (
          <div
            className="mx-auto max-w-md w-full p-3 rounded-lg text-sm mb-2"
            style={{ border: '1px solid #F59E0B', background: '#FFFBEB', color: '#92400E' }}
          >
            Visualizando historial por <b>WhatsApp</b>. Para <b>enviar</b> mensajes necesitas un
            <b> subscriber_id</b> válido.
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-6 text-sm" style={{ color: '#6B7280' }}>
            Cargando conversación…
          </div>
        )}

        {error && (
          <div
            className="mx-auto max-w-md w-full p-3 rounded-lg text-sm"
            style={{ border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#B91C1C' }}
          >
            {error}
          </div>
        )}

        {!loading && !error && msgs.length === 0 && hasWhatsapp && (
          <div
            className="mx-auto max-w-md w-full p-3 rounded-lg text-sm"
            style={{ border: '1px solid #E5E7EB', background: '#FFFFFF', color: '#374151' }}
          >
            No hay mensajes todavía. ¡Envía el primero!
          </div>
        )}

        {msgs.map((m) => (
          <ChatBubble key={m.id} msg={m} />
        ))}

        {showJumpToBottom && (
          <div className="sticky bottom-3 flex justify-end">
            <button
              onClick={() => scrollToBottom(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm shadow border"
              style={{ background: '#FFFFFF', borderColor: '#E5E7EB', color: '#374151' }}
              title="Saltar al final"
            >
              <ArrowDown className="w-4 h-4" />
              Al final
            </button>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="p-3 border-t shrink-0" style={{ borderColor: '#E5E7EB', background: '#FFFFFF' }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSend) sendMessage();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              subscriberIdNumber == null
                ? 'Solo lectura (requiere subscriber_id para enviar)…'
                : 'Escribe un mensaje…'
            }
            className="flex-1 resize-none rounded-xl px-3 py-2 focus:outline-none"
            rows={1}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' && !e.shiftKey) || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
                e.preventDefault();
                if (canSend) sendMessage();
              }
            }}
            style={{
              border: '1px solid #D1D5DB',
              background: '#FFFFFF',
              color: '#111827',
              boxShadow: '0 0 0 0px transparent',
            }}
            onFocus={(e) => (e.currentTarget.style.boxShadow = '0 0 0 2px #4F46E533')}
            onBlur={(e) => (e.currentTarget.style.boxShadow = '0 0 0 0px transparent')}
          />
          <button
            type="submit"
            disabled={!canSend}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{
              background: '#4F46E5',
              color: '#FFFFFF',
              opacity: !canSend ? 0.6 : 1,
            }}
            title={subscriberIdNumber == null ? 'Requiere subscriber_id para enviar' : 'Enviar'}
          >
            <Send className="w-4 h-4" />
            Enviar
          </button>
        </form>

        <div className="mt-1 text-[11px]">
          <span style={{ color: '#6B7280' }}>Source (auto): </span>
          <span className="font-semibold" style={{ color: '#111827' }}>
            {source || '—'}
          </span>
          <span className="ml-3" style={{ color: '#9CA3AF' }}>
            {input.trim().length} caracteres
          </span>
        </div>
      </div>
    </div>
  );
};
