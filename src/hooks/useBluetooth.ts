import { useState, useCallback, useRef } from 'react';
import { BluetoothDeviceInfo } from '@/types/bluetooth';
import { toast } from '@/hooks/use-toast';

// Weight scale service UUIDs (standard Bluetooth SIG)
const WEIGHT_SCALE_SERVICE = '0000181d-0000-1000-8000-00805f9b34fb';
const WEIGHT_MEASUREMENT_CHAR = '00002a9d-0000-1000-8000-00805f9b34fb';
const GENERIC_ACCESS_UUID = '00001800-0000-1000-8000-00805f9b34fb';
const DEVICE_INFO_UUID = '0000180a-0000-1000-8000-00805f9b34fb';

export const useBluetooth = () => {
  const [devices, setDevices] = useState<BluetoothDeviceInfo[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<BluetoothDeviceInfo | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastWeight, setLastWeight] = useState<number>(0);
  const characteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);

  // Check if Web Bluetooth is supported
  const isBluetoothSupported = useCallback((): boolean => {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }, []);

  // Scan for Bluetooth devices using Web Bluetooth API
  const scanForDevices = useCallback(async () => {
    setIsScanning(true);
    setDevices([]);

    if (!isBluetoothSupported()) {
      toast({
        title: "Bluetooth Not Supported",
        description: "Your browser doesn't support Web Bluetooth. Please use Chrome on Android or a compatible browser.",
        variant: "destructive",
      });
      setIsScanning(false);
      return;
    }

    try {
      // Request Bluetooth device - this opens the browser's device picker
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          WEIGHT_SCALE_SERVICE,
          GENERIC_ACCESS_UUID,
          DEVICE_INFO_UUID,
        ]
      });

      if (device) {
        const bluetoothDevice: BluetoothDeviceInfo = {
          id: device.id,
          name: device.name || 'Unknown Device',
          address: device.id.substring(0, 17).replace(/(.{2})/g, '$1:').slice(0, 17) || 'XX:XX:XX:XX:XX:XX',
          rssi: -50, // Web Bluetooth doesn't expose RSSI directly
          connected: false,
          device: device,
        };

        setDevices([bluetoothDevice]);
        
        toast({
          title: "Device Found",
          description: `Found: ${bluetoothDevice.name}`,
        });
      }
    } catch (error: unknown) {
      const err = error as { name?: string; message?: string };
      if (err.name === 'NotFoundError') {
        toast({
          title: "No Device Selected",
          description: "Please select a Bluetooth device to connect",
          variant: "destructive",
        });
      } else if (err.name === 'SecurityError') {
        toast({
          title: "Permission Denied",
          description: "Bluetooth access was denied. Please allow Bluetooth access.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Scan Failed",
          description: err.message || "Failed to scan for Bluetooth devices",
          variant: "destructive",
        });
      }
      console.error('Bluetooth scan error:', error);
    }

    setIsScanning(false);
  }, [isBluetoothSupported]);

  // Handle weight notification from device
  const handleWeightNotification = useCallback((event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    if (value && value.byteLength >= 3) {
      // Parse weight value - format depends on the specific scale
      // Most scales send weight as 16-bit little-endian integer in 0.01 kg units
      const weight = value.getUint16(1, true) / 100;
      setLastWeight(weight);
      
      toast({
        title: "Weight Updated",
        description: `Weight: ${weight.toFixed(2)} kg`,
      });
    }
  }, []);

  // Connect to selected Bluetooth device
  const connectToDevice = useCallback(async (deviceInfo: BluetoothDeviceInfo): Promise<BluetoothDeviceInfo | null> => {
    setIsConnecting(true);

    try {
      if (!deviceInfo.device) {
        throw new Error('No Bluetooth device reference');
      }

      // Connect to GATT server
      const server = await deviceInfo.device.gatt?.connect();
      
      if (!server) {
        throw new Error('Failed to connect to GATT server');
      }

      let characteristic: BluetoothRemoteGATTCharacteristic | undefined;

      // Try to get weight scale service
      try {
        const service = await server.getPrimaryService(WEIGHT_SCALE_SERVICE);
        characteristic = await service.getCharacteristic(WEIGHT_MEASUREMENT_CHAR);
        
        // Start notifications for weight updates
        await characteristic.startNotifications();
        characteristic.addEventListener('characteristicvaluechanged', handleWeightNotification);
        characteristicRef.current = characteristic;
      } catch (e) {
        console.log('Weight scale service not available, will use manual read');
      }

      const connectedDev: BluetoothDeviceInfo = {
        ...deviceInfo,
        connected: true,
        server: server,
        characteristic: characteristic,
      };

      setConnectedDevice(connectedDev);
      
      // Listen for disconnection
      deviceInfo.device.addEventListener('gattserverdisconnected', () => {
        toast({
          title: "Disconnected",
          description: `${deviceInfo.name} was disconnected`,
          variant: "destructive",
        });
        setConnectedDevice(null);
        characteristicRef.current = null;
      });

      toast({
        title: "Connected!",
        description: `Successfully connected to ${deviceInfo.name}`,
      });

      setIsConnecting(false);
      return connectedDev;
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({
        title: "Connection Failed",
        description: err.message || "Failed to connect to device",
        variant: "destructive",
      });
      console.error('Connection error:', error);
      setIsConnecting(false);
      return null;
    }
  }, [handleWeightNotification]);

  // Disconnect from device
  const disconnectDevice = useCallback(async () => {
    if (connectedDevice) {
      try {
        if (characteristicRef.current) {
          await characteristicRef.current.stopNotifications();
          characteristicRef.current = null;
        }
        
        if (connectedDevice.server) {
          connectedDevice.server.disconnect();
        } else if (connectedDevice.device?.gatt) {
          connectedDevice.device.gatt.disconnect();
        }
        
        toast({
          title: "Disconnected",
          description: `Disconnected from ${connectedDevice.name}`,
        });
      } catch (error) {
        console.error('Disconnect error:', error);
      }
      
      setConnectedDevice(null);
      setDevices([]);
    }
  }, [connectedDevice]);

  // Read weight from connected device
  const readWeight = useCallback(async (): Promise<number> => {
    if (!connectedDevice) {
      toast({
        title: "Not Connected",
        description: "Please connect to a Bluetooth device first",
        variant: "destructive",
      });
      return 0;
    }

    try {
      // If we have a characteristic, try to read from it
      if (connectedDevice.characteristic) {
        const value = await connectedDevice.characteristic.readValue();
        // Parse weight - most scales use 16-bit little-endian format
        const weight = value.getUint16(1, true) / 100;
        setLastWeight(weight);
        
        toast({
          title: "Weight Read",
          description: `Weight: ${weight.toFixed(2)} kg`,
        });
        
        return weight;
      }
      
      // If no characteristic available, try to read from weight service
      if (connectedDevice.server) {
        try {
          const service = await connectedDevice.server.getPrimaryService(WEIGHT_SCALE_SERVICE);
          const char = await service.getCharacteristic(WEIGHT_MEASUREMENT_CHAR);
          const value = await char.readValue();
          const weight = value.getUint16(1, true) / 100;
          setLastWeight(weight);
          
          toast({
            title: "Weight Read",
            description: `Weight: ${weight.toFixed(2)} kg`,
          });
          
          return weight;
        } catch (e) {
          console.log('Could not read from weight service');
        }
      }

      // Return last received weight from notifications
      if (lastWeight > 0) {
        toast({
          title: "Weight Read",
          description: `Weight: ${lastWeight.toFixed(2)} kg`,
        });
        return lastWeight;
      }

      toast({
        title: "Reading Failed",
        description: "Unable to read weight. Make sure the scale is sending data.",
        variant: "destructive",
      });
      return 0;
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({
        title: "Read Failed",
        description: err.message || "Failed to read weight from device",
        variant: "destructive",
      });
      console.error('Weight read error:', error);
      return 0;
    }
  }, [connectedDevice, lastWeight]);

  return {
    devices,
    isScanning,
    connectedDevice,
    isConnecting,
    scanForDevices,
    connectToDevice,
    disconnectDevice,
    readWeight,
    isBluetoothSupported,
    lastWeight,
  };
};
