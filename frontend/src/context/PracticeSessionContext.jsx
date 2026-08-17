import { createContext, useContext, useMemo, useState } from "react";

// Lets the practice page tell the rest of the chrome (NavBar) that a session
// is in progress, so navigation away can be locked until it's finished or
// explicitly ended.
const PracticeSessionContext = createContext({ isActive: false, setIsActive: () => {} });

export function PracticeSessionProvider({ children }) {
  const [isActive, setIsActive] = useState(false);
  const value = useMemo(() => ({ isActive, setIsActive }), [isActive]);
  return <PracticeSessionContext.Provider value={value}>{children}</PracticeSessionContext.Provider>;
}

export function usePracticeSession() {
  return useContext(PracticeSessionContext);
}
