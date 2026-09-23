export const PALETTES = {
  blue: {
    name: "Blue",
    accentColor: "#2F6FED",
    dark: {
      bg: "#0A0F1E", surface: "#121A2E", surface2: "#1B2740", line: "#233355",
      text: "#EAF2FF", muted: "#7E90B8", onAccent: "#04102A",
      a1: "#4C8DFF", a2: "#7FB2FF", a3: "#2451A6", a4: "#1B3B78", a5: "#9FC6FF",
      good: "#6FE3C6", warm: "#5B6B8C",
      heroFrom: "#13224A", heroTo: "#0A0F1E",
    },
    light: {
      bg: "#EEF3FC", surface: "#FFFFFF", surface2: "#F4F8FE", line: "#DDE7F8",
      text: "#0E1B33", muted: "#5C6E92", onAccent: "#FFFFFF",
      a1: "#2F6FED", a2: "#5B93F5", a3: "#163172", a4: "#B9D2FA", a5: "#0E3FA6",
      good: "#0E9C7F", warm: "#7C8DB0",
      heroFrom: "#DCE8FF", heroTo: "#EEF3FC",
    }
  },
  brown: {
    name: "Brown",
    accentColor: "#B85D22",
    dark: {
      bg: "#18120F", surface: "#221A15", surface2: "#2E231D", line: "#3E3028",
      text: "#F5EDE8", muted: "#A89487", onAccent: "#18120F",
      a1: "#D97736", a2: "#E89A65", a3: "#9C481A", a4: "#663214", a5: "#F2BA91",
      good: "#5EBA8A", warm: "#8C7A70",
      heroFrom: "#362217", heroTo: "#18120F",
    },
    light: {
      bg: "#F9F6F0", surface: "#FFFFFF", surface2: "#F2EBE3", line: "#E6D9CE",
      text: "#2C1F18", muted: "#826E63", onAccent: "#FFFFFF",
      a1: "#B85D22", a2: "#D47E45", a3: "#783510", a4: "#EAD0C1", a5: "#944416",
      good: "#2A8C5E", warm: "#968175",
      heroFrom: "#EFE2D6", heroTo: "#F9F6F0",
    }
  },
  peach: {
    name: "Peach",
    accentColor: "#E85D54",
    dark: {
      bg: "#1C1215", surface: "#27191E", surface2: "#352229", line: "#482F39",
      text: "#FFF0F3", muted: "#B5949E", onAccent: "#1C1215",
      a1: "#F97066", a2: "#FB9A92", a3: "#C53E3E", a4: "#7A272D", a5: "#FDC4BE",
      good: "#48BB78", warm: "#8E6E77",
      heroFrom: "#3B1B25", heroTo: "#1C1215",
    },
    light: {
      bg: "#FFF5F2", surface: "#FFFFFF", surface2: "#FEEDEA", line: "#FCD7D0",
      text: "#341920", muted: "#8E6771", onAccent: "#FFFFFF",
      a1: "#E85D54", a2: "#F5827A", a3: "#9E2F29", a4: "#FDD5D0", a5: "#BF3E36",
      good: "#2B8A5A", warm: "#99737E",
      heroFrom: "#FCE4DF", heroTo: "#FFF5F2",
    }
  }
};

// Opaque fallback colours stay available for native controls and older browsers.
for (const palette of Object.values(PALETTES)) {
  for (const mode of ['dark', 'light']) {
    const t = palette[mode];
    t.glass = `linear-gradient(145deg, ${t.surface}${mode === 'dark' ? 'ad' : 'c9'}, ${t.surface2}96)`;
    t.glassEdge = mode === 'dark' ? '#ffffff24' : '#ffffffd9';
    t.glassShadow = mode === 'dark' ? '0 16px 44px -28px #000000b0, inset 0 1px 0 #ffffff16' : '0 16px 44px -28px #533a3260, inset 0 1px 0 #ffffff';
    t.canvas = `radial-gradient(ellipse at 4% 8%, #4c8dff24, transparent 48%), radial-gradient(ellipse at 92% 38%, #f9ab8c25, transparent 48%), radial-gradient(ellipse at 30% 96%, #9c684b22, transparent 50%), ${t.bg}`;
  }
}

export const THEME = {
  dark: PALETTES.blue.dark,
  light: PALETTES.blue.light
};

export const CAT_PALETTE = ["a1", "a2", "a5", "a3", "a4", "warm"];

export const PRI_KEY = { High: "a1", Med: "a2", Low: "muted" };

export function useT(mode = "dark", scheme = "blue") {
  const selectedPalette = PALETTES[scheme] || PALETTES.blue;
  return selectedPalette[mode] || selectedPalette.dark;
}

export const uid = () => Math.random().toString(36).slice(2, 10);
export { localDateKey as todayStr } from "./utils/dates.js";
export { formatDate as dayName } from "./utils/dates.js";

export function inputStyle(t) {
  return {
    width: "100%", background: t.surface2, border: `1px solid ${t.line}`, borderRadius: 10,
    padding: "10px 12px", minHeight: 44, color: t.text, fontSize: 16, boxSizing: "border-box",
    transition: "border-color .15s ease"
  };
}

export default THEME;
