import { Client, EstadoEtapa, CategoriaContacto } from '../types/client';

export const getEtapaColor = (etapa: EstadoEtapa): string => {
  const colors = {
    'Nuevo': 'bg-blue-100 text-blue-800 border-blue-200',
    'Cotizando': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Agendado': 'bg-purple-100 text-purple-800 border-purple-200',
    'En_taller': 'bg-orange-100 text-orange-800 border-orange-200',
    'Entregado': 'bg-green-100 text-green-800 border-green-200',
    'Cerrado': 'bg-gray-100 text-gray-800 border-gray-200',
    'Hater': 'bg-red-100 text-red-800 border-red-200',
    'Fan': 'bg-pink-100 text-pink-800 border-pink-200',
    'Espia': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  };
  return colors[etapa] || colors.Nuevo;
};

export const getCategoriaColor = (categoria: CategoriaContacto): string => {
  const colors = {
    'Prospecto_frio': 'bg-slate-100 text-slate-700',
    'Prospecto_tibio': 'bg-amber-100 text-amber-700',
    'Prospecto_caliente': 'bg-red-100 text-red-700',
    'Cliente_nuevo': 'bg-emerald-100 text-emerald-700',
    'Soporte_postventa': 'bg-cyan-100 text-cyan-700',
    'No_alineado': 'bg-gray-100 text-gray-700',
    'Fan': 'bg-pink-100 text-pink-700',
    'Espia': 'bg-violet-100 text-violet-700',
  };
  return colors[categoria] || colors.Prospecto_frio;
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  
  // Handle the format "2025-09-04 10:00"
  let date: Date;
  if (dateString.includes(' ')) {
    // Format: "2025-09-04 10:00"
    const [datePart, timePart] = dateString.split(' ');
    date = new Date(`${datePart}T${timePart}:00`);
  } else {
    date = new Date(dateString);
  }
  
  if (isNaN(date.getTime())) {
    return dateString; // Return original if can't parse
  }
  
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatWhatsApp = (whatsapp: string): string => {
  return whatsapp.replace('@s.whatsapp.net', '').replace('57', '+57 ');
};

export const isToday = (dateString: string): boolean => {
  if (!dateString) return false;
  const date = new Date(dateString.replace(' ', 'T'));
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

export const isTomorrow = (dateString: string): boolean => {
  if (!dateString) return false;
  const date = new Date(dateString.replace(' ', 'T'));
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return date.toDateString() === tomorrow.toDateString();
};

export const isYesterday = (dateString: string): boolean => {
  if (!dateString) return false;
  const date = new Date(dateString.replace(' ', 'T'));
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.toDateString() === yesterday.toDateString();
};

export const filterClients = (
  clients: Client[],
  filters: {
    search: string;
    categoria: CategoriaContacto | '';
    etapa: EstadoEtapa | '';
    dateFrom: string;
    dateTo: string;
  }
): Client[] => {
  return clients.filter(client => {
    const searchMatch = filters.search === '' || 
      client.nombre.toLowerCase().includes(filters.search.toLowerCase()) ||
      client.modelo.toLowerCase().includes(filters.search.toLowerCase()) ||
      client.whatsapp.includes(filters.search) ||
      client.notas.toLowerCase().includes(filters.search.toLowerCase());

    const categoriaMatch = filters.categoria === '' || client.categoria_contacto === filters.categoria;
    const etapaMatch = filters.etapa === '' || client.estado_etapa === filters.etapa;

    const dateMatch = (() => {
      if (!filters.dateFrom && !filters.dateTo) return true;
      if (!client.fecha_agenda) return false;
      
      const clientDate = new Date(client.fecha_agenda.includes(' ') 
        ? client.fecha_agenda.replace(' ', 'T') + ':00'
        : client.fecha_agenda
      );
      
      if (isNaN(clientDate.getTime())) return false;
      
      const fromMatch = !filters.dateFrom || clientDate >= new Date(filters.dateFrom);
      const toMatch = !filters.dateTo || clientDate <= new Date(filters.dateTo);
      
      return fromMatch && toMatch;
    })();

    return searchMatch && categoriaMatch && etapaMatch && dateMatch;
  });
};