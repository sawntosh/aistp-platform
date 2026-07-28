import { createContext, useContext, useEffect, useState } from "react";
import * as authService from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // On first load, try to turn a stored refresh token into a live session.
  useEffect(() => {
    (async () => {
      const access = await authService.refreshSession();
      if (access) {
        try {
          setUser(await authService.fetchCurrentUser());
        } catch {
          authService.logout();
        }
      }
      setIsLoading(false);
    })();
  }, []);

  async function login(credentials) {
    await authService.login(credentials);
    const me = await authService.fetchCurrentUser();
    setUser(me);
    return me;
  }

  async function register(payload) {
    return authService.register(payload);
  }

  function logout() {
    authService.logout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
