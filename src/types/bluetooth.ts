/// <reference types="web-bluetooth" />

export interface BluetoothDeviceInfo {
  id: string;
  name: string;
  address: string;
  rssi?: number;
  connected: boolean;
  device?: BluetoothDevice;
  server?: BluetoothRemoteGATTServer;
  characteristic?: BluetoothRemoteGATTCharacteristic;
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

export interface SavedTransaction {
  id: string;
  timestamp: Date;
  formData: POSFormData;
  result: CalculationResult;
}
