import { countryFetch } from './countryRequest';
import { AuthService } from './authService';
import { CountryService } from './countryService';
import { canAssignCountryRole, parseCountryConfig } from '../utils/countryConfig';

export interface UserData {
  pais_sede?: string;
  id: number;
  email: string;
  rol: string;
  ciudad: string | null; // Lo mantenemos en la interfaz aunque no lo mostremos
  created_at?: string;
}

// Params para MODIFICAR datos generales (sin password)
export interface ModifyUserParams {
  pais_sede?: string;
  id: number;
  email: string;
  rol: string;
  ciudad?: string; // Opcional
}

// Params para CREAR usuario
export interface CreateUserParams {
  pais_sede?: string;
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
  private static async validateRoles(roles: string, existingRoles = '') {
    if (!AuthService.isRoot() && roles.split(',').some(role => role.trim().toLowerCase() === 'root')) {
      throw new Error('Solo root puede asignar el rol root.');
    }
    if (AuthService.isRoot()) return;
    const record = await CountryService.get(true);
    const config = parseCountryConfig(record?.configuracion, AuthService.getPaisSede());
    const existing = existingRoles.split(',').map(role => role.trim().toLowerCase());
    const requested = roles.split(',').map(role => role.trim().toLowerCase()).filter(Boolean);
    if (requested.some(role => !existing.includes(role) && !canAssignCountryRole(role, false, config))) {
      throw new Error('No puedes asignar permisos de módulos deshabilitados para tu país.');
    }
  }

  private static assignedCountries(raw: string): string {
    const countries = AuthService.parseCountries(raw);
    if (!countries.length || countries.some(country => !AuthService.getAllowedCountries().includes(country))) {
      throw new Error('Selecciona países autorizados.');
    }
    return countries.join(',');
  }

  static canEdit(user: UserData): boolean {
    return AuthService.isRoot() || !user.rol.split(',').some(role => role.trim().toLowerCase() === 'root');
  }

  private static async editableUser(id: number): Promise<UserData> {
    const user = (await this.getAllUsers()).find(user => user.id === id);
    if (!user || !this.canEdit(user)) throw new Error('No tienes permiso para modificar este usuario.');
    return user;
  }
  
  // 1. Obtener todos los usuarios
  static async getAllUsers(): Promise<UserData[]> {
    const token = AuthService.getToken();
    const res = await countryFetch(`${API_BASE}/usuarios`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) throw new Error('Error al obtener usuarios');
    const data: UserData[] = await res.json();
    return data.filter(user => AuthService.parseCountries(user.pais_sede).includes(AuthService.getPaisSede()));
  }

  // 2. Crear Usuario (Nuevo)
  static async createUser(params: CreateUserParams): Promise<any> {
    await this.validateRoles(params.rol);
    const countries = AuthService.isRoot() ? this.assignedCountries(params.pais_sede ?? AuthService.getPaisSede()) : AuthService.getPaisSede();
    if (!AuthService.isRoot() && params.pais_sede !== undefined && params.pais_sede !== countries) throw new Error('Solo root puede asignar países.');
    const token = AuthService.getToken();
    const formData = new FormData();
    
    formData.append('email', params.email);
    formData.append('password', params.password);
    formData.append('rol', params.rol); // String separado por comas
    formData.append('pais_sede', countries);
    // No enviamos ciudad en creación según el ejemplo curl

    const res = await countryFetch(`${API_BASE}/usuarios`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData
    }, true);

    if (!res.ok) throw new Error('Error al crear usuario');
    // La respuesta a veces es texto o json, manejamos ambos
    return await res.text(); 
  }

  // 3. Modificar Usuario (Sin password)
  static async modifyUser(params: ModifyUserParams): Promise<any> {
    const existing = await this.editableUser(params.id);
    await this.validateRoles(params.rol, existing.rol);
    const countries = AuthService.isRoot() ? this.assignedCountries(params.pais_sede ?? existing.pais_sede ?? '') : AuthService.parseCountries(existing.pais_sede).join(',');
    if (!AuthService.isRoot() && params.pais_sede !== undefined && params.pais_sede !== countries) throw new Error('Solo root puede asignar países.');
    const token = AuthService.getToken();
    const formData = new FormData();

    formData.append('id', params.id.toString());
    formData.append('email', params.email);
    formData.append('rol', params.rol);
    formData.append('pais_sede', countries);
    // Enviamos ciudad vacía si no viene, para cumplir con el formulario si el backend lo pide
    formData.append('ciudad', params.ciudad ?? existing.ciudad ?? '');

    const res = await countryFetch(`${API_BASE}/modificar-usuarios`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData
    }, true);

    if (!res.ok) throw new Error('Error al modificar usuario');
    return await res.text();
  }

  // 4. Cambiar Contraseña (Nuevo Endpoint)
  static async changePassword(params: ChangePasswordParams): Promise<any> {
    await this.editableUser(params.id);
    const token = AuthService.getToken();
    const formData = new FormData();

    formData.append('id', params.id.toString());
    formData.append('password', params.password);

    const res = await countryFetch(`${API_BASE}/modificar-usuariospwd`, {
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
