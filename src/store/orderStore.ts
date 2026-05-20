import { create } from 'zustand';

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  orderSeq?: string;
  status: string;
  riderId: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerLocation?: { lat: number; lng: number; address?: string };
  branchId?: string;
  branchName?: string;
  branchLocation?: { lat: number; lng: number };
  items?: OrderItem[];
  totalAmount: number;
  paymentMethod: 'COD' | 'Online';
  batchId?: string;
  otp?: string;
  deliveryProofUrl?: string;
  cancelReason?: string;
  returnReason?: string;
  assignedAt?: any;
  acceptedAt?: any;
  pickedAt?: any;
  deliveredAt?: any;
  cancelledAt?: any;
  createdAt?: any;
  updatedAt?: any;
}

interface OrderState {
  activeOrder: Order | null;
  newOrderPopup: Order | null;
  setActiveOrder: (order: Order | null) => void;
  setNewOrderPopup: (order: Order | null) => void;
  dismissPopup: () => void;
}

export const useOrderStore = create<OrderState>((set) => ({
  activeOrder: null,
  newOrderPopup: null,

  setActiveOrder: (order) => set({ activeOrder: order }),

  setNewOrderPopup: (order) => set({ newOrderPopup: order }),

  dismissPopup: () => set({ newOrderPopup: null }),
}));
