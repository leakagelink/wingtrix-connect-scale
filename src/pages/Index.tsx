import { useState, useCallback } from 'react';
import { BluetoothSetup } from '@/components/BluetoothSetup';
import { POSMain } from '@/components/POSMain';
import { SplashScreen } from '@/components/SplashScreen';
import { DeveloperCredit } from '@/components/DeveloperCredit';
import { useBluetooth } from '@/hooks/useBluetooth';

const Index = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [showPOS, setShowPOS] = useState(false);
  const {
    devices,
    isScanning,
    connectedDevice,
    isConnecting,
    scanForDevices,
    connectToDevice,
    disconnectDevice,
    readWeight,
  } = useBluetooth();

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  const handleDisconnect = async () => {
    await disconnectDevice();
    setShowPOS(false);
  };

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  if (showPOS && connectedDevice) {
    return (
      <>
        <POSMain
          connectedDevice={connectedDevice}
          onDisconnect={handleDisconnect}
          onReadWeight={readWeight}
        />
        <DeveloperCredit />
      </>
    );
  }

  return (
    <>
      <BluetoothSetup
        devices={devices}
        isScanning={isScanning}
        isConnecting={isConnecting}
        connectedDevice={connectedDevice}
        onScan={scanForDevices}
        onConnect={connectToDevice}
        onContinue={() => setShowPOS(true)}
      />
      <DeveloperCredit />
    </>
  );
};

export default Index;
