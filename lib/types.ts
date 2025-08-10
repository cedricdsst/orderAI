export type MenuItem = {
  id: string;
  name: string;
  priceCents: number;
};

export type MenuSection = {
  id: string;
  name: string;
  items: MenuItem[];
};

export type OrderItem = {
  id: string; // must match a menu id
  name: string; // must match the corresponding menu item name
  quantity: number;
  unitPriceCents?: number; // filled server-side from MENU
  notes?: string; // free text (limited by server)
};

export type OrderStatus = "building" | "confirmed" | "paid" | "cancelled";

export type Order = {
  orderId: string;
  items: OrderItem[];
  currency: "EUR";
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  status: OrderStatus;
  completed?: boolean;
  updatedAt: string; // ISO timestamp
};

export type ChatTurn = {
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  error?: string;
};


