// Calculate distance using Haversine formula (returns meters)
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
};

// Check if a new order can be added to an existing batch
export const checkAndCreateBatch = (newOrder: any, activeOrders: any[]): string => {
  const DISTANCE_LIMIT = 1000; // 1 km in meters
  const MAX_BATCH_SIZE = 5; // e.g. Max 5 orders per batch

  const newLat = newOrder.customer?.location?.lat || newOrder.customer?.address?.lat;
  const newLng = newOrder.customer?.location?.lng || newOrder.customer?.address?.lng;

  const soloBatchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  if (!newLat || !newLng) return soloBatchId;

  // Find an eligible active order with status 'assigned' or 'accepted'
  const eligibleOrders = activeOrders.filter(o => o.status === 'assigned' || o.status === 'accepted');

  for (let order of eligibleOrders) {
    const lat = order.customer?.location?.lat || order.customer?.address?.lat;
    const lng = order.customer?.location?.lng || order.customer?.address?.lng;
    if (lat && lng) {
      const distance = calculateDistance(newLat, newLng, lat, lng);
      if (distance <= DISTANCE_LIMIT) {
        // Also check if batch size is within limits
        const batchId = order.batchId || order.id;
        const currentBatchSize = activeOrders.filter(o => (o.batchId || o.id) === batchId).length;
        if (currentBatchSize < MAX_BATCH_SIZE) {
          return batchId; // Return joining batch ID
        }
      }
    }
  }

  // If no match found, create a new batch ID
  return soloBatchId;
};
