"use client";

import { useEffect, useState } from "react";

// Shared render for the { error: "locked_down", requiredMasteryPct,
// currentMasteryPct, checkpointDay } shape every non-adaptive-practice
// content route returns (see lib/adaptive/subjectUnlockState.js's
// checkLockdown) -- one place to keep the wording consistent instead of
// each component inventing its own.
export default function LockdownNotice({ lockdown }) {
  const [graceTokens, setGraceTokens] = useState([]);
  const [using, setUsing] = useState(false);

  useEffect(() => {
    fetch("/api/items")
      .then((r) => r.json())
      .then((data) => setGraceTokens(data.usableItems?.filter((i) => i.itemType === "lockdown_grace") ?? []))
      .catch(() => {});
  }, []);

  function useToken() {
    if (!graceTokens.length) return;
    setUsing(true);
    fetch("/api/items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemId: graceTokens[0].id, action: "use_lockdown_grace" }),
    })
      .then((r) => r.json())
      .then((data) => {
        // A blunt but reliable reset -- lockdown is checked independently by
        // several different routes/components, and a full reload re-runs
        // every one of them against the now-updated grace window rather
        // than needing a bespoke "retry" callback threaded through each of
        // this notice's several call sites.
        if (!data.error) window.location.reload();
      })
      .finally(() => setUsing(false));
  }

  return (
    <div className="error-box">
      Locked down — you missed a plan checkpoint (day {lockdown.checkpointDay}) without reaching the mastery needed
      for your next GS subject. This feature is paused until your average mastery on already-unlocked GS subjects
      climbs from {lockdown.currentMasteryPct}% back to {lockdown.requiredMasteryPct}%.
      <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a className="btn btn-primary" href="/practice">
          Start adaptive practice →
        </a>
        {graceTokens.length > 0 && (
          <button className="btn" onClick={useToken} disabled={using}>
            {using ? "Using…" : `🎫 Use a Lockdown Grace Token (${graceTokens.length})`}
          </button>
        )}
      </div>
    </div>
  );
}
