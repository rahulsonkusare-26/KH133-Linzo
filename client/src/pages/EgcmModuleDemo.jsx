import React, { useState, useEffect, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Holistic } from '@mediapipe/holistic';
import * as cam from '@mediapipe/camera_utils';

// Premium Color Palette & Constants
const PRIMARY_TEAL = '#2dd4bf';
const PRIMARY_ORANGE = '#f97316';
const DWELL_THRESHOLD = 500; 
const R_CELL = 2.5; 

const EGCM_TILES = [
    { id: '1', text: 'YES', emoji: '✅' },
    { id: '2', text: 'NO', emoji: '❌' },
    { id: '3', text: 'HELP', emoji: '🆘' },
    { id: '4', text: 'WATER', emoji: '💧' },
    { id: '5', text: 'FOOD', emoji: '🍕' },
    { id: '6', text: 'REST', emoji: '😴' },
    { id: '7', text: 'PAIN', emoji: '😫' },
    { id: '8', text: 'WASH', emoji: '🧼' },
];

class OneEuroFilter {
    constructor(freq, mincutoff = 1.0, beta = 0.0, dcutoff = 1.0) {
        this.freq = freq; this.mincutoff = mincutoff; this.beta = beta; this.dcutoff = dcutoff;
        this.x = null; this.dx = 0; this.lastTime = null;
    }
    filter(value, timestamp) {
        if (this.lastTime === null) { this.lastTime = timestamp; this.x = value; return value; }
        const dt = (timestamp - this.lastTime) / 1000; this.lastTime = timestamp;
        const a = this.alpha(this.mincutoff);
        const dx = (value - this.x) / dt;
        const edx = this.dx + this.alpha(this.dcutoff) * (dx - this.dx); this.dx = edx;
        const cutoff = this.mincutoff + this.beta * Math.abs(edx);
        const result = this.x + this.alpha(cutoff) * (value - this.x); this.x = result;
        return result;
    }
    alpha(cutoff) {
        const te = 1.0 / this.freq; const tau = 1.0 / (2 * Math.PI * cutoff);
        return 1.0 / (1.0 + tau / te);
    }
}

