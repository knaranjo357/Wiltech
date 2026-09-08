import { Client } from '../types/client';
import { ClientService } from './clientService';
import { ApiService } from './apiService';

/** Conversations, CRM and shipping share one session-scoped source of truth. */
export const ConversationDataService = {
  async getClients(options: { force?: boolean; maxAge?: number } = {}): Promise<Client[]> {
    const clients = await ClientService.getClients({ force: options.force, ttl: options.maxAge ?? 30_000 });
    return Array.isArray(clients) ? clients : [];
  },
  patchClient(_patch: Partial<Client>) {
    ApiService.invalidateCache();
  },
};
