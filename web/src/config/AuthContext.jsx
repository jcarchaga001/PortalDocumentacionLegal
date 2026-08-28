import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  clearLegacyDocumentContext,
  resetLegacyDocumentContextForLogin,
  restoreLegacyDocumentContextForCountry,
} from "./legacyDocumentContext.js";
import * as authService from "../services/authService.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    const result = await authService.getCurrentUser();
    if (result.success) {
      restoreLegacyDocumentContextForCountry(result.data?.countryCode);
    }
    setUser(result.success ? result.data : null);
    setLoading(false);
    return result;
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const signIn = useCallback(async (credentials) => {
    const result = await authService.login(credentials);
    if (result.success) {
      resetLegacyDocumentContextForLogin(result.data?.countryCode);
      setUser(result.data);
    }
    return result;
  }, []);

  const signOut = useCallback(async () => {
    await authService.logout();
    clearLegacyDocumentContext();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signOut, refreshSession }),
    [user, loading, signIn, signOut, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider.");
  return context;
}
