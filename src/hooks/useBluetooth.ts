import { useState, useCallback, useRef, useEffect } from 'react';
import { BluetoothDeviceInfo } from '@/types/bluetooth';
import { toast } from '@/hooks/use-toast';

// Check if running in Capacitor native environment
const isNative = (): boolean => {
  return typeof (window as any).Capacitor !== 'undefined';
};

// Classic Bluetooth Serial Plugin interface (for native)
interface BluetoothSerial {
  isEnabled(): Promise<{ enabled: boolean }>;
  enable(): Promise<void>;
  list(): Promise<Array<{ name: string; address: string; id: string }>>;
  connect(options: { address: string }): Promise<void>;
  disconnect(): Promise<void>;
  read(): Promise<{ data: string }>;
  write(options: { data: string }): Promise<void>;
  isConnected(): Promise<{ connected: boolean }>;
  subscribeRaw(callback: (data: { data: ArrayBuffer }) => void): Promise<void>;
}

// Get the Bluetooth Serial plugin
const getBluetoothSerial = (): BluetoothSerial | null => {
  if (isNative() && (window as any).Capacitor?.Plugins?.BluetoothSerial) {
    return (window as any).Capacitor.Plugins.BluetoothSerial as BluetoothSerial;
  }
  return null;
};

// Weight scale service UUIDs (for BLE fallback on web)
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
  const dataBufferRef = useRef<string>('');

  // Check if Bluetooth is supported
  const isBluetoothSupported = useCallback((): boolean => {
    if (isNative()) {
      return true; // Native always supports Bluetooth
    }
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }, []);

  // Parse weight data from HC-05 serial data
  const parseWeightData = useCallback((data: string): number | null => {
    // HC-05 scales typically send weight in formats like:
    // "12.34kg", "12.34 kg", "12.34", "+12.34kg", "ST,GS,   12.34kg"
    dataBufferRef.current += data;
    
    // Look for weight patterns
    const patterns = [
      /([+-]?\d+\.?\d*)\s*kg/i,
      /([+-]?\d+\.?\d*)\s*g/i,
      /ST,GS,\s*([+-]?\d+\.?\d*)/i,
      /([+-]?\d+\.?\d*)[\r\n]/,
    ];

    for (const pattern of patterns) {
      const match = dataBufferRef.current.match(pattern);
      if (match) {
        let weight = parseFloat(match[1]);
        // Convert grams to kg if 'g' pattern
        if (pattern.source.includes('\\s*g') && weight > 100) {
          weight = weight / 1000;
        }
        dataBufferRef.current = ''; // Clear buffer after successful parse
        return weight;
      }
    }

    // Keep only last 100 chars in buffer to prevent memory issues
    if (dataBufferRef.current.length > 100) {
      dataBufferRef.current = dataBufferRef.current.slice(-50);
    }
    
    return null;
  }, []);

  // Native Bluetooth scan using Classic Bluetooth
  const scanNative = useCallback(async () => {
    const bluetoothSerial = getBluetoothSerial();
    if (!bluetoothSerial) {
      toast({
        title: "Bluetooth Not Available",
        description: "Bluetooth Serial plugin not found. Please run as native app.",
        variant: "destructive",
      });
      return;
    }

    setIsScanning(true);
    setDevices([]);

    try {
      // Check if Bluetooth is enabled
      const { enabled } = await bluetoothSerial.isEnabled();
      if (!enabled) {
        await bluetoothSerial.enable();
      }

      // Get paired devices
      const pairedDevices = await bluetoothSerial.list();
      
      const deviceList: BluetoothDeviceInfo[] = pairedDevices.map((device, index) => ({
        id: device.id || device.address,
        name: device.name || `Unknown Device ${index + 1}`,
        address: device.address,
        rssi: -50,
        connected: false,
      }));

      setDevices(deviceList);

      if (deviceList.length === 0) {
        toast({
          title: "No Devices Found",
          description: "No paired Bluetooth devices found. Please pair your HC-05 device in Android settings first.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Devices Found",
          description: `Found ${deviceList.length} paired device(s)`,
        });
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({
        title: "Scan Failed",
        description: err.message || "Failed to scan for Bluetooth devices",
        variant: "destructive",
      });
      console.error('Bluetooth scan error:', error);
    }

    setIsScanning(false);
  }, []);

  // Web Bluetooth scan (BLE only)
  const scanWeb = useCallback(async () => {
    setIsScanning(true);
    setDevices([]);

    if (!('bluetooth' in navigator)) {
      toast({
        title: "Bluetooth Not Supported",
        description: "Your browser doesn't support Web Bluetooth. Please use the native Android app for HC-05 support.",
        variant: "destructive",
      });
      setIsScanning(false);
      return;
    }

    try {
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
          rssi: -50,
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
      if (err.name !== 'NotFoundError') {
        toast({
          title: "Scan Failed",
          description: err.message || "Failed to scan for Bluetooth devices",
          variant: "destructive",
        });
      }
      console.error('Bluetooth scan error:', error);
    }

    setIsScanning(false);
  }, []);

  // Unified scan function
  const scanForDevices = useCallback(async () => {
    if (isNative()) {
      await scanNative();
    } else {
      await scanWeb();
    }
  }, [scanNative, scanWeb]);

  // Native connect using Classic Bluetooth
  const connectNative = useCallback(async (deviceInfo: BluetoothDeviceInfo): Promise<BluetoothDeviceInfo | null> => {
    const bluetoothSerial = getBluetoothSerial();
    if (!bluetoothSerial) {
      toast({
        title: "Connection Failed",
        description: "Bluetooth Serial plugin not available",
        variant: "destructive",
      });
      return null;
    }

    setIsConnecting(true);

    try {
      await bluetoothSerial.connect({ address: deviceInfo.address });

      const connectedDev: BluetoothDeviceInfo = {
        ...deviceInfo,
        connected: true,
      };

      setConnectedDevice(connectedDev);

      // Subscribe to incoming data
      await bluetoothSerial.subscribeRaw((data) => {
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(data.data);
        const weight = parseWeightData(text);
        if (weight !== null) {
          setLastWeight(weight);
          toast({
            title: "Weight Updated",
            description: `Weight: ${weight.toFixed(2)} kg`,
          });
        }
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
  }, [parseWeightData]);

  // Handle weight notification from BLE device
  const handleWeightNotification = useCallback((event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    if (value && value.byteLength >= 3) {
      const weight = value.getUint16(1, true) / 100;
      setLastWeight(weight);
      
      toast({
        title: "Weight Updated",
        description: `Weight: ${weight.toFixed(2)} kg`,
      });
    }
  }, []);

  // Web connect using BLE
  const connectWeb = useCallback(async (deviceInfo: BluetoothDeviceInfo): Promise<BluetoothDeviceInfo | null> => {
    setIsConnecting(true);

    try {
      if (!deviceInfo.device) {
        throw new Error('No Bluetooth device reference');
      }

      const server = await deviceInfo.device.gatt?.connect();
      
      if (!server) {
        throw new Error('Failed to connect to GATT server');
      }

      let characteristic: BluetoothRemoteGATTCharacteristic | undefined;

      try {
        const service = await server.getPrimaryService(WEIGHT_SCALE_SERVICE);
        characteristic = await service.getCharacteristic(WEIGHT_MEASUREMENT_CHAR);
        await characteristic.startNotifications();
        characteristic.addEventListener('characteristicvaluechanged', handleWeightNotification);
        characteristicRef.current = characteristic;
      } catch (e) {
        console.log('Weight scale service not available');
      }

      const connectedDev: BluetoothDeviceInfo = {
        ...deviceInfo,
        connected: true,
        server: server,
        characteristic: characteristic,
      };

      setConnectedDevice(connectedDev);
      
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

  // Unified connect function
  const connectToDevice = useCallback(async (deviceInfo: BluetoothDeviceInfo): Promise<BluetoothDeviceInfo | null> => {
    if (isNative()) {
      return await connectNative(deviceInfo);
    } else {
      return await connectWeb(deviceInfo);
    }
  }, [connectNative, connectWeb]);

  // Disconnect from device
  const disconnectDevice = useCallback(async () => {
    if (connectedDevice) {
      try {
        if (isNative()) {
          const bluetoothSerial = getBluetoothSerial();
          if (bluetoothSerial) {
            await bluetoothSerial.disconnect();
          }
        } else {
          if (characteristicRef.current) {
            await characteristicRef.current.stopNotifications();
            characteristicRef.current = null;
          }
          
          if (connectedDevice.server) {
            connectedDevice.server.disconnect();
          } else if (connectedDevice.device?.gatt) {
            connectedDevice.device.gatt.disconnect();
          }
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
      setLastWeight(0);
      dataBufferRef.current = '';
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
      if (isNative()) {
        // For native, read from serial
        const bluetoothSerial = getBluetoothSerial();
        if (bluetoothSerial) {
          const { data } = await bluetoothSerial.read();
          const weight = parseWeightData(data);
          if (weight !== null) {
            setLastWeight(weight);
            toast({
              title: "Weight Read",
              description: `Weight: ${weight.toFixed(2)} kg`,
            });
            return weight;
          }
        }
        
        // Return last received weight from subscription
        if (lastWeight > 0) {
          toast({
            title: "Weight Read",
            description: `Weight: ${lastWeight.toFixed(2)} kg`,
          });
          return lastWeight;
        }
      } else {
        // For web (BLE)
        if (connectedDevice.characteristic) {
          const value = await connectedDevice.characteristic.readValue();
          const weight = value.getUint16(1, true) / 100;
          setLastWeight(weight);
          
          toast({
            title: "Weight Read",
            description: `Weight: ${weight.toFixed(2)} kg`,
          });
          
          return weight;
        }
        
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

        if (lastWeight > 0) {
          toast({
            title: "Weight Read",
            description: `Weight: ${lastWeight.toFixed(2)} kg`,
          });
          return lastWeight;
        }
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
  }, [connectedDevice, lastWeight, parseWeightData]);

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
    isNativeApp: isNative(),
  };
};
