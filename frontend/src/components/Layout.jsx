import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { api } from '../api';
import { FileText, Home, FolderOpen, Settings, Bell, LogOut, Plus, ChevronDown, Users, Menu, X } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const { families, currentFamily, switchFamily, loadFamilies } = useFamily();
  const [showFamilyPicker, setShowFamilyPicker] = useState(false);
  const [showNewFamily, setShowNewFamily] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadNotificationCount();
    const interval = setInterval(loadNotificationCount, 30000);
    return () => clearInterval(interval);
  }, [currentFamily]);

  const loadNotificationCount = async () => {
    try {
      const data = await api.getNotifications({ unreadOnly: 'true' });
      setUnreadCount(data.unreadCount);
    } catch (e) {}
  };

  const handleCreateFamily = async (e) => {
    e.preventDefault();
    if (!newFamilyName.trim()) return;
    try {
      const family = await api.createFamily({ name: newFamilyName.trim() });
      await loadFamilies();
      switchFamily(family);
      setNewFamilyName('');
      setShowNewFamily(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const navLinks = [
    { to: '/', icon: Home, label: 'Dashboard', end: true },
    { to: '/documents', icon: FolderOpen, label: 'Documents' },
    { to: '/family', icon: Settings, label: 'Family' },
  ];

  if (!currentFamily && families.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-sage-50 px-4">
        <div className="w-full max-w-md animate-fade-in text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-6 shadow-lg shadow-primary-200">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome, {user?.name}!</h2>
          <p className="text-slate-500 mb-8">Create your first family to start organizing documents.</p>
          <form onSubmit={handleCreateFamily} className="space-y-4">
            <input
              type="text"
              value={newFamilyName}
              onChange={(e) => setNewFamilyName(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
              placeholder="e.g. The Sharma Family"
              required
            />
            <button type="submit" className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl shadow-md shadow-primary-200 transition-all">
              Create Family
            </button>
          </form>
          <button onClick={logout} className="mt-6 text-sm text-slate-400 hover:text-slate-600">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Nav */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo + Family Picker */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-slate-800 hidden sm:block">FamilyVault</span>
              </div>

              {/* Family Switcher */}
              <div className="relative">
                <button
                  onClick={() => setShowFamilyPicker(!showFamilyPicker)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-all"
                >
                  <span className="max-w-[150px] truncate">{currentFamily?.name}</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {showFamilyPicker && (
                  <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 animate-fade-in">
                    {families.map(f => (
                      <button
                        key={f.id}
                        onClick={() => { switchFamily(f); setShowFamilyPicker(false); }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center justify-between ${f.id === currentFamily?.id ? 'text-primary-600 font-medium bg-primary-50' : 'text-slate-700'}`}
                      >
                        <span>{f.name}</span>
                        <span className="text-xs text-slate-400">{f.role}</span>
                      </button>
                    ))}
                    <hr className="my-2 border-slate-100" />
                    {showNewFamily ? (
                      <form onSubmit={handleCreateFamily} className="px-4 py-2">
                        <input
                          type="text"
                          value={newFamilyName}
                          onChange={(e) => setNewFamilyName(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder="Family name"
                          autoFocus
                        />
                        <div className="flex gap-2 mt-2">
                          <button type="submit" className="px-3 py-1 text-xs bg-primary-600 text-white rounded-md">Create</button>
                          <button type="button" onClick={() => setShowNewFamily(false)} className="px-3 py-1 text-xs text-slate-500">Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <button
                        onClick={() => setShowNewFamily(true)}
                        className="w-full px-4 py-2 text-left text-sm text-primary-600 hover:bg-primary-50 flex items-center gap-2"
                      >
                        <Plus className="w-3.5 h-3.5" /> New family
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map(link => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'}`
                  }
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </NavLink>
              ))}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/family')}
                className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600">
                <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium text-xs">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <span className="max-w-[100px] truncate">{user?.name}</span>
              </div>
              <button onClick={logout} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Sign out">
                <LogOut className="w-4 h-4" />
              </button>
              {/* Mobile menu toggle */}
              <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
                {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        {showMobileMenu && (
          <nav className="md:hidden border-t border-slate-100 bg-white px-4 py-3 animate-fade-in">
            {navLinks.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={() => setShowMobileMenu(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${isActive ? 'bg-primary-50 text-primary-700' : 'text-slate-600'}`
                }
              >
                <link.icon className="w-4 h-4" />
                {link.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      {/* Overlay for dropdowns */}
      {showFamilyPicker && <div className="fixed inset-0 z-40" onClick={() => setShowFamilyPicker(false)} />}

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
