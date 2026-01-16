import { AuthService } from './authService';

export interface UserData {
  id: number;
  email: string;
  rol: string;
  ciudad: string | null; // Lo mantenemos en la interfaz aunque no lo mostremos
  created_at?: string;
}

// Params para MODIFICAR datos generales (sin password)
export interface ModifyUserParams {
  id: number;
  email: string;
  rol: string;
  ciudad?: string; // Opcional
}

// Params para CREAR usuario
export interface CreateUserParams {
  email: string;
  password: string;
  rol: string;
}

// Params para CAMBIAR CONTRASEÑA
export interface ChangePasswordParams {
  id: number;
  password: string;
}

const API_BASE = 'https://n8n.alliasoft.com/webhook/wiltech';

export class UserService {
  
  // 1. Obtener todos los usuarios
  static async getAllUsers(): Promise<UserData[]> {
    const token = AuthService.getToken();
    const res = await fetch(`${API_BASE}/usuarios`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) throw new Error('Error al obtener usuarios');
    return await res.json();
  }

  // 2. Crear Usuario (Nuevo)
  static async createUser(params: CreateUserParams): Promise<any> {
    const token = AuthService.getToken();
    const formData = new FormData();
    
    formData.append('email', params.email);
    formData.append('password', params.password);
    formData.append('rol', params.rol); // String separado por comas
    // No enviamos ciudad en creación según el ejemplo curl

    const res = await fetch(`${API_BASE}/usuarios`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData
    });

    if (!res.ok) throw new Error('Error al crear usuario');
    // La respuesta a veces es texto o json, manejamos ambos
    return await res.text(); 
  }

  // 3. Modificar Usuario (Sin password)
  static async modifyUser(params: ModifyUserParams): Promise<any> {
    const token = AuthService.getToken();
    const formData = new FormData();

    formData.append('id', params.id.toString());
    formData.append('email', params.email);
    formData.append('rol', params.rol);
    // Enviamos ciudad vacía si no viene, para cumplir con el formulario si el backend lo pide
    formData.append('ciudad', params.ciudad || ''); 

    const res = await fetch(`${API_BASE}/modificar-usuarios`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData
    });

    if (!res.ok) throw new Error('Error al modificar usuario');
    return await res.text();
  }

  // 4. Cambiar Contraseña (Nuevo Endpoint)
  static async changePassword(params: ChangePasswordParams): Promise<any> {
    const token = AuthService.getToken();
    const formData = new FormData();

    formData.append('id', params.id.toString());
    formData.append('password', params.password);

    const res = await fetch(`${API_BASE}/modificar-usuariospwd`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData
    });

    if (!res.ok) throw new Error('Error al cambiar contraseña');
    return await res.text();
  }
}