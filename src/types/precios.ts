export type CategoryType = 
  | 'IPHONE'
  | 'WATCH' 
  | 'PC'
  | 'IPAD'
  | 'UGREEN'
  | 'DIAGNOSTICO'
  | 'PELICULAS DE SEGURIDAD'
  | 'PRECIOS PARA REPARACIONES ELECT';

export interface PrecioItem {
  row_number: number;
  MODELO: string;
  [key: string]: any; // Para campos dinámicos como precios
}

export interface SystemMessage {
  row_number: number;
  system_message: string;
}