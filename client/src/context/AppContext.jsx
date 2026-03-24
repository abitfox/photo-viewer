import { createContext, useContext, useState, useCallback } from 'react';
import { fetchFavorites, fetchTags } from '../services/api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [favorites, setFavorites] = useState([]);
  const [tags, setTags] = useState([]);
  const [currentView, setCurrentView] = useState('browse');
  const [currentPath, setCurrentPath] = useState('');
  const [history, setHistory] = useState([]);
  const [backHistory, setBackHistory] = useState([]);
  const [forwardHistory, setForwardHistory] = useState([]);

  const loadFavorites = useCallback(async () => {
    try {
      const data = await fetchFavorites();
      setFavorites(data);
    } catch (err) {
      console.error('加载收藏失败:', err);
    }
  }, []);

  const loadTags = useCallback(async () => {
    try {
      const data = await fetchTags();
      setTags(data);
    } catch (err) {
      console.error('加载标签失败:', err);
    }
  }, []);

  const navigateTo = useCallback((path) => {
    if (currentPath && path !== currentPath) {
      setBackHistory(prev => [...prev, currentPath]);
      setForwardHistory([]);
    }
    setCurrentPath(path);
  }, [currentPath]);

  const goBack = useCallback(() => {
    if (backHistory.length === 0) return;
    if (currentPath) {
      setForwardHistory(prev => [...prev, currentPath]);
    }
    const prevPath = backHistory[backHistory.length - 1];
    setBackHistory(prev => prev.slice(0, -1));
    setCurrentPath(prevPath);
    return prevPath;
  }, [backHistory, currentPath]);

  const goForward = useCallback(() => {
    if (forwardHistory.length === 0) return;
    if (currentPath) {
      setBackHistory(prev => [...prev, currentPath]);
    }
    const nextPath = forwardHistory[forwardHistory.length - 1];
    setForwardHistory(prev => prev.slice(0, -1));
    setCurrentPath(nextPath);
    return nextPath;
  }, [forwardHistory, currentPath]);

  const value = {
    favorites,
    setFavorites,
    tags,
    setTags,
    currentView,
    setCurrentView,
    currentPath,
    setCurrentPath,
    history,
    setHistory,
    backHistory,
    setBackHistory,
    forwardHistory,
    setForwardHistory,
    loadFavorites,
    loadTags,
    navigateTo,
    goBack,
    goForward,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
