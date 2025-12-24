export interface BluetoothDevice {
  id: string;
  name: string;
  address: string;
  rssi?: number;
  connected: boolean;
}

export interface POSFormData {
  companyName: string;
  mobileNo: string;
  itemName: string;
  weight: number;
  ratePerKg: number;
  discount: number;
  gstType: 'none' | 'cgst_sgst' | 'igst';
  gstPercent: 5 | 18;
}

export interface CalculationResult {
  baseAmount: number;
  discountAmount: number;
  amountAfterDiscount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
  finalAmount: number;
}
