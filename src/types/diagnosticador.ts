export interface FlowStepFieldOption {
  label: string;
  value: string | boolean | number;
}

export interface FlowStepField {
  key: string;
  type: 'text' | 'select' | 'textarea' | 'number' | 'multi_select' | 'seed_value';
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
  id: number;
  created_at?: string;
  configuracion: FlowConfig;
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
