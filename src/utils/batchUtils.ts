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

  const newLat = newOrder.customerLocation?.lat ?? newOrder.customerLocation?.latitude ?? newOrder.customer?.location?.lat ?? newOrder.customer?.location?.latitude ?? newOrder.customer?.address?.lat;
  const newLng = newOrder.customerLocation?.lng ?? newOrder.customerLocation?.longitude ?? newOrder.customer?.location?.lng ?? newOrder.customer?.location?.longitude ?? newOrder.customer?.address?.lng;

  const soloBatchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  if (!newLat || !newLng) return soloBatchId;

  // Find an eligible active order with status 'assigned' or 'accepted'
  const eligibleOrders = activeOrders.filter(o => o.status === 'assigned' || o.status === 'accepted');

  for (let order of eligibleOrders) {
    const lat = order.customerLocation?.lat ?? order.customerLocation?.latitude ?? order.customer?.location?.lat ?? order.customer?.location?.latitude ?? order.customer?.address?.lat;
    const lng = order.customerLocation?.lng ?? order.customerLocation?.longitude ?? order.customer?.location?.lng ?? order.customer?.location?.longitude ?? order.customer?.address?.lng;
    if (lat && lng) {
      const distance = calculateDistance(Number(newLat), Number(newLng), Number(lat), Number(lng));
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

// Sort active orders in a batch/trip based on their picked status and distance to branch/customer
export const getOptimalDeliveryRoute = (
  orders: any[],
  riderLocation: { lat: number; lng: number } | null
): any[] => {
  if (!riderLocation || orders.length <= 1) return orders;

  const unpicked = orders.filter(o => 
    ['assigned', 'accepted', 'go_to_branch', 'arrived_at_branch'].includes(o.status)
  );

  const picked = orders.filter(o => 
    ['picked', 'out_for_delivery', 'arrived_at_customer'].includes(o.status)
  );

  const completed = orders.filter(o => 
    ['delivered', 'success', 'cancelled', 'returned', 'returned_to_branch'].includes(o.status)
  );

  // Sort picked orders by closest customer distance first (TSP)
  const sortedPicked = [...picked].sort((a, b) => {
    const locA = a.customer?.location || a.customer?.address;
    const locB = b.customer?.location || b.customer?.address;
    if (!locA || !locB) return 0;
    
    const latA = locA.lat ?? locA.latitude;
    const lngA = locA.lng ?? locA.longitude;
    const latB = locB.lat ?? locB.latitude;
    const lngB = locB.lng ?? locB.longitude;
    
    if (!latA || !lngA || !latB || !lngB) return 0;
    
    const distA = calculateDistance(riderLocation.lat, riderLocation.lng, latA, lngA);
    const distB = calculateDistance(riderLocation.lat, riderLocation.lng, latB, lngB);
    return distA - distB;
  });

  // Sort unpicked orders by closest branch distance first
  const sortedUnpicked = [...unpicked].sort((a, b) => {
    const locA = a.branchLocation || a.branchDetail?.location || a.branch?.location;
    const locB = b.branchLocation || b.branchDetail?.location || b.branch?.location;
    if (!locA || !locB) return 0;
    
    const latA = locA.lat ?? locA.latitude;
    const lngA = locA.lng ?? locA.longitude;
    const latB = locB.lat ?? locB.latitude;
    const lngB = locB.lng ?? locB.longitude;
    
    if (!latA || !lngA || !latB || !lngB) return 0;
    
    const distA = calculateDistance(riderLocation.lat, riderLocation.lng, latA, lngA);
    const distB = calculateDistance(riderLocation.lat, riderLocation.lng, latB, lngB);
    return distA - distB;
  });

  return [...sortedUnpicked, ...sortedPicked, ...completed];
};

