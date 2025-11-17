import { useCallback, useMemo } from "react";
import { useUser } from "@stackframe/react";

const METADATA_KEY = "typeRoyaleStats";
const DEFAULT_STATS = {
  highestScore: 0,
  totalWins: 0,
};

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const normalizeStats = (raw) => ({
  highestScore: Math.max(0, Number(raw?.highestScore) || 0),
  totalWins: Math.max(0, Number(raw?.totalWins) || 0),
});

const readStats = (metadata) => {
  if (!isRecord(metadata)) {
    return DEFAULT_STATS;
  }
  if (isRecord(metadata[METADATA_KEY])) {
    return normalizeStats(metadata[METADATA_KEY]);
  }
  return normalizeStats(metadata);
};

/**
 * Reads and persists player stats (highest solo score & multiplayer wins)
 * inside the authenticated Stack user's client metadata.
 */
export default function usePlayerStats() {
  const stackUser = useUser();

  const stats = useMemo(
    () => readStats(stackUser?.clientMetadata ?? null),
    [stackUser?.clientMetadata]
  );

  const updateStats = useCallback(
    async (partialOrUpdater) => {
      if (!stackUser) {
        return { ok: false, reason: "unauthenticated" };
      }

      const baseMeta = isRecord(stackUser.clientMetadata)
        ? stackUser.clientMetadata
        : {};
      const currentStats = readStats(baseMeta);
      const patch =
        typeof partialOrUpdater === "function"
          ? partialOrUpdater(currentStats) || {}
          : partialOrUpdater;
      const nextStats = normalizeStats({ ...currentStats, ...patch });

      if (
        nextStats.highestScore === currentStats.highestScore &&
        nextStats.totalWins === currentStats.totalWins
      ) {
        return { ok: true, stats: currentStats, unchanged: true };
      }

      const nextMetadata = {
        ...baseMeta,
        [METADATA_KEY]: nextStats,
      };

      try {
        await stackUser.setClientMetadata(nextMetadata);
        return { ok: true, stats: nextStats };
      } catch (error) {
        console.error("Failed to persist player stats", error);
        return { ok: false, reason: "update-failed", error };
      }
    },
    [stackUser]
  );

  return { stats, updateStats, stackUser };
}
