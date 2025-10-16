import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Repeat2, Copy, Check } from 'lucide-react';
import { Client } from '../types/client';
import { ApiService } from '../services/apiService';
import { SourceSelector } from './SourceSelector';
import { ChatBubble, ChatMsg } from './ChatBubble';

export type ChatPanelProps = {
  client: Client;
  source: string | null | undefined;
  onSourceChange: (s: string) => void;
};

export const ChatPanel: React.FC<ChatPanelProps> = ({ client, source, onSourceChange }) => {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const phone = useMemo(
    () => (client?.whatsapp || '').replace('@s.whatsapp.net', ''),
    [client?.whatsapp]
  );

  const autoScroll = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };
  useEffect(() => {
    autoScroll();
  }, [msgs]);

  const autoResize = () => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = '0px';
    ta.style.height = Math.min(200, ta.scrollHeight) + 'px';
  };
  useEffect(() => autoResize(), [input]);

  const loadConversation = async () => {
    if (!client?.whatsapp) return;
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
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar la conversación');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.whatsapp, source]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !client?.whatsapp) return;
    const optimistic: ChatMsg = { id: `local-${Date.now()}`, type: 'ai', content: text, createdAt: Date.now() };
    setMsgs((prev) => [...prev, optimistic]);
    setInput('');
    setSending(true);
    setError(null);
    try {
      const body: any = { whatsapp: client.whatsapp, mensaje: text };
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
  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 1200);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col"
      style={{ background: '#FFFFFF' }} // fondo fijo
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 px-3 py-2 border-b"
        style={{
          background: '#FFFFFF',
          borderColor: '#E5E7EB', // gray-200
        }}
      >
        <div className="flex items-center gap-2 text-sm" style={{ color: '#6B7280' }}>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-semibold"
            style={{ background: '#EEF2FF', color: '#3730A3', border: '1px solid #E0E7FF' }} // indigo-50/800
            title="Cliente"
          >
            {client?.nombre?.trim()?.[0]?.toUpperCase() || 'C'}
          </div>
          <div className="leading-tight">
            <div className="font-medium" style={{ color: '#111827' }}>
              {client?.nombre || 'Cliente'}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono">{phone || '—'}</span>
              <button
                onClick={copyPhone}
                className="p-1 rounded-md"
                style={{ border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151' }}
                title="Copiar teléfono"
              >
                {copiedPhone ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SourceSelector value={source ?? ''} onChange={onSourceChange} compact />
          <button
            onClick={loadConversation}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm"
            style={{
              border: '1px solid #D1D5DB', // gray-300
              background: '#FFFFFF',
              color: '#374151',
            }}
            title="Recargar"
          >
            <Repeat2 className="w-4 h-4" /> Actualizar
          </button>
        </div>
      </div>

      {/* Mensajes */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
        style={{ background: '#F6F7FB' }} // fondo conversación fijo
        aria-live="polite"
      >
        {loading && (
          <div className="flex items-center justify-center py-6 text-sm" style={{ color: '#6B7280' }}>
            Cargando conversación…
          </div>
        )}

        {error && (
          <div
            className="mx-auto max-w-md w-full p-3 rounded-lg text-sm"
            style={{
              border: '1px solid #FCA5A5', // red-300
              background: '#FEF2F2', // red-50
              color: '#B91C1C', // red-700
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && msgs.length === 0 && (
          <div
            className="mx-auto max-w-md w-full p-3 rounded-lg text-sm"
            style={{
              border: '1px solid #E5E7EB',
              background: '#FFFFFF',
              color: '#374151',
            }}
          >
            No hay mensajes todavía. ¡Envía el primero!
          </div>
        )}

        {msgs.map((m) => (
          <ChatBubble key={m.id} msg={m} />
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t" style={{ borderColor: '#E5E7EB', background: '#FFFFFF' }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!sending && input.trim()) sendMessage();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe un mensaje…"
            className="flex-1 resize-none rounded-xl px-3 py-2 focus:outline-none"
            rows={1}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' && !e.shiftKey) || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
                e.preventDefault();
                if (!sending && input.trim()) sendMessage();
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
            disabled={sending || !input.trim()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{
              background: '#4F46E5', // indigo-600
              color: '#FFFFFF',
              opacity: sending || !input.trim() ? 0.6 : 1,
            }}
            title="Enviar"
          >
            <Send className="w-4 h-4" />
            Enviar
          </button>
        </form>

        <div className="mt-1 text-[11px]">
          <span style={{ color: '#6B7280' }}>Source: </span>
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
