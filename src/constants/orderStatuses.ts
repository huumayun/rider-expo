export const ORDER_STATUS_FLOW = [
  'assigned',
  'accepted',
  'arrived_at_branch',
  'picked',
  'out_for_delivery',
  'arrived_at_customer',
  'delivered'
] as const;

export type OrderStatus = typeof ORDER_STATUS_FLOW[number];

export const STATUS_GRADIENTS: Record<string, [string, string]> = {
  assigned: ['#0ea5e922', '#0ea5e905'],
  accepted: ['#8b5cf622', '#8b5cf605'],
  arrived_at_branch: ['#f59e0b22', '#f59e0b05'],
  picked: ['#f9731622', '#f9731605'],
  out_for_delivery: ['#ec489922', '#ec489905'],
  arrived_at_customer: ['#14b8a622', '#14b8a605'],
  delivered: ['#22d47a22', '#22d47a05'],
  cancelled: ['#f43f5e22', '#f43f5e05'],
};

export const STATUS_EMOJIS: Record<string, string> = {
  assigned: '🔔',
  accepted: '👍',
  arrived_at_branch: '🏪',
  picked: '📦',
  out_for_delivery: '🛵',
  arrived_at_customer: '📍',
  delivered: '✅',
  cancelled: '❌',
};
