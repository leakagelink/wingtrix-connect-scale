import { useState, useCallback, useRef, useEffect } from 'react';
import { BluetoothDeviceInfo } from '@/types/bluetooth';
import { toast } from '@/hooks/use-toast';

// Check if running in Capacitor native environment
const isNative = (): boolean => {
  return typeof (window as any).Capacitor !== 'undefined';
};

// Import the Capacitor Bluetooth Communication plugin dynamically
let BluetoothCommunication: any = null;

const initBluetoothPlugin = async () => {
  if (isNative() && !BluetoothCommunication) {
    try {
      const module = await import('@yesprasoon/capacitor-bluetooth-communication');
      BluetoothCommunication = module.BluetoothCommunication;
      await BluetoothCommunication.initialize();
      console.log('Bluetooth plugin initialized');
    } catch (error) {
      console.error('Failed to initialize Bluetooth plugin:', error);
    }
  }
  return BluetoothCommunication;
};

// Weight scale service UUIDs (for BLE fallback on web)
const WEIGHT_SCALE_SERVICE = '0000181d-0000-1000-8000-00805f9b34fb';
const WEIGHT_MEASUREMENT_CHAR = '00002a9d-0000-1000-8000-00805f9b34fb';
const GENERIC_ACCESS_UUID = '00001800-0000-1000-8000-00805f9b34fb';
const DEVICE_INFO_UUID = '0000180a-0000-1000-8000-00805f9b34fb';

// Auto-reconnect configuration
const AUTO_RECONNECT_MAX_ATTEMPTS = 5;
const AUTO_RECONNECT_DELAY_MS = 2000;
const CONNECTION_CHECK_INTERVAL_MS = 3000;

