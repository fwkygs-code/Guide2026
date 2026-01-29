import { createContext, useContext } from 'react';

const PortalContext = createContext(null);

export const PortalProvider = ({ value, children }) => (
  <PortalContext.Provider value={value}>{children}</PortalContext.Provider>
);

export const usePortal = () => {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error('usePortal must be used within PortalProvider');
  }
  return context;
};
