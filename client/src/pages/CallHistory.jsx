import React, { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import api from '../lib/api';

export default function CallHistory() {
    const context = useOutletContext();
    const user = context?.user;
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [unauthorized, setUnauthorized] = useState(false);

    useEffect(() => {
        api.get('/meetings/history')
            .then(res => {
                const data = res.data;
                if (Array.isArray(data)) {
                    setMeetings(data);
                } else {
                    console.error('Expected array of meetings, got:', data);
                    setMeetings([]);
                }
                setLoading(false);
            })
            .catch(err => {
                if (err.response && err.response.status === 401) {
                    setUnauthorized(true);
                } else {
                    console.error('Failed to fetch history:', err);
                }
                setLoading(false);
            });
    }, []);

    return (
        <div className="animate-fade-in w-full max-w-5xl mx-auto px-4 md:px-8">
            <div className="mb-6 md:mb-10 text-center md:text-left">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#684CFE]/10 text-[#684CFE] border border-[#684CFE]/20 text-[10px] font-bold uppercase tracking-widest mb-3">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Meeting Logs
                </span>
                <h1 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tight mb-2">Call History</h1>
                <p className="text-gray-500 text-sm md:text-base font-medium">Review insights from your past conversations.</p>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-[#684CFE]/20 border-t-[#684CFE] rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Accessing Records...</p>
                </div>
            ) : meetings.length === 0 ? (
                <div className="text-center bg-white/60 backdrop-blur-xl rounded-[2rem] p-8 md:p-12 border border-white/60 shadow-xl shadow-slate-200/20">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6 ring-1 ring-slate-100">
                        <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-black text-gray-900 mb-2 uppercase tracking-tight">No History Found</h3>
                    <p className="text-gray-500 text-sm mb-8 font-medium max-w-xs mx-auto">Your past meetings will appear here once you've completed them.</p>
                    <Link to="/dashboard" className="inline-flex items-center gap-2 bg-[#684CFE] hover:bg-[#5b42df] text-white px-6 py-3.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg shadow-[#684CFE]/20 active:scale-95">
                        Start Your First Call
                    </Link>
                </div>
            ) : (
                <div className="grid gap-3 md:gap-4 pb-12">
                    {meetings.map((meeting, idx) => (
                        <Link
                            key={meeting.roomId}
                            to={`/summary-call/${meeting.roomId}/details`}
                            className="group block relative overflow-hidden animate-fade-in-up"
                            style={{ animationDelay: `${idx * 50}ms` }}
                        >
                            <div className="bg-white/70 backdrop-blur-2xl border border-white/60 rounded-2xl p-4 md:p-6 transition-all duration-300 hover:shadow-xl hover:shadow-[#684CFE]/5 hover:border-[#684CFE]/30">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div className="flex items-center gap-3 w-full md:w-auto">
                                        <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center text-[#684CFE] ring-1 ring-indigo-100 group-hover:bg-[#684CFE] group-hover:text-white transition-all duration-300 shrink-0">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-black text-base text-gray-900 tracking-tight truncate group-hover:text-[#684CFE] transition-colors">
                                                Meeting {meeting.roomId.slice(0, 8)}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-0.5 text-gray-400 font-bold uppercase tracking-widest text-[9px]">
                                                <span className="flex items-center gap-1">
                                                    {new Date(meeting.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </span>
                                                <span className="w-0.5 h-0.5 rounded-full bg-gray-300"></span>
                                                <span className="flex items-center gap-1">
                                                    {new Date(meeting.startTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                        {/* Mobile Badge */}
                                        <div className="ml-auto md:hidden">
                                          <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${meeting.status === 'ended' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                            {meeting.status === 'ended' ? 'Done' : 'Live'}
                                          </span>
                                        </div>
                                    </div>

                                    {/* Desktop Info Row */}
                                    <div className="flex flex-wrap items-center gap-4 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-gray-100/50">
                                        <div className="flex items-center gap-2">
                                            <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                            </svg>
                                            <span className="text-xs font-bold text-gray-500">{meeting.participants?.length || 0}</span>
                                        </div>
                                        {meeting.summary && (
                                            <div className="flex items-center gap-1 text-[#684CFE]">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                <span className="text-[9px] font-black uppercase tracking-tight">Summary</span>
                                            </div>
                                        )}
                                        <div className="hidden md:block">
                                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${meeting.status === 'ended' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                              {meeting.status === 'ended' ? 'Completed' : 'In Progress'}
                                          </span>
                                        </div>
                                        <div className="ml-auto md:ml-2 text-[#684CFE]">
                                            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
