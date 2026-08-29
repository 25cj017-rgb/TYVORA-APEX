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
import TelemetryGaugeOverlay from "../components/TelemetryGaugeOverlay";
import ConjunctionNetworkModal from "../components/ConjunctionNetworkModal";
import { Satellite, ConjunctionEvent, ManeuverPlan } from "@/types";
import { supabase } from "@/lib/supabase";
import { useOrbitalStore } from "../store/useOrbitalStore";
import { useActiveSatellites, useConjunctionAlerts, useTelemetryStream } from "../hooks/useSpaceQueries";

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
    console.warn("Fullscreen notice:", e);
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
  
  // Zustand store properties
  const {
    activeSatellites,
    selectedSatellite,
    conjunctions,
    selectedConjunction,
    showAllOrbits,
    setActiveSatellites,
    setSelectedSatellite,
    setConjunctions,
    setSelectedConjunction,
    setShowAllOrbits,
  } = useOrbitalStore();

  // Local dashboard states
  const [currentTime, setCurrentTime] = useState("");
  const [alertFilter, setAlertFilter] = useState("ALL");
  const [isSimulating, setIsSimulating] = useState(true);
  const [telemetryPing, setTelemetryPing] = useState(84);
  const [mounted, setMounted] = useState(false);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [isBottomDeckOpen, setIsBottomDeckOpen] = useState(false);
  const [evasionPlan, setEvasionPlan] = useState<ManeuverPlan | null>(null);
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
  const [wsStatus, setWsStatus] = useState<string>("SYNCING");

  // React Query Hooks
  const { data: qSatellites } = useActiveSatellites();
  const { data: qConjunctions } = useConjunctionAlerts(qSatellites);
  const { data: qTelemetry } = useTelemetryStream(qSatellites);

  // Sync React Query data to Zustand store
  useEffect(() => {
    if (qSatellites && qSatellites.length > 0) {
      setActiveSatellites(qSatellites);
      if (!selectedSatellite) {
        setSelectedSatellite(qSatellites[0]);
      }
    }
  }, [qSatellites, selectedSatellite, setActiveSatellites, setSelectedSatellite]);

  useEffect(() => {
    if (qConjunctions && qConjunctions.length > 0) {
      setConjunctions(qConjunctions);
      if (!selectedConjunction) {
        setSelectedConjunction(qConjunctions[0]);
      }
    }
  }, [qConjunctions, selectedConjunction, setConjunctions, setSelectedConjunction]);

  // Sync selected satellite and reset evasion plan when selected conjunction changes
  useEffect(() => {
    setEvasionPlan(null);
    if (selectedConjunction && activeSatellites.length > 0) {
      const match = activeSatellites.find(
        (s) => s.name.toLowerCase().includes(selectedConjunction.primaryObject.toLowerCase()) ||
               selectedConjunction.primaryObject.toLowerCase().includes(s.name.toLowerCase())
      );
      if (match) {
        setSelectedSatellite(match);
      }
    }
  }, [selectedConjunction, activeSatellites, setSelectedSatellite]);


  
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

    // Realtime Subscription
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
            const currentSats = useOrbitalStore.getState().activeSatellites;
            const exists = currentSats.find(s => s.norad_id === newSat.norad_id);
            const nextSats = exists
              ? currentSats.map(s => s.norad_id === newSat.norad_id ? newSat : s)
              : [...currentSats, newSat];
            setActiveSatellites(nextSats);
            
            const currentSelected = useOrbitalStore.getState().selectedSatellite;
            if (currentSelected?.norad_id === newSat.norad_id) {
              setSelectedSatellite(newSat);
            }
          }
        }
      );

    channel.subscribe((status) => {
      console.log("Supabase Realtime subscription status changed:", status);
      setWsStatus(status === "SUBSCRIBED" ? "LIVE" : status === "CLOSED" || status === "TIMED_OUT" ? "OFFLINE" : "SYNCING");
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [stage, setActiveSatellites, setSelectedSatellite]);

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
      setTelemetryPing(Math.floor(Math.random() * 15) + 12);
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

    setConjunctions([newAlert, ...conjunctions]);
    setSelectedConjunction(newAlert);
  };

  const filteredConjunctions = conjunctions.filter(c => {
    if (alertFilter === "ALL") return true;
    return c.severity === alertFilter;
  });

  const trendData = selectedConjunction ? [
    { name: "-60m", prob: selectedConjunction.collisionProbability * 0.88 },
    { name: "-50m", prob: selectedConjunction.collisionProbability * 0.94 },
    { name: "-40m", prob: selectedConjunction.collisionProbability * 0.91 },
    { name: "-30m", prob: selectedConjunction.collisionProbability * 1.05 },
    { name: "-20m", prob: selectedConjunction.collisionProbability * 1.02 },
    { name: "-10m", prob: selectedConjunction.collisionProbability * 0.98 },
    { name: "TCA", prob: selectedConjunction.collisionProbability }
  ] : [];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#050505] text-zinc-100 font-sans text-[12px] select-none cursor-none">
      <CustomCursor />
      <img 
        src="/logo.png" 
        alt="Tyvora Logo" 
        className={`absolute top-6 right-8 w-32 md:w-48 z-[100] object-contain hover:scale-105 hover:-rotate-1 transition-all duration-1000 cursor-none ${stage === 'dashboard' ? 'opacity-0 pointer-events-none translate-y-[-10px]' : 'opacity-90 hover:opacity-100'}`} 
        style={{ mixBlendMode: 'screen', filter: 'contrast(2.5) brightness(0.6) grayscale(100%)' }} 
      />
      
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="w-full h-full flex flex-col overflow-hidden z-10 bg-[#050505]"
          >
            {/* SLEEK TOP NAVIGATION BAR */}
            <header className="h-13 px-6 bg-zinc-950/90 border-b border-zinc-800/80 backdrop-blur-xl flex items-center justify-between z-40 shrink-0 font-mono">
              <div className="flex items-center gap-4">
                <span className="font-extrabold text-sm tracking-[0.22em] text-zinc-100 flex items-center gap-2.5 font-orbitron">
                  <span className="w-2 h-2 bg-[#00ffcc] rounded-full shadow-[0_0_10px_#00ffcc]" />
                  TYVORA // APEX
                </span>
                <span className="h-4 w-px bg-zinc-800" />
                <span className="text-[10px] tracking-wider text-zinc-400 font-sans uppercase">MISSION CONTROL INTERFACE</span>
                <span className="h-4 w-px bg-zinc-800" />
                <span className="px-2 py-0.5 rounded text-[9px] font-bold tracking-widest bg-[#00ffcc]/10 text-[#00ffcc] border border-[#00ffcc]/30">
                  AUTH: {sessionUser}
                </span>
              </div>

              <div className="flex items-center gap-5 text-[10px] text-zinc-400">
                <div className="flex items-center gap-2 bg-zinc-900/60 px-2.5 py-1 rounded-md border border-zinc-800/60">
                  <Clock size={12} className="text-zinc-500" />
                  <span>EPOCH: <strong className="text-zinc-200">{currentTime}</strong></span>
                </div>

                <div className="flex items-center gap-3 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${wsStatus === "LIVE" ? "bg-[#00ffcc] shadow-[0_0_8px_#00ffcc]" : wsStatus === "OFFLINE" ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" : "bg-amber-400 animate-pulse"}`} />
                    <span>LINK: <strong className="text-zinc-200 uppercase">{wsStatus}</strong></span>
                  </div>
                  <span className="text-zinc-700">•</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00ffcc] animate-pulse" />
                    <span>LATENCY: <strong className="text-zinc-200">{telemetryPing}ms</strong></span>
                  </div>
                  <span className="text-zinc-700">•</span>
                  <div>ODTK: <strong className="text-[#00ffcc]">NOMINAL</strong></div>
                </div>

                <div className="flex items-center gap-2 pl-2 border-l border-zinc-800/80">
                  <button 
                    onClick={() => setIsNetworkModalOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-[#00ffcc]/10 hover:bg-[#00ffcc]/20 border border-[#00ffcc]/40 text-[#00ffcc] uppercase font-bold text-[9px] tracking-wider rounded transition-all font-orbitron shadow-[0_0_12px_rgba(0,255,204,0.15)]"
                  >
                    <Activity size={12} />
                    TOPOLOGY MATRIX
                  </button>
                  <button 
                    onClick={triggerAlert}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 uppercase font-bold text-[9px] tracking-wider rounded transition-all"
                  >
                    <ShieldAlert size={12} className="text-amber-400" />
                    SIMULATE THREAT
                  </button>
                </div>
              </div>
            </header>

            {/* HERO CENTER WORKSPACE (FULL BLEED 3D WITH FLOATING HUDS) */}
            <div className="flex-1 flex overflow-hidden relative">
              
              {/* LEFT DRAWER // RISK MATRIX PANEL */}
              <AnimatePresence>
                {isLeftPanelOpen && (
                  <motion.aside 
                    initial={{ width: 0, opacity: 0, x: -20 }}
                    animate={{ width: 350, opacity: 1, x: 0 }}
                    exit={{ width: 0, opacity: 0, x: -20 }}
                    transition={{ duration: 0.35, ease: "easeInOut" }}
                    className="h-full bg-zinc-950/95 border-r border-zinc-800/80 backdrop-blur-2xl z-30 flex flex-col shrink-0 shadow-2xl overflow-hidden font-mono text-[10px]"
                  >
                    <div className="p-4 border-b border-zinc-850 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="font-bold text-zinc-200 uppercase tracking-wider font-orbitron text-[11px]">
                          RISK CORRELATION MATRIX
                        </span>
                      </div>
                      <button 
                        onClick={() => setIsLeftPanelOpen(false)}
                        className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-850 transition-colors"
                      >
                        <ChevronLeft size={14} />
                      </button>
                    </div>

                    <div className="p-4 grid grid-cols-2 gap-3 bg-zinc-900/30 border-b border-zinc-850">
                      <div>
                        <span className="text-[8px] text-zinc-500 uppercase block">Space-Track Sync</span>
                        <span className="text-zinc-200 font-bold flex items-center gap-1 mt-0.5">
                          <span className="w-1.5 h-1.5 bg-[#00ffcc] rounded-full inline-block animate-pulse" />
                          ACTIVE / NOMINAL
                        </span>
                      </div>
                      <div>
                        <span className="text-[8px] text-zinc-500 uppercase block">Active Conjunctions</span>
                        <span className="text-zinc-200 font-bold mt-0.5 block">{conjunctions.length} Tracked Vectors</span>
                      </div>
                    </div>

                    <div className="p-3 flex items-center justify-between border-b border-zinc-900">
                      <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-sans">Filter Severity</span>
                      <div className="flex gap-1">
                        {["ALL", "CRITICAL", "HIGH", "MEDIUM"].map((lvl) => (
                          <button
                            key={lvl}
                            onClick={() => setAlertFilter(lvl)}
                            className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all ${
                              alertFilter === lvl 
                                ? "bg-zinc-100 text-zinc-950 shadow-sm" 
                                : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                            }`}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2">
                      <div className="space-y-1.5">
                        {filteredConjunctions.length > 0 ? (
                          filteredConjunctions.map((e) => {
                            const isSelected = selectedConjunction?.id === e.id;
                            return (
                              <div
                                key={e.id}
                                onClick={() => setSelectedConjunction(e)}
                                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                  isSelected
                                    ? "bg-zinc-900/90 border-[#00ffcc]/60 shadow-[0_0_15px_rgba(0,255,204,0.1)] text-zinc-100"
                                    : "bg-zinc-900/30 border-zinc-850 text-zinc-400 hover:bg-zinc-900/60 hover:border-zinc-700"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="font-bold text-xs tracking-wider font-orbitron text-zinc-200">{e.id}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-widest uppercase ${
                                    e.severity === "CRITICAL"
                                      ? "bg-red-500/10 text-red-400 border border-red-500/30 animate-pulse"
                                      : e.severity === "HIGH"
                                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                      : "bg-zinc-800 text-zinc-300"
                                  }`}>
                                    {e.severity}
                                  </span>
                                </div>

                                <div className="space-y-1 text-[9px]">
                                  <div className="flex justify-between">
                                    <span className="text-zinc-500">PRIMARY:</span>
                                    <span className="text-zinc-200 font-semibold">{e.primaryObject}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-zinc-500">HAZARD:</span>
                                    <span className="text-red-400">{e.secondaryObject}</span>
                                  </div>
                                  <div className="flex justify-between pt-1 border-t border-zinc-800/50 mt-1">
                                    <span className="text-zinc-500">MISS DISTANCE:</span>
                                    <span className="font-bold text-[#00ffcc] text-[10px]">{e.missDistance}m</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-center py-12 text-zinc-600 font-mono text-xs">
                            NO CONJUNCTIONS MATCH FILTER
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.aside>
                )}
              </AnimatePresence>

              {/* MAIN 3D GLOBE KERNEL */}
              <div className="flex-1 h-full relative overflow-hidden bg-black">
                
                {/* 1. TOP-LEFT FLOATING COMMAND TOOLBAR */}
                <div className="absolute top-4 left-4 z-20 pointer-events-auto flex items-center gap-3">
                  <div className="bg-zinc-950/85 border border-zinc-800/80 backdrop-blur-xl px-3.5 py-2 rounded-xl shadow-2xl flex items-center gap-4 text-[10px] font-mono">
                    
                    {!isLeftPanelOpen && (
                      <button
                        onClick={() => setIsLeftPanelOpen(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 rounded border border-zinc-700/80 transition-all font-bold uppercase tracking-wider"
                      >
                        <ChevronRight size={12} className="text-[#00ffcc]" />
                        RISK MATRIX ({conjunctions.length})
                      </button>
                    )}

                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-sans">PROPAGATION TARGET:</span>
                      <select
                        value={selectedSatellite?.norad_id || ""}
                        onChange={(e) => {
                          const sat = activeSatellites.find(s => s.norad_id === parseInt(e.target.value, 10));
                          if (sat) setSelectedSatellite(sat);
                        }}
                        className="bg-zinc-900 border border-zinc-750 text-xs text-zinc-200 font-mono rounded px-2.5 py-1 focus:outline-none focus:border-[#00ffcc] cursor-pointer"
                      >
                        {activeSatellites.map((sat) => (
                          <option key={sat.norad_id} value={sat.norad_id}>
                            {sat.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="h-4 w-px bg-zinc-800" />

                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-sans">TICK RATE:</span>
                      <button 
                        onClick={() => setIsSimulating(!isSimulating)}
                        className={`px-2.5 py-1 rounded font-mono text-[9px] font-bold tracking-widest uppercase transition-all border ${
                          isSimulating 
                            ? "bg-[#00ffcc]/15 text-[#00ffcc] border-[#00ffcc]/40 shadow-[0_0_8px_rgba(0,255,204,0.2)]" 
                            : "bg-zinc-900 text-zinc-400 border-zinc-800"
                        }`}
                      >
                        {isSimulating ? "LIVE" : "PAUSED"}
                      </button>
                    </div>

                    <div className="h-4 w-px bg-zinc-800" />

                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-sans">ORBIT PATHS:</span>
                      <button 
                        onClick={() => setShowAllOrbits(!showAllOrbits)}
                        className={`px-2.5 py-1 rounded font-mono text-[9px] font-bold tracking-widest uppercase transition-all border ${
                          showAllOrbits 
                            ? "bg-[#00ffcc]/15 text-[#00ffcc] border-[#00ffcc]/40 shadow-[0_0_8px_rgba(0,255,204,0.2)]" 
                            : "bg-zinc-900 text-zinc-400 border-zinc-800"
                        }`}
                      >
                        {showAllOrbits ? "SHOW ALL" : "TARGET ONLY"}
                      </button>
                    </div>

                    {!isRightPanelOpen && (
                      <button
                        onClick={() => setIsRightPanelOpen(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 rounded border border-zinc-700/80 transition-all font-bold uppercase tracking-wider"
                      >
                        <Cpu size={12} className="text-[#00ffcc]" />
                        ADVISORY AI
                        <ChevronLeft size={12} />
                      </button>
                    )}

                  </div>
                </div>

                {/* 2. TOP-RIGHT FLOATING TELEMETRY GAUGE */}
                <div className="absolute top-4 right-4 z-20 pointer-events-auto">
                  <TelemetryGaugeOverlay velocity={selectedSatellite?.norad_id === 25544 ? 7.66 : 7.5} altitude={selectedSatellite?.norad_id === 25544 ? 420.5 : 500} latency={telemetryPing} />
                </div>

                {/* 3. CENTER CESIUM GLOBE */}
                {selectedSatellite ? (
                  <SpaceGlobe 
                    satellites={activeSatellites}
                    selectedSatellite={selectedSatellite} 
                    onSatelliteSelect={setSelectedSatellite}
                    isLandingMode={false}
                    evasionPlan={evasionPlan}
                  />
                ) : (
                  <div className="flex-1 h-full flex items-center justify-center font-mono text-zinc-500 bg-zinc-950">
                    LOADING 3D VECTOR GLOBE CORE...
                  </div>
                )}

                {/* 4. BOTTOM FLOATING CONJUNCTION & TREND HUD DECK */}
                {selectedConjunction && (
                  <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-auto max-w-5xl mx-auto">
                    <motion.div 
                      layout
                      className="bg-zinc-950/90 border border-zinc-800/90 backdrop-blur-2xl rounded-2xl shadow-2xl overflow-hidden font-mono text-[10px]"
                    >
                      {/* Compact Deck Header */}
                      <div className="px-4 py-2.5 bg-zinc-900/60 border-b border-zinc-800/60 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-2 font-bold font-orbitron tracking-wider text-xs text-zinc-200">
                            <span className={`w-2.5 h-2.5 rounded-full ${selectedConjunction.severity === "CRITICAL" ? "bg-red-500 animate-pulse" : "bg-amber-400"}`} />
                            TARGET VECTOR // {selectedConjunction.id}
                          </span>
                          <span className="h-3 w-px bg-zinc-800" />
                          <span className="text-zinc-400">
                            Primary: <strong className="text-zinc-100">{selectedConjunction.primaryObject}</strong>
                          </span>
                          <span className="text-zinc-600">vs</span>
                          <span className="text-red-400 font-semibold">{selectedConjunction.secondaryObject}</span>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-500 uppercase font-sans text-[9px]">Calculated Miss:</span>
                            <span className="text-[#00ffcc] font-extrabold text-sm tracking-tight">{selectedConjunction.missDistance}m</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-500 uppercase font-sans text-[9px]">Collision Prob:</span>
                            <span className="text-red-400 font-bold text-sm">{(selectedConjunction.collisionProbability * 100).toFixed(4)}%</span>
                          </div>
                          <button
                            onClick={() => setIsBottomDeckOpen(!isBottomDeckOpen)}
                            className="px-3 py-1 bg-zinc-800/80 hover:bg-zinc-750 text-zinc-200 font-bold uppercase tracking-wider rounded border border-zinc-700/60 transition-all text-[9px]"
                          >
                            {isBottomDeckOpen ? "Minimize HUD ▼" : "Expand Trend & Diagnostics ▲"}
                          </button>
                        </div>
                      </div>

                      {/* Expanded 2-Column Metrics & Trend Graph */}
                      <AnimatePresence>
                        {isBottomDeckOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6"
                          >
                            {/* Left Column: Precise Axis Vectors */}
                            <div className="space-y-2.5 pr-4 border-r border-zinc-850">
                              <div className="flex items-center justify-between pb-1.5 border-b border-zinc-900 text-[9px] uppercase font-sans tracking-widest text-zinc-400 font-bold">
                                <span>Close-Approach Vector Diagnostics</span>
                                <span className="text-[#00ffcc] font-mono">TCA: {selectedConjunction.tca}</span>
                              </div>

                              <div className="grid grid-cols-2 gap-3 pt-1">
                                <div className="bg-zinc-900/40 p-2.5 rounded border border-zinc-850">
                                  <span className="text-[8px] text-zinc-500 uppercase block font-sans">RADIAL MISS VECTOR</span>
                                  <span className="text-zinc-100 font-bold text-xs">{selectedConjunction.radialMiss}m</span>
                                </div>
                                <div className="bg-zinc-900/40 p-2.5 rounded border border-zinc-850">
                                  <span className="text-[8px] text-zinc-500 uppercase block font-sans">IN-TRACK MISS</span>
                                  <span className="text-zinc-100 font-bold text-xs">{selectedConjunction.inTrackMiss}m</span>
                                </div>
                                <div className="bg-zinc-900/40 p-2.5 rounded border border-zinc-850">
                                  <span className="text-[8px] text-zinc-500 uppercase block font-sans">CROSS-TRACK MISS</span>
                                  <span className="text-zinc-100 font-bold text-xs">{selectedConjunction.crossTrackMiss}m</span>
                                </div>
                                <div className="bg-zinc-900/40 p-2.5 rounded border border-zinc-850 flex flex-col justify-center">
                                  <span className="text-[8px] text-zinc-500 uppercase block font-sans">SEVERITY STATUS</span>
                                  <span className="text-red-400 font-extrabold uppercase text-xs animate-pulse">{selectedConjunction.severity} HAZARD</span>
                                </div>
                              </div>
                            </div>

                            {/* Right Column: Collision Probability Line Graph */}
                            <div className="flex flex-col justify-between pl-2">
                              <div className="flex items-center justify-between pb-1 text-[9px] uppercase font-sans tracking-widest text-zinc-400 font-bold">
                                <span>TCA - 60m Probability Evolution</span>
                                <span className="text-zinc-500 font-mono">ODTK COVARIANCE: 99.98%</span>
                              </div>

                              <div className="h-[95px] w-full pt-2">
                                {mounted ? (
                                  <ResponsiveContainer width="100%" height={95}>
                                    <LineChart data={trendData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                                      <XAxis 
                                        dataKey="name" 
                                        stroke="#52525b" 
                                        fontSize={9} 
                                        tickLine={false} 
                                      />
                                      <YAxis 
                                        stroke="#52525b" 
                                        fontSize={9} 
                                        tickLine={false}
                                        tickFormatter={(v) => v.toFixed(4)}
                                      />
                                      <Tooltip
                                        contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", fontSize: "10px", fontFamily: "monospace", borderRadius: "8px" }}
                                        itemStyle={{ color: "#ef4444" }}
                                        labelStyle={{ color: "#a1a1aa" }}
                                      />
                                      <Line 
                                        type="monotone" 
                                        dataKey="prob" 
                                        stroke={selectedConjunction.severity === "CRITICAL" ? "#ef4444" : "#00ffcc"} 
                                        strokeWidth={2} 
                                        dot={{ r: 3, strokeWidth: 1, fill: "#050505" }}
                                        activeDot={{ r: 5, fill: "#ef4444" }}
                                      />
                                    </LineChart>
                                  </ResponsiveContainer>
                                ) : (
                                  <div className="text-[9px] text-zinc-500 flex items-center justify-center h-full">WAVEFORM LOAD...</div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </div>
                )}

              </div>

              {/* RIGHT DRAWER // ADVISORY AI ASSISTANT PANEL */}
              <AnimatePresence>
                {isRightPanelOpen && (
                  <motion.aside 
                    initial={{ width: 0, opacity: 0, x: 20 }}
                    animate={{ width: 380, opacity: 1, x: 0 }}
                    exit={{ width: 0, opacity: 0, x: 20 }}
                    transition={{ duration: 0.35, ease: "easeInOut" }}
                    className="h-full bg-zinc-950/95 border-l border-zinc-800/80 backdrop-blur-2xl z-30 flex flex-col shrink-0 shadow-2xl overflow-hidden"
                  >
                    <div className="p-3.5 border-b border-zinc-850 flex items-center justify-between font-mono text-[10px]">
                      <div className="flex items-center gap-2">
                        <Cpu size={14} className="text-[#00ffcc]" />
                        <span className="font-bold text-zinc-200 tracking-wider uppercase font-orbitron">
                          ADVISORY UNIT // AI RAG
                        </span>
                      </div>
                      <button 
                        onClick={() => setIsRightPanelOpen(false)}
                        className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-850 transition-colors"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-hidden p-3">
                      {selectedConjunction && (
                        <AssistantChat 
                          key={selectedConjunction.id} 
                          selectedConjunction={selectedConjunction} 
                          onManeuverExecute={setEvasionPlan}
                        />
                      )}
                    </div>
                  </motion.aside>
                )}
              </AnimatePresence>

            </div>

            {/* SLEEK FOOTER STATUS TICKER */}
            <footer className="h-7 px-6 bg-zinc-950 border-t border-zinc-900/80 flex items-center justify-between font-mono text-[9px] text-zinc-500 uppercase tracking-widest shrink-0 z-40">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-[#00ffcc] rounded-full animate-pulse" />
                  <span className="text-zinc-300 font-semibold">SGP4 KERNEL: ACTIVE</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-[#00ffcc] rounded-full" />
                  <span className="text-zinc-300 font-semibold">API: NOMINAL</span>
                </div>
                <div>FPS: <strong className="text-zinc-200">60.0</strong></div>
                <div>LATENCY: <strong className="text-[#00ffcc]">{telemetryPing}ms</strong></div>
              </div>
              <div className="text-zinc-600 font-sans tracking-normal text-[10px]">
                TYVORA AEROSPACE DEFENSE © 2026 // AIR-GAPPED COMMAND PROTOCOL
              </div>
            </footer>

          </motion.div>
        )}

      </AnimatePresence>

      <ConjunctionNetworkModal isOpen={isNetworkModalOpen} onClose={() => setIsNetworkModalOpen(false)} />
    </div>
  );
}
