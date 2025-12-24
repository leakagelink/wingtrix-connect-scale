import { useState } from 'react';
import { 
  Scale, 
  Calculator, 
  Bluetooth, 
  ArrowLeft, 
  Receipt,
  Package,
  Phone,
  Building2,
  Percent,
  IndianRupee,
  Loader2,
  RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BluetoothDevice, POSFormData, CalculationResult } from '@/types/bluetooth';
import { calculateTotal, formatCurrency } from '@/utils/calculations';
import { cn } from '@/lib/utils';

interface POSMainProps {
  connectedDevice: BluetoothDevice;
  onDisconnect: () => void;
  onReadWeight: () => Promise<number>;
}

export const POSMain = ({ connectedDevice, onDisconnect, onReadWeight }: POSMainProps) => {
  const [isReading, setIsReading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<CalculationResult | null>(null);

  const [formData, setFormData] = useState<POSFormData>({
    companyName: '',
    mobileNo: '',
    itemName: '',
    weight: 0,
    ratePerKg: 0,
    discount: 0,
    gstType: 'none',
    gstPercent: 18,
  });

  const handleInputChange = (field: keyof POSFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setShowResult(false);
  };

  const handleReadWeight = async () => {
    setIsReading(true);
    const weight = await onReadWeight();
    setFormData(prev => ({ ...prev, weight }));
    setIsReading(false);
    setShowResult(false);
  };

  const handleCalculate = () => {
    const calculatedResult = calculateTotal(formData);
    setResult(calculatedResult);
    setShowResult(true);
  };

  const handleReset = () => {
    setFormData({
      companyName: '',
      mobileNo: '',
      itemName: '',
      weight: 0,
      ratePerKg: 0,
      discount: 0,
      gstType: 'none',
      gstPercent: 18,
    });
    setResult(null);
    setShowResult(false);
  };

  const isFormValid = formData.weight > 0 && formData.ratePerKg > 0;

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <header className="glass-card sticky top-0 z-50 px-4 py-3 mx-4 mt-4 rounded-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onDisconnect} className="mr-1">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Scale className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Wingtrix POS</h1>
              <div className="flex items-center gap-1.5 text-xs text-success">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                {connectedDevice.name}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleReset} title="Reset Form">
            <RotateCcw className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>
      </header>

      <div className="px-4 mt-6 space-y-6">
        {/* Weight Display */}
        <div className="glass-card p-6 text-center space-y-4">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Scale className="w-5 h-5" />
            <span className="text-sm font-medium uppercase tracking-wider">Current Weight</span>
          </div>
          <div className="weight-display">
            {formData.weight.toFixed(2)}
            <span className="text-2xl ml-2 text-primary">kg</span>
          </div>
          <Button
            onClick={handleReadWeight}
            disabled={isReading}
            variant="accent"
            size="lg"
            className="w-full"
          >
            {isReading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Reading...
              </>
            ) : (
              <>
                <Scale className="w-5 h-5" />
                Read Weight
              </>
            )}
          </Button>
        </div>

        {/* Form Fields */}
        <div className="glass-card p-5 space-y-5">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Invoice Details
          </h2>

          <div className="grid gap-4">
            {/* Company Name */}
            <div className="space-y-2">
              <Label htmlFor="companyName" className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="w-4 h-4" />
                Company Name
              </Label>
              <Input
                id="companyName"
                placeholder="Enter company name"
                value={formData.companyName}
                onChange={(e) => handleInputChange('companyName', e.target.value)}
                className="bg-secondary/50 border-border/50 focus:border-primary"
              />
            </div>

            {/* Mobile Number */}
            <div className="space-y-2">
              <Label htmlFor="mobileNo" className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-4 h-4" />
                Mobile Number
              </Label>
              <Input
                id="mobileNo"
                type="tel"
                placeholder="Enter mobile number"
                value={formData.mobileNo}
                onChange={(e) => handleInputChange('mobileNo', e.target.value)}
                className="bg-secondary/50 border-border/50 focus:border-primary"
              />
            </div>

            {/* Item Name */}
            <div className="space-y-2">
              <Label htmlFor="itemName" className="flex items-center gap-2 text-muted-foreground">
                <Package className="w-4 h-4" />
                Item Name
              </Label>
              <Input
                id="itemName"
                placeholder="Enter item name"
                value={formData.itemName}
                onChange={(e) => handleInputChange('itemName', e.target.value)}
                className="bg-secondary/50 border-border/50 focus:border-primary"
              />
            </div>

            {/* Rate Per Kg */}
            <div className="space-y-2">
              <Label htmlFor="ratePerKg" className="flex items-center gap-2 text-muted-foreground">
                <IndianRupee className="w-4 h-4" />
                Rate per Kg (₹)
              </Label>
              <Input
                id="ratePerKg"
                type="number"
                placeholder="0.00"
                value={formData.ratePerKg || ''}
                onChange={(e) => handleInputChange('ratePerKg', parseFloat(e.target.value) || 0)}
                className="bg-secondary/50 border-border/50 focus:border-primary font-mono text-lg"
              />
            </div>

            {/* Discount */}
            <div className="space-y-2">
              <Label htmlFor="discount" className="flex items-center gap-2 text-muted-foreground">
                <Percent className="w-4 h-4" />
                Discount (%)
              </Label>
              <Input
                id="discount"
                type="number"
                placeholder="0"
                min="0"
                max="100"
                value={formData.discount || ''}
                onChange={(e) => handleInputChange('discount', parseFloat(e.target.value) || 0)}
                className="bg-secondary/50 border-border/50 focus:border-primary font-mono"
              />
            </div>

            {/* GST Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">GST Type</Label>
                <Select
                  value={formData.gstType}
                  onValueChange={(value: 'none' | 'cgst_sgst' | 'igst') =>
                    handleInputChange('gstType', value)
                  }
                >
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue placeholder="Select GST" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="cgst_sgst">CGST + SGST</SelectItem>
                    <SelectItem value="igst">IGST</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">GST %</Label>
                <Select
                  value={String(formData.gstPercent)}
                  onValueChange={(value) =>
                    handleInputChange('gstPercent', parseInt(value) as 5 | 18)
                  }
                  disabled={formData.gstType === 'none'}
                >
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue placeholder="GST %" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5%</SelectItem>
                    <SelectItem value="18">18%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Calculate Button */}
        <Button
          onClick={handleCalculate}
          disabled={!isFormValid}
          variant="accent"
          size="xl"
          className="w-full"
        >
          <Calculator className="w-6 h-6" />
          Calculate Total
        </Button>

        {/* Result */}
        {showResult && result && (
          <div className="glass-card p-5 space-y-4 animate-scale-in">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Calculation Summary
            </h2>

            <div className="space-y-3">
              <div className="flex justify-between text-foreground">
                <span>Base Amount ({formData.weight} kg × ₹{formData.ratePerKg})</span>
                <span className="font-mono">{formatCurrency(result.baseAmount)}</span>
              </div>

              {result.discountAmount > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>Discount ({formData.discount}%)</span>
                  <span className="font-mono">-{formatCurrency(result.discountAmount)}</span>
                </div>
              )}

              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="font-mono">{formatCurrency(result.amountAfterDiscount)}</span>
              </div>

              {formData.gstType === 'cgst_sgst' && (
                <>
                  <div className="flex justify-between text-muted-foreground">
                    <span>CGST ({formData.gstPercent / 2}%)</span>
                    <span className="font-mono">{formatCurrency(result.cgst)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>SGST ({formData.gstPercent / 2}%)</span>
                    <span className="font-mono">{formatCurrency(result.sgst)}</span>
                  </div>
                </>
              )}

              {formData.gstType === 'igst' && (
                <div className="flex justify-between text-muted-foreground">
                  <span>IGST ({formData.gstPercent}%)</span>
                  <span className="font-mono">{formatCurrency(result.igst)}</span>
                </div>
              )}

              <div className="h-px bg-border my-2" />

              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-foreground">Total Amount</span>
                <span className="price-display">{formatCurrency(result.finalAmount)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
