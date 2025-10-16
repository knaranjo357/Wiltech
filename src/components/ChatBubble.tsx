import React, { useMemo, useState } from 'react';
import { Copy, Check } from 'lucide-react';

export type ChatMsg = {
  id: string | number;
  type: 'human' | 'ai' | 'system';
  content: string;
  createdAt?: string | number | Date;
};

/** Escape seguro + linkify básico */
const escapeHtml = (raw: string) =>
  raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const linkify = (raw: string) => {
  // URLs http(s)://... y www.
  const urlRegex = /((https?:\/\/|www\.)[^\s<]+)/gi;
  return raw.replace(urlRegex, (url) => {
    const href = url.startsWith('http') ? url : `https://${url}`;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="underline decoration-1 decoration-[#4f46e5] hover:text-[#4338ca]">${escapeHtml(
      url
    )}</a>`;
  });
};

const renderRichText = (content: string) => {
  // soporta saltos de línea y enlaces
  const safe = escapeHtml(content);
  const withLinks = linkify(safe);
  // reemplazar saltos de línea por <br/>
  return withLinks.replace(/\n/g, '<br/>');
};

export const ChatBubble: React.FC<{ msg: ChatMsg }> = ({ msg }) => {
  const isAssistant = msg.type === 'ai';
  const isSystem = msg.type === 'system';

  const ts = msg.createdAt ? new Date(msg.createdAt) : null;
  const tsStr = ts ? ts.toLocaleString() : '';

  const [copied, setCopied] = useState(false);
  const html = useMemo(() => renderRichText(msg.content || ''), [msg.content]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  if (isSystem) {
    return (
      <div className="flex justify-center select-text">
        <div
          className="max-w-[90%] text-[11px] px-2 py-1 rounded-md border"
          // Colores fijos
          style={{
            background: '#F1F5F9', // slate-100
            color: '#475569', // slate-600
            borderColor: '#E2E8F0', // slate-200
          }}
        >
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isAssistant ? 'justify-end' : 'justify-start'} select-text`}>
      <div
        className={`group relative max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow border`}
        style={
          isAssistant
            ? {
                background: '#4F46E5', // indigo-600
                color: '#FFFFFF',
                borderColor: '#4F46E5',
              }
            : {
                background: '#FFFFFF',
                color: '#111827', // gray-900
                borderColor: '#E5E7EB', // gray-200
              }
        }
      >
        {/* Contenido enriquecido (enlaces) */}
        <div
          className="leading-relaxed break-words"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {/* Timestamp */}
        {tsStr && (
          <div
            className="mt-1 text-[10px]"
            style={{ color: isAssistant ? 'rgba(255,255,255,0.85)' : '#6B7280' }} // gray-500
            title={tsStr}
          >
            {tsStr}
          </div>
        )}

        {/* Copiar */}
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-2 -right-2 p-1 rounded-md shadow"
          style={{
            background: isAssistant ? '#4338CA' : '#F9FAFB', // indigo-700 / gray-50
            color: isAssistant ? '#FFFFFF' : '#374151', // white / gray-700
            border: '1px solid #E5E7EB',
          }}
          aria-label="Copiar mensaje"
          title="Copiar"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
