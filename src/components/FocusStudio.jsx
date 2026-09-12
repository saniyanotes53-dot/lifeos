import React, { useState, useEffect, useRef } from "react";
import {
  Play, Pause, RotateCcw, Volume2, VolumeX, Maximize2, Minimize2,
  CheckCircle2, Sparkles, Flame, Headphones, Moon, Wind, Coffee, CloudRain
} from "lucide-react";
import { Card, Screen, PrimaryButton, GhostButton, ProgressRing } from "./primitives";
import { useToast } from "./Toast";

export default function FocusStudio({ t, tasks = [], onCompleteTask, initialTaskId }) {
  const toast = useToast();
  // Timer states
  const [mode, setMode] = useState("focus"); // "focus" (25m), "short" (5m), "long" (15m)
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(initialTaskId || "");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Focus Stats (stored in localStorage)
  const [sessionsCompleted, setSessionsCompleted] = useState(() => {
    return Number(localStorage.getItem("lifeos_focus_sessions") || 0);
  });
  const [totalFocusMin, setTotalFocusMin] = useState(() => {
    return Number(localStorage.getItem("lifeos_focus_minutes") || 0);
  });

  // Soundscape state
  const [soundscape, setSoundscape] = useState("none"); // "none", "alpha", "rain", "drone", "brown"
  const [soundVolume, setSoundVolume] = useState(0.5);
  const audioCtxRef = useRef(null);
  const soundNodesRef = useRef([]);

  const durations = {
    focus: 25 * 60,
    short: 5 * 60,
    long: 15 * 60
  };

  const changeMode = (newMode) => {
    setMode(newMode);
    setTimeLeft(durations[newMode]);
    setIsRunning(false);
  };

  // Timer Tick
  useEffect(() => {
    let timer = null;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (isRunning && timeLeft === 0) {
      setIsRunning(false);
      handleSessionComplete();
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft]);

  // Audio Engine: Stop currently running soundscape
  const stopAudio = () => {
    soundNodesRef.current.forEach(node => {
      try {
        if (node.stop) node.stop();
        node.disconnect();
      } catch (e) {}
    });
    soundNodesRef.current = [];
  };

  // Audio Engine: Start procedural Web Audio ambient sound
  const startAudio = (type, volume) => {
    stopAudio();
    if (type === "none") return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(volume * 0.4, ctx.currentTime);
      masterGain.connect(ctx.destination);
      soundNodesRef.current.push(masterGain);

      if (type === "alpha") {
        // Binaural Alpha Beats (200Hz base and 210Hz beat = 10Hz Alpha Focus frequency)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc1.frequency.setValueAtTime(200, ctx.currentTime);
        osc2.frequency.setValueAtTime(210, ctx.currentTime);
        osc1.type = "sine";
        osc2.type = "sine";

        const panner1 = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        const panner2 = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        if (panner1 && panner2) {
          panner1.pan.setValueAtTime(-0.8, ctx.currentTime);
          panner2.pan.setValueAtTime(0.8, ctx.currentTime);
          osc1.connect(panner1);
          panner1.connect(masterGain);
          osc2.connect(panner2);
          panner2.connect(masterGain);
        } else {
          osc1.connect(masterGain);
          osc2.connect(masterGain);
        }

        osc1.start();
        osc2.start();
        soundNodesRef.current.push(osc1, osc2);
      } else if (type === "drone") {
        // Cosmic Low Drone: Deep triad chords with gentle lowpass filter
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();

        osc1.frequency.setValueAtTime(110, ctx.currentTime); // A2
        osc2.frequency.setValueAtTime(164.81, ctx.currentTime); // E3
        osc1.type = "triangle";
        osc2.type = "sine";

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(320, ctx.currentTime);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(masterGain);

        osc1.start();
        osc2.start();
        soundNodesRef.current.push(osc1, osc2, filter);
      } else if (type === "rain" || type === "brown") {
        // Generative Pink / Brown Noise Buffer
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0.0;

        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          if (type === "brown") {
            data[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = data[i];
            data[i] *= 3.5;
          } else {
            // Rain: filtered noise with slight modulations
            data[i] = (lastOut + (0.06 * white)) / 1.06;
            lastOut = data[i];
            data[i] *= 2.5;
          }
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = type === "rain" ? "bandpass" : "lowpass";
        filter.frequency.setValueAtTime(type === "rain" ? 800 : 400, ctx.currentTime);

        noise.connect(filter);
        filter.connect(masterGain);
        noise.start();
        soundNodesRef.current.push(noise, filter);
      }
    } catch (err) {
      console.warn("Audio generation not allowed without user gesture:", err);
    }
  };

  // Play a soft bell chime upon completion
  const playChime = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3); // A5
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.8);
    } catch (e) {}
  };

  // Handle Session Completion
  const handleSessionComplete = () => {
    playChime();
    if (mode === "focus") {
      const newSessions = sessionsCompleted + 1;
      const newMins = totalFocusMin + 25;
      setSessionsCompleted(newSessions);
      setTotalFocusMin(newMins);
      localStorage.setItem("lifeos_focus_sessions", String(newSessions));
      localStorage.setItem("lifeos_focus_minutes", String(newMins));

      // Award XP!
      const currentXP = Number(localStorage.getItem("lifeos_user_xp") || 0) + 50;
      localStorage.setItem("lifeos_user_xp", String(currentXP));

      toast("🏆 Deep Work Complete! +50 XP earned. Take a well-deserved break!", "sparkle", 4500);

      // Auto-complete selected task if chosen
      if (selectedTaskId && onCompleteTask) {
        onCompleteTask(selectedTaskId);
      }
    } else {
      toast("Break over! Ready for the next focus sprint?", "info", 3500);
    }
  };

  // Soundscape effect change
  const handleSoundscapeChange = (type) => {
    setSoundscape(type);
    if (type === "none") {
      stopAudio();
    } else {
      startAudio(type, soundVolume);
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => stopAudio();
  }, []);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const totalSecs = durations[mode];
  const pct = Math.round(((totalSecs - timeLeft) / totalSecs) * 100);

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  return (
    <Screen t={t} title="Focus Studio (Pro)">
      {/* Zen Fullscreen Overlay */}
      {isFullscreen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: t.bg,
            zIndex: 99999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24
          }}
        >
          <button
            onClick={() => setIsFullscreen(false)}
            className="press"
            style={{
              position: "absolute",
              top: 24,
              right: 24,
              background: t.surface2,
              border: `1px solid ${t.line}`,
              color: t.text,
              borderRadius: 12,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer"
            }}
          >
            <Minimize2 size={16} /> Exit Zen Mode
          </button>

          <div style={{ textAlign: "center", maxWidth: 460, width: "100%" }}>
            <div style={{ fontSize: 14, color: t.a1, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
              {mode === "focus" ? "Deep Focus Session" : "Rest & Recharge"}
            </div>

            {selectedTask && (
              <div style={{ fontSize: 16, color: t.text, fontWeight: 600, marginBottom: 20 }}>
                Focusing on: <span style={{ color: t.a1 }}>"{selectedTask.title}"</span>
              </div>
            )}

            <div style={{
              fontFamily: "'SF Pro Display', -apple-system, sans-serif",
              fontSize: "clamp(64px, 14vw, 110px)",
              fontWeight: 800,
              color: t.text,
              letterSpacing: -2,
              lineHeight: 1,
              margin: "20px 0"
            }}>
              {formatTime(timeLeft)}
            </div>

            {/* Pulsing breathing indicator */}
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, margin: "24px 0" }}>
              <div className="pulse" style={{ width: 14, height: 14, borderRadius: 7, background: isRunning ? t.good : t.muted }} />
              <span style={{ fontSize: 13, color: t.muted }}>
                {isRunning ? "Distraction shields active · Flow state" : "Timer paused"}
              </span>
            </div>

            <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
              <PrimaryButton
                t={t}
                onClick={() => setIsRunning(!isRunning)}
                style={{ width: "auto", padding: "14px 36px", fontSize: 16 }}
              >
                {isRunning ? <><Pause size={18} /> Pause</> : <><Play size={18} /> Start Focus</>}
              </PrimaryButton>
              <GhostButton
                t={t}
                onClick={() => { setIsRunning(false); setTimeLeft(durations[mode]); }}
                style={{ width: "auto", padding: "14px 20px" }}
              >
                <RotateCcw size={18} />
              </GhostButton>
            </div>
          </div>
        </div>
      )}

      {/* Main Screen Layout */}
      <div style={{ maxWidth: 840, margin: "0 auto" }}>
        {/* Banner / Value Prop */}
        <div style={{
          background: `linear-gradient(135deg, ${t.a1}18, ${t.a3}10)`,
          border: `1px solid ${t.a1}44`,
          borderRadius: 18,
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 18
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: `linear-gradient(135deg, ${t.a1}, ${t.a3})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: t.onAccent
            }}>
              <Headphones size={22} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 6 }}>
                Pro Deep Work Studio
                <span style={{ fontSize: 10.5, background: t.a1, color: t.onAccent, padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>
                  INCLUDED FREE
                </span>
              </div>
              <div style={{ fontSize: 12, color: t.muted }}>
                A focus timer with optional background sounds.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: t.text }}>
                {totalFocusMin}m
              </div>
              <div style={{ fontSize: 10.5, color: t.muted }}>Focus Logged</div>
            </div>
            <div style={{ width: 1, height: 28, background: t.line }} />
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: t.a1, display: "flex", alignItems: "center", gap: 3 }}>
                <Flame size={16} color="#f97316" /> {sessionsCompleted}
              </div>
              <div style={{ fontSize: 10.5, color: t.muted }}>Sessions</div>
            </div>
          </div>
        </div>

        {/* Timer Box */}
        <Card t={t} style={{ textAlign: "center", padding: "32px 24px", position: "relative", overflow: "hidden" }}>
          {/* Zen mode button */}
          <button
            onClick={() => setIsFullscreen(true)}
            className="press"
            style={{
              position: "absolute", top: 16, right: 16,
              background: t.surface2, border: `1px solid ${t.line}`,
              color: t.muted, borderRadius: 10, padding: 8, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4, fontSize: 12
            }}
            title="Enter Fullscreen Zen Mode"
          >
            <Maximize2 size={15} /> Zen Mode
          </button>

          {/* Mode Selector Tabs */}
          <div style={{ display: "inline-flex", background: t.surface2, padding: 4, borderRadius: 14, border: `1px solid ${t.line}`, marginBottom: 28 }}>
            {[
              ["focus", "Deep Work (25m)"],
              ["short", "Short Rest (5m)"],
              ["long", "Long Rest (15m)"]
            ].map(([k, lbl]) => (
              <button
                key={k}
                onClick={() => changeMode(k)}
                style={{
                  background: mode === k ? `linear-gradient(135deg, ${t.a1}, ${t.a3})` : "transparent",
                  color: mode === k ? t.onAccent : t.muted,
                  border: "none",
                  borderRadius: 10,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: mode === k ? 700 : 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
              >
                {lbl}
              </button>
            ))}
          </div>

          {/* Huge Progress Ring & Clock */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
            <ProgressRing t={t} pct={pct} size={220} stroke={10}>
              <div style={{ textAlign: "center" }}>
                <div style={{
                  fontSize: 52,
                  fontWeight: 800,
                  color: t.text,
                  letterSpacing: -1,
                  fontVariantNumeric: "tabular-nums"
                }}>
                  {formatTime(timeLeft)}
                </div>
                <div style={{ fontSize: 12, color: isRunning ? t.good : t.muted, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: isRunning ? t.good : t.muted }} />
                  {isRunning ? "FOCUSING" : "PAUSED"}
                </div>
              </div>
            </ProgressRing>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", maxWidth: 360, margin: "0 auto 24px" }}>
            <PrimaryButton
              t={t}
              onClick={() => setIsRunning(!isRunning)}
              style={{ flex: 1, padding: "13px 0", fontSize: 15 }}
            >
              {isRunning ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Pause size={17} /> Pause
                </span>
              ) : (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Play size={17} /> Start Focus Sprint
                </span>
              )}
            </PrimaryButton>

            <GhostButton
              t={t}
              onClick={() => { setIsRunning(false); setTimeLeft(durations[mode]); }}
              style={{ width: 48, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
              title="Reset Timer"
            >
              <RotateCcw size={16} />
            </GhostButton>
          </div>

          {/* Link Task Selector */}
          <div style={{
            maxWidth: 440,
            margin: "0 auto",
            background: t.surface2,
            borderRadius: 14,
            padding: "12px 14px",
            border: `1px solid ${t.line}`,
            textAlign: "left"
          }}>
            <div style={{ fontSize: 11.5, color: t.muted, marginBottom: 6, fontWeight: 600 }}>
              🎯 Target Task for this Session:
            </div>
            <select aria-label="Linked task"
              value={selectedTaskId}
              onChange={e => setSelectedTaskId(e.target.value)}
              style={{
                width: "100%",
                background: t.surface,
                border: `1px solid ${t.line}`,
                borderRadius: 10,
                padding: "8px 12px",
                color: t.text,
                fontSize: 13,
                outline: "none"
              }}
            >
              <option value="">-- Focus without specific task --</option>
              {tasks.filter(x => !x.done).map(x => (
                <option key={x.id} value={x.id}>
                  [{x.priority || "Normal"}] {x.title}
                </option>
              ))}
            </select>
          </div>
        </Card>

        {/* Ambient Soundscapes Section */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={16} color={t.a1} /> Generative Acoustic Soundscapes
            <span style={{ fontSize: 11, color: t.muted, fontWeight: 400 }}>
              (Sounds generated on this device)
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 12 }}>
            {[
              { id: "none", name: "Silence", desc: "No audio", icon: VolumeX },
              { id: "alpha", name: "10Hz Alpha Beats", desc: "Binaural flow state", icon: Headphones },
              { id: "rain", name: "Rainfall Masking", desc: "Filtered droplets", icon: CloudRain },
              { id: "drone", name: "Cosmic Zen Drone", desc: "Warm resonant chords", icon: Moon },
              { id: "brown", name: "Deep Brown Noise", desc: "Airplane cabin masking", icon: Wind }
            ].map(s => {
              const active = soundscape === s.id;
              const Icon = s.icon;
              return (
                <button type="button"
                  key={s.id}
                  onClick={() => handleSoundscapeChange(s.id)}
                  className="press card-hover"
                  style={{ ...{ font: "inherit", textAlign: "inherit", color: "inherit", border: "none", background: "transparent", padding: 0 },
                    background: active ? `linear-gradient(135deg, ${t.a1}22, ${t.a3}15)` : t.surface,
                    border: `1px solid ${active ? t.a1 : t.line}`,
                    borderRadius: 14,
                    padding: 14,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 12
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: active ? t.a1 : t.surface2,
                    color: active ? t.onAccent : t.muted,
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    <Icon size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: active ? t.a1 : t.text }}>
                      {s.name}
                    </div>
                    <div style={{ fontSize: 10.5, color: t.muted }}>
                      {s.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Volume Slider if sound is playing */}
          {soundscape !== "none" && (
            <div className="fade-in" style={{
              marginTop: 14,
              background: t.surface2,
              padding: "10px 16px",
              borderRadius: 12,
              border: `1px solid ${t.line}`,
              display: "flex",
              alignItems: "center",
              gap: 14
            }}>
              <Volume2 size={16} color={t.a1} />
              <span style={{ fontSize: 12, color: t.muted }}>Sound Volume</span>
              <input aria-label="Sound volume"
                type="range"
                min="0.05"
                max="1"
                step="0.05"
                value={soundVolume}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  setSoundVolume(val);
                  startAudio(soundscape, val);
                }}
                style={{ flex: 1, accentColor: t.a1, cursor: "pointer" }}
              />
              <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>
                {Math.round(soundVolume * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </Screen>
  );
}
