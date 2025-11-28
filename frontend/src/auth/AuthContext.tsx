import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { getApiBase } from "../getApiBase";

interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: () => {},
  logout: () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if user is authenticated on mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const apiBase = getApiBase();
        console.log("[Auth] Fetching user from:", `${apiBase}/auth/user`);
        const response = await fetch(`${apiBase}/auth/user`, {
          credentials: "include",
        });
        console.log("[Auth] User fetch response status:", response.status);
        if (response.ok) {
          const data = await response.json();
          console.log("[Auth] User data received:", data);
          setUser(data);
        } else {
          console.log("[Auth] User fetch failed with status:", response.status);
        }
      } catch (error) {
        console.error("[Auth] Failed to fetch user:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const login = () => {
    const loginUrl = `${getApiBase()}/auth/google`;
    console.log("[Auth] Redirecting to login URL:", loginUrl);
    window.location.href = loginUrl;
  };

  const logout = async () => {
    try {
      await fetch(`${getApiBase()}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      setUser(null);
      window.location.href = "/";
    } catch (error) {
      console.error("[Auth] Logout failed:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
