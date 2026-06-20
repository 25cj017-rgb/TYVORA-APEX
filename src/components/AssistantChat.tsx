import React, { useState, useEffect, useRef } from "react";
import { ConjunctionEvent } from "@/services/insightAssistant";
import { synthesizeManeuverStrategy } from "@/services/riskEngine";
import { ManeuverPlan } from "@/types";

interface AssistantChatProps {
  selectedConjunction: ConjunctionEvent;
  onManeuverExecute?: (plan: ManeuverPlan) => void;
}

interface Message {
  id: string;
  sender: "system" | "user" | "assistant";
  text: string;
  timestamp: string;
  isManeuverProposal?: boolean;
  maneuverData?: {
    deltaV: number;
    direction: string;
    correction: number;
  };
  maneuverStatus?: "PENDING" | "EXECUTED";
}

export default function AssistantChat({ selectedConjunction, onManeuverExecute }: AssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setMessages([
      {
        id: "sys-init",
        sender: "system",
        text: `INSIGHT SYSTEM INITIALIZED // LOCK ACQUIRED ON TARGET VECTOR: ${selectedConjunction.id}`,
        timestamp,
      },
      {
        id: "asst-welcome",
        sender: "assistant",
        text: `Operator, I have pulled live ephemeris logs for ${selectedConjunction.primaryObject} (vs ${selectedConjunction.secondaryObject}). Conjunction severity is resolved at ${selectedConjunction.severity} level with a ${selectedConjunction.missDistance}m clearance. Ask me to break down risk vectors or formulate burn strategies.`,
        timestamp,
      }
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConjunction.id]);

  // Keep chat scrolled to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const nextIdOffset = messages.length;
    const userMsg: Message = {
      id: `msg-user-${nextIdOffset}`,
      sender: "user",
      text,
      timestamp,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Intercept the burn plan request to inject our dynamic maneuver calculation
      if (text.toLowerCase().includes("burn plan") || text.toLowerCase().includes("evasion")) {
        // Calculate the maneuver strategy using the riskEngine physics module
        // We use a 500m target correction and an estimated 1 hour (3600s) to TCA
        const strategy = await synthesizeManeuverStrategy(500, 3600);
        
        setIsLoading(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-asst-${nextIdOffset + 1}`,
            sender: "assistant",
            text: `I have synthesized an optimal evasion burn vector for ${selectedConjunction.primaryObject}. A ${strategy.burnDirection} burn of ${strategy.deltaV_m_s} m/s is required to achieve a safe ${strategy.projectedMissDistanceKm}km clearance. Awaiting Human-in-the-Loop authorization.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            isManeuverProposal: true,
            maneuverData: {
              deltaV: strategy.deltaV_m_s,
              direction: strategy.burnDirection,
              correction: strategy.projectedMissDistanceKm * 1000,
            },
            maneuverStatus: "PENDING",
          },
        ]);
        return;
      }

      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventData: selectedConjunction,
          query: text,
        }),
      });

      const data = await response.json();
      const assistantText = data.answer || "⚠️ SYSTEM ERROR: FAILED TO PARSE RESPONSE STREAM.";
      
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-asst-${nextIdOffset + 1}`,
          sender: "assistant",
          text: assistantText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        },
      ]);
    } catch (err) {
      console.warn("Telemetry RAG assistant error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${nextIdOffset + 1}`,
          sender: "system",
          text: "⚠️ DECRYPTION FAULT: SECURE API GATEWAY CONNECTION UNRESPONSIVE.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteManeuver = (msgId: string) => {
    const targetMsg = messages.find((m) => m.id === msgId);
    if (targetMsg && onManeuverExecute && targetMsg.maneuverData) {
      onManeuverExecute({
        deltaV_m_s: targetMsg.maneuverData.deltaV,
        burnDirection: targetMsg.maneuverData.direction as any,
        projectedMissDistanceKm: targetMsg.maneuverData.correction / 1000,
      });
    }

    setMessages((prev) => {
      const updatedMessages = prev.map((msg) =>
        msg.id === msgId ? { ...msg, maneuverStatus: "EXECUTED" as const } : msg
      );
      
      return [
        ...updatedMessages,
        {
          id: `msg-sys-exec-${Date.now()}`,
          sender: "system",
          text: `MANEUVER AUTHORIZED. TRANSMITTING BURN SEQUENCE TO ${selectedConjunction.primaryObject}.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        }
      ];
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSendMessage(inputValue);
    }
  };

  const suggestions = [
    `Why is this event marked ${selectedConjunction.severity.toLowerCase()}?`,
    "What are the miss-axis components?",
    "Formulate an optimal evasion vector burn plan"
  ];

  return (
    <div className="flex flex-col h-full font-mono text-[10px] bg-[#050505]">
      
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-2 text-zinc-400">
        <div className="flex items-center gap-1.5 font-bold tracking-widest font-sans text-zinc-300">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00ffcc] animate-pulse" />
          ADVISORY UNIT (RAG)
        </div>
        <div className="text-[8px] text-[#00ffcc] tracking-wider">
          HITL SAFETY ACTIVE
        </div>
      </div>

      {/* CRITICAL ALERT OVERRIDE */}
      {selectedConjunction.collisionProbability > 0.0001 && (
        <div className="mb-2 p-2 border border-[#ef4444] bg-[#ef4444]/10 animate-pulse">
          <div className="text-[#ef4444] font-bold text-[9px] tracking-widest uppercase mb-1">CRITICAL: COLLISION PROBABILITY EXCEEDS 0.01%</div>
          <button 
            onClick={() => handleSendMessage("Formulate an optimal evasion vector burn plan")}
            className="w-full bg-[#ef4444] text-[#050505] font-bold text-[9px] py-1.5 uppercase tracking-widest hover:bg-white transition-colors"
          >
            GENERATE BURN STRATEGY
          </button>
        </div>
      )}

      {/* Message scroll container */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-4 bg-[#050505]"
      >
        {messages.map((msg) => {
          if (msg.sender === "system") {
            return (
              <div key={msg.id} className="text-zinc-500 text-[8px] tracking-wider pl-2 py-0.5 uppercase">
                [{msg.timestamp}] {msg.text}
              </div>
            );
          }
          if (msg.sender === "user") {
            return (
              <div key={msg.id} className="flex flex-col items-end">
                <div className="text-zinc-500 text-[8px] mb-0.5">OPERATOR [{msg.timestamp}]</div>
                <div className="text-zinc-200 pl-2 border-l border-zinc-700 max-w-[85%] break-words">
                  {msg.text}
                </div>
              </div>
            );
          }
          return (
            <div key={msg.id} className="flex flex-col items-start w-full">
              <div className="text-zinc-400 font-bold font-sans text-[8px] mb-0.5 uppercase tracking-wider">Advisory Unit [{msg.timestamp}]</div>
              <div className="text-zinc-300 pl-2 border-l border-zinc-800 max-w-[95%] break-words leading-relaxed">
                {msg.text}
                {msg.isManeuverProposal && msg.maneuverData && (
                  <div className="mt-4 pt-4 border-t border-zinc-900">
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="p-1.5 border-l border-zinc-800">
                        <div className="text-[8px] text-zinc-500 uppercase">Delta-V</div>
                        <div className="text-zinc-200 font-bold">{msg.maneuverData.deltaV} m/s</div>
                      </div>
                      <div className="p-1.5 border-l border-zinc-800">
                        <div className="text-[8px] text-zinc-500 uppercase">Vector</div>
                        <div className="text-zinc-200 font-bold">{msg.maneuverData.direction}</div>
                      </div>
                    </div>
                    {msg.maneuverStatus === "PENDING" ? (
                      <button 
                        onClick={() => handleExecuteManeuver(msg.id)}
                        className="w-full py-1.5 text-[#ef4444] hover:text-white hover:bg-[#ef4444] font-bold text-[9px] uppercase tracking-widest border border-[#ef4444] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        [ VERIFY & EXECUTE BURN ]
                      </button>
                    ) : (
                      <div className="w-full py-1.5 text-zinc-500 border border-zinc-800 font-bold text-[9px] text-center uppercase tracking-widest">
                        BURN EXECUTED SECURELY
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex flex-col items-start animate-pulse">
            <div className="text-zinc-500 font-bold font-sans text-[8px] mb-0.5 tracking-wider uppercase">Advisory Unit Computing...</div>
            <div className="text-zinc-500 pl-2 border-l border-zinc-800">
              <span className="inline-block w-1 h-1 bg-zinc-400 rounded-full animate-bounce mr-1" />
              <span className="inline-block w-1 h-1 bg-zinc-400 rounded-full animate-bounce mr-1 [animation-delay:0.2s]" />
              <span className="inline-block w-1 h-1 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      {/* Suggested fast query chips */}
      <div className="pt-2 mt-2 border-t border-zinc-900 bg-[#050505] flex flex-wrap gap-2">
        {suggestions.map((suggestion, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(suggestion)}
            disabled={isLoading}
            className="text-[8px] text-zinc-500 hover:text-zinc-200 transition-colors uppercase disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            &gt; {suggestion}
          </button>
        ))}
      </div>

      {/* Input panel */}
      <div className="pt-2 mt-2 bg-[#050505] flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}
          disabled={isLoading}
          placeholder="QUERY ADVISORY UNIT..."
          className="flex-1 bg-[#050505] border-b border-zinc-800 px-2 py-1 text-[10px] text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-zinc-500 transition-colors font-mono disabled:opacity-50"
        />
        <button
          onClick={() => handleSendMessage(inputValue)}
          disabled={isLoading || !inputValue.trim()}
          className="px-2 font-bold uppercase transition-colors text-zinc-400 hover:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          SEND
        </button>
      </div>

    </div>
  );
}
