"use client";

/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-unused-vars */

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { 
  ShieldAlert, 
  Activity, 
  Satellite as SatelliteIcon, 
  Settings, 
  Cpu, 
  AlertTriangle, 
  Bell, 
  Clock, 
  Search, 
  Radio, 
  TrendingUp, 
  Globe, 
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Menu
} from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import AssistantChat from "../components/AssistantChat";
import CustomCursor from "../components/CustomCursor";
import { Satellite, ConjunctionEvent, ManeuverPlan } from "@/types";
import { supabase } from "@/lib/supabase";

// Dynamically import SpaceGlobe to bypass server-side window errors
const SpaceGlobe = dynamic(() => import("../components/SpaceGlobe"), {
  ssr: false,
});

// High-fidelity active target space objects with valid TLE elements
const INITIAL_SATELLITES: Satellite[] = [
  {
    norad_id: 25544,
    name: "ISS (Space Station)",
    tle_line1: "1 25544U 98067A   26143.49887731  .00014603  00000-0  26307-3 0  9997",
    tle_line2: "2 25544  51.6423 331.4284 0004739 301.8842 165.7483 15.49826727568550",
    status: "ACTIVE",
    last_updated: new Date().toISOString()
  },
  {
    norad_id: 20580,
    name: "HST (Hubble)",
    tle_line1: "1 20580U 90037B   26143.19504630  .00000858  00000-0  73413-4 0  9991",
    tle_line2: "2 20580  28.4688 285.9261 0003014 345.9224  14.1741 15.00392764956108",
    status: "ACTIVE",
    last_updated: new Date().toISOString()
  },
  {
    norad_id: 40091,
    name: "Sentinel-2A",
    tle_line1: "1 40091U 15028A   26143.50000000  .00000100  00000-0  10000-4 0  9999",
    tle_line2: "2 40091  98.5621 123.4567 0001000  90.0000 270.0000 14.32100000500000",
    status: "ACTIVE",
    last_updated: new Date().toISOString()
  },
  {
    norad_id: 39084,
    name: "Landsat-8",
    tle_line1: "1 39084U 13008A   26143.50000000  .00000100  00000-0  10000-4 0  9999",
    tle_line2: "2 39084  98.2000 100.0000 0001200  90.0000 270.0000 14.50000000500000",
    status: "ACTIVE",
    last_updated: new Date().toISOString()
  },
  {
    norad_id: 37384,
    name: "GPS III-01",
    tle_line1: "1 37384U 11036A   26143.50000000  .00000010  00000-0  00000-0 0  9999",
    tle_line2: "2 37384  55.0000 150.0000 0050000  90.0000 270.0000  2.00000000500000",
    status: "ACTIVE",
    last_updated: new Date().toISOString()
  },
  {
    norad_id: 41334,
    name: "Iridium-100",
    tle_line1: "1 41334U 16011A   26143.50000000  .00000500  00000-0  50000-4 0  9999",
    tle_line2: "2 41334  86.4000  50.0000 0010000  90.0000 270.0000 14.34200000500000",
    status: "ACTIVE",
    last_updated: new Date().toISOString()
  },
  {
    norad_id: 33591,
    name: "NOAA-19",
    tle_line1: "1 33591U 09005A   26143.48625000  .00000084  00000-0  68725-4 0  9993",
    tle_line2: "2 33591  99.1415 158.7303 0013926  87.2341 273.0112 14.12450837887321",
    status: "ACTIVE",
    last_updated: new Date().toISOString()
  }
];

