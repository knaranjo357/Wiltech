import { CategoryType, PrecioItem } from '../types/precios';
import { ApiService } from './apiService';

export class PreciosService {
  static async getPrecios(category: CategoryType): Promise<PrecioItem[]> {
    return ApiService.post<PrecioItem[]>('/precios', { category });
  }

  static async updatePrecios(category: CategoryType, data: Partial<PrecioItem>): Promise<PrecioItem> {
    return ApiService.post<PrecioItem>('/precios', { category, ...data });
  }
}