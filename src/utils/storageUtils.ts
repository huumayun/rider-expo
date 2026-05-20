import AsyncStorage from '@react-native-async-storage/async-storage';

const CHAT_CACHE_PREFIX = 'gb_chat_';
const CACHE_METADATA_KEY = 'gb_chat_meta';
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Saves chat messages to the local cache and updates metadata.
 * @param orderId - Order ID
 * @param messages - Array of messages
 */
export async function saveChatToCache(orderId: string, messages: any[]) {
  if (!orderId || !messages) return;
  
  try {
    const key = `${CHAT_CACHE_PREFIX}${orderId}`;
    const data = JSON.stringify(messages.slice(-50)); // Only keep the last 50
    await AsyncStorage.setItem(key, data);
    
    const metaStr = await AsyncStorage.getItem(CACHE_METADATA_KEY);
    const meta = metaStr ? JSON.parse(metaStr) : {};
    meta[orderId] = Date.now();
    await AsyncStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(meta));
  } catch (e) {
    console.error('Error saving chat to cache:', e);
    // If quota exceeded, perform emergency cleanup
    await cleanupOldCaches(true);
  }
}

/**
 * Retrieves chat messages from the local cache.
 * @param orderId - Order ID
 * @returns Promise<Array> List of messages or empty array
 */
export async function getChatFromCache(orderId: string): Promise<any[]> {
  if (!orderId) return [];
  
  try {
    const key = `${CHAT_CACHE_PREFIX}${orderId}`;
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Error reading chat from cache:', e);
    return [];
  }
}

/**
 * Clears chats older than MAX_CACHE_AGE_MS.
 * @param forceAll - If true, clears extra items even if not expired
 */
export async function cleanupOldCaches(forceAll = false) {
  try {
    const metaStr = await AsyncStorage.getItem(CACHE_METADATA_KEY);
    const meta = metaStr ? JSON.parse(metaStr) : {};
    const now = Date.now();
    const updatedMeta = { ...meta };
    
    const keysToRemove: string[] = [];

    Object.keys(meta).forEach(orderId => {
      const lastUpdated = meta[orderId];
      if (forceAll || (now - lastUpdated > MAX_CACHE_AGE_MS)) {
        keysToRemove.push(`${CHAT_CACHE_PREFIX}${orderId}`);
        delete updatedMeta[orderId];
      }
    });

    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
    }
    
    await AsyncStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(updatedMeta));
  } catch (e) {
    console.error('Error during chat cache cleanup:', e);
  }
}
