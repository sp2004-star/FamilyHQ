import { Link } from 'react-router-dom';
import { Shield, FolderOpen, Clock, LayoutDashboard, Users, Lock, ArrowRight, Sparkles } from 'lucide-react';

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
    <div className="min-h-screen bg-[#0a0a1a] text-white overflow-hidden relative">
      {/* Ambient background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-primary-600/20 via-purple-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 right-0 w-[400px] h-[400px] bg-gradient-to-bl from-blue-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-gradient-to-tr from-primary-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Nav - glass */}
      <nav className="relative z-10 max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">FamilyVault</span>
        </div>
        <Link
          to="/login"
          className="px-5 py-2 text-sm font-medium text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl backdrop-blur-md transition-all"
        >
          Sign In
        </Link>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs font-medium text-primary-300 mb-8 backdrop-blur-sm">
          <Sparkles className="w-3.5 h-3.5" />
          Private. Organized. Family-first.
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold leading-[1.1] tracking-tight">
          Your family's important<br />documents, <span className="bg-gradient-to-r from-primary-400 to-blue-400 bg-clip-text text-transparent">all in one place</span>
        </h1>
        <p className="mt-6 text-lg text-white/50 max-w-2xl mx-auto leading-relaxed">
          A private vault where family members can securely store, organize, and share critical documents — from insurance policies to medical records — with the people who matter most.
        </p>
        <div className="mt-10">
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold rounded-2xl hover:from-primary-600 hover:to-primary-700 transition-all shadow-xl shadow-primary-500/25 hover:shadow-primary-500/40 text-sm"
          >
            Create Your Vault
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Features - glass cards */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-28">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Everything your family needs</h2>
          <p className="mt-3 text-white/40">Simple, secure, and built for families.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="group bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 hover:bg-white/[0.06] hover:border-white/[0.15] transition-all backdrop-blur-md"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500/20 to-primary-600/10 border border-primary-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:border-primary-500/30 transition-colors">
                <f.icon className="w-5 h-5 text-primary-400" />
              </div>
              <h3 className="font-semibold text-white mb-1.5">{f.title}</h3>
              <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA - glass */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pb-24 text-center">
        <div className="bg-white/[0.04] border border-white/[0.1] backdrop-blur-xl rounded-3xl p-10 sm:p-14">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Ready to secure your family's documents?</h2>
          <p className="mt-3 text-white/40 max-w-lg mx-auto">
            Free to use. Set up your vault in under a minute.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 mt-7 px-7 py-3.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold rounded-2xl hover:from-primary-600 hover:to-primary-700 transition-all shadow-xl shadow-primary-500/25 text-sm"
          >
            Get Started — It's Free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] py-6 text-center text-xs text-white/30">
        © {new Date().getFullYear()} FamilyVault. Built for families, by families.
      </footer>
    </div>
  );
}
