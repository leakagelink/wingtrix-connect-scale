import { useState, useCallback } from 'react';
import { BluetoothDevice } from '@/types/bluetooth';
import { toast } from '@/hooks/use-toast';

export const useBluetooth = () => {
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<BluetoothDevice | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const scanForDevices = useCallback(async () => {
    setIsScanning(true);
    setDevices([]);

    // Simulate scanning for HC-05 devices
    // In a real implementation, this would use Web Bluetooth API or a native bridge
    await new Promise(resolve => setTimeout(resolve, 2000));

    const mockDevices: BluetoothDevice[] = [
      { id: '1', name: 'HC-05 Scale', address: '98:D3:31:FD:00:01', rssi: -45, connected: false },
      { id: '2', name: 'HC-05 Weight', address: '98:D3:31:FD:00:02', rssi: -60, connected: false },
      { id: '3', name: 'BT Scale Pro', address: '98:D3:31:FD:00:03', rssi: -72, connected: false },
    ];

    setDevices(mockDevices);
    setIsScanning(false);
    
    toast({
      title: "Scan Complete",
      description: `Found ${mockDevices.length} devices`,
    });
  }, []);

  const connectToDevice = useCallback(async (device: BluetoothDevice) => {
    setIsConnecting(true);

    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const connectedDev = { ...device, connected: true };
    setConnectedDevice(connectedDev);
    setIsConnecting(false);

    toast({
      title: "Connected!",
      description: `Successfully connected to ${device.name}`,
    });

    return connectedDev;
  }, []);

  const disconnectDevice = useCallback(async () => {
    if (connectedDevice) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast({
        title: "Disconnected",
        description: `Disconnected from ${connectedDevice.name}`,
      });
      
      setConnectedDevice(null);
    }
  }, [connectedDevice]);

  const readWeight = useCallback(async (): Promise<number> => {
    if (!connectedDevice) {
      toast({
        title: "Not Connected",
        description: "Please connect to a Bluetooth device first",
        variant: "destructive",
      });
      return 0;
    }

    // Simulate reading weight from scale
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Generate random weight between 0.1 and 100 kg
    const weight = Math.round((Math.random() * 99.9 + 0.1) * 100) / 100;
    
    toast({
      title: "Weight Read",
      description: `Weight: ${weight} kg`,
    });

    return weight;
  }, [connectedDevice]);

  return {
    devices,
    isScanning,
    connectedDevice,
    isConnecting,
    scanForDevices,
    connectToDevice,
    disconnectDevice,
    readWeight,
  };
};
