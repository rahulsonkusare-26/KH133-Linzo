import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import api from '../lib/api';
import LinzoLogo from '../assets/linzo-logo.png';

const MainLayout = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const response = await api.get('/auth/me');
                setUser(response.data.user || response.data);
            } catch (error) {
                navigate('/login');
            } finally {
                setLoading(false);
            }
        };
        fetchUser();

        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, [navigate]);

    const menuItems = [
        { name: 'Home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', path: '/dashboard' },
        { name: 'History', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', path: '/history' },
        { name: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', path: '/settings' },
    ];

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-[#684CFE]/20 border-t-[#684CFE] rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 bg-white/10 backdrop-blur rounded-full"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-[#FAFAFE] selection:bg-[#684CFE] selection:text-white font-sans text-gray-800 overflow-hidden relative">

            {/* 1. Background Ambience (Animated Blobs) */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#684CFE]/8 rounded-full filter blur-[120px] animate-blob"></div>
                <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-400/8 rounded-full filter blur-[120px] animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-purple-400/8 rounded-full filter blur-[120px] animate-blob animation-delay-4000"></div>
            </div>

            {/* 2. Floating Sidebar (Glassmorphism) */}
            <aside className="fixed bottom-4 left-4 right-4 md:top-4 md:bottom-4 md:w-20 lg:w-64 md:right-auto z-50 bg-white backdrop-blur-xl rounded-[2rem] shadow-xl shadow-[#684CFE]/10 flex flex-row md:flex-col justify-between items-center md:items-stretch py-2 px-4 md:py-8 md:px-0 md:border-r-0 border border-gray-200">

                {/* Logo Area */}
                <div className="hidden md:flex flex-col items-center mb-8 gap-3">
                    <div className="p-2 px-3 cursor-pointer" onClick={() => navigate('/')}>
                        <img src={LinzoLogo} alt="Linzo" className="h-15 w-auto object-contain" />
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 w-full flex md:flex-col justify-around md:justify-center gap-2 md:gap-4 md:px-4">
                    {menuItems.map((item) => (
                        <button
                            key={item.name}
                            onClick={() => navigate(item.path)}
                            className={`group relative flex items-center md:gap-3 p-3 md:px-4 md:py-3 rounded-2xl transition-all duration-300 ${location.pathname === item.path
                                ? 'bg-[#684CFE] text-white shadow-xl shadow-[#684CFE]/30 scale-105'
                                : 'text-gray-500 hover:bg-[#684CFE]/10 hover:text-[#684CFE]'
                                }`}
                        >
                            <svg className={`w-6 h-6 ${location.pathname === item.path ? 'stroke-2' : 'stroke-[1.5]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                            </svg>
                            <span className={`hidden lg:block text-sm font-medium ${location.pathname === item.path ? 'font-semibold' : ''}`}>{item.name}</span>

                            {/* Hover Tooltip for Tablet */}
                            <div className="absolute left-full ml-4 px-2 py-1 bg-white border border-gray-200 text-gray-700 text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 hidden md:block lg:hidden pointer-events-none transition-opacity whitespace-nowrap z-50">
                                {item.name}
                            </div>
                        </button>
                    ))}
                </nav>

                {/* User Profile (Bottom of Sidebar) */}
                <div className="hidden md:flex flex-col items-center mt-auto pt-6 border-t border-gray-200 md:px-4">
                    <button onClick={() => navigate('/settings')} className="flex items-center gap-3 w-full p-2 rounded-2xl hover:bg-[#684CFE]/10 transition-colors group">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#684CFE] to-blue-500 p-[2px]">
                            <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                                <span className="font-bold text-[#684CFE]">
                                    {user?.name?.[0]?.toUpperCase()}
                                </span>
                            </div>
                        </div>
                        <div className="hidden lg:block text-left overflow-hidden">
                            <p className="text-sm font-bold text-gray-800 truncate group-hover:text-[#684CFE] transition-colors">{user?.name?.split(' ')[0]}</p>
                            <p className="text-[10px] text-gray-400 font-medium">View Profile</p>
                        </div>
                    </button>
                </div>
            </aside>

            {/* 3. Main Content Area */}
            <main className="relative z-10 md:ml-20 lg:ml-64 p-4 md:p-6 lg:p-8 pb-20 md:pb-6 h-screen flex flex-col overflow-y-auto overflow-x-hidden">

                {/* Header (Top Right) */}
                <header className="flex justify-between md:justify-end items-center mb-4 md:mb-6 flex-shrink-0">

                    {/* Mobile Logo */}
                    <div className="flex md:hidden items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                        <img src={LinzoLogo} alt="Linzo" className="h-14 w-auto object-contain" />
                    </div>

                    <div className="bg-white backdrop-blur-xl border border-gray-200 px-4 py-2 rounded-full flex items-center gap-4 shadow-sm">
                        <span className="hidden sm:block text-sm font-medium text-gray-500">
                            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div className="w-px h-4 bg-gray-200 hidden sm:block"></div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => navigate('/settings')} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-[#684CFE]/10 flex items-center justify-center text-gray-500 hover:text-[#684CFE] transition-colors">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </button>
                            {/* Mobile: Small Avatar */}
                            <button onClick={() => navigate('/settings')} className="md:hidden w-8 h-8 rounded-full bg-gradient-to-tr from-[#684CFE] to-blue-500 p-[1.5px]">
                                <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                                    <span className="text-xs font-bold text-[#684CFE]">{user?.name?.[0]?.toUpperCase()}</span>
                                </div>
                            </button>
                        </div>
                    </div>
                </header>

                {/* Main Content Area */}
                <div className="flex-1 w-full max-w-7xl mx-auto">
                    <Outlet context={{ user }} />
                </div>
            </main>
        </div>
    );
};

export default MainLayout;
