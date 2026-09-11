import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import logo from '../assets/linzo-logo.png';
import './LinzoMeetPage.css';

function useAnimatedNumber(value) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const start = prev.current;
    const end = value;
    if (start === end) return;

    const duration = 800;
    const startTime = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (t < 1) requestAnimationFrame(tick);
      else prev.current = end;
    };

    requestAnimationFrame(tick);
  }, [value]);

  return display;
}

const ComingSoon = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({ total: 200, newSignups: 0 });
    const [loadingStats, setLoadingStats] = useState(true);
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const [success, setSuccess] = useState(false);
    const [countPop, setCountPop] = useState(false);

    const animatedTotal = useAnimatedNumber(stats.total);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const { data } = await api.get('/waitlist/stats');
                setStats({
                    total: data.total,
                    newSignups: data.newSignups ?? (data.total - 200),
                });
            } catch (err) {
                console.error('Failed to fetch waitlist stats', err);
            } finally {
                // Keep loadingStats slightly delayed for an organic look
                setTimeout(() => {
                    setLoadingStats(false);
                }, 800);
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleJoinWaitlist = async (e) => {
        e.preventDefault();
        setFormError('');
        
        const trimmed = email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
            setFormError('Please enter a valid email address.');
            return;
        }

        setSubmitting(true);
        try {
            const { data } = await api.post('/waitlist/join', {
                email: trimmed,
                profileType: 'other', // default profile type for general waitlist signup
            });
            setStats({
                total: data.total,
                newSignups: data.total - 200,
            });
            setCountPop(true);
            setTimeout(() => setCountPop(false), 600);
            setSuccess(true);
            setEmail('');
        } catch (err) {
            setFormError(
                err.response?.data?.message || 'Could not join waitlist. Please try again.'
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="linzomeet-page min-h-screen min-h-[100dvh] text-slate-800 font-sans overflow-x-hidden flex flex-col justify-between relative">
            {/* Animated background */}
            <div className="linzomeet-bg" aria-hidden="true">
                <div className="linzomeet-mesh" />
                <div className="linzomeet-orb linzomeet-orb-1" />
                <div className="linzomeet-orb linzomeet-orb-2" />
                <div className="linzomeet-orb linzomeet-orb-3" />
                <div className="linzomeet-grid" />
                <div className="linzomeet-noise" />
            </div>

            <div className="linzomeet-wrap w-full max-w-md md:max-w-lg mx-auto px-6 py-12 flex-1 flex flex-col justify-center relative z-10">
                {/* Header */}
                <header className="linzomeet-enter linzomeet-enter-d1 flex flex-col items-center gap-4 mb-10 text-center">
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="flex items-center justify-center gap-3 group focus:outline-none"
                        aria-label="Linzo home"
                    >
                        <img
                            src={logo}
                            alt="Linzo"
                            className="h-12 w-auto object-contain transition-transform duration-300 group-active:scale-95"
                        />
                    </button>
                    <span className="linzomeet-badge inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-[#684CFE]">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 linzomeet-live-dot" />
                        Platform Coming Soon
                    </span>
                </header>

                {/* Coming Soon content card */}
                <div className={`linzomeet-enter linzomeet-enter-d2 linzomeet-surface rounded-3xl p-6 sm:p-10 shadow-2xl relative ${countPop ? 'linzomeet-count-pop' : ''}`}>
                    <div className="linzomeet-surface-glow" aria-hidden />
                    
                    {success ? (
                        /* Google Pay style Success Screen */
                        <div className="relative z-10 text-center py-6 flex flex-col items-center">
                            <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
                                {/* Ripple Rings */}
                                <div className="gpay-ripple-1"></div>
                                <div className="gpay-ripple-2"></div>
                                
                                {/* Main Circle */}
                                <div className="gpay-circle w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                    <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                                        <path className="gpay-check" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            </div>
                            
                            <h2 className="text-2xl font-black text-slate-900 mb-2">You're on the list!</h2>
                            <p className="text-sm text-slate-500 mb-6 leading-relaxed max-w-sm">
                                We've secured your spot. You will be among the very first to know when the platform launches public access.
                            </p>
                            
                            {/* Spot status banner */}
                            <div className="w-full px-5 py-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex flex-col items-center justify-center gap-1 mb-8">
                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">Your Position</span>
                                <span className="text-3xl font-black text-slate-900 tracking-tight">
                                    #{stats.total.toLocaleString()}
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={() => setSuccess(false)}
                                className="linzomeet-cta-btn w-full py-3.5 rounded-2xl bg-[#684CFE] text-white font-bold hover:bg-[#5338d4] active:scale-[0.98] transition-all shadow-lg shadow-[#684CFE]/25 cursor-pointer flex items-center justify-center"
                            >
                                Back to Waitlist
                            </button>
                        </div>
                    ) : (
                        /* Signup Form Screen */
                        <div className="relative z-10">
                            <h1 className="text-4xl md:text-5xl font-black text-slate-900 text-center mb-4 tracking-tight leading-none">
                                Coming <span className="linzomeet-gradient-text">Soon</span>
                            </h1>

                            <p className="text-slate-500 text-sm md:text-base text-center leading-relaxed mb-8 max-w-md mx-auto">
                                The world's most adaptive video meeting platform is almost here. Secure your early access spot today.
                            </p>

                            {/* Waitlist Counter Card */}
                            <div className="bg-white/60 border border-slate-200/50 rounded-2xl p-4 mb-8 text-center shadow-sm">
                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1">
                                    Current Waitlist
                                </span>
                                <div className="flex items-center justify-center gap-1.5 min-h-[3rem]">
                                                                    {loadingStats ? (
                                        <div className="flex items-center justify-center py-1">
                                            {/* Full skeleton loader to represent the entire waitlist counter */}
                                            <div className="linzomeet-skeleton h-10 w-28 rounded-2xl" />
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center">
                                            {/* Complete single number (e.g. 201) animated smoothly */}
                                            <span className={`text-4xl sm:text-5xl font-black linzomeet-gradient-text font-mono tracking-tight transition-transform duration-300 ${countPop ? 'scale-110' : ''}`}>
                                                {animatedTotal}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <span className="text-[11px] text-slate-400 font-semibold mt-1 block">
                                    inclusive users have joined the queue
                                </span>
                            </div>

                            <form onSubmit={handleJoinWaitlist} className="space-y-4">
                                <div>
                                    <input
                                        type="email"
                                        placeholder="Enter your email address"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="linzomeet-input w-full px-5 py-4 rounded-2xl bg-white border-2 border-slate-200 focus:border-[#684CFE] focus:ring-0 outline-none transition-all shadow-sm text-slate-900 text-base"
                                        required
                                        disabled={submitting}
                                    />
                                </div>

                                {formError && (
                                    <div className="text-xs text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl font-medium" role="alert">
                                        {formError}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="linzomeet-cta-btn w-full py-4 rounded-2xl bg-[#684CFE] text-white font-bold hover:bg-[#5338d4] disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] transition-all shadow-xl shadow-[#684CFE]/20 cursor-pointer flex items-center justify-center"
                                >
                                    {submitting ? 'Securing Spot...' : 'Join Exclusive Waitlist'}
                                </button>
                            </form>
                        </div>
                    )}
                </div>

                {/* Additional action/info links */}
                <div className="linzomeet-enter linzomeet-enter-d3 mt-8 flex justify-center gap-6 text-sm font-bold text-[#684CFE]">
                    <button
                        type="button"
                        onClick={() => navigate('/login')}
                        className="hover:text-[#5338d4] hover:underline focus:outline-none transition-colors"
                    >
                        Sign In
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="hover:text-[#5338d4] hover:underline focus:outline-none transition-colors"
                    >
                        Go Home
                    </button>
                </div>
            </div>

            {/* Footer */}
            <footer className="linzomeet-enter linzomeet-enter-d5 text-center text-[11px] sm:text-xs text-slate-400 py-6 leading-relaxed mt-auto relative z-10">
                <p>© {new Date().getFullYear()} Linzo · Adaptive Multimodal Communication</p>
            </footer>
        </div>
    );
};

export default ComingSoon;