// Precise Conjunction Events
const INITIAL_CONJUNCTION_EVENTS: ConjunctionEvent[] = [
  {
    id: "CONJ-2026-904",
    primaryObject: "Starlink-3841",
    secondaryObject: "CZ-4C Debris (40932)",
    tca: "2026-05-23 14:42:19 UTC",
    missDistance: 142,
    collisionProbability: 0.00045,
    severity: "CRITICAL",
    radialMiss: 38.4,
    inTrackMiss: 112.1,
    crossTrackMiss: 80.5,
  },
  {
    id: "CONJ-2026-905",
    primaryObject: "Tyvora-Sat 1A",
    secondaryObject: "Falcon Debris (58392)",
    tca: "2026-05-23 18:10:04 UTC",
    missDistance: 310,
    collisionProbability: 0.00008,
    severity: "HIGH",
    radialMiss: 92.1,
    inTrackMiss: 245.3,
    crossTrackMiss: 168.2,
  },
  {
    id: "CONJ-2026-906",
    primaryObject: "GPS III-06",
    secondaryObject: "SL-12 R/B Debris",
    tca: "2026-05-24 03:15:32 UTC",
    missDistance: 980,
    collisionProbability: 0.000005,
    severity: "MEDIUM",
    radialMiss: 210.4,
    inTrackMiss: 890.1,
    crossTrackMiss: 412.3,
  },
  {
    id: "CONJ-2026-907",
    primaryObject: "OneWeb-0294",
    secondaryObject: "Cosmos Debris",
    tca: "2026-05-24 09:55:00 UTC",
    missDistance: 1205,
    collisionProbability: 0.000001,
    severity: "LOW",
    radialMiss: 340.5,
    inTrackMiss: 1102.4,
    crossTrackMiss: 450.9,
  }
];

// Helper function to safely request fullscreen in all browsers
const enableFullscreen = () => {
  if (typeof window === "undefined") return;
  try {
    const docEl = document.documentElement as any;
    const requestFs =
      docEl.requestFullscreen ||
      docEl.mozRequestFullScreen ||
      docEl.webkitRequestFullscreen ||
      docEl.msRequestFullscreen;

    if (requestFs) {
      requestFs.call(docEl).catch((err: any) => {
        console.warn("Fullscreen permission denied or needs user gesture:", err);
      });
    }
  } catch (e) {
    console.error("Fullscreen error:", e);
  }
};

type AppStage = "portal-landing" | "login" | "handshake" | "dashboard";

