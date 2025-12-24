import { POSFormData, CalculationResult } from '@/types/bluetooth';

export const calculateTotal = (data: POSFormData): CalculationResult => {
  const baseAmount = data.weight * data.ratePerKg;
  const discountAmount = (baseAmount * data.discount) / 100;
  const amountAfterDiscount = baseAmount - discountAmount;

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (data.gstType === 'cgst_sgst') {
    const halfGst = (amountAfterDiscount * data.gstPercent) / 100 / 2;
    cgst = halfGst;
    sgst = halfGst;
  } else if (data.gstType === 'igst') {
    igst = (amountAfterDiscount * data.gstPercent) / 100;
  }

  const totalGst = cgst + sgst + igst;
  const finalAmount = amountAfterDiscount + totalGst;

  return {
    baseAmount: Math.round(baseAmount * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    amountAfterDiscount: Math.round(amountAfterDiscount * 100) / 100,
    cgst: Math.round(cgst * 100) / 100,
    sgst: Math.round(sgst * 100) / 100,
    igst: Math.round(igst * 100) / 100,
    totalGst: Math.round(totalGst * 100) / 100,
    finalAmount: Math.round(finalAmount * 100) / 100,
  };
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
};
