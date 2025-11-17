import { useCallback, useMemo } from "react";
import { useUser } from "@stackframe/react";

const METADATA_KEY = "typeRoyaleStats";
const PROFILE_VIEWS = new Set(["card", "list"]);
const DEFAULT_STATS = {
  highestScore: 0,
  totalWins: 0,
  timeAttackBest: 0,
  timeAttackRuns: 0,
  preferences: {
    profileView: "card",
  },
};

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const normalizeStats = (raw) => ({
  highestScore: Math.max(0, Number(raw?.highestScore) || 0),
  totalWins: Math.max(0, Number(raw?.totalWins) || 0),
  timeAttackBest: Math.max(0, Number(raw?.timeAttackBest) || 0),
  timeAttackRuns: Math.max(0, Number(raw?.timeAttackRuns) || 0),
  preferences: {
    profileView: PROFILE_VIEWS.has(raw?.preferences?.profileView)
      ? raw.preferences.profileView
      : DEFAULT_STATS.preferences.profileView,
  },
});

const areStatsEqual = (next, prev) =>
  next.highestScore === prev.highestScore &&
  next.totalWins === prev.totalWins &&
  next.timeAttackBest === prev.timeAttackBest &&
  next.timeAttackRuns === prev.timeAttackRuns &&
  next.preferences.profileView === prev.preferences.profileView;

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
      const nextStats = normalizeStats({
        ...currentStats,
        ...patch,
        preferences: {
          ...currentStats.preferences,
          ...(patch?.preferences || {}),
        },
      });

      if (areStatsEqual(nextStats, currentStats)) {
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
