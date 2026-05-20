// ─── Order status flow ────────────────────────────────────────────────────────
export const ORDER_STEPS = [
  'assigned',
  'accepted',
  'go_to_branch',
  'arrived_at_branch',
  'picked',
  'out_for_delivery',
  'arrived_at_customer',
  'delivered',
] as const;

export type OrderStatus = typeof ORDER_STEPS[number] | 'cancelled' | 'returned';

export const NEXT_STATUS: Record<string, OrderStatus> = {
  assigned: 'accepted',
  accepted: 'go_to_branch' as OrderStatus,
  go_to_branch: 'arrived_at_branch' as OrderStatus,
  arrived_at_branch: 'picked',
  picked: 'out_for_delivery',
  out_for_delivery: 'arrived_at_customer',
  arrived_at_customer: 'delivered',
};

// ─── Status config (label + gradient per status) ──────────────────────────────
export const STATUS_CONFIG: Record<string, {
  labelBn: string;
  labelEn: string;
  btnBn: string;
  btnEn: string;
  grad: [string, string];
  emoji: string;
}> = {
  assigned: {
    labelBn: 'নতুন অর্ডার', labelEn: 'New Order',
    btnBn: 'গ্রহণ করুন', btnEn: 'Accept Order',
    grad: ['#22d47a', '#16a85a'], emoji: '📦',
  },
  accepted: {
    labelBn: 'অর্ডার গ্রহণ করা হয়েছে', labelEn: 'Order Accepted',
    btnBn: 'ব্রাঞ্চে যান', btnEn: 'Go to Branch',
    grad: ['#0ea5e9', '#0284c7'], emoji: '✅',
  },
  go_to_branch: {
    labelBn: 'ব্রাঞ্চে যাচ্ছি', labelEn: 'Going to Branch',
    btnBn: 'ব্রাঞ্চে পৌঁছেছি', btnEn: 'Arrived at Branch',
    grad: ['#f59e0b', '#d97706'], emoji: '🏃',
  },
  arrived_at_branch: {
    labelBn: 'ব্রাঞ্চে আছি', labelEn: 'At Branch',
    btnBn: 'পিক করলাম', btnEn: 'Picked Up',
    grad: ['#8b5cf6', '#7c3aed'], emoji: '🏪',
  },
  picked: {
    labelBn: 'পিক করা হয়েছে', labelEn: 'Picked Up',
    btnBn: 'ডেলিভারিতে বের হলাম', btnEn: 'Out for Delivery',
    grad: ['#f59e0b', '#d97706'], emoji: '✅',
  },
  out_for_delivery: {
    labelBn: 'ডেলিভারিতে', labelEn: 'Out for Delivery',
    btnBn: 'কাস্টমারের কাছে পৌঁছেছি', btnEn: 'Arrived at Customer',
    grad: ['#e85d04', '#dc2f02'], emoji: '🚀',
  },
  arrived_at_customer: {
    labelBn: 'কাস্টমারের কাছে', labelEn: 'At Customer',
    btnBn: 'ডেলিভারি নিশ্চিত করুন', btnEn: 'Confirm Delivery',
    grad: ['#ff4d6d', '#c9184a'], emoji: '🏠',
  },
  delivered: {
    labelBn: 'ডেলিভারড!', labelEn: 'Delivered!',
    btnBn: 'সম্পন্ন', btnEn: 'Done',
    grad: ['#22d47a', '#16a85a'], emoji: '🎉',
  },
  cancelled: {
    labelBn: 'বাতিল', labelEn: 'Cancelled',
    btnBn: 'বাতিল', btnEn: 'Cancelled',
    grad: ['#f43f5e', '#e11d48'], emoji: '❌',
  },
  returned: {
    labelBn: 'ফেরত', labelEn: 'Returned',
    btnBn: 'ফেরত', btnEn: 'Returned',
    grad: ['#f97316', '#ea580c'], emoji: '🔄',
  },
};

// ─── Theme ────────────────────────────────────────────────────────────────────
export const COLORS = {
  green: '#22d47a',
  blue: '#0ea5e9',
  danger: '#f43f5e',
  warning: '#f59e0b',
  purple: '#8b5cf6',
  orange: '#f97316',

  dark: {
    bg: '#07070f',
    surface: 'rgba(255,255,255,0.03)',
    surfaceHigh: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.08)',
    text: '#f8fafc',
    sub: '#64748b',
    hi: 'rgba(255,255,255,0.04)',
    cardA: 'rgba(34,212,122,0.06)',
    cardB: 'rgba(14,165,233,0.06)',
    cardC: 'rgba(139,92,246,0.06)',
    cardD: 'rgba(245,158,11,0.06)',
    accent: '#22d47a',
    green: '#22d47a',
    danger: '#f43f5e',
  },
  light: {
    bg: '#ffffff',
    surface: '#f8fafc',
    surfaceHigh: '#f1f5f9',
    border: '#e2e8f0',
    text: '#0f172a',
    sub: '#94a3b8',
    hi: '#f1f5f9',
    cardA: 'rgba(34,212,122,0.08)',
    cardB: 'rgba(14,165,233,0.08)',
    cardC: 'rgba(139,92,246,0.08)',
    cardD: 'rgba(245,158,11,0.08)',
    accent: '#22d47a',
    green: '#22d47a',
    danger: '#f43f5e',
  },
} as const;

// ─── Background task name ────────────────────────────────────────────────────
export const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';

// ─── AsyncStorage keys ───────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  theme: 'rider_theme',
  lang: 'rider_lang',
  toastEnabled: 'rider_toast_enabled',
  termsAccepted: 'rider_terms_accepted',
} as const;

// ─── Firestore / RTDB paths ──────────────────────────────────────────────────
export const FS = {
  employee: (uid: string) => `employees/${uid}`,
  order: (id: string) => `orders/${id}`,
  transactions: 'transactions',
  notifications: 'notifications',
  fcmTokens: 'fcm_tokens',
  shiftLogs: (uid: string) => `shift_logs/${uid}/logs`,
} as const;

export const RTDB_PATHS = {
  attendance: (uid: string) => `attendance/${uid}`,
  chat: (orderId: string) => `chats/${orderId}/messages`,
  chatMeta: (orderId: string) => `chats/${orderId}/meta`,
  typing: (orderId: string, role: string) => `chats/${orderId}/meta/${role}Typing`,
  riderTyping: (orderId: string, uid: string) => `chats/${orderId}/meta/riderTyping`,
} as const;
