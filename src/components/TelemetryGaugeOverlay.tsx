"use client";

import React, { useState } from "react";
import ReactECharts from "echarts-for-react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Minimize2, Maximize2 } from "lucide-react";

interface TelemetryGaugeOverlayProps {
  velocity: number;
  altitude: number;
  latency: number;
}

export default function TelemetryGaugeOverlay({
  velocity = 7.66,
  altitude = 420.5,
  latency = 84,
}: TelemetryGaugeOverlayProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  const gaugeOption = {
    series: [
      {
        type: "gauge",
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max: 12,
        splitNumber: 6,
        radius: "95%",
        axisLine: {
          lineStyle: {
            width: 4,
            color: [
              [0.3, "#3b82f6"],
              [0.7, "#00ffcc"],
              [1, "#ef4444"],
            ],
          },
        },
        pointer: {
          icon: "path://M12.8,0.7l12,40.1H0.7L12.8,0.7z",
          length: "60%",
          width: 4,
          offsetCenter: [0, "-10%"],
          itemStyle: {
            color: "#00ffcc",
          },
        },
        axisTick: {
          length: 5,
          lineStyle: {
            color: "auto",
            width: 1,
          },
        },
        splitLine: {
          length: 8,
          lineStyle: {
            color: "auto",
            width: 2,
          },
        },
        axisLabel: {
          color: "#a1a1aa",
          fontSize: 9,
          distance: -20,
          fontFamily: "monospace",
        },
        title: {
          offsetCenter: [0, "65%"],
          fontSize: 9,
          color: "#71717a",
          fontFamily: "monospace",
        },
        detail: {
          fontSize: 13,
          offsetCenter: [0, "35%"],
          valueAnimation: true,
          formatter: function (value: number) {
            return value.toFixed(2) + " km/s";
          },
          color: "#00ffcc",
          fontFamily: "monospace",
          fontWeight: "bold",
        },
        data: [
          {
            value: velocity,
            name: "VELOCITY",
          },
        ],
      },
    ],
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-zinc-950/85 border border-zinc-800/80 backdrop-blur-xl rounded-xl shadow-2xl font-mono select-none overflow-hidden transition-all duration-300"
    >
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/60 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#00ffcc] animate-pulse" />
          <span className="text-[10px] font-bold text-zinc-200 tracking-wider uppercase font-orbitron flex items-center gap-1.5">
            <Activity size={12} className="text-[#00ffcc]" />
            TELEMETRY MATRIX
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-bold text-[#00ffcc] bg-[#00ffcc]/10 border border-[#00ffcc]/30 px-1.5 py-0.5 rounded tracking-widest">
            LIVE
          </span>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-zinc-400 hover:text-white transition-colors p-0.5 rounded hover:bg-zinc-800"
            title={isMinimized ? "Expand Telemetry" : "Minimize Telemetry"}
          >
            {isMinimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {!isMinimized ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="p-3"
          >
            <div className="h-36 w-60 -my-2 mx-auto">
              <ReactECharts option={gaugeOption} style={{ height: "100%", width: "100%" }} theme="dark" />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 mt-1 border-t border-zinc-800/60 text-[10px]">
              <div className="bg-zinc-900/40 px-2 py-1.5 rounded border border-zinc-800/40">
                <span className="text-[8px] text-zinc-400 block uppercase font-sans">ALTITUDE DECAY</span>
                <span className="text-zinc-100 font-bold font-mono text-xs">{altitude.toFixed(1)} km</span>
              </div>
              <div className="bg-zinc-900/40 px-2 py-1.5 rounded border border-zinc-800/40 text-right">
                <span className="text-[8px] text-zinc-400 block uppercase font-sans">SIGNAL LATENCY</span>
                <span className="text-[#00ffcc] font-bold font-mono text-xs">{latency} ms</span>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-3 py-1.5 flex items-center justify-between gap-4 text-[10px]"
          >
            <span className="text-zinc-400">Velocity: <strong className="text-[#00ffcc]">{velocity.toFixed(2)} km/s</strong></span>
            <span className="text-zinc-400">Alt: <strong className="text-zinc-200">{altitude.toFixed(0)} km</strong></span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
