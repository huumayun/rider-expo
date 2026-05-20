export const chatRef = (orderId: string) => `chats/${orderId}/messages`;
export const metaRef = (orderId: string) => `chats/${orderId}/meta`;
export const typingRef = (orderId: string, role: string) => `chats/${orderId}/meta/${role}Typing`;

export const QUICK_MESSAGES = [
  { id: 'q1', text_en: 'Where are you?', text_bn: 'আপনি কোথায়?' },
  { id: 'q2', text_en: 'Please hurry', text_bn: 'দয়া করে তাড়াতাড়ি করুন' },
  { id: 'q3', text_en: 'I am at the gate', text_bn: 'আমি গেটে আছি' },
  { id: 'q4', text_en: 'Please call me', text_bn: 'আমাকে কল করুন' },
  { id: 'q5', text_en: 'How long will it take?', text_bn: 'কতক্ষণ লাগবে?' },
  { id: 'q6', text_en: 'OK, thank you', text_bn: 'ঠিক আছে, ধন্যবাদ' }
];

export const ROLES = {
  CUSTOMER: 'customer',
  RIDER: 'rider'
};
