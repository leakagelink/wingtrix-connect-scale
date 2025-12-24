import { useEffect, useState } from 'react';
import wingtrixLogo from '@/assets/wingtrix-logo.png';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [showContent, setShowContent] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Show content after a brief delay
    const showTimer = setTimeout(() => setShowContent(true), 200);
    
    // Start fade out after 2.5 seconds
    const fadeTimer = setTimeout(() => setFadeOut(true), 2500);
    
    // Complete after 3 seconds
    const completeTimer = setTimeout(() => onComplete(), 3000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div 
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }} />
      </div>

      {/* Main Content */}
      <div className={`relative z-10 flex flex-col items-center space-y-8 transition-all duration-700 ${
        showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}>
        {/* Logo */}
        <div className="relative">
          <div className="absolute inset-0 bg-accent/20 blur-2xl rounded-full scale-150 animate-pulse" />
          <img 
            src={wingtrixLogo} 
            alt="Wingtrix Logo" 
            className="relative w-48 h-auto drop-shadow-2xl"
          />
        </div>

        {/* App Name */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-foreground tracking-wide">
            Wingtrix <span className="text-primary">POS</span>
          </h1>
          <p className="text-muted-foreground text-sm">Smart Billing System</p>
        </div>

        {/* Demo Badge */}
        <div className="demo-badge px-4 py-2 rounded-full border-2 border-warning/50 bg-warning/10">
          <span className="text-warning font-bold tracking-widest text-sm">DEMO APP</span>
        </div>

        {/* Loading Animation */}
        <div className="flex items-center gap-2 mt-8">
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>

      {/* Developer Credit */}
      <div className="absolute bottom-8 text-center">
        <p className="developer-credit text-sm font-medium">
          Developed by <span className="text-primary font-bold">socilet.in</span>
        </p>
      </div>
    </div>
  );
};
