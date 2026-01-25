// src/components/ChatBubble.tsx
import React, { useMemo, useState } from 'react';
import { Copy, Check, Bot, User, CheckCheck } from 'lucide-react';

export type ChatMsg = {
  id: string | number;
  type: 'human' | 'ai' | 'system'; // human = cliente, ai = nosotros (agente/bot)
  content: string;
  createdAt?: string | number | Date;
};

/** --- Helpers de Texto y Fecha --- */

const escapeHtml = (raw: string) =>
  raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const linkify = (raw: string, isMyMessage: boolean) => {
  const urlRegex = /((https?:\/\/|www\.)[^\s<]+)/gi;
  // Si es mi mensaje (fondo oscuro), enlaces blancos/claros. Si es cliente, azules.
  const linkClass = isMyMessage
    ? "text-blue-100 underline hover:text-white transition-colors decoration-blue-300/50"
    : "text-blue-600 underline hover:text-blue-800 transition-colors decoration-blue-200";

  return raw.replace(urlRegex, (url) => {
    const href = url.startsWith('http') ? url : `https://${url}`;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="${linkClass} font-medium break-all">${escapeHtml(url)}</a>`;
  });
};

const formatTime = (date?: string | number | Date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(d);
};

export const ChatBubble: React.FC<{ msg: ChatMsg }> = ({ msg }) => {
  // Determinamos roles
  const isAgent = msg.type === 'ai';     // Derecha (Nosotros)
  const isHuman = msg.type === 'human';  // Izquierda (Cliente)
  const isSystem = msg.type === 'system'; // Centro

  const [copied, setCopied] = useState(false);

  // Procesamos HTML (Links y saltos de línea)
  const htmlContent = useMemo(() => {
    const safeText = escapeHtml(msg.content || '');
    const linkedText = linkify(safeText, isAgent);
    return linkedText.replace(/\n/g, '<br/>');
  }, [msg.content, isAgent]);

  const timeStr = useMemo(() => formatTime(msg.createdAt), [msg.createdAt]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  /* ------------------------------------------------------------
     1. MENSAJES DE SISTEMA (Centrados, tipo "Log")
  ------------------------------------------------------------ */
  if (isSystem) {
    return (
      <div className="flex justify-center my-4 opacity-75">
        <span className="bg-gray-100 text-gray-500 text-[11px] font-medium px-3 py-1 rounded-full border border-gray-200 shadow-sm uppercase tracking-wide">
          {msg.content}
        </span>
      </div>
    );
  }

  /* ------------------------------------------------------------
     2. BURBUJAS DE CHAT (Human vs AI)
  ------------------------------------------------------------ */
  return (
    <div 
      className={`flex w-full group animate-in fade-in slide-in-from-bottom-2 duration-300 ${
        isAgent ? 'justify-end' : 'justify-start'
      }`}
    >
      {/* Container principal de la fila */}
      <div className={`flex max-w-[85%] sm:max-w-[75%] gap-2 ${isAgent ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* AVATAR (Icono lateral) */}
        <div className="shrink-0 flex flex-col justify-end pb-1">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center shadow-sm border
            ${isAgent 
              ? 'bg-indigo-100 border-indigo-200 text-indigo-700' 
              : 'bg-white border-gray-200 text-gray-600'
            }`}
          >
            {isAgent ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
          </div>
        </div>

        {/* BURBUJA DE TEXTO */}
        <div className="relative flex flex-col">
          <div
            className={`relative px-4 py-2.5 shadow-sm text-sm leading-relaxed break-words border
              ${isAgent
                ? 'bg-indigo-600 text-white border-indigo-600 rounded-2xl rounded-br-sm' // Burbuja derecha
                : 'bg-white text-gray-800 border-gray-200 rounded-2xl rounded-bl-sm'   // Burbuja izquierda
              }
            `}
          >
            {/* Contenido */}
            <div dangerouslySetInnerHTML={{ __html: htmlContent }} />

            {/* Hora y Status dentro de la burbuja */}
            <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] select-none
               ${isAgent ? 'text-indigo-200' : 'text-gray-400'}
            `}>
               <span>{timeStr}</span>
               {isAgent && (
                 <CheckCheck className="w-3 h-3 opacity-80" />
               )}
            </div>
          </div>

          {/* BOTÓN COPIAR (Aparece fuera de la burbuja al hacer hover) */}
          <button
            onClick={handleCopy}
            className={`absolute top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white border border-gray-100 shadow-md text-gray-500 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:text-indigo-600 hover:scale-110 z-10
              ${isAgent ? '-left-10' : '-right-10'}
            `}
            title="Copiar texto"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

      </div>
    </div>
  );
};