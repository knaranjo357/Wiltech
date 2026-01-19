import React, { useMemo, useState } from 'react';
import { Copy, Check, Bot, User } from 'lucide-react';

export type ChatMsg = {
  id: string | number;
  type: 'human' | 'ai' | 'system';
  content: string;
  createdAt?: string | number | Date;
};

/** Escape seguro */
const escapeHtml = (raw: string) =>
  raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** Linkify con clases dinámicas según el tipo de burbuja */
const linkify = (raw: string, linkClasses: string) => {
  const urlRegex = /((https?:\/\/|www\.)[^\s<]+)/gi;
  return raw.replace(urlRegex, (url) => {
    const href = url.startsWith('http') ? url : `https://${url}`;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="${linkClasses}">${escapeHtml(
      url
    )}</a>`;
  });
};

const renderRichText = (content: string, isAssistant: boolean) => {
  const safe = escapeHtml(content);
  // Enlaces blancos para el asistente (fondo oscuro), azules para el humano (fondo claro)
  const linkClasses = isAssistant 
    ? "underline decoration-white/50 hover:text-white font-medium break-all"
    : "underline decoration-indigo-400 text-indigo-600 hover:text-indigo-800 font-medium break-all";
    
  const withLinks = linkify(safe, linkClasses);
  return withLinks.replace(/\n/g, '<br/>');
};

const formatTime = (date?: string | number | Date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(d);
};

export const ChatBubble: React.FC<{ msg: ChatMsg }> = ({ msg }) => {
  const isAssistant = msg.type === 'ai'; // Mensajes enviados por nosotros (Derecha)
  const isSystem = msg.type === 'system';
  const isHuman = msg.type === 'human';  // Mensajes recibidos del cliente (Izquierda)

  const [copied, setCopied] = useState(false);
  
  const html = useMemo(() => 
    renderRichText(msg.content || '', isAssistant), 
  [msg.content, isAssistant]);

  const timeStr = useMemo(() => formatTime(msg.createdAt), [msg.createdAt]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  // --- RENDERING: MENSAJE DE SISTEMA ---
  if (isSystem) {
    return (
      <div className="flex justify-center my-3 select-none animate-in fade-in duration-300">
        <span className="bg-slate-100 text-slate-500 text-[10px] font-medium px-3 py-1 rounded-full border border-slate-200 shadow-sm flex items-center gap-1.5">
          {msg.content}
        </span>
      </div>
    );
  }

  // --- RENDERING: CHAT BUBBLES ---
  return (
    <div className={`flex w-full ${isAssistant ? 'justify-end' : 'justify-start'} group mb-1`}>
      <div 
        className={`relative max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm transition-all duration-200
          ${isAssistant 
            ? 'bg-indigo-600 text-white rounded-br-sm shadow-indigo-100' 
            : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm shadow-gray-100'
          }
        `}
      >
        {/* Icono pequeño visual (opcional) */}
        <div className={`absolute -top-1.5 ${isAssistant ? '-right-1.5' : '-left-1.5'} w-4 h-4 rounded-full flex items-center justify-center text-[8px] border opacity-0 group-hover:opacity-100 transition-opacity duration-300
           ${isAssistant 
             ? 'bg-indigo-500 border-indigo-400 text-white' 
             : 'bg-gray-100 border-gray-200 text-gray-500'}
        `}>
           {isAssistant ? <Bot className="w-2.5 h-2.5"/> : <User className="w-2.5 h-2.5"/>}
        </div>

        {/* Botón Copiar Flotante */}
        <button
          onClick={handleCopy}
          className={`absolute opacity-0 group-hover:opacity-100 transition-all duration-200 p-1.5 rounded-lg shadow-sm border
            ${isAssistant 
               ? 'top-2 -left-10 bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-50' 
               : 'top-2 -right-10 bg-white text-gray-500 border-gray-100 hover:bg-gray-50'
            }
          `}
          title="Copiar texto"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>

        {/* Contenido HTML */}
        <div
          className="leading-relaxed break-words font-normal"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {/* Timestamp */}
        <div className={`mt-1.5 flex items-center gap-1 text-[10px] select-none
           ${isAssistant ? 'justify-end text-indigo-100/80' : 'justify-start text-gray-400'}
        `}>
           {timeStr}
           {isAssistant && (
             // Doble check simulado para mensajes enviados
             <span className="ml-0.5 opacity-80">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M12.293 4.293a1 1 0 0 1 1.414 1.414l-7 7a1 1 0 0 1-1.414 0l-3-3a1 1 0 1 1 1.414-1.414L6 10.586l6.293-6.293z"/></svg>
             </span>
           )}
        </div>
      </div>
    </div>
  );
};