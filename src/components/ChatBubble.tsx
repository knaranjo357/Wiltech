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
      <div className="flex justify-center my-6 opacity-80 animate-in fade-in zoom-in-95 duration-500">
        <span className="bg-slate-100/80 backdrop-blur-sm text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border border-slate-200/50 shadow-sm">
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
      className={`flex w-full group animate-in fade-in slide-in-from-bottom-3 duration-500 ${
        isAgent ? 'justify-end' : 'justify-start'
      }`}
    >
      {/* Container principal de la fila */}
      <div className={`flex max-w-[85%] sm:max-w-[70%] gap-3 ${isAgent ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* AVATAR (Icono lateral) */}
        <div className="shrink-0 flex flex-col justify-end pb-1">
          <div className={`w-8 h-8 rounded-2xl flex items-center justify-center shadow-lg border transition-transform group-hover:scale-110
            ${isAgent 
              ? 'bg-gradient-to-br from-indigo-500 to-indigo-700 border-indigo-400/30 text-white' 
              : 'bg-white border-slate-200 text-slate-400'
            }`}
          >
            {isAgent ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
          </div>
        </div>

        {/* BURBUJA DE TEXTO */}
        <div className="relative flex flex-col">
          <div
            className={`relative px-5 py-3.5 shadow-xl text-[14px] leading-[1.6] break-words border transition-all
              ${isAgent
                ? 'bg-slate-900 text-white border-slate-800 rounded-[20px] rounded-br-[4px] shadow-slate-200/50' 
                : 'bg-white text-slate-700 border-slate-100 rounded-[20px] rounded-bl-[4px] shadow-slate-100/50'   
              }
            `}
          >
            {/* Contenido */}
            <div 
              className="font-medium tracking-tight"
              dangerouslySetInnerHTML={{ __html: htmlContent }} 
            />

            {/* Hora y Status dentro de la burbuja */}
            <div className={`flex items-center justify-end gap-1.5 mt-2 text-[10px] font-bold uppercase tracking-wider select-none
               ${isAgent ? 'text-indigo-300/80' : 'text-slate-400'}
            `}>
               <span>{timeStr}</span>
               {isAgent && (
                 <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
               )}
            </div>
          </div>

          {/* BOTÓN COPIAR (Aparece al hacer hover) */}
          <button
            onClick={handleCopy}
            className={`absolute top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-2xl bg-white border border-slate-200 shadow-xl text-slate-400 opacity-0 group-hover:opacity-100 transition-all duration-300 hover:text-indigo-600 hover:scale-110 active:scale-95 z-10
              ${isAgent ? '-left-12' : '-right-12'}
            `}
            title="Copiar texto"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

      </div>
    </div>
  );
};