export type ExtractedItem = {
  name: string;
  qty: number | null;
  unit_price: number | null;
  line_total: number | null;
  category: string;
  subcategory: string;
  confidence: 'high' | 'low';
};

export type Extraction = {
  doc_type: string;
  store_type: string;
  country: string;
  currency: string;
  store_name: string | null;
  store_branch_address: string | null;
  store_tax_id: string | null;
  receipt_number: string | null;
  date: string | null;
  time: string | null;
  payment_method: string | null;
  subtotal: number | null;
  tax_total: number | null;
  discount_total: number;
  total: number | null;
  items: ExtractedItem[];
  legibility: 'good' | 'partial' | 'poor';
  notes: string;
};

export type ReceiptRow = {
  id: string;
  user_id: string;
  store_name: string | null;
  store_branch_address: string | null;
  store_type: string | null;
  currency: string | null;
  purchased_on: string | null;
  total: number | null;
  payment_method: string | null;
  image_path: string | null;
  created_at: string;
  item_count?: number;
};

export type ReceiptItemRow = {
  id: string;
  line_no: number;
  name_as_printed: string;
  qty: number | null;
  unit_price: number | null;
  line_total: number | null;
  category: string | null;
  subcategory: string | null;
};

export const CATEGORIES = [
  'food', 'drink', 'alcohol', 'restaurant', 'household', 'personal_care', 'pharmacy', 'pet',
  'clothing', 'electronics', 'fuel', 'parking', 'transport', 'utilities', 'services', 'other',
] as const;

export const PAYMENT_METHODS = ['cash', 'card', 'mobile_money', 'other'] as const;
