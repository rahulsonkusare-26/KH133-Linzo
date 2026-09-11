import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import logo from '../assets/samvaad-logo.png';
import './SamvaadMeetPage.css';

const RESEARCH_DRIVE_URL =
  import.meta.env.VITE_RESEARCH_DRIVE_URL ||
  'https://drive.google.com/drive/folders/12cLvutE-JzybvN5Sv4_abrY8mx49ke28';

const FALLBACK_STATS = {
  total: 200,
  breakdown: { deaf: 82, mute: 64, other: 54 },
};

const PROFILE_OPTIONS = [
  {
    id: 'deaf',
    label: 'Deaf / Hard of Hearing',
    hint: 'Sign language & captions',
    color: 'text-emerald-600',
    border: 'hover:border-emerald-400',
  },
  {
    id: 'mute',
    label: 'Mute / Non-Verbal',
    hint: 'Sign-to-voice & typing',
    color: 'text-purple-600',
    border: 'hover:border-purple-400',
  },
  {
    id: 'other',
    label: 'Other Profiles',
    hint: 'Hearing, cognitive & more',
    color: 'text-[#684CFE]',
    border: 'hover:border-[#684CFE]',
  },
];

function useReveal(ref, threshold = 0.12) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, threshold]);

  return visible;
}

function useAnimatedNumber(value) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const start = prev.current;
    const end = value;
    if (start === end) return;

    const duration = 600;
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

