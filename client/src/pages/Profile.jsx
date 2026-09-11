import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { setAuthToken } from '../lib/api';

export default function Profile() {
  const context = useOutletContext();
  const user = context?.user;
  const navigate = useNavigate();

  const logout = () => {
    setAuthToken(null);
    navigate('/login', { replace: true });
  };

  return (
    <div className="animate-fade-in w-full max-w-5xl mx-auto px-4 md:px-8 pb-10">
      <div className="mb-6 md:mb-10 text-center md:text-left">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#684CFE]/10 text-[#684CFE] border border-[#684CFE]/20 text-[10px] font-bold uppercase tracking-widest mb-3">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Account Preferences
        </span>
        <h1 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tight mb-2">Profile and Settings</h1>
        <p className="text-gray-500 text-sm md:text-base font-medium">Manage your profile and preferences.</p>
      </div>

      <div className="bg-white/70 backdrop-blur-2xl border border-white/60 rounded-[2rem] shadow-xl shadow-slate-200/20 p-6 md:p-10 animate-fade-in-up">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-12">
          {/* Avatar Section */}
          <div className="relative group shrink-0">
            <div className="w-28 h-28 md:w-40 md:h-40 rounded-[2rem] overflow-hidden shadow-xl shadow-[#684CFE]/10 ring-4 ring-white transition-all duration-500">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#684CFE] to-purple-600 flex items-center justify-center">
                  <span className="text-5xl font-black text-white opacity-90 select-none">
                    {user?.name?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
              )}
            </div>
            {/* Status Badge */}
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
              <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg border border-white/80 backdrop-blur-md ${user?.isFirebaseUser ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${user?.isFirebaseUser ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                {user?.isFirebaseUser ? 'Firebase' : 'Direct'}
              </span>
            </div>
          </div>

          {/* Info Section */}
          <div className="flex-1 text-center md:text-left space-y-4 md:space-y-6 min-w-0">
            <div className="space-y-1">
              <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight leading-none truncate">
                {user?.name || 'Linzo User'}
              </h2>
              <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] truncate">{user?.email}</p>
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              <div className="px-4 py-3 rounded-xl bg-slate-50/50 border border-slate-100/50 flex flex-col items-center md:items-start transition-colors duration-300">
                <span className="text-[8px] uppercase tracking-widest font-black text-slate-300 mb-0.5">Account</span>
                <span className="text-xs font-black text-gray-700 capitalize">{user?.isFirebaseUser ? 'Social' : 'Standard'}</span>
              </div>
              <div className="px-4 py-3 rounded-xl bg-slate-50/50 border border-slate-100/50 flex flex-col items-center md:items-start transition-colors duration-300">
                <span className="text-[8px] uppercase tracking-widest font-black text-slate-300 mb-0.5">Joined</span>
                <span className="text-xs font-black text-gray-700">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : 'Recent'}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-1">Unique ID</p>
              <code className="inline-block font-mono bg-slate-50/80 px-3 py-1.5 rounded-lg text-slate-500 text-[10px] border border-slate-100 truncate max-w-full overflow-x-auto">
                {user?._id}
              </code>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-100/60 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
            Linzo v2.0
          </p>
          <button
            onClick={logout}
            className="w-full md:w-auto px-8 py-3.5 rounded-xl bg-rose-50 text-rose-600 font-black uppercase tracking-widest text-[10px] hover:bg-rose-100 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-rose-100/20 active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
