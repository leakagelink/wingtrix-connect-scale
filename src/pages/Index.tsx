import { useState } from 'react';
import { BluetoothSetup } from '@/components/BluetoothSetup';
import { POSMain } from '@/components/POSMain';
import { useBluetooth } from '@/hooks/useBluetooth';

const Index = () => {
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

  const handleDisconnect = async () => {
    await disconnectDevice();
    setShowPOS(false);
  };

  if (showPOS && connectedDevice) {
    return (
      <POSMain
        connectedDevice={connectedDevice}
        onDisconnect={handleDisconnect}
        onReadWeight={readWeight}
      />
    );
  }

  return (
    <BluetoothSetup
      devices={devices}
      isScanning={isScanning}
      isConnecting={isConnecting}
      connectedDevice={connectedDevice}
      onScan={scanForDevices}
      onConnect={connectToDevice}
      onContinue={() => setShowPOS(true)}
    />
  );
};

export default Index;
