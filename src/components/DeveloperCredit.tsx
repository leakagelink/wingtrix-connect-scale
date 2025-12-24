export const DeveloperCredit = () => {
  return (
    <div className="fixed bottom-4 left-0 right-0 z-50 flex items-center justify-center gap-3 pointer-events-none">
      <div className="demo-badge px-3 py-1 rounded-full border border-warning/30 bg-warning/10">
        <span className="text-warning font-semibold text-xs tracking-wider">DEMO APP</span>
      </div>
      <div className="developer-credit px-4 py-1.5 rounded-full glass-card text-xs font-medium">
        Developed by <span className="text-primary font-bold">socilet.in</span>
      </div>
    </div>
  );
};
