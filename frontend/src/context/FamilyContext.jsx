import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from './AuthContext';

const FamilyContext = createContext(null);

export function FamilyProvider({ children }) {
  const { user } = useAuth();
  const [families, setFamilies] = useState([]);
  const [currentFamily, setCurrentFamily] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadFamilies();
    } else {
      setFamilies([]);
      setCurrentFamily(null);
    }
  }, [user]);

  const loadFamilies = async () => {
    setLoading(true);
    try {
      const data = await api.getFamilies();
      setFamilies(data);
      // Restore last selected family or pick first
      const lastId = localStorage.getItem('currentFamilyId');
      const found = data.find(f => f.id === lastId);
      setCurrentFamily(found || data[0] || null);
    } catch (e) {
      console.error('Failed to load families:', e);
    } finally {
      setLoading(false);
    }
  };

  const switchFamily = (family) => {
    setCurrentFamily(family);
    localStorage.setItem('currentFamilyId', family.id);
  };

  return (
    <FamilyContext.Provider value={{ families, currentFamily, switchFamily, loadFamilies, loading }}>
      {children}
    </FamilyContext.Provider>
  );
}

export const useFamily = () => useContext(FamilyContext);
