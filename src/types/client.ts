// types/clients.ts (o ../types/client.ts)

export type Nullable<T> = T | '' | null | undefined;

export type ViewMode = 'kanban' | 'cards' | 'list';

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
  | 'Hater'
  | 'Fan'
  | 'Espia';

export type ModoRecepcion = 'Tienda' | 'Envío';

export type SortField =
  | 'fecha_agenda'
  | 'nombre'
  | 'modelo'
  | 'estado_etapa'
  | 'categoria_contacto'
  | 'row_number';

export type SortOrder = 'asc' | 'desc';

export interface Client {
  row_number: number;
  /** Puede venir como JID (xxx@s.whatsapp.net), número plano o UUID */
  whatsapp: string;

  estado_etapa: Nullable<EstadoEtapa>;
  categoria_contacto: Nullable<CategoriaContacto>;

  ciudad: Nullable<string>;
  nombre: Nullable<string>;
  intencion: Nullable<string>;
  modelo: Nullable<string>;
  detalles: Nullable<string>;

  buscar_precios_status: Nullable<string>;
  /** "YYYY-MM-DD HH:mm" (America/Bogota) o vacío */
  fecha_agenda: Nullable<string>;
  modo_recepcion: Nullable<ModoRecepcion>;
  notas: Nullable<string>;

  servicios_adicionales: Nullable<string>;
  /** Porcentaje 0–100 como texto según tu backend */
  descuento_multi_reparacion: Nullable<string>;
  asignado_a: Nullable<string>;

  /** Compat: true = on; '', null también los tratas como on en UI */
  consentimiento_contacto: boolean | '' | null;

  // ===== Campos nuevos del webhook =====
  diagnostico_requerido: Nullable<string>;
  equipo_manipulado: Nullable<string>;

  precio_diagnostico_informado: Nullable<string>;
  precio_reparacion_estimado: Nullable<string>;
  precio_maximo_informado: Nullable<string>;

  interes_accesorios: Nullable<string>;
  notas_cliente: Nullable<string>;
  observaciones_tecnicas: Nullable<string>;
  agenda_ciudad_sede: Nullable<string>;

  // ===== Datos de guía/envío =====
  guia_nombre_completo: Nullable<string>;
  guia_cedula_id: Nullable<string>;
  guia_telefono: Nullable<string>;
  guia_direccion: Nullable<string>;
  guia_ciudad: Nullable<string>;
  guia_departamento_estado: Nullable<string>;
  guia_email: Nullable<string>;
  guia_numero_ida: Nullable<string>;
  guia_numero_retorno: Nullable<string>;

  asegurado: Nullable<string>;
  valor_seguro: Nullable<string | number>;
  created: Nullable<string>;
}
