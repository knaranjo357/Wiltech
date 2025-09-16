export interface Client {
  row_number: number;
  whatsapp: string;
  estado_etapa: EstadoEtapa;
  categoria_contacto: CategoriaContacto;
  ciudad: string;
  nombre: string;
  intencion: string;
  modelo: string;
  detalles: string;
  buscar_precios_status: string;
  fecha_agenda: string;
  modo_recepcion: string;
  notas: string;
  servicios_adicionales: string;
  descuento_multi_reparacion: string;
  asignado_a: string;
  consentimiento_contacto: boolean | string;
}

export type EstadoEtapa = 
  | 'Nuevo' 
  | 'Cotizando' 
  | 'Agendado' 
  | 'En_taller' 
  | 'Entregado' 
  | 'Cerrado' 
  | 'Hater' 
  | 'Fan' 
  | 'Espia';

export type CategoriaContacto = 
  | 'Prospecto_frio' 
  | 'Prospecto_tibio' 
  | 'Prospecto_caliente' 
  | 'Cliente_nuevo' 
  | 'Soporte_postventa' 
  | 'No_alineado' 
  | 'Fan' 
  | 'Espia';

export type ViewMode = 'kanban' | 'cards' | 'list';

export type SortField = 'fecha_agenda' | 'nombre' | 'modelo' | 'estado_etapa' | 'categoria_contacto' | 'row_number';

export type SortOrder = 'asc' | 'desc';