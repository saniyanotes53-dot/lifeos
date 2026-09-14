import React from "react";
import { AlertTriangle } from "lucide-react";

export default class ScreenErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ScreenErrorBoundary caught an error:", error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleReturnToDashboard = () => {
    this.setState({ hasError: false, error: null });
    if (typeof this.props.onReturnToDashboard === "function") {
      this.props.onReturnToDashboard();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const t = this.props.t || {
        bg: "#0A0F1E",
        surface: "#121A2E",
        surface2: "#1B2740",
        line: "#233355",
        text: "#EAF2FF",
        muted: "#7E90B8",
        a1: "#4C8DFF",
        a3: "#2451A6",
        onAccent: "#04102A"
      };

      return (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            padding: 24,
            textAlign: "center"
          }}
        >
          <div
            style={{
              background: t.surface,
              border: `1px solid ${t.line}`,
              borderRadius: 18,
              padding: "36px 28px",
              maxWidth: 460,
              width: "100%",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.15)"
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                margin: "0 auto 16px",
                background: `${t.a1}22`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: t.a1
              }}
            >
              <AlertTriangle size={24} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: t.text, margin: "0 0 8px" }}>
              Something went wrong while loading this screen.
            </h3>
            <p style={{ fontSize: 13, color: t.muted, margin: "0 0 24px", lineHeight: 1.5 }}>
              An unexpected error occurred in this view. You can return to your dashboard or reload the application.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={this.handleReturnToDashboard}
                className="press"
                style={{
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 18px",
                  background: `linear-gradient(135deg, ${t.a1}, ${t.a3})`,
                  color: t.onAccent,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Return to Dashboard
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="press"
                style={{
                  border: `1px solid ${t.line}`,
                  borderRadius: 10,
                  padding: "10px 18px",
                  background: t.surface2 || "transparent",
                  color: t.text,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Reload Life OS
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
