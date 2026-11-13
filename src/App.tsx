import React, { useState, useEffect } from 'react';
import { VipCapturePage } from './components/public/VipCapturePage';
import { AdminLogin } from './components/admin/AdminLogin';
import { AdminLayout } from './components/admin/AdminLayout';
import { api } from './services/api';
import { Store } from './types';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return typeof window !== 'undefined' ? window.location.pathname : '/';
  });
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);

  // Keep state synced with browser history
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Restore the Supabase session and ask the server to authorize it.
  useEffect(() => {
    if (window.location.pathname.startsWith('/vip/')) return;
    api.checkCurrentSession().then((res) => {
      setIsAdminAuthenticated(res.authenticated);
      if (res.authenticated && window.location.pathname === '/') navigateTo('/admin');
      if (!res.authenticated && window.location.pathname.startsWith('/admin')) navigateTo('/');
    });
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo(0, 0);
  };

  // If user is already authenticated and visits root '/', redirect to '/admin'
  useEffect(() => {
    if (currentPath === '/' && isAdminAuthenticated) {
      navigateTo('/admin');
    }
  }, [currentPath, isAdminAuthenticated]);

  // Pre-load stores for switcher and fallback navigation
  useEffect(() => {
    api
      .getStores()
      .then((data) => setStores(data))
      .catch(() => {
        setStores([
          {
            id: 'store-barigui',
            name: 'Barigui',
            slug: 'barigui',
            description: '',
            logoUrl: '/logo.png',
            isActive: true,
            distributionMode: 'automatic',
            createdAt: '',
            updatedAt: '',
          },
          {
            id: 'store-quadrata',
            name: 'Quadrata',
            slug: 'quadrata',
            description: '',
            logoUrl: '/logo.png',
            isActive: true,
            distributionMode: 'automatic',
            createdAt: '',
            updatedAt: '',
          },
          {
            id: 'store-patio',
            name: 'Pátio',
            slug: 'patio',
            description: '',
            logoUrl: '/logo.png',
            isActive: true,
            distributionMode: 'automatic',
            createdAt: '',
            updatedAt: '',
          },
        ]);
      });
  }, []);

  // 1. Public VIP Capture Pages: /vip/:slug (e.g. /vip/barigui, /vip/quadrata, /vip/patio)
  const vipMatch = currentPath.match(/^\/vip\/([a-zA-Z0-9_-]+)/);
  if (vipMatch) {
    const slug = vipMatch[1];
    return (
      <VipCapturePage
        slug={slug}
        onNavigateToAdmin={() => navigateTo(isAdminAuthenticated ? '/admin' : '/')}
        onSelectStore={(newSlug) => navigateTo(`/vip/${newSlug}`)}
        allStores={stores.map((s) => ({ slug: s.slug, name: s.name }))}
      />
    );
  }

  // 2. Protected Admin Dashboard (/admin)
  if (currentPath.startsWith('/admin')) {
    if (!isAdminAuthenticated) {
      return (
        <AdminLogin
          onLoginSuccess={() => {
            setIsAdminAuthenticated(true);
            navigateTo('/admin');
          }}
        />
      );
    }

    return (
      <AdminLayout
        onLogout={async () => {
          await api.logout();
          setIsAdminAuthenticated(false);
          navigateTo('/');
        }}
        onNavigateToPublic={(slug = stores[0]?.slug || 'barigui') => navigateTo(`/vip/${slug}`)}
      />
    );
  }

  // 3. Root route (/): Direct Admin Login screen for unauthenticated visitors
  // Authenticated users are automatically redirected to /admin via useEffect above
  return (
    <AdminLogin
      onLoginSuccess={() => {
        setIsAdminAuthenticated(true);
        navigateTo('/admin');
      }}
    />
  );
}
