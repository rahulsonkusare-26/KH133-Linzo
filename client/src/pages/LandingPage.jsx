import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { setAuthToken } from '../lib/api';
import logo from '../assets/linzo-logo.png';
import landingImg1 from '../assets/linzo-landing-img2.png';

const LandingPage = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [scrolled, setScrolled] = useState(false);
    const [openFooterSection, setOpenFooterSection] = useState(null);

    const toggleFooterSection = (section) => {
        setOpenFooterSection(prev => prev === section ? null : section);
    };

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const token = localStorage.getItem('token');
                if (token) {
                    const response = await api.get('/auth/me');
                    setUser(response.data.user || response.data);
                }
            } catch (error) {
                console.log("Not logged in");
            }
        };
        fetchUser();

        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleLogout = () => {
        setAuthToken(null);
        localStorage.removeItem('token');
        setUser(null);
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-white flex flex-col font-sans overflow-x-hidden text-slate-800">
            {/* Header */}
            <header
                className={`fixed top-0 z-50 w-full flex justify-center transition-all duration-500 ease-in-out ${scrolled ? 'pt-4 pb-2' : 'pt-0'
                    }`}
            >
                <div
                    className={`
                        w-full transition-all duration-500 ease-in-out flex items-center justify-between border
                        ${scrolled
                            ? 'max-w-[95%] sm:max-w-7xl mx-auto bg-white/90 backdrop-blur-xl rounded-full shadow-lg shadow-indigo-500/10 py-3 px-6 sm:px-8 border-slate-200/60'
                            : 'max-w-7xl mx-auto bg-transparent py-6 px-4 sm:px-6 lg:px-8 border-transparent'
                        }
                    `}
                >
                    <div className="flex items-center gap-3">
                        <div className="h-[40px] sm:h-[45px] w-auto flex items-center justify-center transition-transform hover:scale-105 cursor-pointer" onClick={() => navigate('/')}>
                            <img src={logo} alt="Linzo Logo" className="w-full h-full object-contain drop-shadow-sm" />
                        </div>
                    </div>

                    {/* Desktop Navigation Links */}
                    <div className="hidden lg:flex items-center gap-8 text-sm font-semibold text-slate-600">
                        <a href="#technology" className="hover:text-[#684CFE] transition-colors relative group">
                            Architecture
                            <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-[#684CFE] transition-all duration-300 group-hover:w-full"></span>
                        </a>
                        <a href="#features" className="hover:text-[#684CFE] transition-colors relative group">
                            Features
                            <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-[#684CFE] transition-all duration-300 group-hover:w-full"></span>
                        </a>
                        <a href="#use-cases" className="hover:text-[#684CFE] transition-colors relative group">
                            Cognitive Profiles
                            <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-[#684CFE] transition-all duration-300 group-hover:w-full"></span>
                        </a>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-6">
                        {user ? (
                            <div className="flex items-center gap-3 sm:gap-4 animate-fade-in">
                                <Link to="/dashboard" className="hidden sm:block text-sm font-semibold text-gray-700 hover:text-[#684CFE] transition-colors cursor-pointer">
                                    Dashboard
                                </Link>
                                <div className="relative group z-50">
                                    <button
                                        onClick={() => navigate('/profile')}
                                        className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#684CFE] to-[#9F7AEA] text-white flex items-center justify-center text-sm font-bold ring-2 ring-white shadow-md transition-transform hover:scale-105 hover:shadow-lg cursor-pointer transform"
                                    >
                                        {user.name?.[0] || 'U'}
                                    </button>
                                    {/* Dropdown menu */}
                                    <div className="absolute right-0 top-full pt-4 w-60 hidden group-hover:block z-50 animate-fade-in-up">
                                        <div className="bg-white/95 backdrop-blur-2xl rounded-2xl shadow-2xl py-2 border border-white/50 overflow-hidden ring-1 ring-black/5">
                                            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                                                <p className="text-sm font-bold text-gray-900 truncate">{user.name}</p>
                                                <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                            </div>
                                            <Link to="/profile" className="block px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-[#684CFE] transition-colors font-medium">
                                                👤 View Profile
                                            </Link>
                                            <Link to="/dashboard" className="block sm:hidden px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-[#684CFE] transition-colors font-medium">
                                                📊 Dashboard
                                            </Link>
                                            <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors font-medium">
                                                🚪 Log out
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 sm:gap-4 animate-fade-in">
                                <Link to="/login" className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-[#684CFE] transition-colors hidden sm:block">
                                    Log in
                                </Link>
                                <Link to="/register" className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-[#684CFE] to-[#5839f2] rounded-full shadow-lg shadow-indigo-500/30 transition-all hover:scale-105 hover:shadow-indigo-500/40 border border-indigo-400/20 active:scale-95">
                                    Sign up
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 w-full">
                {/* 1. Hero Section */}
                <section className="relative pt-24 pb-0 sm:pb-16 lg:pt-28 lg:pb-24 overflow-hidden bg-white">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10 grid grid-cols-1 lg:grid-cols-2 items-center gap-12 lg:gap-8">
                        {/* Left: Text Content */}
                        <div className="text-center lg:text-left z-20 lg:-mt-45">
                            <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-[#684CFE] text-xs font-bold tracking-widest uppercase mb-6 shadow-sm border-white/50 backdrop-blur-sm animate-fade-in-up">
                                Personalized Inclusive Communication
                            </span>
                            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight text-slate-900 mb-6 leading-[1.15] animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                                Connect Beyond <br className="hidden md:block" />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#684CFE] to-[#9F7AEA]">Every Barrier</span>
                            </h1>

                            <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-xl mx-auto lg:mx-0 leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                                The world's most adaptive video meeting platform. Experience instant sign-language avatars, private motion-processing, and personalized layouts built for every mind and every ability.
                            </p>

                            <div className="mt-8 sm:mt-10 flex flex-row items-stretch justify-center lg:justify-start gap-2.5 sm:gap-4 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                                <Link
                                    to={user ? "/dashboard" : "/login"}
                                    className="flex-1 sm:flex-none px-4 sm:px-8 py-2.5 sm:py-4 text-xs sm:text-base font-bold text-white bg-gradient-to-r from-[#684CFE] to-[#4c2eed] hover:from-[#5839f2] hover:to-[#4023d8] rounded-xl sm:rounded-2xl shadow-xl shadow-indigo-500/30 transition-all transform hover:-translate-y-1 hover:shadow-2xl flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap"
                                >
                                    <svg className="w-4 h-4 sm:w-5 sm:h-5 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                    Join Meeting
                                </Link>
                                <a href="#technology" className="flex-1 sm:flex-none px-4 sm:px-8 py-2.5 sm:py-4 text-xs sm:text-base font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-300 rounded-xl sm:rounded-2xl transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap">
                                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#684CFE] hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 21l-7-7 7-7M21 21l-7-7 7-7" /></svg>
                                    Why Linzo?
                                </a>
                            </div>
                        </div>

                        {/* Right: Hero Image */}
                        <div className="w-full relative flex flex-col justify-center items-center animate-fade-in" style={{ animationDelay: '0.5s' }}>
                            <div className="relative w-full max-w-md lg:max-w-xl flex items-center justify-center">
                                {/* Soft ambient glow mapping to the image */}
                                <div className="absolute inset-0 bg-[#684CFE] rounded-full blur-[80px] opacity-10 z-0 pointer-events-none"></div>
                                <img
                                    src={landingImg1}
                                    alt="Linzo Meet Virtual Meeting Dashboard"
                                    className="relative z-10 w-full h-auto object-contain mix-blend-multiply opacity-95 scale-105"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* 2. Breakthrough Technology Section */}
                <section id="technology" className="pt-6 pb-0 sm:py-24 bg-white relative border-t border-slate-100">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-16 animate-fade-in-up">
                            <h2 className="text-xs font-bold tracking-[0.2em] text-[#684CFE] uppercase mb-4">Why Linzo?</h2>
                            <h3 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">Communication in Real-Time</h3>
                            <p className="text-lg text-slate-500 max-w-3xl mx-auto leading-relaxed">
                                Traditional accessibility tools are slow and intrusive. Linzo uses private, on-device AI to enable seamless interaction without lag or hardware limitations.
                            </p>
                        </div>

                        <div className="grid md:grid-cols-3 gap-8">
                            {/* Tech 1 */}
                            <div className="bg-slate-50 border border-slate-200 hover:border-[#684CFE]/30 rounded-[2rem] p-8 hover:shadow-xl hover:shadow-indigo-500/10 transition-all group">
                                <div className="w-14 h-14 bg-white shadow-sm border border-slate-200 text-[#684CFE] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <h4 className="text-xl font-bold text-slate-900 mb-4">Instant Conversation</h4>
                                <p className="text-slate-600 text-sm leading-relaxed">
                                    Don't wait 2 seconds for a text to appear. Our AI predicts signs as they happen, so conversation feels natural and fluid for both hearing and deaf participants.
                                </p>
                            </div>

                            {/* Tech 2 */}
                            <div className="bg-slate-50 border border-slate-200 hover:border-purple-300 rounded-[2rem] p-8 hover:shadow-xl hover:shadow-purple-500/10 transition-all group">
                                <div className="w-14 h-14 bg-white shadow-sm border border-slate-200 text-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                                </div>
                                <h4 className="text-xl font-bold text-slate-900 mb-4">Privacy-First AI</h4>
                                <p className="text-slate-600 text-sm leading-relaxed">
                                    Your video never leaves your computer. We only transmit movement data—reducing data usage by 98% and keeping your privacy 100% secure.
                                </p>
                            </div>

                            {/* Tech 3 */}
                            <div className="bg-slate-50 border border-slate-200 hover:border-blue-300 rounded-[2rem] p-8 hover:shadow-xl hover:shadow-blue-500/10 transition-all group">
                                <div className="w-14 h-14 bg-white shadow-sm border border-slate-200 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                </div>
                                <h4 className="text-xl font-bold text-slate-900 mb-4">Perfect Sync</h4>
                                <p className="text-slate-600 text-sm leading-relaxed">
                                    Whether you're signing, speaking, or typing, Linzo aligns everything so no one falls behind. Everyone hears and sees a synchronized interaction.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. Adaptive Features Section */}
                <section id="features" className="py-24 bg-indigo-50/40 border-t border-slate-100">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-16 animate-fade-in-up">
                            <h2 className="text-xs font-bold tracking-[0.2em] text-[#684CFE] uppercase mb-4">Adaptive Interface</h2>
                            <h3 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">Built for Every User</h3>
                            <p className="text-lg text-slate-500 max-w-3xl mx-auto leading-relaxed">
                                Linzo adapts to you, not the other way around. Our interface dynamically modifies how information is presented based on your specific needs.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                            {/* Feature 1 */}
                            <div className="group relative p-8 bg-white rounded-3xl border border-slate-100 shadow-md hover:shadow-2xl hover:shadow-indigo-500/15 transition-all duration-500 transform hover:-translate-y-2 cursor-pointer overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                <div className="relative z-10 w-full h-full flex flex-col">
                                    <h3 className="text-lg font-bold text-slate-900 mb-3 group-hover:text-[#684CFE] transition-colors">Smart Focus</h3>
                                    <p className="text-slate-600 text-sm leading-relaxed flex-grow">
                                        Avoid screen clutter. If you're watching a Sign Avatar, our AI automatically hides redundant captions to keep your experience clean and focused.
                                    </p>
                                </div>
                            </div>

                            {/* Feature 2 */}
                            <div className="group relative p-8 bg-white rounded-3xl border border-slate-100 shadow-md hover:shadow-2xl hover:shadow-purple-500/15 transition-all duration-500 transform hover:-translate-y-2 cursor-pointer overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                <div className="relative z-10 w-full h-full flex flex-col">
                                    <h3 className="text-lg font-bold text-slate-900 mb-3 group-hover:text-purple-600 transition-colors">Universal Talk</h3>
                                    <p className="text-slate-600 text-sm leading-relaxed flex-grow">
                                        Break the language barrier. Speak in your native tongue and have it instantly translated into text, speech, or signs across 50+ global dialects.
                                    </p>
                                </div>
                            </div>

                            {/* Feature 3 */}
                            <div className="group relative p-8 bg-white rounded-3xl border border-slate-100 shadow-md hover:shadow-2xl hover:shadow-emerald-500/15 transition-all duration-500 transform hover:-translate-y-2 cursor-pointer overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                <div className="relative z-10 w-full h-full flex flex-col">
                                    <h3 className="text-lg font-bold text-slate-900 mb-3 group-hover:text-emerald-600 transition-colors">Built for Your Mind</h3>
                                    <p className="text-slate-600 text-sm leading-relaxed flex-grow">
                                        Specialized modes for ADHD, Dyslexia, and Autism. Adjust animation speeds, text retention, and pacing to match your comfort level.
                                    </p>
                                </div>
                            </div>

                            {/* Feature 4 */}
                            <div className="group relative p-8 bg-white rounded-3xl border border-slate-100 shadow-md hover:shadow-2xl hover:shadow-blue-500/15 transition-all duration-500 transform hover:-translate-y-2 cursor-pointer overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                <div className="relative z-10 w-full h-full flex flex-col">
                                    <h3 className="text-lg font-bold text-slate-900 mb-3 group-hover:text-blue-600 transition-colors">Tone Detection</h3>
                                    <p className="text-slate-600 text-sm leading-relaxed flex-grow">
                                        More than just words. We track facial expressions like raised brows or squints to translate sarcastic or questioning tones natively.
                                    </p>
                                </div>
                            </div>

                        </div>
                    </div>
                </section>

                {/* 4. Use Cases Section */}
                <section id="use-cases" className="py-24 bg-slate-900 text-white relative overflow-hidden">
                    <div className="absolute inset-0 bg-indigo-900/20 mix-blend-multiply opacity-50 z-0 pointer-events-none"></div>
                    <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#684CFE]/20 blur-[150px] rounded-full z-0"></div>

                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
                        <div className="flex flex-col md:flex-row justify-between items-center md:items-end mb-16 gap-6 text-center md:text-left">
                            <div className="flex-1">
                                <h2 className="text-xs font-bold tracking-[0.2em] text-indigo-400 uppercase mb-4">Total Inclusion</h2>
                                <h3 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4 tracking-tight">Your Meeting, Your Way</h3>
                                <p className="text-lg text-slate-400 max-w-2xl mx-auto md:mx-0">Inclusive design isn't just a feature—it's how Linzo was built from the ground up.</p>
                            </div>
                            <Link to="/register" className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-all font-semibold text-sm whitespace-nowrap">
                                Create Free Profile
                            </Link>
                        </div>

                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="p-6 md:p-8 rounded-[2rem] bg-indigo-950/40 border border-indigo-400/20 backdrop-blur-xl hover:bg-indigo-900/50 transition-all">
                                <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30 mb-5 inline-block">Visual Assist Mode</span>
                                <h4 className="text-xl font-bold mb-3 text-white">Deaf & Hard of Hearing</h4>
                                <ul className="space-y-3 text-sm text-indigo-100/70">
                                    <li className="flex items-start gap-2"><svg className="w-5 h-5 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Real-time Sign Language Avatars</li>
                                    <li className="flex items-start gap-2"><svg className="w-5 h-5 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Automatic Voice Translation</li>
                                    <li className="flex items-start gap-2"><svg className="w-5 h-5 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Visual Focus Highlighting</li>
                                </ul>
                            </div>

                            <div className="p-6 md:p-8 rounded-[2rem] bg-indigo-950/40 border border-indigo-400/20 backdrop-blur-xl hover:bg-indigo-900/50 transition-all">
                                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 mb-5 inline-block">Focus Assist Mode</span>
                                <h4 className="text-xl font-bold mb-3 text-white">ADHD & Dyslexia</h4>
                                <ul className="space-y-3 text-sm text-indigo-100/70">
                                    <li className="flex items-start gap-2"><svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Automatic Screen De-cluttering</li>
                                    <li className="flex items-start gap-2"><svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Simplified Instant Summaries</li>
                                    <li className="flex items-start gap-2"><svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Personalized Reading Speed</li>
                                </ul>
                            </div>

                            <div className="p-6 md:p-8 rounded-[2rem] bg-indigo-950/40 border border-indigo-400/20 backdrop-blur-xl hover:bg-indigo-900/50 transition-all">
                                <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-500/30 mb-5 inline-block">Social Assist Mode</span>
                                <h4 className="text-xl font-bold mb-3 text-white">Autism Spectrum</h4>
                                <ul className="space-y-3 text-sm text-indigo-100/70">
                                    <li className="flex items-start gap-2"><svg className="w-5 h-5 text-purple-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Calm & Controlled Content Pacing</li>
                                    <li className="flex items-start gap-2"><svg className="w-5 h-5 text-purple-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Adjustable Animation Smoothness</li>
                                    <li className="flex items-start gap-2"><svg className="w-5 h-5 text-purple-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Voice Tone Indicators</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

            </main>

            {/* Premium Enterprise Footer */}
            <footer className="bg-white border-t border-slate-100 pt-12 sm:pt-16 pb-8">
                <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-8">

                    {/* ─── Desktop: Original Grid Layout (md+) ─── */}
                    <div className="hidden md:grid md:grid-cols-4 lg:grid-cols-5 gap-8 mb-16">
                        <div className="col-span-2 lg:col-span-2">
                            <div className="h-10 w-auto mb-6">
                                <img src={logo} alt="Linzo Logo" className="h-full object-contain" />
                            </div>
                            <p className="text-slate-500 text-sm leading-relaxed max-w-xs mb-8">
                                Pioneer of Call-Native Adaptive Multimodal Communication Systems. Elevating unified interactions for every cognitive profile.
                            </p>
                            <div className="flex items-center gap-4">
                                <a href="#" className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-[#684CFE] hover:border-[#684CFE] transition-all">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" /></svg>
                                </a>
                                <a href="#" className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-[#684CFE] hover:border-[#684CFE] transition-all">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" /></svg>
                                </a>
                                <a href="#" className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-[#684CFE] hover:border-[#684CFE] transition-all">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                                </a>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-slate-900 font-bold mb-5 tracking-tight">Product</h4>
                            <ul className="space-y-3">
                                <li><a href="#" className="text-sm text-slate-500 hover:text-[#684CFE] transition-colors">Sign Avatar Features</a></li>
                                <li><a href="#" className="text-sm text-slate-500 hover:text-[#684CFE] transition-colors">Semantic Arbitration</a></li>
                                <li><a href="#" className="text-sm text-slate-500 hover:text-[#684CFE] transition-colors">Global Connectivity</a></li>
                                <li><a href="#" className="text-sm text-slate-500 hover:text-[#684CFE] transition-colors">Security Overview</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-slate-900 font-bold mb-5 tracking-tight">Resources</h4>
                            <ul className="space-y-3">
                                <li><a href="#" className="text-sm text-slate-500 hover:text-[#684CFE] transition-colors">Documentation</a></li>
                                <li><a href="#" className="text-sm text-slate-500 hover:text-[#684CFE] transition-colors">Cognitive Guidelines</a></li>
                                <li><a href="#" className="text-sm text-slate-500 hover:text-[#684CFE] transition-colors">WebRTC Testing</a></li>
                                <li><a href="#" className="text-sm text-slate-500 hover:text-[#684CFE] transition-colors">Invention Tech Profile</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-slate-900 font-bold mb-5 tracking-tight">Company</h4>
                            <ul className="space-y-3">
                                <li><a href="#" className="text-sm text-slate-500 hover:text-[#684CFE] transition-colors">About Us</a></li>
                                <li><a href="#" className="text-sm text-slate-500 hover:text-[#684CFE] transition-colors">Careers</a></li>
                                <li><a href="#" className="text-sm text-slate-500 hover:text-[#684CFE] transition-colors">Contact</a></li>
                                <li><a href="#" className="text-sm text-slate-500 hover:text-[#684CFE] transition-colors">Legal Documents</a></li>
                            </ul>
                        </div>
                    </div>

                    {/* ─── Mobile: Logo + Accordion Layout (below md) ─── */}
                    <div className="md:hidden mb-12">
                        {/* Logo & Description */}
                        <div className="mb-8">
                            <div className="h-10 w-auto mb-5">
                                <img src={logo} alt="Linzo Logo" className="h-full object-contain" />
                            </div>
                            <p className="text-slate-500 text-sm leading-relaxed max-w-xs mb-6">
                                Pioneer of Call-Native Adaptive Multimodal Communication Systems. Elevating unified interactions for every cognitive profile.
                            </p>
                            <div className="flex items-center gap-4">
                                <a href="#" className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-[#684CFE] hover:border-[#684CFE] transition-all">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" /></svg>
                                </a>
                                <a href="#" className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-[#684CFE] hover:border-[#684CFE] transition-all">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" /></svg>
                                </a>
                                <a href="#" className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-[#684CFE] hover:border-[#684CFE] transition-all">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                                </a>
                            </div>
                        </div>

                        {/* Accordion Sections */}
                        <div className="divide-y divide-slate-100 border-y border-slate-100">
                            {/* Product */}
                            <div>
                                <button
                                    onClick={() => toggleFooterSection('product')}
                                    className="w-full flex items-center justify-between py-4 text-left cursor-pointer"
                                >
                                    <h4 className="text-slate-900 font-bold tracking-tight">Product</h4>
                                    <svg className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${openFooterSection === 'product' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openFooterSection === 'product' ? 'max-h-48 opacity-100 pb-4' : 'max-h-0 opacity-0'}`}>
                                    <ul className="space-y-3 pl-1">
                                        <li><a href="#" className="text-sm text-slate-500 hover:text-[#684CFE] transition-colors">Sign Avatar Features</a></li>
                                        <li><a href="#" className="text-sm text-slate-500 hover:text-[#684CFE] transition-colors">Semantic Arbitration</a></li>
                                        <li><a href="#" className="text-sm text-slate-500 hover:text-[#684CFE] transition-colors">Global Connectivity</a></li>
                                        <li><a href="#" className="text-sm text-slate-500 hover:text-[#684CFE] transition-colors">Security Overview</a></li>
                                    </ul>
                                </div>
                            </div>

                            {/* Resources */}
                            <div>
                                <button
                                    onClick={() => toggleFooterSection('resources')}
                                    className="w-full flex items-center justify-between py-4 text-left cursor-pointer"
                                >
                                    <h4 className="text-slate-900 font-bold tracking-tight">Resources</h4>
                                    <svg className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${openFooterSection === 'resources' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openFooterSection === 'resources' ? 'max-h-48 opacity-100 pb-4' : 'max-h-0 opacity-0'}`}>
                                    <ul className="space-y-3 pl-1">
                                        <li><a href="#" className="text-sm text-slate-500 hover:text-[#684CFE] transition-colors">Documentation</a></li>
                                        <li><a href="#" className="text-sm text-slate-500 hover:text-[#684CFE] transition-colors">Cognitive Guidelines</a></li>
                                        <li><a href="#" className="text-sm text-slate-500 hover:text-[#684CFE] transition-colors">WebRTC Testing</a></li>
                                        <li><a href="#" className="text-sm text-slate-500 hover:text-[#684CFE] transition-colors">Invention Tech Profile</a></li>
                                    </ul>
                                </div>
                            </div>

                            {/* Company */}
                            <div>
                                <button
                                    onClick={() => toggleFooterSection('company')}
                                    className="w-full flex items-center justify-between py-4 text-left cursor-pointer"
                                >
                                    <h4 className="text-slate-900 font-bold tracking-tight">Company</h4>
                                    <svg className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${openFooterSection === 'company' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openFooterSection === 'company' ? 'max-h-48 opacity-100 pb-4' : 'max-h-0 opacity-0'}`}>
                                    <ul className="space-y-3 pl-1">
                                        <li><a href="#" className="text-sm text-slate-500 hover:text-[#684CFE] transition-colors">About Us</a></li>
                                        <li><a href="#" className="text-sm text-slate-500 hover:text-[#684CFE] transition-colors">Careers</a></li>
                                        <li><a href="#" className="text-sm text-slate-500 hover:text-[#684CFE] transition-colors">Contact</a></li>
                                        <li><a href="#" className="text-sm text-slate-500 hover:text-[#684CFE] transition-colors">Legal Documents</a></li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom bar */}
                    <div className="pt-8 border-t border-slate-100 flex flex-col items-center md:flex-row md:justify-between gap-4">
                        <p className="text-slate-400 text-xs sm:text-sm text-center md:text-left">
                            &copy; {new Date().getFullYear()} LINZO Adaptive Communication. All rights reserved.
                        </p>
                        <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-slate-400">
                            <a href="#" className="hover:text-slate-600 transition-colors">Privacy Policy</a>
                            <a href="#" className="hover:text-slate-600 transition-colors">Terms of Service</a>
                            <a href="#" className="hover:text-slate-600 transition-colors">Cookie Controls</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
