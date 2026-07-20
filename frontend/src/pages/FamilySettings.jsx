import { useState, useEffect } from 'react';
import { useFamily } from '../context/FamilyContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { Users, Crown, UserMinus, Mail, RotateCcw, Bell, Check, Trash2, Edit3, Save, X } from 'lucide-react';

export default function FamilySettings() {
  const { currentFamily, loadFamilies, switchFamily } = useFamily();
  const { user } = useAuth();
  const [familyData, setFamilyData] = useState(null);
  const [invites, setInvites] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [tab, setTab] = useState('members');

  useEffect(() => {
    if (currentFamily) loadData();
  }, [currentFamily]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [family, notifs] = await Promise.all([
        api.getFamily(currentFamily.id),
        api.getNotifications({ familyId: currentFamily.id }),
      ]);
      setFamilyData(family);
      setNotifications(notifs.notifications);
      setNewName(family.name);

      if (family.userRole === 'admin') {
        const inv = await api.getInvites(currentFamily.id);
        setInvites(inv);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await api.inviteMember(currentFamily.id, { email: inviteEmail.trim() });
      setInviteEmail('');
      const inv = await api.getInvites(currentFamily.id);
      setInvites(inv);
      alert('Invite sent successfully!');
    } catch (err) {
      alert(err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleResendInvite = async (inviteId) => {
    try {
      await api.resendInvite(currentFamily.id, inviteId);
      alert('Invite resent!');
      const inv = await api.getInvites(currentFamily.id);
      setInvites(inv);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRemoveMember = async (userId, memberName) => {
    if (!confirm(`Remove ${memberName} from the family?`)) return;
    try {
      await api.removeMember(currentFamily.id, userId);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSaveName = async () => {
    try {
      const updated = await api.updateFamily(currentFamily.id, { name: newName });
      setEditingName(false);
      loadFamilies();
      switchFamily(updated);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllRead({ familyId: currentFamily.id });
      setNotifications(prev => prev.map(n => ({ ...n, read: 1 })));
    } catch (e) {}
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!familyData) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Family Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="px-3 py-1 border border-slate-200 rounded-lg text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
                    autoFocus
                  />
                  <button onClick={handleSaveName} className="p-1 text-green-600 hover:bg-green-50 rounded"><Save className="w-4 h-4" /></button>
                  <button onClick={() => { setEditingName(false); setNewName(familyData.name); }} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900">{familyData.name}</h1>
                  {familyData.userRole === 'admin' && (
                    <button onClick={() => setEditingName(true)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
              <p className="text-sm text-slate-500">{familyData.members?.length} member{familyData.members?.length !== 1 ? 's' : ''} · Your role: {familyData.userRole}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        <TabBtn active={tab === 'members'} onClick={() => setTab('members')}>Members</TabBtn>
        {familyData.userRole === 'admin' && <TabBtn active={tab === 'invites'} onClick={() => setTab('invites')}>Invites</TabBtn>}
        <TabBtn active={tab === 'notifications'} onClick={() => setTab('notifications')}>
          Notifications
          {notifications.filter(n => !n.read).length > 0 && (
            <span className="ml-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full inline-flex items-center justify-center">
              {notifications.filter(n => !n.read).length}
            </span>
          )}
        </TabBtn>
      </div>

      {/* Members Tab */}
      {tab === 'members' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {familyData.userRole === 'admin' && (
            <div className="px-6 py-4 border-b border-slate-100">
              <form onSubmit={handleInvite} className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Invite by email..."
                  required
                />
                <button type="submit" disabled={inviting} className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
                  {inviting ? 'Sending...' : 'Invite'}
                </button>
              </form>
            </div>
          )}
          <div className="divide-y divide-slate-100">
            {familyData.members?.map(member => (
              <div key={member.id} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium text-sm">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-slate-800">{member.name}</span>
                      {member.role === 'admin' && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                      {member.id === user?.id && <span className="text-xs text-slate-400">(you)</span>}
                    </div>
                    <span className="text-xs text-slate-400">{member.email}</span>
                  </div>
                </div>
                {familyData.userRole === 'admin' && member.id !== user?.id && (
                  <button
                    onClick={() => handleRemoveMember(member.id, member.name)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                    title="Remove member"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invites Tab */}
      {tab === 'invites' && familyData.userRole === 'admin' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {invites.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-400">
              <Mail className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No invites sent yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {invites.map(invite => (
                <div key={invite.id} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50">
                  <div>
                    <p className="font-medium text-sm text-slate-800">{invite.email}</p>
                    <p className="text-xs text-slate-400">
                      Status: <span className={`font-medium ${invite.status === 'accepted' ? 'text-green-600' : invite.status === 'pending' ? 'text-amber-600' : 'text-red-600'}`}>
                        {invite.status}
                      </span>
                      {' · '}Expires: {new Date(invite.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  {invite.status === 'pending' && (
                    <button onClick={() => handleResendInvite(invite.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-primary-600 hover:bg-primary-50 rounded-lg font-medium">
                      <RotateCcw className="w-3 h-3" /> Resend
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notifications Tab */}
      {tab === 'notifications' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {notifications.length > 0 && (
            <div className="px-6 py-3 border-b border-slate-100 flex justify-end">
              <button onClick={handleMarkAllRead} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                Mark all as read
              </button>
            </div>
          )}
          {notifications.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-400">
              <Bell className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map(n => (
                <div key={n.id} className={`px-6 py-3 ${!n.read ? 'bg-primary-50/50' : ''}`}>
                  <div className="flex items-center gap-2">
                    {!n.read && <div className="w-2 h-2 bg-primary-500 rounded-full" />}
                    <p className="font-medium text-sm text-slate-800">{n.title}</p>
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">{n.message}</p>
                  <p className="text-xs text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center ${
        active ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  );
}
