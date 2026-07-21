import { Link } from 'react-router-dom';
import { Shield, FolderOpen, Clock, LayoutDashboard, Users, Lock } from 'lucide-react';

const features = [
  {
    icon: Lock,
    title: 'Private & Shared',
    desc: 'Store documents privately for yourself, or share them with your family — you choose who sees what.',
  },
  {
    icon: FolderOpen,
    title: 'Organized Categories',
    desc: 'Sort documents into categories like Insurance, Legal, Medical, Finance, and more.',
  },
  {
    icon: Clock,
    title: 'Expiry Tracking',
    desc: 'Get reminders before important documents expire — never miss a renewal deadline.',
  },
  {
    icon: LayoutDashboard,
    title: 'Dashboard Overview',
    desc: 'See upcoming expiries, recent shares, and document stats at a glance.',
  },
  {
    icon: Users,
    title: 'Family Access',
    desc: 'Invite family members with a simple link. Everyone gets their own secure space.',
  },
  {
    icon: Shield,
    title: 'Secure by Design',
    desc: 'Encrypted storage, private by default, and role-based access control.',
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-primary-50">
      {/* Nav */}
      <nav className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-900">FamilyVault</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-primary-700 transition-colors"
          >
            Sign In
          </Link>
          <Link
            to="/signup"
            className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors shadow-sm"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary-50 border border-primary-100 rounded-full text-xs font-medium text-primary-700 mb-6">
          <Shield className="w-3.5 h-3.5" />
          Private. Organized. Family-first.
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight tracking-tight">
          Your family's important<br />documents, <span className="text-primary-600">all in one place</span>
        </h1>
        <p className="mt-5 text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
          A private vault where family members can securely store, organize, and share critical documents — from insurance policies to medical records — with the people who matter most.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            to="/signup"
            className="px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-all shadow-md hover:shadow-lg text-sm"
          >
            Create Your Vault
          </Link>
          <Link
            to="/login"
            className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-all text-sm"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-slate-900">Everything your family needs</h2>
          <p className="mt-2 text-slate-500">Simple, secure, and built for families.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div key={f.title} className="bg-white rounded-2xl border border-slate-100 p-6 hover:shadow-md hover:border-slate-200 transition-all">
              <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-primary-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-1.5">{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 pb-20 text-center">
        <div className="bg-primary-600 rounded-3xl p-10 sm:p-14 text-white">
          <h2 className="text-2xl sm:text-3xl font-bold">Ready to secure your family's documents?</h2>
          <p className="mt-3 text-primary-100 max-w-lg mx-auto">
            Free to use. Set up your vault in under a minute.
          </p>
          <Link
            to="/signup"
            className="inline-block mt-6 px-6 py-3 bg-white text-primary-700 font-semibold rounded-xl hover:bg-primary-50 transition-colors text-sm shadow-sm"
          >
            Get Started — It's Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-6 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} FamilyVault. Built for families, by families.
      </footer>
    </div>
  );
}