const EgcmModuleDemo = () => {
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const holisticRef = useRef(null);

    const [isModelLoading, setIsModelLoading] = useState(true);
    const [isAutoCalibrating, setIsAutoCalibrating] = useState(false);
    const [calibPoint, setCalibPoint] = useState(null);
    const [calibrationProgress, setCalibrationProgress] = useState(0);
    const [gazePoint, setGazePoint] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const [activeTileId, setActiveTileId] = useState(null);
    const [dwellProgress, setDwellProgress] = useState(0);
    const [lastSpeech, setLastSpeech] = useState('');
    const [telemetry, setTelemetry] = useState({ h: 0, v: 0, headYaw: 0, headPitch: 0, isBlinking: false });

    const latestRatios = useRef({ h: 0.5, v: 0.5 });
    const dwellTimerRef = useRef(null);
    const filterX = useRef(new OneEuroFilter(60, 0.3, 0.015)).current;
    const filterY = useRef(new OneEuroFilter(60, 0.3, 0.015)).current;
    const filterH = useRef(new OneEuroFilter(60, 1.0, 0.0)).current;
    const filterV = useRef(new OneEuroFilter(60, 1.0, 0.0)).current;

    const gazeModel = useRef({ hMin: 0.4, hMax: 0.6, vMin: 0.4, vMax: 0.6, hCenter: 0.5, vCenter: 0.5 });

    const calibrationPoints = [
        { x: 0.1, y: 0.1, label: "Top Left" },
        { x: 0.9, y: 0.1, label: "Top Right" },
        { x: 0.5, y: 0.5, label: "Center" },
        { x: 0.1, y: 0.9, label: "Bottom Left" },
        { x: 0.9, y: 0.9, label: "Bottom Right" }
    ];

    const calibDataBuffer = useRef([]);

    useEffect(() => {
        const saved = localStorage.getItem('samvaad_gaze_model_v4');
        if (saved) {
            try { gazeModel.current = JSON.parse(saved); setIsAutoCalibrating(false); } catch (e) {}
        }
    }, []);

    const runAutoCalibration = async () => {
        setIsAutoCalibrating(true); calibDataBuffer.current = [];
        speak("Rapid calibration starting.");
        for (let i = 0; i < calibrationPoints.length; i++) {
            const pt = calibrationPoints[i]; setCalibPoint(pt); setCalibrationProgress(0);
            await new Promise(r => setTimeout(r, 600));
            const duration = 800; const interval = 40; const steps = duration / interval;
            for (let s = 0; s < steps; s++) {
                await new Promise(r => setTimeout(r, interval));
                if (latestRatios.current) { calibDataBuffer.current.push({ h: latestRatios.current.h, v: latestRatios.current.v, pointIdx: i }); }
                setCalibrationProgress(((s + 1) / steps) * 100);
            }
        }
        finalizeAutoCalibration();
    };

    const finalizeAutoCalibration = () => {
        const data = calibDataBuffer.current; if (data.length === 0) return;
        const averages = calibrationPoints.map((_, i) => {
            const pts = data.filter(d => d.pointIdx === i);
            return { h: pts.reduce((s, p) => s + p.h, 0) / pts.length, v: pts.reduce((s, p) => s + p.v, 0) / pts.length };
        });
        const hMin = (averages[0].h + averages[3].h) / 2; const hMax = (averages[1].h + averages[4].h) / 2;
        const vMin = (averages[0].v + averages[1].v) / 2; const vMax = (averages[3].v + averages[4].v) / 2;
        const hRange = hMax - hMin; const vRange = vMax - vMin;
        const model = { hMin: hMin - hRange * 0.15, hMax: hMax + hRange * 0.15, vMin: vMin - vRange * 0.15, vMax: vMax + vRange * 0.15, hCenter: averages[2].h, vCenter: averages[2].v };
        gazeModel.current = model; localStorage.setItem('samvaad_gaze_model_v4', JSON.stringify(model));
        setIsAutoCalibrating(false); setCalibPoint(null); speak("Ready.");
    };

    const geometricPredict = (h, v, headYaw = 0, headPitch = 0) => {
        const m = gazeModel.current;
        // Tracky Hybrid Mode: Head direction (75%) + Eye refinement (25%)
        const headWeight = 0.75;
        const combinedH = h * (1 - headWeight) + (0.5 - headYaw * 1.6) * headWeight;
        const combinedV = v * (1 - headWeight) + (0.45 + headPitch * 1.6) * headWeight;

        let normX = Math.max(0, Math.min(1, (combinedH - m.hMin) / (m.hMax - m.hMin)));
        let normY = Math.max(0, Math.min(1, (combinedV - m.vMin) / (m.vMax - m.vMin)));

        const applyCurve = (val) => {
            const centered = (val - 0.5) * 2; const sign = Math.sign(centered); const absVal = Math.abs(centered);
            const curved = sign * Math.pow(absVal, 1.3); return (curved / 2) + 0.5;
        };

        const accelX = applyCurve(normX); const accelY = applyCurve(normY);
        const interactionBox = { left: window.innerWidth * 0.15, right: window.innerWidth * 0.85, top: window.innerHeight * 0.15, bottom: window.innerHeight * 0.85 };
        const screenX = interactionBox.left + accelX * (interactionBox.right - interactionBox.left);
        const screenY = interactionBox.top + accelY * (interactionBox.bottom - interactionBox.top);
        return { x: screenX, y: screenY };
    };

    const onResults = useCallback((results) => {
        setIsModelLoading(false); const now = performance.now();
        if (canvasRef.current && results.faceLandmarks) {
            const ctx = canvasRef.current.getContext('2d'); const { width, height } = canvasRef.current; ctx.clearRect(0, 0, width, height);
            const drawConn = (pts, col) => { ctx.beginPath(); ctx.moveTo(pts[0].x * width, pts[0].y * height); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * width, pts[i].y * height); ctx.closePath(); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke(); };
            drawConn([469, 470, 471, 472].map(i => results.faceLandmarks[i]), PRIMARY_TEAL);
            drawConn([474, 475, 476, 477].map(i => results.faceLandmarks[i]), PRIMARY_TEAL);
        }
        if (!results.faceLandmarks) return;
        const L_inner = results.faceLandmarks[133]; const L_outer = results.faceLandmarks[33]; const L_iris = results.faceLandmarks[468];
        const R_inner = results.faceLandmarks[362]; const R_outer = results.faceLandmarks[263]; const R_iris = results.faceLandmarks[473];
        const L_top = results.faceLandmarks[159]; const L_bottom = results.faceLandmarks[145];
        const nose = results.faceLandmarks[1]; const chin = results.faceLandmarks[152];
        const leftFace = results.faceLandmarks[234]; const rightFace = results.faceLandmarks[454];

        if (L_iris && R_iris && nose && chin) {
            const rawH_base = ((L_iris.x - L_outer.x) / (L_inner.x - L_outer.x) + (R_iris.x - R_inner.x) / (R_outer.x - R_inner.x)) / 2;
            const rawV_base = (L_iris.y - L_top.y) / (L_bottom.y - L_top.y);
            const headYaw = (nose.x - (leftFace.x + rightFace.x) / 2) / (rightFace.x - leftFace.x);
            const headPitch = (nose.y - (results.faceLandmarks[10].y + chin.y) / 2) / (chin.y - results.faceLandmarks[10].y);
            
            const correctedH = rawH_base + (headYaw * 0.45); const correctedV = rawV_base + (headPitch * 0.35);
            const h = filterH.filter(correctedH, now); const v = filterV.filter(correctedV, now);
            const aperture = Math.abs(L_top.y - L_bottom.y); const isBlinking = aperture < 0.014;

            latestRatios.current = { h, v };
            if (now - lastTelemetryTime.current > 100) { setTelemetry({ h, v, headYaw, headPitch, isBlinking }); lastTelemetryTime.current = now; }

            if (!isAutoCalibrating && !isBlinking) {
                const eyePredicted = geometricPredict(h, v, headYaw, headPitch);
                const smoothedX = filterX.filter(eyePredicted.x, now); const smoothedY = filterY.filter(eyePredicted.y, now);
                setGazePoint(prev => {
                    const dx = Math.abs(smoothedX - prev.x); const dy = Math.abs(smoothedY - prev.y);
                    return (dx < 2 && dy < 2) ? prev : { x: smoothedX, y: smoothedY };
                });
            }
        }
    }, [isAutoCalibrating]);

    useEffect(() => {
        holisticRef.current = new Holistic({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${f}` });
        holisticRef.current.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5, refineFaceLandmarks: true });
        if (webcamRef.current && webcamRef.current.video) {
            const camera = new cam.Camera(webcamRef.current.video, { onFrame: async () => { if (webcamRef.current) await holisticRef.current.send({ image: webcamRef.current.video }); }, width: 640, height: 480 });
            camera.start();
        }
        return () => { if (holisticRef.current) holisticRef.current.close(); };
    }, []);

    useEffect(() => { if (holisticRef.current) holisticRef.current.onResults(onResults); }, [onResults]);

    useEffect(() => {
        const tileElements = document.querySelectorAll('[data-egcm-tile]');
        let nearestTile = null; let minAngularDist = 999; const PIXELS_PER_DEGREE = 35;
        tileElements.forEach(el => {
            const rect = el.getBoundingClientRect(); const centerX = rect.left + rect.width / 2; const centerY = rect.top + rect.height / 2;
            const dx = (gazePoint.x - centerX); const dy = (gazePoint.y - centerY);
            const distPx = Math.sqrt(dx * dx + dy * dy); const angularDist = distPx / PIXELS_PER_DEGREE;
            if (angularDist < R_CELL && angularDist < minAngularDist) { minAngularDist = angularDist; nearestTile = el.getAttribute('data-egcm-tile'); }
        });
        if (nearestTile !== activeTileId) {
            setActiveTileId(nearestTile); setDwellProgress(0); if (dwellTimerRef.current) clearInterval(dwellTimerRef.current);
            if (nearestTile) {
                const startTime = Date.now();
                dwellTimerRef.current = setInterval(() => {
                    const elapsed = Date.now() - startTime; const progress = Math.min((elapsed / DWELL_THRESHOLD) * 100, 100);
                    setDwellProgress(progress); if (progress >= 100) { clearInterval(dwellTimerRef.current); triggerTile(nearestTile); }
                }, 50);
            }
        }
    }, [gazePoint, activeTileId]);

    const triggerTile = (id) => {
        const tile = EGCM_TILES.find(t => t.id === id);
        if (tile) {
            speak(tile.text); setLastSpeech(tile.text);
            const el = document.querySelector(`[data-egcm-tile="${id}"]`);
            if (el) { el.classList.add('ring-4', 'ring-white', 'scale-110'); setTimeout(() => el.classList.remove('ring-4', 'ring-white', 'scale-110'), 300); }
        }
    };

    const speak = (text) => { if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1.0; u.pitch = 1.0; window.speechSynthesis.speak(u); } };

    const lastTelemetryTime = useRef(0);

    return (
        <div className="min-h-screen bg-[#0f172a] text-white flex flex-col font-sans overflow-hidden">
            {isAutoCalibrating && calibPoint && (
                <div className="fixed inset-0 z-[250] pointer-events-none bg-slate-950/60 backdrop-blur-[6px] transition-all duration-500">
                    <div className="absolute transition-all duration-1000 ease-in-out" style={{ left: `${calibPoint.x * 100}%`, top: `${calibPoint.y * 100}%`, transform: 'translate(-50%, -50%)' }}>
                        <div className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-75" style={{ transform: `translate(-50%, -50%) scale(${1 + (calibrationProgress / 100)})` }}>
                            <div className="w-12 h-12 rounded-full bg-teal-500/20 border border-teal-500/40 animate-ping"></div>
                        </div>
                        <svg className="absolute -translate-x-1/2 -translate-y-1/2 w-64 h-64 rotate-[-90deg]"><circle cx="128" cy="128" r="100" fill="none" stroke="rgba(45,212,191,0.05)" strokeWidth="2" /><circle cx="128" cy="128" r="100" fill="none" stroke={PRIMARY_TEAL} strokeWidth="6" strokeDasharray="628" strokeDashoffset={628 - (628 * calibrationProgress) / 100} strokeLinecap="round" className="transition-all duration-150 ease-linear" /></svg>
                        <div className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-[0_0_40px_rgba(255,255,255,0.8)] flex items-center justify-center"><div className="w-2 h-2 bg-teal-600 rounded-full"></div></div>
                        <div className="absolute top-24 -translate-x-1/2 flex flex-col items-center gap-3"><div className="text-white text-[14px] font-black tracking-[0.3em] uppercase whitespace-nowrap bg-teal-600 px-6 py-2 rounded-full shadow-2xl border-2 border-white/20 animate-bounce">{calibPoint.label}</div></div>
                    </div>
                </div>
            )}

            <header className="p-6 bg-[#1e293b]/80 backdrop-blur-md border-b border-white/10 flex justify-between items-center z-50">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></div>
                    <div><h1 className="text-xl font-bold">Samvaad AI Hybrid Gaze</h1><p className="text-xs text-slate-400">Head + Eye Tracking System</p></div>
                </div>
                <div className="flex items-center gap-6">
                    <button onClick={() => runAutoCalibration()} className="text-xs font-bold uppercase tracking-widest text-orange-400">Re-Calibrate</button>
                    <div className="flex items-center gap-2 px-3 py-1 bg-teal-500/10 border border-teal-500/30 text-teal-400 text-[10px] font-black tracking-widest uppercase rounded-full">TRACKING ACTIVE</div>
                    <button onClick={() => window.location.href = '/'} className="text-sm font-medium text-slate-400 hover:text-white">Exit</button>
                </div>
            </header>

            <main className="flex-1 relative p-8 flex items-center justify-center">
                <div className="fixed pointer-events-none z-[100] transition-transform duration-75 ease-out flex items-center justify-center" style={{ left: gazePoint.x, top: gazePoint.y, transform: `translate(-50%, -50%)` }}>
                    <div className={`absolute rounded-full border-2 border-dashed transition-all duration-300 ${activeTileId ? 'border-orange-500/50 bg-orange-500/5 scale-110' : 'border-teal-500/20 bg-teal-500/5'}`} style={{ width: '175px', height: '175px' }} />
                    <div className="w-6 h-6 rounded-full border-2 border-white/50 bg-white/20 flex items-center justify-center shadow-2xl"><div className={`w-1.5 h-1.5 rounded-full ${activeTileId ? 'bg-orange-500' : 'bg-white'}`}></div></div>
                    {activeTileId && <svg className="absolute w-24 h-24 -rotate-90"><circle cx="48" cy="48" r="40" fill="none" stroke="rgba(249,115,22,0.1)" strokeWidth="4" /><circle cx="48" cy="48" r="40" fill="none" stroke={PRIMARY_ORANGE} strokeWidth="4" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * dwellProgress) / 100} strokeLinecap="round" className="transition-all duration-75" /></svg>}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full max-w-5xl">
                    {EGCM_TILES.map((tile) => (
                        <div key={tile.id} data-egcm-tile={tile.id} className={`aspect-square rounded-[2rem] p-8 flex flex-col items-center justify-center gap-4 transition-all duration-500 transform relative overflow-hidden ${activeTileId === tile.id ? 'bg-orange-500 shadow-[0_0_50px_rgba(249,115,22,0.4)] scale-105 z-10' : 'bg-slate-800/50'} border-2 ${activeTileId === tile.id ? 'border-orange-400' : 'border-white/10'}`}>
                            <span className="text-6xl">{tile.emoji}</span>
                            <span className="text-2xl font-black uppercase tracking-wider">{tile.text}</span>
                            {activeTileId === tile.id && <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>}
                            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/20"><div className="h-full bg-white transition-all duration-75" style={{ width: activeTileId === tile.id ? `${dwellProgress}%` : '0%' }}></div></div>
                        </div>
                    ))}
                </div>

                <div className="fixed bottom-8 right-8 w-64 h-48 rounded-3xl overflow-hidden border-2 border-white/20 shadow-2xl bg-slate-900">
                    <Webcam ref={webcamRef} mirrored={true} className="w-full h-full object-cover" videoConstraints={{ width: 640, height: 480, facingMode: 'user' }} />
                    <canvas ref={canvasRef} width={640} height={480} className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ transform: 'scaleX(-1)' }} />
                </div>

                {lastSpeech && (
                    <div className="fixed bottom-12 left-1/2 -translate-x-1/2 px-8 py-4 bg-white text-slate-900 rounded-2xl shadow-2xl flex items-center gap-4 animate-bounce">
                        <p className="text-xl font-bold">"{lastSpeech}"</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default EgcmModuleDemo;