export const useBluetooth = () => {
  const [devices, setDevices] = useState<BluetoothDeviceInfo[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<BluetoothDeviceInfo | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastWeight, setLastWeight] = useState<number>(0);
  const [isPluginReady, setIsPluginReady] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [autoReconnectEnabled, setAutoReconnectEnabled] = useState(true);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  const characteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const dataBufferRef = useRef<string>('');
  const listenerRef = useRef<any>(null);
  const lastConnectedDeviceRef = useRef<BluetoothDeviceInfo | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const manualDisconnectRef = useRef(false);

  // Initialize plugin on mount
  useEffect(() => {
    if (isNative()) {
      initBluetoothPlugin().then((plugin) => {
        if (plugin) {
          setIsPluginReady(true);
        }
      });
    }
    
    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (connectionCheckIntervalRef.current) {
        clearInterval(connectionCheckIntervalRef.current);
      }
      if (listenerRef.current) {
        listenerRef.current.remove();
      }
    };
  }, []);

  // Check if Bluetooth is supported
  const isBluetoothSupported = useCallback((): boolean => {
    if (isNative()) {
      return true;
    }
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }, []);

  // Parse weight data from HC-05 serial data
  const parseWeightData = useCallback((data: string): number | null => {
    dataBufferRef.current += data;
    
    const patterns = [
      /([+-]?\d+\.?\d*)\s*kg/i,
      /([+-]?\d+\.?\d*)\s*g(?!s)/i,
      /ST,GS,\s*([+-]?\d+\.?\d*)/i,
      /([+-]?\d+\.?\d*)[\r\n]/,
      /^\s*([+-]?\d+\.?\d*)\s*$/m,
    ];

    for (const pattern of patterns) {
      const match = dataBufferRef.current.match(pattern);
      if (match) {
        let weight = parseFloat(match[1]);
        if (pattern.source.includes('g(?!s)') && weight > 100) {
          weight = weight / 1000;
        }
        dataBufferRef.current = '';
        return weight;
      }
    }

    if (dataBufferRef.current.length > 100) {
      dataBufferRef.current = dataBufferRef.current.slice(-50);
    }
    
    return null;
  }, []);

  // Setup data listener for native Bluetooth
  const setupDataListener = useCallback(async () => {
    if (!isNative() || !BluetoothCommunication) return;

    try {
      if (listenerRef.current) {
        listenerRef.current.remove();
      }

      listenerRef.current = await BluetoothCommunication.addListener('dataReceived', (data: { data: string }) => {
        console.log('Received data:', data.data);
        const weight = parseWeightData(data.data);
        if (weight !== null && weight > 0) {
          setLastWeight(weight);
          toast({
            title: "Weight Updated",
            description: `Weight: ${weight.toFixed(2)} kg`,
          });
        }
      });
    } catch (error) {
      console.error('Failed to setup data listener:', error);
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

  // Check connection status for native
  const checkNativeConnection = useCallback(async (): Promise<boolean> => {
    if (!isNative() || !BluetoothCommunication) return false;
    
    try {
      // Try to check if still connected by sending a ping or checking status
      const result = await BluetoothCommunication.isConnected?.();
      return result?.connected ?? false;
    } catch (error) {
      return false;
    }
  }, []);

  // Auto-reconnect function
  const attemptReconnect = useCallback(async (deviceInfo: BluetoothDeviceInfo) => {
    if (!autoReconnectEnabled || manualDisconnectRef.current) {
      return;
    }

    if (reconnectAttempts >= AUTO_RECONNECT_MAX_ATTEMPTS) {
      toast({
        title: "Reconnection Failed",
        description: `Could not reconnect after ${AUTO_RECONNECT_MAX_ATTEMPTS} attempts. Please reconnect manually.`,
        variant: "destructive",
      });
      setIsReconnecting(false);
      setReconnectAttempts(0);
      return;
    }

    setIsReconnecting(true);
    setReconnectAttempts(prev => prev + 1);

    toast({
      title: "Reconnecting...",
      description: `Attempt ${reconnectAttempts + 1}/${AUTO_RECONNECT_MAX_ATTEMPTS}`,
    });

    try {
      if (isNative() && BluetoothCommunication) {
        await BluetoothCommunication.connect({ address: deviceInfo.address });
        
        const connectedDev: BluetoothDeviceInfo = {
          ...deviceInfo,
          connected: true,
        };

        setConnectedDevice(connectedDev);
        lastConnectedDeviceRef.current = connectedDev;
        await setupDataListener();
        startConnectionMonitoring();

        toast({
          title: "Reconnected!",
          description: `Successfully reconnected to ${deviceInfo.name}`,
        });

        setIsReconnecting(false);
        setReconnectAttempts(0);
      } else if (deviceInfo.device?.gatt) {
        const server = await deviceInfo.device.gatt.connect();
        
        if (server) {
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
          lastConnectedDeviceRef.current = connectedDev;

          toast({
            title: "Reconnected!",
            description: `Successfully reconnected to ${deviceInfo.name}`,
          });

          setIsReconnecting(false);
          setReconnectAttempts(0);
        }
      }
    } catch (error) {
      console.error('Reconnection attempt failed:', error);
      
      // Schedule next reconnection attempt
      reconnectTimeoutRef.current = setTimeout(() => {
        attemptReconnect(deviceInfo);
      }, AUTO_RECONNECT_DELAY_MS);
    }
  }, [autoReconnectEnabled, reconnectAttempts, setupDataListener, handleWeightNotification]);

  // Handle disconnection event
  const handleDisconnection = useCallback((deviceInfo: BluetoothDeviceInfo) => {
    if (manualDisconnectRef.current) {
      manualDisconnectRef.current = false;
      return;
    }

    toast({
      title: "Connection Lost",
      description: `${deviceInfo.name} was disconnected. Attempting to reconnect...`,
      variant: "destructive",
    });

    setConnectedDevice(null);
    characteristicRef.current = null;

    // Stop connection monitoring
    if (connectionCheckIntervalRef.current) {
      clearInterval(connectionCheckIntervalRef.current);
    }

    // Start auto-reconnect
    if (autoReconnectEnabled && lastConnectedDeviceRef.current) {
      reconnectTimeoutRef.current = setTimeout(() => {
        attemptReconnect(lastConnectedDeviceRef.current!);
      }, AUTO_RECONNECT_DELAY_MS);
    }
  }, [autoReconnectEnabled, attemptReconnect]);

  // Start connection monitoring for native
  const startConnectionMonitoring = useCallback(() => {
    if (!isNative()) return;

    if (connectionCheckIntervalRef.current) {
      clearInterval(connectionCheckIntervalRef.current);
    }

    connectionCheckIntervalRef.current = setInterval(async () => {
      const isConnected = await checkNativeConnection();
      
      if (!isConnected && connectedDevice && !isReconnecting) {
        handleDisconnection(connectedDevice);
      }
    }, CONNECTION_CHECK_INTERVAL_MS);
  }, [checkNativeConnection, connectedDevice, isReconnecting, handleDisconnection]);

  // Native Bluetooth scan using Classic Bluetooth
  const scanNative = useCallback(async () => {
    if (!BluetoothCommunication) {
      await initBluetoothPlugin();
    }

    if (!BluetoothCommunication) {
      toast({
        title: "Bluetooth Not Available",
        description: "Bluetooth plugin not initialized. Please restart the app.",
        variant: "destructive",
      });
      return;
    }

    setIsScanning(true);
    setDevices([]);

    try {
      try {
        await BluetoothCommunication.enableBluetooth();
      } catch (e) {
        console.log('Bluetooth already enabled or user denied');
      }

      const result = await BluetoothCommunication.scanDevices();
      
      const deviceList: BluetoothDeviceInfo[] = (result.devices || []).map((device: any, index: number) => ({
        id: device.address || device.id,
        name: device.name || `Unknown Device ${index + 1}`,
        address: device.address,
        rssi: device.rssi || -50,
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
    if (!BluetoothCommunication) {
      toast({
        title: "Connection Failed",
        description: "Bluetooth plugin not available",
        variant: "destructive",
      });
      return null;
    }

    setIsConnecting(true);
    manualDisconnectRef.current = false;

    try {
      await BluetoothCommunication.connect({ address: deviceInfo.address });

      const connectedDev: BluetoothDeviceInfo = {
        ...deviceInfo,
        connected: true,
      };

      setConnectedDevice(connectedDev);
      lastConnectedDeviceRef.current = connectedDev;

      await setupDataListener();
      startConnectionMonitoring();

      toast({
        title: "Connected!",
        description: `Successfully connected to ${deviceInfo.name}`,
      });

      setIsConnecting(false);
      setReconnectAttempts(0);
      return connectedDev;
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({
        title: "Connection Failed",
        description: err.message || "Failed to connect to device. Make sure the device is paired and in range.",
        variant: "destructive",
      });
      console.error('Connection error:', error);
      setIsConnecting(false);
      return null;
    }
  }, [setupDataListener, startConnectionMonitoring]);

  // Web connect using BLE
  const connectWeb = useCallback(async (deviceInfo: BluetoothDeviceInfo): Promise<BluetoothDeviceInfo | null> => {
    setIsConnecting(true);
    manualDisconnectRef.current = false;

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
      lastConnectedDeviceRef.current = connectedDev;
      
      // Listen for disconnection with auto-reconnect
      deviceInfo.device.addEventListener('gattserverdisconnected', () => {
        handleDisconnection(connectedDev);
      });

      toast({
        title: "Connected!",
        description: `Successfully connected to ${deviceInfo.name}`,
      });

      setIsConnecting(false);
      setReconnectAttempts(0);
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
  }, [handleWeightNotification, handleDisconnection]);

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
    // Mark as manual disconnect to prevent auto-reconnect
    manualDisconnectRef.current = true;
    
    // Clear any pending reconnect attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Stop connection monitoring
    if (connectionCheckIntervalRef.current) {
      clearInterval(connectionCheckIntervalRef.current);
      connectionCheckIntervalRef.current = null;
    }

    setIsReconnecting(false);
    setReconnectAttempts(0);

    if (connectedDevice) {
      try {
        if (isNative() && BluetoothCommunication) {
          if (listenerRef.current) {
            listenerRef.current.remove();
            listenerRef.current = null;
          }
          await BluetoothCommunication.disconnect();
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
      lastConnectedDeviceRef.current = null;
      setDevices([]);
      setLastWeight(0);
      dataBufferRef.current = '';
    }
  }, [connectedDevice]);

  // Toggle auto-reconnect
  const toggleAutoReconnect = useCallback((enabled: boolean) => {
    setAutoReconnectEnabled(enabled);
    
    if (!enabled) {
      // Cancel any pending reconnection attempts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      setIsReconnecting(false);
      setReconnectAttempts(0);
    }
  }, []);

  // Cancel reconnection manually
  const cancelReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsReconnecting(false);
    setReconnectAttempts(0);
    
    toast({
      title: "Reconnection Cancelled",
      description: "Auto-reconnect has been cancelled.",
    });
  }, []);

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
      if (isNative() && BluetoothCommunication) {
        try {
          await BluetoothCommunication.write({ data: 'R\n' });
        } catch (e) {
          console.log('Write command not needed or failed');
        }

        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (lastWeight > 0) {
          toast({
            title: "Weight Read",
            description: `Weight: ${lastWeight.toFixed(2)} kg`,
          });
          return lastWeight;
        }

        toast({
          title: "Waiting for Data",
          description: "Place item on scale. Weight will update automatically.",
        });
        return lastWeight;
      } else {
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
        title: "No Data",
        description: "Place item on scale and try again.",
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
    isNativeApp: isNative(),
    isPluginReady,
    // Auto-reconnect features
    isReconnecting,
    autoReconnectEnabled,
    reconnectAttempts,
    toggleAutoReconnect,
    cancelReconnect,
  };
};