export default function Home() {
  const [stage, setStage] = useState<AppStage>("portal-landing");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [username, setUsername] = useState("admin@tyvora.com");
  const [password, setPassword] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<string>("GUEST");
  
  // Dashboard states
  const [conjunctions, setConjunctions] = useState(INITIAL_CONJUNCTION_EVENTS);
  const [selectedConjunction, setSelectedConjunction] = useState(INITIAL_CONJUNCTION_EVENTS[0]);
  const [activeSatellites, setActiveSatellites] = useState(INITIAL_SATELLITES);
  const [selectedSatellite, setSelectedSatellite] = useState(INITIAL_SATELLITES[0]);
  const [currentTime, setCurrentTime] = useState("");
  const [alertFilter, setAlertFilter] = useState("ALL");
  const [isSimulating, setIsSimulating] = useState(true);
  const [telemetryPing, setTelemetryPing] = useState(84);
  const [mounted, setMounted] = useState(false);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [evasionPlan, setEvasionPlan] = useState<ManeuverPlan | null>(null);
  
  // High-performance parallax (bypasses React state to prevent re-renders)
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springConfig = { damping: 25, stiffness: 150 };
  const smoothMouseX = useSpring(mouseX, springConfig);
  const smoothMouseY = useSpring(mouseY, springConfig);
  const bgX = useTransform(smoothMouseX, [-0.5, 0.5], [25, -25]);
  const bgY = useTransform(smoothMouseY, [-0.5, 0.5], [25, -25]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set((e.clientX / window.innerWidth) - 0.5);
      mouseY.set((e.clientY / window.innerHeight) - 0.5);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  // Safe client-side mount trigger
  useEffect(() => {
    setMounted(true);
  }, []);

  // Phase 6: Live WebSocket Telemetry Subscription
  useEffect(() => {
    if (stage !== "dashboard") return;

    // 1. Initial Load of current satellites
    const fetchSatellites = async () => {
      const { data, error } = await supabase.from('satellites').select('*');
      if (data && !error && data.length > 0) {
        setActiveSatellites(data as Satellite[]);
        setSelectedSatellite((prev: Satellite) => data.find(s => s.norad_id === prev.norad_id) || data[0]);
      }
    };
    fetchSatellites();

    // 2. Realtime Subscription
    const channel = supabase.channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'satellites',
        },
        (payload) => {
          console.log("Realtime payload received!", payload);
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const newSat = payload.new as Satellite;
            setActiveSatellites((prev: Satellite[]) => {
              const exists = prev.find(s => s.norad_id === newSat.norad_id);
              if (exists) {
                return prev.map(s => s.norad_id === newSat.norad_id ? newSat : s);
              }
              return [...prev, newSat];
            });
            setSelectedSatellite((prev: Satellite) => prev.norad_id === newSat.norad_id ? newSat : prev);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [stage]);

  // Automatic fullscreen trigger on landing page first interaction
  useEffect(() => {
    if (!mounted || stage !== "portal-landing") return;

    const triggerFullscreen = () => {
      enableFullscreen();
      // Remove listener after first interaction to remain clean and lightweight
      window.removeEventListener("click", triggerFullscreen);
      window.removeEventListener("keydown", triggerFullscreen);
      window.removeEventListener("touchstart", triggerFullscreen);
    };

    // Try immediately (in case browser allows persistent/pre-authorized fullscreen)
    enableFullscreen();

    // Listen for any key user interaction to automatically enter fullscreen
    window.addEventListener("click", triggerFullscreen);
    window.addEventListener("keydown", triggerFullscreen);
    window.addEventListener("touchstart", triggerFullscreen);

    return () => {
      window.removeEventListener("click", triggerFullscreen);
      window.removeEventListener("keydown", triggerFullscreen);
      window.removeEventListener("touchstart", triggerFullscreen);
    };
  }, [mounted, stage]);

  // Live UTC Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toISOString().replace("T", " ").substring(0, 19) + " UTC");
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Telemetry fluctuation simulator
  useEffect(() => {
    if (stage !== "dashboard" || !isSimulating) return;

    const interval = setInterval(() => {
      setSelectedConjunction(prev => {
        const delta = (Math.random() - 0.5) * 4;
        const newMiss = Math.max(10, Math.round(prev.missDistance + delta));
        return { ...prev, missDistance: newMiss };
      });
      setTelemetryPing(Math.floor(Math.random() * 40) + 60);
    }, 3000);

    return () => clearInterval(interval);
  }, [isSimulating, stage]);

  const handleLandingClick = () => {
    if (stage !== "portal-landing") return;
    
    // Explicit fullscreen trigger inside click handler to guarantee browser compliance
    enableFullscreen();

    setIsTransitioning(true);
    setTimeout(() => {
      setStage("login");
      setIsTransitioning(false);
    }, 1200); // 1.2s cinematic zoom warp transition
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsTransitioning(true);

    // Local Bypass for testing without a real Supabase backend
    if (username.trim() === "admin@tyvora.com" && password === "tyvora2026") {
      setSessionUser("ADMIN");
      setStage("handshake");
      setTimeout(() => {
        setStage("dashboard");
        setIsTransitioning(false);
      }, 1500);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: username.trim(),
        password: password,
      });

      if (error) {
        setAuthError(`⚠️ ACCESS DENIED: ${error.message.toUpperCase()}`);
        setIsTransitioning(false);
      } else if (data.session) {
        setSessionUser(data.user?.email?.split('@')[0].toUpperCase() || "OPERATOR");
        setStage("handshake");
        setTimeout(() => {
          setStage("dashboard");
          setIsTransitioning(false);
        }, 1500); // 1.5s security authentication sync
      }
    } catch (err) {
      setAuthError("⚠️ SYSTEM FAULT: SUPABASE CONNECTION ERROR");
      setIsTransitioning(false);
    }
  };

  const triggerAlert = () => {
    const randomId = Math.floor(Math.random() * 1000) + 1000;
    const newAlert: ConjunctionEvent = {
      id: `CONJ-2026-${randomId}`,
      primaryObject: `Astroscale-E`,
      secondaryObject: `Delta Debris (${Math.floor(Math.random() * 80000) + 10000})`,
      tca: new Date(Date.now() + 1000 * 60 * 30).toISOString().replace("T", " ").substring(0, 19) + " UTC",
      missDistance: Math.floor(Math.random() * 400) + 80,
      collisionProbability: parseFloat((Math.random() * 0.005 + 0.0001).toFixed(6)),
      severity: Math.random() > 0.5 ? "CRITICAL" : "HIGH",
      radialMiss: parseFloat((Math.random() * 100 + 20).toFixed(1)),
      inTrackMiss: parseFloat((Math.random() * 300 + 80).toFixed(1)),
      crossTrackMiss: parseFloat((Math.random() * 200 + 40).toFixed(1)),
    };

    setConjunctions(prev => [newAlert, ...prev]);
    setSelectedConjunction(newAlert);
  };

  const filteredConjunctions = conjunctions.filter(c => {
    if (alertFilter === "ALL") return true;
    return c.severity === alertFilter;
  });

  const trendData = [
    { name: "-60m", prob: selectedConjunction.collisionProbability * 0.88 },
    { name: "-50m", prob: selectedConjunction.collisionProbability * 0.94 },
    { name: "-40m", prob: selectedConjunction.collisionProbability * 0.91 },
    { name: "-30m", prob: selectedConjunction.collisionProbability * 1.05 },
    { name: "-20m", prob: selectedConjunction.collisionProbability * 1.02 },
    { name: "-10m", prob: selectedConjunction.collisionProbability * 0.98 },
    { name: "TCA", prob: selectedConjunction.collisionProbability }
  ];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#050505] text-zinc-100 font-sans text-[12px] select-none cursor-none">
      <CustomCursor />
      
      {/* IMMERSIVE LANDING & LOGIN Backdrops */}
      <AnimatePresence>
        {stage !== "dashboard" && mounted && (
          <motion.div 
            key="landing-background"
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: 1,
              scale: isTransitioning ? 1.08 : 1.05,
              filter: isTransitioning ? "blur(3px)" : "blur(0px)"
            }}
            style={{ 
              backgroundImage: "url('/tyvora_landing_background.png')",
              x: bgX,
              y: bgY
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            className="absolute -inset-10 z-0 bg-cover bg-left md:bg-center no-repeat"
          />
        )}
      </AnimatePresence>

      {/* PORTAL INTERACTIVE PANEL */}
      <AnimatePresence mode="wait">
        
        {/* STAGE 0: IMMERSIVE PORTAL SPLASH */}
        {stage === "portal-landing" && (
          <motion.div 
            key="portal-landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleLandingClick}
            className="absolute inset-0 z-10 flex flex-col md:grid md:grid-cols-2 p-8 md:p-20 cursor-pointer"
          >
            {/* Left side is left empty to showcase the premium crescent Earth photograph */}
            <div className="flex-1 md:col-span-1" />

            {/* Right side holds the elegant Orbitron typography and engage button */}
            <div className="flex-1 md:col-span-1 flex flex-col justify-center items-start md:pl-16 space-y-6">
              
              <div className="space-y-1">
                <motion.span 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 0.5, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="font-mono text-[10px] text-zinc-400 tracking-[0.3em] uppercase block"
                >
                  SPACE SITUATIONAL RISK ASSESSMENT
                </motion.span>
                
                {/* Beautiful custom contrast font title */}
                <motion.h1 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1.0, ease: "easeOut" }}
                  className="text-zinc-100 font-extrabold text-6xl tracking-[0.18em] font-orbitron select-none uppercase drop-shadow-[0_0_20px_rgba(255,255,255,0.12)]"
                >
                  TYVORA
                </motion.h1>
              </div>

              <motion.div 
                animate={{ opacity: isTransitioning ? [1, 0] : [0.35, 0.9, 0.35] }}
                transition={{ repeat: Infinity, duration: 1.8 }}
                className="font-mono text-[9px] text-zinc-300 uppercase tracking-[0.2em] border border-zinc-800 bg-zinc-950/70 px-4 py-2 rounded backdrop-blur-sm"
              >
                {isTransitioning 
                  ? "ENGAGING DECRYPTION CIPHER..." 
                  : "PRESS SCREEN TO INITIALIZE COMMAND PORTAL"}
              </motion.div>

            </div>
          </motion.div>
        )}

        {/* STAGE 1: DECRYPTION LOGIN CONSOLE */}
        {stage === "login" && (
          <motion.div 
            key="login"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/20 backdrop-blur-[1px]"
          >
            <form 
              onSubmit={handleLoginSubmit}
              className="w-96 border border-zinc-800 bg-zinc-950/90 backdrop-blur-md p-7 rounded font-mono text-[11px] space-y-4"
            >
              <div className="border-b border-zinc-850 pb-3">
                <div className="font-bold text-zinc-100 tracking-widest text-[12px] font-orbitron">TYVORA // DECRYPTION CONSOLE</div>
                <div className="text-[9px] text-zinc-500 uppercase mt-0.5">Enter credentials to decode telemetry matrix</div>
              </div>

              {authError && (
                <div className="p-2 border border-red-900/40 bg-red-950/20 text-red-500 font-bold text-center rounded text-[9px] uppercase animate-pulse">
                  {authError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[9px] text-zinc-500 uppercase block">Decrypt Cipher Key (Email)</label>
                <input 
                  type="email" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 p-2 text-zinc-100 rounded text-xs focus:outline-none focus:border-zinc-700 transition-all font-mono"
                  placeholder="admin@tyvora.com"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] text-zinc-500 uppercase block">Decryption Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 p-2 text-zinc-100 rounded text-xs focus:outline-none focus:border-zinc-700 transition-all font-mono"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] text-zinc-500 uppercase block">Secure MFA Handshake Key (Optional)</label>
                <input 
                  type="text" 
                  value={mfaToken}
                  onChange={(e) => setMfaToken(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 p-2 text-zinc-100 rounded text-xs focus:outline-none focus:border-zinc-700 transition-all font-mono text-center tracking-[0.2em]"
                  placeholder="000 000"
                  maxLength={6}
                />
              </div>

              <motion.button 
                whileHover={{ scale: 1.02, boxShadow: "0 0 15px rgba(0,255,204,0.3)" }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isTransitioning}
                className="w-full py-2.5 bg-zinc-100 text-zinc-950 font-bold hover:bg-white hover:text-[#00ffcc] uppercase text-[10px] tracking-wider rounded transition-all cursor-none font-orbitron disabled:opacity-50"
              >
                {isTransitioning ? "AUTHENTICATING..." : "DECODE ACCESS ENCRYPT / LOGIN"}
              </motion.button>
            </form>
          </motion.div>
        )}

        {/* STAGE 2: HIGH-TECH HANDSHAKE LOADER */}
        {stage === "handshake" && (
          <motion.div 
            key="handshake"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-950 font-mono text-[10px] tracking-widest text-zinc-400"
          >
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="w-12 h-12 border-2 border-zinc-800 border-t-[#00ffcc] border-r-[#00ccaa] rounded-full mb-6 shadow-[0_0_15px_rgba(0,255,204,0.4)]" 
            />
            <motion.p 
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="uppercase font-bold text-[#00ffcc]"
            >
              STAGE: INITIALIZING SECURE HANDSHAKE...
            </motion.p>
            <p className="text-zinc-600 text-[9px] mt-2 uppercase font-semibold">Validating ephemeris key matching algorithm</p>
          </motion.div>
        )}

        {/* STAGE 3: PROTECTED DASHBOARD SYSTEM */}
        {stage === "dashboard" && mounted && (
          <motion.div 
            key="dashboard"
            initial={{ opacity: 0, scale: 0.98, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1.2, ease: "easeOut", staggerChildren: 0.1 }}
            className="w-full h-full flex overflow-hidden z-10"
          >
            
            <main className="flex-1 flex flex-col h-full overflow-hidden p-3 gap-3">
              
              {/* TOP STATUS BAR */}
              <header className="flex items-center justify-between py-1.5 font-mono">
                <div className="flex items-center gap-4">
                  <span className="font-bold tracking-widest text-zinc-100 flex items-center gap-2 font-orbitron">
                    <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full" />
                    TYVORA // MISSION CONTROL INTERFACE
                  </span>
                  <span className="text-zinc-600">|</span>
                  <span className="text-[#00ffcc] font-bold">AUTH: {sessionUser}</span>
                  <span className="text-zinc-600">|</span>
                  <span className="text-zinc-400">EPOCH: <span className="text-zinc-200">{currentTime}</span></span>
                </div>

                <div className="flex items-center gap-6 text-[10px] text-zinc-400">
                  <div className="flex items-center gap-1.5">TELEMETRY LATENCY: <span className="text-zinc-200 font-bold">{telemetryPing}ms</span><span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-pulse" /></div>
                  <div>TLE PROPAGATION ERROR (RMS): <span className="text-zinc-200 font-bold">0.024 km</span></div>
                  <div>COVARIANCE MATRIX INTEGRITY: <span className="text-zinc-200 font-bold">99.98%</span></div>
                  <div>ODTK BATCH FILTER: <span className="text-zinc-200 font-bold">NOMINAL</span></div>
                  <button 
                    onClick={triggerAlert}
                    className="px-2 py-0.5 border border-zinc-700 hover:border-zinc-500 bg-zinc-850 hover:bg-zinc-800 text-zinc-200 uppercase font-semibold text-[9px] rounded cursor-pointer transition-colors"
                  >
                    Simulate Threat Ingest
                  </button>
                </div>
              </header>

              {/* WORKSPACE MATRIX */}
              <section className="flex-1 flex gap-3 overflow-hidden relative">
                
                {/* PRIMARY COLUMN */}
                <AnimatePresence>
                  {isLeftPanelOpen && (
                    <motion.div 
                      initial={{ width: 0, opacity: 0 }} 
                      animate={{ width: "25%", opacity: 1 }} 
                      exit={{ width: 0, opacity: 0 }}
                      className="h-full flex-shrink-0 overflow-hidden"
                    >
                      <div className="w-full min-w-[280px] h-full flex flex-col gap-6 pr-2">
                  
                  <div className="grid grid-cols-2 gap-4 py-2">
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-zinc-500 uppercase block">Space-Track API Sync</span>
                      <span className="font-mono text-zinc-200 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full inline-block animate-pulse" />
                        STANDBY / ACTIVE
                      </span>
                    </div>
                    <div className="space-y-0.5 pl-1.5">
                      <span className="text-[9px] text-zinc-500 uppercase block">SGP4 Steps / hr</span>
                      <span className="font-mono text-zinc-200 font-bold">1,440/hr</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-zinc-500 uppercase block">Orbit Determination</span>
                      <span className="font-mono text-zinc-200">12.8ms</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-zinc-500 uppercase block">Conjunction Count</span>
                      <span className="font-mono text-zinc-200 font-bold">{conjunctions.length} Active Vectors</span>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between pb-3 mb-2 border-b border-zinc-900">
                      <span className="font-bold font-sans tracking-wider text-zinc-400 uppercase text-[10px]">
                        Close-Approach Risk Matrix
                      </span>
                      
                      <div className="flex gap-1">
                        {["ALL", "CRITICAL", "HIGH", "MEDIUM"].map((lvl) => (
                          <button
                            key={lvl}
                            onClick={() => setAlertFilter(lvl)}
                            className={`px-1.5 py-0.5 rounded text-[8px] font-mono border transition-all ${
                              alertFilter === lvl 
                                ? "bg-zinc-200 text-zinc-950 border-zinc-300 font-bold" 
                                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                            }`}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                      <table className="w-full text-left font-mono text-[10px] border-collapse">
                        <thead>
                          <tr className="text-zinc-500 border-b border-zinc-900">
                            <th className="py-2 pr-2 font-normal font-sans uppercase text-[9px] tracking-widest">EVENT ID</th>
                            <th className="py-2 px-2 font-normal font-sans uppercase text-[9px] tracking-widest">PRIMARY</th>
                            <th className="py-2 px-2 font-normal font-sans uppercase text-[9px] tracking-widest">HAZARD OBJECT</th>
                            <th className="py-2 px-2 text-right font-normal font-sans uppercase text-[9px] tracking-widest">MISS</th>
                            <th className="py-2 pl-2 text-right font-normal font-sans uppercase text-[9px] tracking-widest">SEV</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900/50">
                          {filteredConjunctions.length > 0 ? (
                            filteredConjunctions.map((e) => {
                              const isSelected = selectedConjunction.id === e.id;
                              return (
                                <tr 
                                  key={e.id}
                                  onClick={() => setSelectedConjunction(e)}
                                  className={`hover:bg-zinc-900/40 cursor-pointer transition-colors ${
                                    isSelected ? "bg-zinc-900 text-zinc-100 font-bold" : "text-zinc-400"
                                  }`}
                                >
                                  <td className="py-2 pr-2 text-zinc-200">{e.id}</td>
                                  <td className="p-2 truncate max-w-[80px] text-zinc-300">{e.primaryObject}</td>
                                  <td className="p-2 truncate max-w-[90px] text-zinc-300">{e.secondaryObject}</td>
                                  <td className="p-2 text-right font-bold text-zinc-100">{e.missDistance}m</td>
                                  <td className="py-2 pl-2 text-right">
                                    <span className={`px-1.5 py-0.5 text-[8px] font-bold tracking-widest uppercase ${
                                      e.severity === "CRITICAL" 
                                        ? "text-[#ef4444] border border-[#ef4444] animate-pulse" 
                                        : e.severity === "HIGH"
                                        ? "text-amber-500 border border-amber-900"
                                        : e.severity === "MEDIUM"
                                        ? "text-zinc-400"
                                        : "text-zinc-500"
                                    }`}>
                                      {e.severity}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={5} className="text-center py-8 text-zinc-600 font-mono">
                                NO ACTIVE TRACKS MATCHING CORRELATION FILTER.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* SECONDARY & TERTIARY SECTION */}
                <motion.div className="flex-1 flex flex-col gap-6 h-full overflow-hidden px-2 relative min-w-0">
                  
                  {/* Left Toggle Button */}
                  <button 
                    onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)} 
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-30 p-1 bg-zinc-950 border border-zinc-700 border-l-0 rounded-r text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-all cursor-pointer shadow-lg"
                  >
                     <ChevronRight size={14} className={isLeftPanelOpen ? "rotate-180 transition-transform" : "transition-transform"} />
                  </button>

                  {/* Right Toggle Button */}
                  <button 
                    onClick={() => setIsRightPanelOpen(!isRightPanelOpen)} 
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-30 p-1 bg-zinc-950 border border-zinc-700 border-r-0 rounded-l text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-all cursor-pointer shadow-lg"
                  >
                     <ChevronLeft size={14} className={isRightPanelOpen ? "rotate-180 transition-transform" : "transition-transform"} />
                  </button>
                  
                  <div className="flex-1 flex flex-col overflow-hidden min-h-[380px]">
                    <div className="flex items-center justify-between pb-3 mb-2 border-b border-zinc-900">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-zinc-300 rounded-full" />
                        <span className="font-bold font-sans text-[10px] uppercase text-zinc-400 tracking-wider">
                          SGP4 Telemetry Orbital Vector Grid (3D)
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-zinc-500 font-mono">PROPAGATION CORRELATION:</span>
                          <select
                            value={selectedSatellite.norad_id}
                            onChange={(e) => {
                              const sat = activeSatellites.find(s => s.norad_id === parseInt(e.target.value, 10));
                              if (sat) setSelectedSatellite(sat);
                            }}
                            className="bg-zinc-950 border border-zinc-800 text-[9px] text-zinc-300 font-mono rounded px-2 py-0.5 focus:outline-none cursor-pointer hover:border-zinc-700"
                          >
                            {activeSatellites.map((sat) => (
                              <option key={sat.norad_id} value={sat.norad_id}>
                                {sat.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-zinc-500 font-mono">TICK RATE:</span>
                          <button 
                            onClick={() => setIsSimulating(!isSimulating)}
                            className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-bold border ${
                              isSimulating ? "bg-zinc-850 text-zinc-200 border-zinc-700" : "bg-zinc-900 text-zinc-500 border-zinc-800"
                            }`}
                          >
                            {isSimulating ? "LIVE" : "PAUSED"}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 relative bg-black/40">
                      <SpaceGlobe 
                        satellites={activeSatellites}
                        selectedSatellite={selectedSatellite} 
                        onSatelliteSelect={setSelectedSatellite}
                        isLandingMode={false}
                        evasionPlan={evasionPlan}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6 h-[190px]">
                    
                    {/* ACTIVE CONJUNCTION DETAIL */}
                    <div className="flex flex-col justify-between font-mono pr-2">
                      <div className="pb-2 mb-2 flex items-center justify-between">
                        <span className="font-bold text-[10px] font-sans tracking-widest text-zinc-400 uppercase">Vector Target // {selectedConjunction.id}</span>
                        <span className={`text-[9px] font-bold tracking-widest uppercase ${
                          selectedConjunction.severity === "CRITICAL"
                            ? "text-red-500 animate-pulse"
                            : "text-zinc-400"
                        }`}>
                          {selectedConjunction.severity}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-[10px] text-zinc-400">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">PRIMARY CORRELATION:</span>
                          <span className="text-zinc-100 font-bold">{selectedConjunction.primaryObject}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">SECONDARY HAZARD:</span>
                          <span className="text-red-400">{selectedConjunction.secondaryObject}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">TCA POINT (UTC):</span>
                          <span className="text-zinc-200">{selectedConjunction.tca}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">RADIAL MISS VECTOR:</span>
                          <span className="text-zinc-200">{selectedConjunction.radialMiss}m</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">IN-TRACK / CROSS MISS:</span>
                          <span className="text-zinc-200">{selectedConjunction.inTrackMiss}m / {selectedConjunction.crossTrackMiss}m</span>
                        </div>
                      </div>

                      <div className="pt-2 mt-2 flex justify-between items-center text-[11px]">
                        <span className="text-zinc-500 font-sans uppercase text-[9px] tracking-widest">Calculated Miss:</span>
                        <span className="text-zinc-100 font-bold text-base tracking-tight">{selectedConjunction.missDistance}m</span>
                      </div>
                    </div>

                    {/* PROBABILITY TREND GRAPH */}
                    <div className="flex flex-col justify-between font-mono pl-2">
                      <div className="pb-2 mb-1 flex items-center justify-between">
                        <span className="font-bold text-[10px] font-sans tracking-widest text-zinc-400 uppercase">Collision Probability Trend</span>
                        <span className={`font-bold ${selectedConjunction.severity === "CRITICAL" ? "text-red-500" : "text-zinc-200"}`}>
                          {(selectedConjunction.collisionProbability * 100).toFixed(5)}%
                        </span>
                      </div>

                      <div className="flex-1 w-full min-h-[90px] flex items-center justify-center relative mt-1">
                        {mounted ? (
                          <ResponsiveContainer width="100%" height={90}>
                            <LineChart data={trendData} margin={{ top: 10, right: 15, left: -25, bottom: 0 }}>
                              <XAxis 
                                dataKey="name" 
                                stroke="#3f3f46" 
                                fontSize={8} 
                                tickLine={false} 
                              />
                              <YAxis 
                                stroke="#3f3f46" 
                                fontSize={8} 
                                tickLine={false}
                                tickFormatter={(v) => v.toFixed(4)}
                              />
                              <Tooltip
                                contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", fontSize: "9px", fontFamily: "monospace" }}
                                itemStyle={{ color: "#ef4444" }}
                                labelStyle={{ color: "#71717a" }}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="prob" 
                                stroke={selectedConjunction.severity === "CRITICAL" ? "#ef4444" : "#71717a"} 
                                strokeWidth={1.5} 
                                dot={{ r: 2, strokeWidth: 1 }}
                                activeDot={{ r: 4 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="text-[9px] text-zinc-500">LOAD TRANSIENT WAVEFORM...</div>
                        )}
                      </div>

                      <div className="flex justify-between items-center text-[8px] text-zinc-500 pt-1 border-t border-zinc-900/50 mt-1">
                        <span>RESOLVED CONJUNCTION RESOLUTION:</span>
                        <span className="text-zinc-400">1:144,000 PROP VECTOR STEP</span>
                      </div>
                    </div>

                  </div>

                </motion.div>

                {/* TERTIARY COLUMN - AI INSIGHT ASSISTANT */}
                <AnimatePresence>
                  {isRightPanelOpen && (
                    <motion.div 
                      initial={{ width: 0, opacity: 0 }} 
                      animate={{ width: "25%", opacity: 1 }} 
                      exit={{ width: 0, opacity: 0 }}
                      className="h-full flex-shrink-0 overflow-hidden"
                    >
                      <div className="w-full min-w-[280px] h-full flex flex-col gap-3 pl-2">
                        <AssistantChat 
                          key={selectedConjunction.id} 
                          selectedConjunction={selectedConjunction} 
                          onManeuverExecute={setEvasionPlan}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </section>
              
              {/* SYSTEM HEALTH TICKER */}
              <footer className="pt-2 flex items-center justify-between border-t border-zinc-900 font-mono text-[9px] text-zinc-500 uppercase tracking-widest mt-2">
                <div className="flex gap-6">
                  <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-[#00ffcc] rounded-full animate-pulse" /> SGP4 KERNEL: ACTIVE</div>
                  <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-[#00ffcc] rounded-full" /> API STATUS: NOMINAL</div>
                  <div className="flex items-center gap-1.5">FPS: <span className="text-zinc-200 font-bold">60.0</span></div>
                  <div className="flex items-center gap-1.5">LATENCY: <span className="text-[#00ffcc] font-bold">{telemetryPing}ms</span></div>
                </div>
                <div className="text-zinc-600">TYVORA AEROSPACE DEFENSE © 2026</div>
              </footer>

            </main>

          </motion.div>
        )}

      </AnimatePresence>

    </div>
  );
}
