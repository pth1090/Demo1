import React, { createContext, useCallback, useEffect, useState } from "react";
import type { CurrentUser } from "../types";
import { getCurrentUser, loginUser, registerUser } from "../api/client";

interface AuthState {
  user: CurrentUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, display_name: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: validate stored token
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      setIsLoading(false);
      return;
    }
    getCurrentUser()
      .then(setUser)
      .catch(() => localStorage.removeItem("auth_token"))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const resp = await loginUser(email, password);
    localStorage.setItem("auth_token", resp.access_token);
    setUser(resp.user);
  }, []);

  const register = useCallback(async (
    email: string, password: string, display_name: string
  ) => {
    const resp = await registerUser({ email, password, display_name });
    localStorage.setItem("auth_token", resp.access_token);
    setUser(resp.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
