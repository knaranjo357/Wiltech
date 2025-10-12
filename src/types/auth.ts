// types/auth.ts
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  // El backend puede devolver estos campos directamente...
  role?: string;
  locations?: Array<string | { id?: string; name?: string }>;
  // ...o podrían venir en el JWT (payload). Los sacamos si no llegan aquí.
}

export interface User {
  email: string;
  token: string;
  role?: string;
  locations?: Array<string | { id?: string; name?: string }>;
}