export default function SamvaadMeetPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(FALLBACK_STATS);
  const [loadingStats, setLoadingStats] = useState(true);
  const [barsReady, setBarsReady] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [profileType, setProfileType] = useState('other');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [countPop, setCountPop] = useState(false);

  const actionsRef = useRef(null);
  const actionsInView = useReveal(actionsRef);
  const [actionsReady, setActionsReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setActionsReady(true), 500);
    return () => clearTimeout(t);
  }, []);

  const actionsVisible = actionsInView || actionsReady;

  const animatedTotal = useAnimatedNumber(stats.total);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/waitlist/stats');
      setStats({
        total: data.total,
        breakdown: data.breakdown,
      });
    } catch {
      setStats(FALLBACK_STATS);
    } finally {
      setLoadingStats(false);
      setTimeout(() => setBarsReady(true), 80);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  useEffect(() => {
    if (!waitlistOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [waitlistOpen]);

  const openWaitlist = () => {
    setWaitlistOpen(true);
    setFormError('');
    setSuccessMessage('');
  };

  const handleJoinWaitlist = async (e) => {
    e.preventDefault();
    setFormError('');
    setSuccessMessage('');

    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setFormError('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post('/waitlist/join', {
        email: trimmed,
        profileType,
      });
      setStats({
        total: data.total,
        breakdown: data.breakdown,
      });
      setCountPop(true);
      setTimeout(() => setCountPop(false), 500);
      setSuccessMessage(data.message || "You're on the list!");
      setEmail('');
    } catch (err) {
      setFormError(
        err.response?.data?.message || 'Could not join waitlist. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openResearch = () => {
    window.open(RESEARCH_DRIVE_URL, '_blank', 'noopener,noreferrer');
  };

  const breakdownItems = [
    {
      key: 'deaf',
      label: 'Deaf / HoH',
      shortLabel: 'Deaf',
      value: stats.breakdown.deaf,
      bar: 'bg-emerald-500',
      text: 'text-emerald-600',
    },
    {
      key: 'mute',
      label: 'Mute / Non-Verbal',
      shortLabel: 'Mute',
      value: stats.breakdown.mute,
      bar: 'bg-purple-500',
      text: 'text-purple-600',
    },
    {
      key: 'other',
      label: 'Other Profiles',
      shortLabel: 'Other',
      value: stats.breakdown.other,
      bar: 'bg-[#684CFE]',
      text: 'text-[#684CFE]',
    },
  ];

  const maxBreakdown = Math.max(...breakdownItems.map((b) => b.value), 1);

  return (
    <div className="samvaadmeet-page min-h-screen min-h-[100dvh] text-slate-800 font-sans overflow-x-hidden">
      {/* Animated background */}
      <div className="samvaadmeet-bg" aria-hidden="true">
        <div className="samvaadmeet-mesh" />
        <div className="samvaadmeet-orb samvaadmeet-orb-1" />
        <div className="samvaadmeet-orb samvaadmeet-orb-2" />
        <div className="samvaadmeet-orb samvaadmeet-orb-3" />
        <div className="samvaadmeet-grid" />
        <div className="samvaadmeet-noise" />
      </div>

      <div className="samvaadmeet-wrap max-w-lg sm:max-w-2xl md:max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 md:py-14 pb-10">
        {/* Header */}
        <header className="samvaadmeet-enter samvaadmeet-enter-d1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 sm:mb-12">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center justify-center sm:justify-start gap-3 group mx-auto sm:mx-0"
            aria-label="Samvaad AI home"
          >
            <img
              src={logo}
              alt="Samvaad AI"
              className="h-11 sm:h-12 w-auto object-contain transition-transform duration-300 group-active:scale-95"
            />
          </button>
          <span className="samvaadmeet-badge inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-[#684CFE] mx-auto sm:mx-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 samvaadmeet-live-dot" />
            Live · Inclusive Communication
          </span>
        </header>

        {/* Hero */}
        <section className="samvaadmeet-enter samvaadmeet-enter-d2 text-center mb-8 sm:mb-10">
          <div className="flex flex-wrap items-center justify-center gap-2 mb-5 sm:mb-6">
            <span className="samvaadmeet-pill inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#684CFE]">
              Sign Language Avatars
            </span>
            <span className="samvaadmeet-pill inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider text-purple-700">
              Privacy-First AI
            </span>
            <span className="samvaadmeet-pill inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider text-indigo-700">
              Cognitive Profiles
            </span>
          </div>

          <h1 className="text-[1.875rem] leading-tight sm:text-4xl md:text-5xl font-black tracking-tight mb-3">
            <span className="samvaadmeet-gradient-text">Samvaad AI</span>
          </h1>
          <p className="text-base sm:text-xl font-semibold text-slate-800 mb-2">
            Built for Every Cognitive Profile
          </p>
          <p className="text-sm sm:text-base text-slate-500 max-w-md mx-auto leading-relaxed px-1">
            The world's most adaptive video meeting platform — instant sign avatars, private motion-processing, and layouts built for every mind and ability.
          </p>
        </section>

        {/* Waitlist stats */}
        <section
          className={`samvaadmeet-enter samvaadmeet-enter-d3 samvaadmeet-surface rounded-2xl sm:rounded-3xl p-5 sm:p-8 mb-6 sm:mb-10 relative ${countPop ? 'samvaadmeet-count-pop' : ''}`}
        >
          <div className="samvaadmeet-surface-glow" aria-hidden />
          <div className="relative">
          <div className="flex items-center justify-between gap-3 mb-5 sm:mb-6">
            <p className="text-sm font-semibold text-slate-600">Community waitlist</p>
            {!loadingStats && (
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                Live
              </span>
            )}
          </div>

          <div className="text-center sm:text-left mb-6 sm:mb-8">
            {loadingStats ? (
              <div className="samvaadmeet-skeleton h-14 w-32 mx-auto sm:mx-0 rounded-xl" />
            ) : (
              <p
                className={`samvaadmeet-stat-number text-5xl sm:text-6xl font-black text-[#684CFE] inline-block ${countPop ? 'bump' : ''}`}
              >
                {animatedTotal.toLocaleString()}
                <span className="text-xl sm:text-2xl font-bold text-slate-400">+</span>
              </p>
            )}
            <p className="text-xs text-slate-400 mt-2">Growing community · starts at 200</p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6 sm:mb-8">
            {breakdownItems.map((item) => (
              <div
                key={item.key}
                className="samvaadmeet-stat-chip rounded-xl sm:rounded-2xl px-2 py-3 sm:px-4 sm:py-4 text-center"
              >
                {loadingStats ? (
                  <div className="samvaadmeet-skeleton h-7 w-10 mx-auto mb-1.5 rounded" />
                ) : (
                  <p className={`text-xl sm:text-2xl font-black ${item.text}`}>{item.value}</p>
                )}
                <p className="text-[10px] sm:text-xs text-slate-600 font-semibold mt-0.5 leading-tight">
                  <span className="sm:hidden">{item.shortLabel}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-3 sm:space-y-3.5">
            {breakdownItems.map((item) => (
              <div key={item.key} className="flex items-center gap-2 sm:gap-3">
                <span className="text-[11px] sm:text-xs font-semibold text-slate-500 w-16 sm:w-28 shrink-0 truncate">
                  {item.shortLabel}
                </span>
                <div className="samvaadmeet-bar-track flex-1 h-2 sm:h-2.5">
                  <div
                    className={`samvaadmeet-bar-fill ${item.bar}`}
                    style={{
                      width: loadingStats || !barsReady ? '0%' : `${(item.value / maxBreakdown) * 100}%`,
                    }}
                  />
                </div>
                <span className={`text-xs sm:text-sm font-bold w-8 sm:w-10 text-right ${item.text}`}>
                  {loadingStats ? '—' : item.value}
                </span>
              </div>
            ))}
          </div>
          </div>
        </section>

        {/* Actions */}
        <section
          ref={actionsRef}
          className={`space-y-3 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-5 md:gap-6 mb-8 sm:mb-12 samvaadmeet-reveal ${actionsVisible ? 'is-visible' : ''}`}
        >
          <button
            type="button"
            onClick={openWaitlist}
            className="samvaadmeet-reveal-delay-1 samvaadmeet-action-card samvaadmeet-action-primary w-full text-left p-5 sm:p-6 rounded-2xl sm:rounded-3xl text-white border-0"
          >
            <div className="flex items-start gap-4">
              <div className="samvaadmeet-action-icon w-11 h-11 shrink-0 rounded-xl bg-white/20 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-lg font-bold mb-0.5">Join the Waitlist</h2>
                <p className="text-sm text-white/85 leading-snug">Email signup · profile breakdown</p>
              </div>
              <svg className="w-5 h-5 shrink-0 mt-1 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          <button
            type="button"
            onClick={openResearch}
            className="samvaadmeet-reveal-delay-2 samvaadmeet-action-card samvaadmeet-action-glass w-full text-left p-5 sm:p-6 rounded-2xl sm:rounded-3xl"
          >
            <div className="flex items-start gap-4">
              <div className="samvaadmeet-action-icon w-11 h-11 shrink-0 rounded-xl bg-indigo-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-0.5">Research Work</h2>
                <p className="text-sm text-slate-500 leading-snug">Papers & demos on Google Drive</p>
              </div>
              <svg className="w-5 h-5 shrink-0 mt-1 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="samvaadmeet-reveal-delay-3 samvaadmeet-action-card samvaadmeet-action-outline w-full text-left p-5 sm:p-6 rounded-2xl sm:rounded-3xl"
          >
            <div className="flex items-start gap-4">
              <div className="samvaadmeet-action-icon w-11 h-11 shrink-0 rounded-xl bg-[#684CFE]/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#684CFE]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-0.5">Go to Home</h2>
                <p className="text-sm text-slate-500 leading-snug">Full product & features at samvaad.in</p>
              </div>
              <svg className="w-5 h-5 shrink-0 mt-1 text-[#684CFE]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </section>

        <footer className="samvaadmeet-enter samvaadmeet-enter-d5 text-center text-[11px] sm:text-xs text-slate-400 pb-2 leading-relaxed">
          <p>© {new Date().getFullYear()} Samvaad AI · Adaptive Multimodal Communication</p>
        </footer>
      </div>

      {/* Waitlist modal — bottom sheet on mobile */}
      {waitlistOpen && (
        <div
          className="samvaadmeet-modal-backdrop fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/55"
          onClick={() => setWaitlistOpen(false)}
          role="presentation"
        >
          <div
            className="samvaadmeet-modal-panel w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 p-5 sm:p-8 max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="waitlist-title"
          >
            <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-5 sm:hidden" aria-hidden />

            <div className="flex items-start justify-between gap-3 mb-5 sm:mb-6">
              <div>
                <h2 id="waitlist-title" className="text-xl font-bold text-slate-900">
                  Join the Waitlist
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {stats.total.toLocaleString()}+ waiting
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWaitlistOpen(false)}
                className="p-2.5 -mr-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors touch-manipulation"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {successMessage ? (
              <div className="text-center py-6 sm:py-8">
                <div className="samvaadmeet-success-icon w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-slate-900 mb-2">{successMessage}</p>
                <p className="text-sm text-slate-500 mb-6">
                  Total waitlist: <strong className="text-[#684CFE]">{stats.total}</strong>
                </p>
                <button
                  type="button"
                  onClick={() => setWaitlistOpen(false)}
                  className="samvaadmeet-cta-btn w-full sm:w-auto px-8 py-3 rounded-xl bg-[#684CFE] text-white font-semibold hover:bg-[#5338d4] active:scale-[0.98] transition-all touch-manipulation"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleJoinWaitlist} className="space-y-4 sm:space-y-5">
                <div>
                  <label htmlFor="waitlist-email" className="block text-sm font-semibold text-slate-700 mb-2">
                    Email address
                  </label>
                  <input
                    id="waitlist-email"
                    type="email"
                    inputMode="email"
                    autoCapitalize="off"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    required
                    autoComplete="email"
                    className="samvaadmeet-input w-full px-4 py-3.5 sm:py-3 rounded-xl border-2 border-slate-200 focus:border-[#684CFE] focus:ring-0 outline-none transition-colors text-slate-900 placeholder:text-slate-400"
                  />
                </div>

                <fieldset>
                  <legend className="block text-sm font-semibold text-slate-700 mb-3">
                    Your accessibility profile
                  </legend>
                  <div className="space-y-2 samvaadmeet-profile-pill">
                    {PROFILE_OPTIONS.map((opt) => (
                      <div key={opt.id}>
                        <input
                          type="radio"
                          id={`profile-${opt.id}`}
                          name="profileType"
                          value={opt.id}
                          checked={profileType === opt.id}
                          onChange={() => setProfileType(opt.id)}
                          className="sr-only"
                        />
                        <label
                          htmlFor={`profile-${opt.id}`}
                          data-type={opt.id}
                          className={`flex items-center justify-between gap-3 p-4 rounded-xl border-2 border-slate-200 cursor-pointer touch-manipulation ${opt.border}`}
                        >
                          <div className="min-w-0">
                            <span className="block font-semibold text-slate-900 text-sm sm:text-base">
                              {opt.label}
                            </span>
                            <p className="text-xs text-slate-400 mt-0.5 truncate">{opt.hint}</p>
                          </div>
                          <span
                            className={`samvaadmeet-profile-radio w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                              profileType === opt.id
                                ? 'border-[#684CFE] bg-[#684CFE]'
                                : 'border-slate-300 bg-transparent'
                            }`}
                          >
                            {profileType === opt.id && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                </fieldset>

                {formError && (
                  <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl" role="alert">
                    {formError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="samvaadmeet-cta-btn w-full py-3.5 rounded-xl bg-[#684CFE] text-white font-bold hover:bg-[#5338d4] disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] transition-all shadow-lg shadow-[#684CFE]/20 touch-manipulation"
                >
                  {submitting ? 'Joining…' : 'Join Waitlist'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
