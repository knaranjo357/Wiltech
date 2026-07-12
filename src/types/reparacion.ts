export interface ReparacionMultimedia {
  id: number | string;
  id_diagnostico?: number;
  field_key: string;
  archivo_url: string;
  nombre_archivo: string;
  mime_type?: string | null;
  descripcion?: string | null;
  created_at?: string;
}

export interface Reparacion {
  id: number;
  id_dispositivo: string;
  crm_row_number?: number | null;
  crm_whatsapp?: string | null;
  crm_source?: string | null;
  crm_data: Record<string, unknown>;
  numero_orden?: string | null;
  sede?: string | null;
  estado: string;
  prioridad: string;
  tecnico_asignado?: string | null;
  datos_dispositivo: Record<string, unknown>;
  detalle_reparacion: Record<string, unknown>;
  id_diagrama?: number | null;
  flow_name?: string | null;
  version_diagrama?: string | null;
  paso_actual?: string | null;
  estado_diagnostico: string;
  respuestas: Record<string, unknown>;
  multimedia: ReparacionMultimedia[];
  fecha_ingreso?: string;
  fecha_promesa?: string | null;
  fecha_entrega?: string | null;
  created_at?: string;
  updated_at?: string;
}
