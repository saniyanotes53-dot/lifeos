import { Modal } from "./primitives";
import React, { useState } from "react";
import {
  Sparkles, CheckCircle, Clock, Moon, Wallet, Palette, ArrowRight, X
} from "lucide-react";
import { Card, PrimaryButton, GhostButton } from "./primitives";

export default function UserGuideModal({ t, isOpen, onClose }) {
  const [step, setStep] = useState(0);

  if (!isOpen) return null;

  const slides = [
    {
      icon: Sparkles,
      badge: "Welcome",
      title: "Welcome to Life OS",
      description: "Your unified day, budget, and wellness command center designed by Buraq Studios. Here is a quick 1-minute tour to help you get the most out of your experience.",
      highlights: [
        "All-in-one productivity, health & finance tracker",
        "3 dynamic theme palettes with light & dark modes",
        "Encrypted, per-user cloud storage with live sync"
      ]
    },
    {
      icon: Clock,
      badge: "Tasks & Timetable",
      title: "Plan Your Day with Timetable",
      description: "Organize what matters most. Schedule tasks directly into your calendar.",
      highlights: [
        "Toggle between Day view and Week view grid",
        "Click 'Schedule' on any task to pin it to a time slot",
        "Completing a task synchronizes both Tasks and Timetable automatically",
        "Enable in-app reminders while Life OS is open"
      ]
    },
    {
      icon: Moon,
      badge: "Health & Fitness",
      title: "Health, Sleep & Nutrition Targets",
      description: "Keep your mind and body functioning at peak condition.",
      highlights: [
        "Log sleep hours, gym workouts, and daily meals",
        "Auto-calculate your BMI and metabolic calorie needs",
        "Get tailored daily calorie & protein targets to lose fat or build muscle",
        "View weekly 7-hour sleep goal adherence bars"
      ]
    },
    {
      icon: Wallet,
      badge: "Wealth & Budget",
      title: "Hisaabat-Inspired Money Management",
      description: "Complete visibility over cash, bank balances, and expenditures.",
      highlights: [
        "Manage Bank accounts, Cash wallets, and liquid net worth",
        "Use AI Statement Import to parse SMS or bank statement lines",
        "Set monthly category spending limits with progress indicators",
        "Track debt with the Borrow & Lend tracker"
      ]
    },
    {
      icon: Palette,
      badge: "Customization",
      title: "Personalize Your Visuals",
      description: "Pick a visual atmosphere that matches your focus.",
      highlights: [
        "Choose between Electric Blue, Warm Brown, and Peach palettes",
        "Toggle instant Dark / Light mode anytime from the top header",
        "Export professional weekly and monthly summary reports as PDF"
      ]
    }
  ];

  const current = slides[step];
  const Icon = current.icon;
  const isLast = step === slides.length - 1;

  return (
    <Modal title="Life OS guide" onClose={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 999,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      backdropFilter: "blur(6px)"
    }}>
      <Card t={t} style={{
        width: "100%", maxWidth: 540, padding: 28, background: t.surface,
        borderRadius: 24, boxShadow: `0 24px 70px -12px ${t.a1}33`,
        position: "relative", border: `1.5px solid ${t.line}`
      }}>
        {/* Close Button */}
        <button aria-label="Close dialog"
          onClick={onClose}
          className="press"
          style={{
            position: "absolute", top: 18, right: 18, background: t.surface2,
            border: `1px solid ${t.line}`, borderRadius: 10, width: 32, height: 32,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            color: t.muted
          }}
        >
          <X size={16} />
        </button>

        {/* Badge & Icon */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 16,
            background: `linear-gradient(135deg, ${t.a1}, ${t.a3})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 8px 20px -6px ${t.a1}88`
          }}>
            <Icon size={24} color={t.onAccent} />
          </div>
          <div>
            <span style={{
              fontSize: 11, fontWeight: 700, color: t.a1, background: `${t.a1}22`,
              padding: "3px 8px", borderRadius: 6, textTransform: "uppercase", letterSpacing: 0.5
            }}>
              {current.badge}
            </span>
            <div style={{ fontSize: 11.5, color: t.muted, marginTop: 3 }}>
              Step {step + 1} of {slides.length}
            </div>
          </div>
        </div>

        {/* Title & Description */}
        <h2 style={{
          fontFamily: "'Iowan Old Style', Georgia, serif", fontSize: 22,
          fontWeight: 700, color: t.text, margin: "0 0 8px"
        }}>
          {current.title}
        </h2>
        <p style={{ fontSize: 13.5, color: t.muted, lineHeight: 1.5, margin: "0 0 16px" }}>
          {current.description}
        </p>

        {/* Highlights List */}
        <div style={{
          background: t.surface2, borderRadius: 14, padding: "12px 14px",
          marginBottom: 22, border: `1px solid ${t.line}`
        }}>
          {current.highlights.map((h, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 12.5, color: t.text, marginBottom: i < current.highlights.length - 1 ? 8 : 0 }}>
              <CheckCircle size={15} color={t.good} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{h}</span>
            </div>
          ))}
        </div>

        {/* Navigation Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {/* Progress dots */}
          <div style={{ display: "flex", gap: 6 }}>
            {slides.map((_, i) => (
              <button type="button"
                key={i}
                onClick={() => setStep(i)}
                style={{ ...{ font: "inherit", textAlign: "inherit", color: "inherit", border: "none", background: "transparent", padding: 0 },
                  width: step === i ? 20 : 7, height: 7, borderRadius: 4,
                  background: step === i ? t.a1 : t.line,
                  transition: "all 0.25s ease", cursor: "pointer"
                }}
              />
            ))}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            {step > 0 && (
              <GhostButton t={t} onClick={() => setStep(s => s - 1)} style={{ width: "auto", padding: "9px 16px", fontSize: 13 }}>
                Back
              </GhostButton>
            )}
            <PrimaryButton
              t={t}
              onClick={() => {
                if (isLast) {
                  onClose();
                } else {
                  setStep(s => s + 1);
                }
              }}
              style={{ width: "auto", padding: "9px 20px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
            >
              {isLast ? "Get Started" : "Next"} <ArrowRight size={14} />
            </PrimaryButton>
          </div>
        </div>

        {/* Footer Tagline */}
        <div style={{ textAlign: "center", fontSize: 10.5, color: t.muted, marginTop: 18, borderTop: `1px solid ${t.line}`, paddingTop: 10 }}>
          Designed by <strong style={{ color: t.a1 }}>Buraq Studios</strong> · Copyright all rights reserved
        </div>
      </Card>
    </Modal>
  );
}
