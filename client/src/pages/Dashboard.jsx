import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import DashboardCarousel from '../components/DashboardCarousel';

const Dashboard = () => {
  const context = useOutletContext();
  const user = context?.user;
  const [meetingCode, setMeetingCode] = useState('');
  const navigate = useNavigate();

  const createMeeting = () => {
    const roomId = Math.random().toString(36).substring(7);
    navigate(`/integrated-room/${roomId}`);
  };

  const joinMeeting = () => {
    if (meetingCode.trim()) {
      // Clean the input: remove trailing slashes and ignore anything after '?'
      const cleanUrl = meetingCode.trim().split('?')[0].replace(/\/+$/, '');
      const roomId = cleanUrl.split('/').pop();

      if (roomId) {
        navigate(`/integrated-room/${roomId}`);
      }
    }
  };

  return (
    <div className="animate-fade-in w-full max-w-5xl mx-auto px-4 md:px-8 pb-12">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-16">

        {/* Left Section: Content & Actions */}
        <div className="flex-1 w-full space-y-8 max-w-lg">

          {/* Headline & Intro */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#684CFE]/10 text-[#684CFE] border border-[#684CFE]/20 text-[10px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#684CFE] animate-pulse"></span>
              Live AI Translation
            </div>

            <h1 className="text-4xl md:text-5xl font-black text-gray-900 leading-tight tracking-tight">
              Connect <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#684CFE] to-[#8C6DFF]">Without Limits</span>
            </h1>

            <p className="text-gray-500 text-sm md:text-base font-medium leading-relaxed">
              Experience the world's most inclusive meeting platform. Real-time interpretation and AI translation for everyone, everywhere.
            </p>
          </div>

          {/* Action Hub */}
          <div className="space-y-4 w-full">
            {/* Primary Action */}
            <button
              onClick={createMeeting}
              className="w-full group relative flex items-center justify-between p-5 rounded-2xl bg-[#684CFE] text-white overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-[#684CFE]/30 hover:-translate-y-0.5 active:translate-y-0"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/30">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="text-left">
                  <span className="block font-black text-lg uppercase tracking-tight">New Meeting</span>
                  <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Instant Room</span>
                </div>
              </div>
              <svg className="w-5 h-5 text-white/80 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Secondary Action */}
            <div className="flex items-stretch gap-2 w-full">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={meetingCode}
                  onChange={(e) => setMeetingCode(e.target.value)}
                  placeholder="Enter room code"
                  className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl text-gray-800 font-bold placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#684CFE]/20 focus:border-[#684CFE]/40 transition-all h-full"
                />
              </div>
              <button
                onClick={joinMeeting}
                disabled={!meetingCode.trim()}
                className={`px-6 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all whitespace-nowrap ${meetingCode.trim()
                  ? 'bg-gradient-to-r from-[#684CFE] to-[#8C6DFF] text-white hover:shadow-xl hover:shadow-[#684CFE]/30 shadow-lg'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed border border-gray-300 shadow-sm'
                  }`}
              >
                Join
              </button>
            </div>

            {/* Mobile-Only Carousel Card */}
            <div className="lg:hidden mt-2 pt-4 border-t border-gray-100 animate-fade-in animation-delay-500">
              <div className="bg-white/60 backdrop-blur-2xl p-6 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-white/80">
                <div className="bg-white rounded-[2rem] p-6 border border-slate-50 shadow-inner">
                  <DashboardCarousel />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section: Visual Showcase (Hidden on Mobile) */}
        <div className="hidden lg:flex flex-1 w-full max-w-lg xl:max-w-2xl relative animate-fade-in animation-delay-300">
          {/* Main Showcase Container */}
          <div className="relative z-10 bg-white/60 backdrop-blur-2xl p-4 rounded-[3.5rem] shadow-2xl shadow-slate-200/50 border border-white/80">
            <div className="bg-white rounded-[3rem] p-10 md:p-14 border border-slate-50 shadow-inner flex flex-col items-center justify-center aspect-square relative">
              <DashboardCarousel />
            </div>
          </div>

          {/* Floating Badges (Matching Screenshot) */}
          <div className="absolute -top-2 -right-4 animate-float animation-delay-2000 z-20">
            <div className="bg-white/95 backdrop-blur-xl border border-white/60 p-4 rounded-3xl shadow-xl flex items-center gap-4 min-w-[160px]">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black text-gray-900 leading-none mb-1">Secure</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">End-to-end</span>
              </div>
            </div>
          </div>

          <div className="absolute -bottom-2 -left-4 animate-float z-20">
            <div className="bg-white/95 backdrop-blur-xl border border-white/60 p-4 rounded-3xl shadow-xl flex items-center gap-4 min-w-[160px]">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-[#684CFE]">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black text-gray-900 leading-none mb-1">Global</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Translation</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
