import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { isFirebaseConfigured } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const { firebaseUser, profile } = useAuth();
  const dashboardHref = profile
    ? profile.role === 'teacher'
      ? '/teacher'
      : profile.role === 'parent'
      ? '/parent'
      : '/student'
    : '/login';
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = time.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-[100dvh] w-full bg-background relative overflow-hidden flex flex-col font-sans">
      {/* Background decorations */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-teal-500/5 rounded-full blur-[100px] pointer-events-none" />
      
      {/* Navigation */}
      <nav className="w-full px-6 md:px-10 py-5 flex items-center justify-between relative z-10 glass-panel border-x-0 border-t-0 rounded-none animate-fade-in-down">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
            <i className="fa-solid fa-graduation-cap text-lg" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">
            EduConnect<span className="text-primary font-extrabold">360</span>
          </span>
        </div>
        
        <div className="flex items-center gap-4 md:gap-6">
          <Link
            href="/parent"
            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors hidden sm:inline-flex items-center gap-2"
          >
            <i className="fa-solid fa-user-group text-primary" /> พอร์ทัลผู้ปกครอง
          </Link>
          <div className="hidden md:flex items-center gap-2.5 text-sm font-medium text-muted-foreground px-4 py-2 rounded-full glass-panel border-white/40">
            <div className={`w-2 h-2 rounded-full ${isFirebaseConfigured ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]'}`} />
            {isFirebaseConfigured ? 'System Online' : 'Connecting...'}
          </div>
          <Link
            href={firebaseUser ? dashboardHref : '/login'}
            className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all duration-300 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 inline-flex items-center"
          >
            {firebaseUser ? 'Dashboard' : 'Sign In'} <i className="fa-solid fa-arrow-right ml-2 text-xs opacity-80" />
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 max-w-7xl mx-auto w-full">
        
        {/* Hero Section */}
        <div className="w-full max-w-4xl text-center mb-16 md:mb-24 mt-8 md:mt-0">
          <div 
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full glass-panel text-sm font-semibold text-primary mb-8 animate-fade-in-up" 
            style={{ animationDelay: '100ms', animationFillMode: 'both' }}
          >
            <i className="fa-regular fa-calendar-check" />
            {formattedDate}
          </div>
          
          <h1 
            className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight text-foreground mb-8 leading-[1.1] animate-fade-in-up"
            style={{ animationDelay: '200ms', animationFillMode: 'both' }}
          >
            The heart of your <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-emerald-500 to-teal-500">
              digital campus.
            </span>
          </h1>
          
          <p 
            className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed animate-fade-in-up"
            style={{ animationDelay: '300ms', animationFillMode: 'both' }}
          >
            Manage classes, track attendance, and connect with students in a workspace designed for clarity, speed, and calm.
          </p>
          
          <div 
            className="flex flex-col sm:flex-row items-center justify-center gap-5 animate-fade-in-up"
            style={{ animationDelay: '400ms', animationFillMode: 'both' }}
          >
            <Link
              href={dashboardHref}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:bg-primary/90 transition-all duration-300 shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/40 hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-3"
            >
              <i className="fa-solid fa-layer-group" />
              Open Dashboard
            </Link>
            <Link
              href="/parent"
              className="w-full sm:w-auto px-8 py-4 rounded-xl glass-panel text-foreground font-semibold text-base hover:bg-white/60 dark:hover:bg-black/20 transition-all duration-300 flex items-center justify-center gap-3 hover:-translate-y-1 active:translate-y-0"
            >
              <i className="fa-solid fa-user-group text-primary" />
              Parent Portal
            </Link>
          </div>
        </div>

        {/* Feature Modules Grid */}
        <div 
          className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full animate-fade-in-up"
          style={{ animationDelay: '600ms', animationFillMode: 'both' }}
        >
          {/* Card 1 */}
          <div className="glass-panel p-8 rounded-3xl flex flex-col items-start group hover:-translate-y-2 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 cursor-pointer border-white/40 dark:border-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full transition-all duration-500 group-hover:scale-125 group-hover:bg-primary/10" />
            <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-2xl mb-6 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500 shadow-inner">
              <i className="fa-solid fa-users-rectangle" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-3">Class Management</h3>
            <p className="text-base text-muted-foreground leading-relaxed flex-1 relative z-10">
              Organize your subjects, schedules, and student rosters with intuitive tools that get out of your way.
            </p>
          </div>

          {/* Card 2 */}
          <div className="glass-panel p-8 rounded-3xl flex flex-col items-start group hover:-translate-y-2 transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-500/10 cursor-pointer border-white/40 dark:border-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full transition-all duration-500 group-hover:scale-125 group-hover:bg-emerald-500/10" />
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-2xl mb-6 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-500 shadow-inner">
              <i className="fa-solid fa-clipboard-user" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-3">Smart Attendance</h3>
            <p className="text-base text-muted-foreground leading-relaxed flex-1 relative z-10">
              Log daily presence in seconds. Instantly identify patterns with automated insights and reporting.
            </p>
          </div>

          {/* Card 3 */}
          <div className="glass-panel p-8 rounded-3xl flex flex-col items-start group hover:-translate-y-2 transition-all duration-500 hover:shadow-2xl hover:shadow-teal-500/10 cursor-pointer border-white/40 dark:border-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-bl-full transition-all duration-500 group-hover:scale-125 group-hover:bg-teal-500/10" />
            <div className="w-14 h-14 rounded-2xl bg-teal-500/10 text-teal-600 flex items-center justify-center text-2xl mb-6 group-hover:scale-110 group-hover:bg-teal-500 group-hover:text-white transition-all duration-500 shadow-inner">
              <i className="fa-solid fa-chart-line" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-3">Campus Insights</h3>
            <p className="text-base text-muted-foreground leading-relaxed flex-1 relative z-10">
              Get a bird's-eye view of your educational ecosystem with real-time analytics and progress tracking.
            </p>
          </div>
        </div>
      </main>
      
      <footer 
        className="w-full py-8 text-center text-sm font-medium text-muted-foreground relative z-10 animate-fade-in-up"
        style={{ animationDelay: '800ms', animationFillMode: 'both' }}
      >
        <p>EduConnect360 &copy; {new Date().getFullYear()}. Crafted for modern educators.</p>
      </footer>
    </div>
  );
}
