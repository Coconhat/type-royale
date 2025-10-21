import { useEffect } from "react";
import { initAudio, loadGunshot } from "../libs/gunshot";

function audioInit() {
  useEffect(() => {
    // prefetch sample (best-effort)
    loadGunshot("/gunshot.wav").catch(() => {
      /* ignore, fallback synth will be used */
    });

    // Many browsers require a user gesture to unlock audio. Resume on first click/keydown.
    const resume = async () => {
      try {
        const ctx = await initAudio();
        if (typeof ctx.resume === "function") await ctx.resume();
      } catch {
        /* ignore */
      }
      window.removeEventListener("click", resume);
      window.removeEventListener("keydown", resume);
    };
    window.addEventListener("click", resume, { once: true });
    window.addEventListener("keydown", resume, { once: true });

    return () => {
      window.removeEventListener("click", resume);
      window.removeEventListener("keydown", resume);
    };
  }, []);
}

export default audioInit;
