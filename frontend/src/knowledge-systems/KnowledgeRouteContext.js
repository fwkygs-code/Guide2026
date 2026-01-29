import { createContext, useContext } from 'react';

const KnowledgeRouteContext = createContext(null);

export const KnowledgeRouteProvider = ({ value, children }) => (
  <KnowledgeRouteContext.Provider value={value}>
    {children}
  </KnowledgeRouteContext.Provider>
);

export const useKnowledgeRoute = () => {
  const context = useContext(KnowledgeRouteContext);
  if (!context) {
    throw new Error('useKnowledgeRoute must be used within KnowledgeRouteProvider');
  }
  return context;
};
