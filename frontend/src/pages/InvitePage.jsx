import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { api } from '../api';
import { FileText, Users, AlertCircle, CheckCircle } from 'lucide-react';

export default function InvitePage() {
  const { token } = useParams();
  const { user } = useAuth();
  const { loadFamilies, switchFamily } = useFamily();
  const navigate = useNavigate();
  const [inviteInfo, setInviteInfo] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadInviteInfo();
  }, [token]);

  const loadInviteInfo = async () => {
    try {
      const info = await api.getInviteInfo(token);
      setInviteInfo(info);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!user) {
      // Redirect to signup with invite token saved
      localStorage.setItem('pendingInvite', token);
      navigate('/signup');
      return;
    }

    setJoining(true);
    try {
      const result = await api.joinFamily(token);
      setSuccess(true);
      await loadFamilies();
      if (result.family) switchFamily(result.family);
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  };

  // Auto-join after signup if there's a pending invite
  useEffect(() => {
    if (user) {
      const pending = localStorage.getItem('pendingInvite');
      if (pending === token && !success && !error) {
        localStorage.removeItem('pendingInvite');
        handleJoin();
      }
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-sage-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-sage-50 px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl mb-4 shadow-lg shadow-primary-200">
            <FileText className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Family Document Vault</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100">
          {error ? (
            <div className="text-center">
              <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
              <h2 className="text-lg font-semibold text-slate-800 mb-2">Invalid Invitation</h2>
              <p className="text-slate-500 mb-6">{error}</p>
              <Link to="/login" className="inline-block px-6 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700">
                Go to Login
              </Link>
            </div>
          ) : success ? (
            <div className="text-center">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
              <h2 className="text-lg font-semibold text-slate-800 mb-2">Welcome to the family!</h2>
              <p className="text-slate-500">You've successfully joined. Redirecting...</p>
            </div>
          ) : (
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto text-primary-500 mb-4" />
              <h2 className="text-lg font-semibold text-slate-800 mb-2">You're invited!</h2>
              <p className="text-slate-500 mb-1">
                <strong>{inviteInfo?.invitedByName}</strong> invited you to join
              </p>
              <p className="text-xl font-bold text-primary-700 mb-6">"{inviteInfo?.familyName}"</p>

              {user ? (
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl shadow-md shadow-primary-200 disabled:opacity-50"
                >
                  {joining ? 'Joining...' : 'Accept & Join Family'}
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500">Sign in or create an account to join:</p>
                  <Link to="/login" className="block w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl text-center shadow-md shadow-primary-200">
                    Sign In
                  </Link>
                  <Link to="/signup" onClick={() => localStorage.setItem('pendingInvite', token)} className="block w-full py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl text-center">
                    Create Account
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
