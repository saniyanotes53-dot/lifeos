import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, Sparkles, X } from "lucide-react";

const ToastContext = createContext(null);

export function ToastProvider({ children, t }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "success", duration = 3200) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const icons = {
    success: <CheckCircle2 size={17} color={t?.good || "#10b981"} />,
    alert: <AlertCircle size={17} color="#f59e0b" />,
    error: <AlertCircle size={17} color="#ef4444" />,
    sparkle: <Sparkles size={17} color={t?.a1 || "#3b82f6"} />,
    info: <Info size={17} color={t?.a2 || "#60a5fa"} />
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Floating Toast Stack */}
      <div style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        pointerEvents: "none",
        maxWidth: "92vw",
        width: 360
      }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="pop-in glass-panel"
            style={{
              pointerEvents: "auto",
              background: t?.surface ? `${t.surface}ee` : "rgba(18, 26, 46, 0.92)",
              border: `1px solid ${t?.line || "rgba(255,255,255,0.12)"}`,
              borderRadius: 14,
              padding: "12px 14px",
              boxShadow: "0 16px 36px -8px rgba(0, 0, 0, 0.35)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: t?.text || "#ffffff",
              fontSize: 13,
              fontWeight: 500,
              backdropFilter: "blur(16px)"
            }}
          >
            <div style={{ flexShrink: 0 }}>
              {icons[toast.type] || icons.success}
            </div>
            <div style={{ flex: 1, lineHeight: 1.4 }}>
              {toast.message}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                background: "transparent",
                border: "none",
                color: t?.muted || "#94a3b8",
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center"
              }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  return context?.addToast || (() => {});
}
