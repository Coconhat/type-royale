import { useEffect, useRef, useState } from "react";

export default function useInterpolation(serverEnemies) {
  const [interpolated, setInterpolated] = useState([]);
  const animFrameRef = useRef(null);
  const lastTimeRef = useRef(Date.now());
  const enemyCountRef = useRef(0);

  useEffect(() => {
    // Initialize interpolated state from server enemies when count changes
    if (serverEnemies.length !== enemyCountRef.current) {
      enemyCountRef.current = serverEnemies.length;
      setInterpolated(
        serverEnemies.map((e) => ({
          ...e,
          displayX: e.x,
          displayY: e.y,
        }))
      );
    }
  }, [serverEnemies]);

  useEffect(() => {
    let mounted = true;
    const LERP_FACTOR = 0.1;

    function animate() {
      if (!mounted) return;

      const now = Date.now();
      lastTimeRef.current = now;

      setInterpolated((prev) => {
        // Create a map of server positions for quick lookup
        const serverMap = new Map(serverEnemies.map((e) => [e.id, e]));

        return prev.map((enemy) => {
          const serverEnemy = serverMap.get(enemy.id);
          if (!serverEnemy) return enemy; // enemy removed

          // Smoothly interpolate toward server position
          const targetX = serverEnemy.x;
          const targetY = serverEnemy.y;

          // If position changed significantly, lerp toward it
          const displayX =
            enemy.displayX + (targetX - enemy.displayX) * LERP_FACTOR;
          const displayY =
            enemy.displayY + (targetY - enemy.displayY) * LERP_FACTOR;

          return {
            ...serverEnemy,
            displayX,
            displayY,
          };
        });
      });

      animFrameRef.current = requestAnimationFrame(animate);
    }

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      mounted = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [serverEnemies]);

  return interpolated;
}
