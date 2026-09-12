import { useEffect, useState } from "react";
import { localDateKey } from "./utils/dates.js";

export function useLocalDay() {
  const [day, setDay] = useState(localDateKey);
  useEffect(() => {
    const refresh = () => setDay(localDateKey());
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);
  return day;
}
