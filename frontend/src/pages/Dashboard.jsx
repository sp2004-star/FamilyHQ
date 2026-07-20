import { useState, useEffect } from 'react';
import { useFamily } from '../context/FamilyContext';
import { api } from '../api';
import { AlertTriangle, Clock, FileText, TrendingUp, FolderOpen, Shield } from 'lucide-react';

const categoryIcons = {
  ID: Shield,
  Insurance: FileText,
  Medical: TrendingUp,
  Financial: TrendingUp,
  Education: FileText,
  Other: FolderOpen,
};

const categoryColors = {
  ID: 'bg-blue-100 text-blue-700',
  Insurance: 'bg-purple-100 text-purple-700',
  Medical: 'bg-red-100 text-red-700',
  Financial: 'bg-green-100 text-green-700',
  Education: 'bg-amber-100 text-amber-700',
  Other: 'bg-slate-100 text-slate-700',
};

function getExpiryStatus(expiryDate) {
  if (!expiryDate) return null;
  const days = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: 'Expired', color: 'bg-red-100 text-red-700 border-red-200', urgency: 'red' };
  if (days <= 7) return { label: `${days}d left`, color: 'bg-red-100 text-red-700 border-red-200', urgency: 'red' };
  if (days <= 30) return { label: `${days}d left`, color: 'bg-amber-100 text-amber-700 border-amber-200', urgency: 'yellow' };
  return { label: `${days}d left`, color: 'bg-green-100 text-green-700 border-green-200', urgency: 'green' };
}

export default function Dashboard() {
  const { currentFamily } = useFamily();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentFamily) loadDashboard();
  }, [currentFamily]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const d = await api.getDashboard(currentFamily.id);
      setData(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Overview for {currentFamily?.name}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Total Documents" value={data.totalDocuments} color="primary" />
        <StatCard icon={AlertTriangle} label="Expiring Soon" value={data.upcomingExpiries.length} color="amber" />
        <StatCard icon={FolderOpen} label="Categories" value={data.byCategory.length} color="sage" />
        <StatCard icon={Clock} label="Recent Shared" value={data.recentShared.length} color="purple" />
      </div>

      {/* Upcoming Expiries */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Upcoming Expiries
          </h2>
        </div>
        {data.upcomingExpiries.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-400">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No documents expiring in the next 30 days</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.upcomingExpiries.map(doc => {
              const status = getExpiryStatus(doc.expiry_date);
              return (
                <div key={doc.id} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${status?.urgency === 'red' ? 'bg-red-500' : status?.urgency === 'yellow' ? 'bg-amber-500' : 'bg-green-500'}`} />
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{doc.name}</p>
                      <p className="text-xs text-slate-400">{doc.category} · {doc.uploaded_by_name}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${status?.color}`}>
                    {status?.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Categories + Recent Shared */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* By Category */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-800">Documents by Category</h2>
          </div>
          <div className="p-6 space-y-3">
            {data.byCategory.length === 0 ? (
              <p className="text-slate-400 text-center py-4">No documents yet</p>
            ) : (
              data.byCategory.map(cat => {
                const Icon = categoryIcons[cat.category] || FolderOpen;
                return (
                  <div key={cat.category} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${categoryColors[cat.category]}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">{cat.category}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-800">{cat.count}</span>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Recently Shared */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-800">Recently Shared</h2>
          </div>
          {data.recentShared.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-400">
              <p>No shared documents yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.recentShared.slice(0, 5).map(doc => (
                <div key={doc.id} className="px-6 py-3 hover:bg-slate-50 transition-colors">
                  <p className="font-medium text-slate-800 text-sm">{doc.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    by {doc.uploaded_by_name} · {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    primary: 'bg-primary-50 text-primary-600',
    amber: 'bg-amber-50 text-amber-600',
    sage: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors[color]} mb-3`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}
