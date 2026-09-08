export interface FlowStepFieldOption {
  label: string;
  value: string | boolean | number;
}

export interface FlowStepField {
  key: string;
  type: 'text' | 'select' | 'textarea' | 'number' | 'multi_select' | 'seed_value' | 'multimedia';
  label: string;
  options?: FlowStepFieldOption[];
  required?: boolean;
  placeholder?: string;
}

export interface MatchCondition {
  op: 'equals' | 'in';
  field: string;
  value: any;
}

export interface FlowBranch {
  next: string;
  match: MatchCondition[];
}

export interface FlowStepItemField {
  key: string;
  type: string;
  label: string;
  options?: FlowStepFieldOption[];
  required?: boolean;
}

export interface FlowStep {
  id: string;
  next?: string;
  type: 'form' | 'decision' | 'repeater' | 'end';
  title: string;
  fields?: FlowStepField[];
  can_open_agent?: boolean;
  branches?: FlowBranch[];
  save_as?: string;
  item_label?: string;
  item_fields?: FlowStepItemField[];
  seed_from_field?: string;
  summary_fields?: string[];
}

export interface FlowConfig {
  name: string;
  steps: FlowStep[];
  flow_id: string;
  version: string;
  start_step: string;
}

export interface FlowData {
  pais_sede?: string;
  isNew?: boolean;
  id: number;
  created_at?: string;
  flow_name?: string;
  configuracion: FlowConfig;
}

export interface Diagnostico {
  id: number;
  id_reparacion: number;
  id_diagrama: number;
  flow_name: string;
  estado: 'en_progreso' | 'completado' | 'cancelado';
  paso_actual?: string | null;
  respuestas: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  multimedia?: DiagnosticoMultimedia[];
}

export interface DiagnosticoMultimedia {
  id: number;
  id_diagnostico: number;
  field_key: string;
  archivo_url: string;
  nombre_archivo: string;
  mime_type?: string | null;
  descripcion?: string | null;
  created_at?: string;
}

export interface EquipoSegunda {
  id: number;
  created_at?: string;
  equipo: string;
  modelo: string;
  componente: string;
  precio: string;
  nota: string | null;
}
