"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export default function CustomCursor() {
  const [isHovering, setIsHovering] = useState(false);
  
  // High-performance cursor tracking (bypasses React state entirely)
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  
  // Apply a very slight spring physics for an incredibly smooth "hardware" feel
  const springConfig = { damping: 30, stiffness: 800, mass: 0.1 };
  const smoothX = useSpring(cursorX, springConfig);
  const smoothY = useSpring(cursorY, springConfig);

  useEffect(() => {
    const updateMousePosition = (e: MouseEvent) => {
      cursorX.set(e.clientX - 16); // Center offset for a 32x32 container
      cursorY.set(e.clientY - 16);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName.toLowerCase() === "button" ||
        target.tagName.toLowerCase() === "a" ||
        target.closest("button") ||
        target.closest("a") ||
        target.tagName.toLowerCase() === "input" ||
        target.tagName.toLowerCase() === "select" ||
        target.closest("tr")
      ) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    window.addEventListener("mousemove", updateMousePosition);
    window.addEventListener("mouseover", handleMouseOver);

    return () => {
      window.removeEventListener("mousemove", updateMousePosition);
      window.removeEventListener("mouseover", handleMouseOver);
    };
  }, [cursorX, cursorY]);

  return (
    <motion.div
      className="fixed top-0 left-0 pointer-events-none z-[9999] mix-blend-screen flex items-center justify-center will-change-transform"
      style={{
        x: smoothX,
        y: smoothY,
        width: 32,
        height: 32,
      }}
    >
      {/* Center Target Dot */}
      <motion.div 
        className="absolute w-1 h-1 bg-cyan-400 rounded-full"
        animate={{ scale: isHovering ? 0 : 1 }}
      />
      
      {/* Tactical Crosshair Horizontal */}
      <motion.div 
        className="absolute w-full h-[1px] bg-cyan-500/60"
        animate={{ 
          scaleX: isHovering ? 0.3 : 1, 
          opacity: isHovering ? 0 : 1 
        }}
        transition={{ duration: 0.2 }}
      />
      
      {/* Tactical Crosshair Vertical */}
      <motion.div 
        className="absolute h-full w-[1px] bg-cyan-500/60"
        animate={{ 
          scaleY: isHovering ? 0.3 : 1,
          opacity: isHovering ? 0 : 1
        }}
        transition={{ duration: 0.2 }}
      />

      {/* Target Lock Square -> Transforms to Circle on Hover */}
      <motion.div
        className="absolute inset-0 border border-cyan-500"
        animate={{ 
          rotate: isHovering ? 45 : 0,
          scale: isHovering ? 1.4 : 0.8,
          borderColor: isHovering ? "rgba(34, 211, 238, 1)" : "rgba(34, 211, 238, 0.3)",
          borderRadius: isHovering ? "50%" : "0%"
        }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      />
      
      {/* Active Selection Spin Indicator */}
      <motion.div
        className="absolute w-10 h-10 border border-dashed border-cyan-400/80 rounded-full"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ 
          opacity: isHovering ? 1 : 0, 
          scale: isHovering ? 1 : 0.5,
          rotate: isHovering ? 180 : 0
        }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      />
    </motion.div>
  );
}
