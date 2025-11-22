'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { client } from '@/lib/eden-client';

interface AdminContextType {
  isAuthenticated: boolean;
  username: string | null;
  loading: boolean;
  login: (sessionId: string, username: string) => void;
  logout: () => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    checkSession();
  }, [pathname]);

  const checkSession = async () => {
    const sessionId = localStorage.getItem('sessionId');

    if (!sessionId) {
      setIsAuthenticated(false);
      setUsername(null);
      setLoading(false);

      // Redirect to login if not on public pages
      if (pathname !== '/login' && pathname !== '/setup') {
        router.push('/login');
      }
      return;
    }

    try {
      const response = await client.api.admin.session.get({
        headers: {
          Authorization: `Bearer ${sessionId}`
        }
      });

      if (response.data && 'valid' in response.data && response.data.valid) {
        setIsAuthenticated(true);
        setUsername(response.data.admin?.username || null);
      } else {
        // Invalid session
        localStorage.removeItem('sessionId');
        setIsAuthenticated(false);
        setUsername(null);

        if (pathname !== '/login' && pathname !== '/setup') {
          router.push('/login');
        }
      }
    } catch (error) {
      localStorage.removeItem('sessionId');
      setIsAuthenticated(false);
      setUsername(null);

      if (pathname !== '/login' && pathname !== '/setup') {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const login = (sessionId: string, username: string) => {
    localStorage.setItem('sessionId', sessionId);
    setIsAuthenticated(true);
    setUsername(username);
  };

  const logout = async () => {
    const sessionId = localStorage.getItem('sessionId');

    if (sessionId) {
      try {
        await client.api.admin.logout.post({
          headers: {
            Authorization: `Bearer ${sessionId}`
          }
        });
      } catch (error) {
        // Ignore errors on logout
      }
    }

    localStorage.removeItem('sessionId');
    setIsAuthenticated(false);
    setUsername(null);
    router.push('/login');
  };

  return (
    <AdminContext.Provider value={{ isAuthenticated, username, loading, login, logout }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}
