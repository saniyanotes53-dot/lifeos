import React from "react";

export default function CopyrightFooter({ t, style }) {
  return (
    <div style={{
      textAlign: "center",
      padding: "16px 12px",
      fontSize: 11.5,
      color: t.muted,
      letterSpacing: 0.3,
      lineHeight: 1.6,
      opacity: 0.85,
      ...style
    }}>
      This website is designed by <strong style={{ color: t.a1, fontWeight: 700 }}>Buraq Studios</strong> · Copyright all rights reserved.
    </div>
  );
}
