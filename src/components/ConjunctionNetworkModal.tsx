"use client";

import React, { useMemo } from "react";
import { ReactFlow, Background, Controls, Node, Edge, BackgroundVariant } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";
import { X, Network } from "lucide-react";
import { useOrbitalStore } from "../store/useOrbitalStore";

interface ConjunctionNetworkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ConjunctionNetworkModal({ isOpen, onClose }: ConjunctionNetworkModalProps) {
  const { conjunctions } = useOrbitalStore();

  const { nodes, edges } = useMemo(() => {
    if (!conjunctions || conjunctions.length === 0) {
      return { nodes: [], edges: [] };
    }

    // Extract all unique objects
    const uniqueObjects = new Set<string>();
    conjunctions.forEach((c) => {
      if (c.primaryObject) uniqueObjects.add(c.primaryObject);
      if (c.secondaryObject) uniqueObjects.add(c.secondaryObject);
    });

    const objectList = Array.from(uniqueObjects);

    // Dynamic circle layout parameters
    const radius = Math.min(220, 100 + objectList.length * 15);
    const centerX = 380;
    const centerY = 240;

    const nodes: Node[] = objectList.map((name, index) => {
      const angle = (index / objectList.length) * 2 * Math.PI;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      const isPrimary = conjunctions.some((c) => c.primaryObject === name);

      return {
        id: name,
        position: { x, y },
        data: { label: `${isPrimary ? "🛰️" : "⚠️"} ${name}` },
        style: {
          background: isPrimary ? "#09090b" : "#180202",
          color: isPrimary ? "#00ffcc" : "#ef4444",
          border: isPrimary ? "1px solid #00ffcc" : "1px dashed #ef4444",
          borderRadius: "8px",
          padding: "10px",
          fontFamily: "monospace",
          fontSize: "11px",
          fontWeight: "bold",
          boxShadow: isPrimary ? "0 0 10px rgba(0,255,204,0.2)" : "none",
          width: 160,
          textAlign: "center" as const,
        },
      };
    });

    const edges: Edge[] = conjunctions.map((c) => {
      const isCritical = c.severity === "CRITICAL";
      const isHigh = c.severity === "HIGH";

      return {
        id: `edge-${c.id}`,
        source: c.primaryObject,
        target: c.secondaryObject,
        animated: isCritical || isHigh,
        label: `${c.missDistance}m (${c.severity})`,
        style: {
          stroke: isCritical ? "#ef4444" : isHigh ? "#f59e0b" : "#3b82f6",
          strokeWidth: isCritical ? 2.5 : isHigh ? 2 : 1.2,
        },
        labelStyle: {
          fill: isCritical ? "#ef4444" : isHigh ? "#f59e0b" : "#3b82f6",
          fontWeight: 700,
          fontFamily: "monospace",
          fontSize: 10,
        },
        labelBgStyle: {
          fill: "#09090b",
          fillOpacity: 0.8,
        },
      };
    });

    return { nodes, edges };
  }, [conjunctions]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          className="bg-[#09090b] border border-zinc-800 rounded-xl w-full max-w-4xl h-[600px] flex flex-col shadow-2xl overflow-hidden font-mono"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950">
            <div className="flex items-center gap-3">
              <Network className="text-[#00ffcc]" size={20} />
              <div>
                <h3 className="text-sm font-bold text-zinc-100 tracking-wider uppercase font-orbitron">
                  ORBITAL CONJUNCTION DEPENDENCY TREE (REACT-FLOW)
                </h3>
                <p className="text-[10px] text-zinc-500 uppercase">Interactive Close-Approach Hazard Topology</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* React Flow Graph Canvas */}
          <div className="flex-1 w-full h-full bg-[#050505] relative animate-fade-in">
            {nodes.length > 0 ? (
              <ReactFlow nodes={nodes} edges={edges} fitView colorMode="dark">
                <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#27272a" />
                <Controls className="bg-zinc-900 border border-zinc-800 fill-zinc-300" />
              </ReactFlow>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-500 text-xs">
                NO ACTIVE CONJUNCTION TRAJECTORIES CORRELATED
              </div>
            )}
          </div>

          {/* Footer Status */}
          <div className="px-6 py-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-400">
            <span>DRAG NODES TO SIMULATE EVASIVE TRAJECTORY CORRECTIONS</span>
            <span className="text-[#00ffcc] font-bold">XYFLOW ENGINE ACTIVE</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
