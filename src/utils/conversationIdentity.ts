type ConversationContact = {
  source?: unknown;
  whatsapp?: unknown;
  asignado_a?: unknown;
  subscriber_id?: unknown;
  subscriberId?: unknown;
  sub_id?: unknown;
};

const contactValue = (value: unknown): string => {
  const text = String(value ?? '').trim();
  return /^(null|undefined)$/i.test(text) ? '' : text;
};

export function resolveConversationIdentity(client: ConversationContact, source?: string | null) {
  const rawSource = contactValue(source) || contactValue(client.source);
  const isWeb = rawSource.toLowerCase() === 'web1';
  const resolvedSource = isWeb ? 'web1' : rawSource;
  // The existing web endpoint expects the n8n session ID in the whatsapp field.
  const recipient = isWeb
    ? contactValue(client.asignado_a) || contactValue(client.whatsapp)
    : contactValue(client.whatsapp);
  const rawSubscriberId = client.subscriber_id ?? client.subscriberId ?? client.sub_id;
  const subscriberId = contactValue(rawSubscriberId) ? rawSubscriberId : null;
  return {
    isWeb,
    source: resolvedSource,
    recipient,
    subscriberId,
    available: !!recipient || subscriberId !== null,
  };
}

export function conversationCacheKey(identity: ReturnType<typeof resolveConversationIdentity>, country: string, session: string | null) {
  return JSON.stringify([session, country, identity.source || 'Directo', identity.recipient, identity.subscriberId]);
}
