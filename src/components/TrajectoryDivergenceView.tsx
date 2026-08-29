"use client";

import React, { useEffect, useRef, useState } from "react";
import { ConjunctionEvent, ManeuverPlan } from "@/types";
import AssistantChat from "./AssistantChat";
import { ConjunctionEvent as InsightConjunctionEvent } from "@/services/insightAssistant";

interface TrajectoryDivergenceViewProps {
  conjunction: ConjunctionEvent;
  evasionPlan: ManeuverPlan | null;
  onManeuverExecute: (plan: ManeuverPlan) => void;
  onClose: () => void;
}

export default function TrajectoryDivergenceView({
  conjunction,
  evasionPlan,
  onManeuverExecute,
  onClose,
}: TrajectoryDivergenceViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const [tab, setTab] = useState<"TELEMETRY" | "LOGS">("TELEMETRY");

  // ─── Canvas Renderer ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let t = 0;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // ── Background ─────────────────────────────────────────────────────────
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, W, H);

      // Subtle grid
      ctx.strokeStyle = "rgba(39,39,42,0.5)";
      ctx.lineWidth = 0.5;
      const gridStep = 40;
      for (let x = 0; x < W; x += gridStep) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += gridStep) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // ── Radar Detection Zone ────────────────────────────────────────────────
      // Center of the radar circle — slightly left of center
      const cx = W * 0.38;
      const cy = H * 0.48;
      const R = Math.min(W, H) * 0.34;

      // Outer glow
      const radGrad = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R);
      radGrad.addColorStop(0, "rgba(0,255,204,0.0)");
      radGrad.addColorStop(0.85, "rgba(0,255,204,0.04)");
      radGrad.addColorStop(1, "rgba(0,255,204,0.12)");
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = radGrad;
      ctx.fill();

      // Circle border
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,255,204,0.25)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Inner rings
      [0.65, 0.35].forEach((frac) => {
        ctx.beginPath();
        ctx.arc(cx, cy, R * frac, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0,255,204,0.08)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      });

      // Crosshair at center
      const ch = 14;
      ctx.strokeStyle = "rgba(0,255,204,0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - ch, cy); ctx.lineTo(cx + ch, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - ch); ctx.lineTo(cx, cy + ch); ctx.stroke();

      // ── Animated sweep line ─────────────────────────────────────────────────
      const sweepAngle = (t * 0.015) % (Math.PI * 2);
      const sweepGrad = ctx.createConicalGradient
        ? null
        : null; // fallback: just draw a line
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(sweepAngle);
      const sweepFade = ctx.createLinearGradient(0, 0, R, 0);
      sweepFade.addColorStop(0, "rgba(0,255,204,0.0)");
      sweepFade.addColorStop(0.6, "rgba(0,255,204,0.18)");
      sweepFade.addColorStop(1, "rgba(0,255,204,0.35)");
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(R, 0);
      ctx.strokeStyle = sweepFade;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // ── Close Approach Intersection Point ───────────────────────────────────
      // The two lines cross slightly right of center inside the radar circle
      const ix = cx + R * 0.15;
      const iy = cy - R * 0.04;

      // Pulsing red ring at intersection
      const pulse = 0.55 + 0.45 * Math.abs(Math.sin(t * 0.05));
      ctx.beginPath();
      ctx.arc(ix, iy, 10 + 4 * Math.abs(Math.sin(t * 0.05)), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(239,68,68,${pulse})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Target reticle icon (crosshair target)
      ctx.beginPath();
      ctx.arc(ix, iy, 5, 0, Math.PI * 2);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ix - 10, iy); ctx.lineTo(ix - 6, iy);
      ctx.moveTo(ix + 6, iy); ctx.lineTo(ix + 10, iy);
      ctx.moveTo(ix, iy - 10); ctx.lineTo(ix, iy - 6);
      ctx.moveTo(ix, iy + 6); ctx.lineTo(ix, iy + 10);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1;
      ctx.stroke();

      // ── DANGER / COLLISION TRAJECTORY (white solid) ─────────────────────────
      // Goes from bottom-left to upper-right, passes through the intersection
      const dStartX = W * 0.02;
      const dStartY = H * 0.92;
      const dEndX = W * 0.78;
      const dEndY = H * 0.04;

      ctx.beginPath();
      ctx.moveTo(dStartX, dStartY);
      ctx.lineTo(dEndX, dEndY);
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.shadowColor = "rgba(255,255,255,0.3)";
      ctx.shadowBlur = 4;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // ── EVASION / PREDICTED TRAJECTORY (cyan dashed) ────────────────────────
      // Diverges from the intersection point downward-right
      const eStartX = dStartX;
      const eStartY = dStartY;
      const eCtrlX = ix + 60;
      const eCtrlY = iy + 80;
      const eEndX = W * 0.88;
      const eEndY = H * 0.75;

      ctx.beginPath();
      ctx.moveTo(eStartX, eStartY);
      // Use quadratic bezier to create the diverging arc
      ctx.quadraticCurveTo(eCtrlX, eCtrlY, eEndX, eEndY);
      ctx.strokeStyle = "#00ffcc";
      ctx.lineWidth = 1.8;
      ctx.setLineDash([10, 6]);
      ctx.shadowColor = "rgba(0,255,204,0.5)";
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      // ── LABELS ──────────────────────────────────────────────────────────────
      ctx.font = "bold 10px 'Courier New', monospace";
      ctx.textAlign = "left";

      // "PREDICTED CLOSE APPROACH" box at intersection
      const boxX = ix + 16;
      const boxY = iy - 10;
      const missText = `MISS DISTANCE: ${conjunction.missDistance}m`;
      const boxW = 190;
      const boxH = 36;
      ctx.fillStyle = "rgba(5,5,5,0.88)";
      ctx.strokeStyle = "rgba(100,100,100,0.6)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.rect(boxX, boxY, boxW, boxH);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ef4444";
      ctx.fillText("PREDICTED CLOSE APPROACH", boxX + 8, boxY + 14);
      ctx.fillStyle = "rgba(180,180,180,0.8)";
      ctx.font = "9px 'Courier New', monospace";
      ctx.fillText(missText, boxX + 8, boxY + 27);

      // Connecting line from intersection to box
      ctx.beginPath();
      ctx.moveTo(ix + 5, iy);
      ctx.lineTo(boxX, boxY + boxH / 2);
      ctx.strokeStyle = "rgba(100,100,100,0.4)";
      ctx.lineWidth = 0.7;
      ctx.stroke();

      // "MANEUVER" label on the evasion path
      if (evasionPlan) {
        // Point along the evasion curve ~40% through
        const mX = eStartX + (eCtrlX - eStartX) * 0.5;
        const mY = eStartY + (eCtrlY - eStartY) * 0.35 + 30;
        ctx.font = "bold 9px 'Courier New', monospace";
        ctx.fillStyle = "#00ffcc";
        ctx.textAlign = "left";
        ctx.fillText("MANEUVER", mX, mY - 8);
        ctx.font = "8px 'Courier New', monospace";
        ctx.fillStyle = "rgba(0,255,204,0.7)";
        ctx.fillText(`ΔV ${evasionPlan.deltaV_m_s} m/s | ${evasionPlan.burnDirection}`, mX, mY + 3);

        // Dot marker
        ctx.beginPath();
        ctx.arc(mX - 8, mY - 5, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#00ffcc";
        ctx.fill();
      }

      // "PREDICTED TRAJECTORY" label near end of evasion path
      ctx.font = "bold 10px 'Courier New', monospace";
      ctx.fillStyle = "#00ffcc";
      ctx.textAlign = "left";
      const ptX = W * 0.06;
      const ptY = H * 0.72;
      // dot
      ctx.beginPath();
      ctx.arc(ptX - 10, ptY - 3, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#00ffcc";
      ctx.fill();
      ctx.fillStyle = "#00ffcc";
      ctx.fillText("PREDICTED TRAJECTORY", ptX, ptY);

      t++;
      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [evasionPlan, conjunction.missDistance]);

  // Adapt type for AssistantChat
  const conjunctionForChat: InsightConjunctionEvent = {
    id: conjunction.id,
    primaryObject: conjunction.primaryObject,
    secondaryObject: conjunction.secondaryObject,
    tca: conjunction.tca,
    missDistance: conjunction.missDistance,
    collisionProbability: conjunction.collisionProbability,
    severity: conjunction.severity as any,
    radialMiss: conjunction.radialMiss,
    inTrackMiss: conjunction.inTrackMiss,
    crossTrackMiss: conjunction.crossTrackMiss,
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050505] flex flex-col font-mono text-[10px] text-zinc-100 select-none">

      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <header className="h-12 px-5 bg-zinc-950/95 border-b border-zinc-800/80 flex items-center justify-between shrink-0 text-[10px]">
        <div className="flex items-center gap-4">
          <span className="font-extrabold text-sm tracking-[0.22em] text-zinc-100 font-orbitron flex items-center gap-2">
            <span className="w-2 h-2 bg-[#00ffcc] rounded-full shadow-[0_0_8px_#00ffcc]" />
            TYVORA // APEX
          </span>
          <span className="h-4 w-px bg-zinc-800" />
          <span className="text-zinc-400 uppercase tracking-wider">MISSION CONTROL INTERFACE</span>
          <span className="h-4 w-px bg-zinc-800" />
          <span className="px-2 py-0.5 rounded text-[9px] font-bold tracking-widest bg-[#00ffcc]/10 text-[#00ffcc] border border-[#00ffcc]/30">
            AUTH: ADMIN
          </span>
        </div>

        <div className="flex items-center gap-4 text-zinc-400">
          <span>
            EPOCH: <strong className="text-zinc-200">{new Date().toISOString().replace("T", " ").substring(0, 19)} UTC</strong>
          </span>
          <span>
            LATENCY: <strong className="text-zinc-200">15ms</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 rounded text-[9px] font-bold uppercase tracking-wider transition-all"
            >
              ← GLOBE VIEW
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/40 text-amber-400 rounded text-[9px] font-bold uppercase tracking-wider">
              ⚠ SIMULATE THREAT
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN BODY ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left: 2D Trajectory Canvas */}
        <div className="flex-1 relative overflow-hidden bg-[#050505]">

          {/* Page title watermark */}
          <div className="absolute top-3 left-4 z-10 text-zinc-700 text-[9px] uppercase tracking-widest">
            Trajectory Divergence Analysis — Tyvora Apex
          </div>

          <canvas
            ref={canvasRef}
            className="w-full h-full"
            width={900}
            height={620}
            style={{ display: "block" }}
          />

          {/* ── BOTTOM HUD ─────────────────────────────────────────────────── */}
          <div className="absolute bottom-0 left-0 right-0 bg-zinc-950/85 border-t border-zinc-800/80 backdrop-blur-lg px-5 py-3 flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-4">
              {/* Alert tag */}
              <div className="flex flex-col">
                <span className="text-zinc-400 font-bold tracking-wider">TARGET VECTOR // {conjunction.id}</span>
                {conjunction.severity === "CRITICAL" && (
                  <span className="text-red-500 font-bold text-[9px] tracking-wider animate-pulse uppercase">⚠ COLLISION ALERT</span>
                )}
              </div>
              <div className="h-8 w-px bg-zinc-800" />
              <div>
                <span className="text-zinc-500 text-[9px] block">Primary:</span>
                <span className="text-zinc-100 font-bold">{conjunction.primaryObject}</span>
              </div>
              <span className="text-zinc-600 font-bold">VS</span>
              <div>
                <span className="text-zinc-500 text-[9px] block">Secondary:</span>
                <span className="text-red-400 font-bold">{conjunction.secondaryObject}</span>
              </div>
              <div className="h-8 w-px bg-zinc-800" />
              <div>
                <span className="text-zinc-500 text-[9px] block">Calculated Miss:</span>
                <span className="text-[#00ffcc] font-bold text-sm">{conjunction.missDistance}m</span>
              </div>
              <div>
                <span className="text-zinc-500 text-[9px] block">Collision Prob:</span>
                <span className="text-red-400 font-bold text-sm">{(conjunction.collisionProbability * 100).toFixed(4)}%</span>
              </div>
            </div>

            <button
              className="px-4 py-2 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-bold uppercase tracking-wider text-[9px] rounded transition-all"
            >
              EXPAND DIAGNOSTICS ▲
            </button>
          </div>

          {/* ── FOOTER TICKER ──────────────────────────────────────────────── */}
          <div className="absolute bottom-0 left-0 right-0 h-6" style={{ bottom: "58px" }}>
            <div className="w-full h-px bg-zinc-900" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-5 flex items-center justify-between px-5 text-[8px] text-zinc-600 uppercase" style={{ bottom: "0px", zIndex: 5 }}>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-[#00ffcc] animate-pulse" /> SGP4 KERNEL: ACTIVE
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-[#00ffcc]" /> API: NOMINAL
              </span>
              <span>FPS: <strong className="text-zinc-400">60.0</strong></span>
              <span>LATENCY: <strong className="text-[#00ffcc]">15MS</strong></span>
            </div>
            <span>TYVORA AEROSPACE DEFENSE © 2026 // AIR-GAPPED COMMAND PROTOCOL</span>
          </div>
        </div>

        {/* Right: Advisory Panel */}
        <div className="w-[340px] shrink-0 bg-zinc-950/98 border-l border-zinc-800/80 flex flex-col overflow-hidden">
          {/* Panel header */}
          <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-[#00ffcc]">⊕</span>
              <span className="font-bold text-zinc-200 tracking-widest uppercase font-orbitron text-[11px]">ADVISORY UNIT</span>
              <span className="text-zinc-600 text-[8px]">AI RAG ENGINE</span>
            </div>
            <span className="px-2 py-0.5 text-[8px] font-bold tracking-widest bg-[#00ffcc]/10 text-[#00ffcc] border border-[#00ffcc]/30 rounded">
              HITL ACTIVE
            </span>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-zinc-800 shrink-0">
            {(["TELEMETRY", "LOGS"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-[9px] font-bold uppercase tracking-widest transition-all ${
                  tab === t
                    ? "text-[#00ffcc] border-b-2 border-[#00ffcc]"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden p-3">
            {tab === "TELEMETRY" ? (
              <AssistantChat
                key={conjunction.id}
                selectedConjunction={conjunctionForChat}
                onManeuverExecute={onManeuverExecute}
              />
            ) : (
              <div className="text-zinc-500 text-[9px] uppercase tracking-widest mt-4 text-center">
                SYSTEM LOGS STREAM NOMINAL
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
