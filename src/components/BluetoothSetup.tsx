import { useState } from 'react';
import { Bluetooth, BluetoothSearching, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BluetoothDeviceInfo } from '@/types/bluetooth';
import { cn } from '@/lib/utils';
import wingtrixLogo from '@/assets/wingtrix-logo.png';

interface BluetoothSetupProps {
  devices: BluetoothDeviceInfo[];
  isScanning: boolean;
  isConnecting: boolean;
  connectedDevice: BluetoothDeviceInfo | null;
  onScan: () => void;
  onConnect: (device: BluetoothDeviceInfo) => void;
  onContinue: () => void;
}

export const BluetoothSetup = ({
  devices,
  isScanning,
  isConnecting,
  connectedDevice,
  onScan,
  onConnect,
  onContinue,
}: BluetoothSetupProps) => {
  const [selectedDevice, setSelectedDevice] = useState<BluetoothDeviceInfo | null>(null);

  const getSignalStrength = (rssi?: number) => {
    if (!rssi) return 'weak';
    if (rssi > -50) return 'excellent';
    if (rssi > -70) return 'good';
    return 'weak';
  };

  const getSignalBars = (strength: string) => {
    switch (strength) {
      case 'excellent':
        return 4;
      case 'good':
        return 3;
      default:
        return 1;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 pb-20">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-accent/20 blur-2xl rounded-full scale-150 animate-pulse" />
            <img 
              src={wingtrixLogo} 
              alt="Wingtrix Logo" 
              className="relative w-32 h-auto drop-shadow-xl mx-auto"
            />
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            Wingtrix <span className="text-primary">POS</span>
          </h1>
          <p className="text-muted-foreground">
            Connect your Bluetooth weighing scale to get started
          </p>
        </div>

        {/* Scan Button */}
        <Button
          onClick={onScan}
          disabled={isScanning}
          variant="glass"
          size="lg"
          className="w-full"
        >
          {isScanning ? (
            <>
              <BluetoothSearching className="w-5 h-5 animate-pulse" />
              Scanning for devices...
            </>
          ) : (
            <>
              <BluetoothSearching className="w-5 h-5" />
              Scan for Devices
            </>
          )}
        </Button>

        {/* Device List */}
        {devices.length > 0 && (
          <div className="glass-card p-4 space-y-3 animate-scale-in">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Available Devices
            </h3>
            <div className="space-y-2">
              {devices.map((device, index) => {
                const signalStrength = getSignalStrength(device.rssi);
                const bars = getSignalBars(signalStrength);
                const isSelected = selectedDevice?.id === device.id;
                const isConnected = connectedDevice?.id === device.id;

                return (
                  <button
                    key={device.id}
                    onClick={() => setSelectedDevice(device)}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-300",
                      "border-2 hover:border-primary/50",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border/50 bg-secondary/30",
                      isConnected && "border-success bg-success/10"
                    )}
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        isConnected
                          ? "bg-success/20"
                          : isSelected
                          ? "gradient-primary"
                          : "bg-secondary"
                      )}
                    >
                      {isConnected ? (
                        <Check className="w-6 h-6 text-success" />
                      ) : (
                        <Bluetooth
                          className={cn(
                            "w-6 h-6",
                            isSelected
                              ? "text-primary-foreground"
                              : "text-muted-foreground"
                          )}
                        />
                      )}
                    </div>

                    <div className="flex-1 text-left">
                      <p className="font-semibold text-foreground">{device.name}</p>
                      <p className="text-sm text-muted-foreground">{device.address}</p>
                    </div>

                    <div className="flex items-end gap-0.5 h-5">
                      {[1, 2, 3, 4].map((bar) => (
                        <div
                          key={bar}
                          className={cn(
                            "w-1 rounded-full transition-all",
                            bar <= bars ? "bg-primary" : "bg-border",
                            bar === 1 && "h-1",
                            bar === 2 && "h-2",
                            bar === 3 && "h-3",
                            bar === 4 && "h-4"
                          )}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Connect Button */}
        {selectedDevice && !connectedDevice && (
          <Button
            onClick={() => onConnect(selectedDevice)}
            disabled={isConnecting}
            variant="accent"
            size="lg"
            className="w-full animate-slide-in-right"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Bluetooth className="w-5 h-5" />
                Connect to {selectedDevice.name}
              </>
            )}
          </Button>
        )}

        {/* Continue Button */}
        {connectedDevice && (
          <Button
            onClick={onContinue}
            variant="accent"
            size="lg"
            className="w-full animate-scale-in"
          >
            <Check className="w-5 h-5" />
            Continue to POS
          </Button>
        )}
      </div>
    </div>
  );
};
