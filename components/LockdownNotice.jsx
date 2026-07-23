"use client";

// Shared render for the { error: "locked_down", requiredMasteryPct,
// currentMasteryPct, checkpointDay } shape every non-adaptive-practice
// content route returns (see lib/adaptive/subjectUnlockState.js's
// checkLockdown) -- one place to keep the wording consistent instead of
// each component inventing its own.
export default function LockdownNotice({ lockdown }) {
  return (
    <div className="error-box">
      Locked down — you missed a plan checkpoint (day {lockdown.checkpointDay}) without reaching the mastery needed
      for your next GS subject. This feature is paused until your average mastery on already-unlocked GS subjects
      climbs from {lockdown.currentMasteryPct}% back to {lockdown.requiredMasteryPct}%.
      <div style={{ marginTop: 8 }}>
        <a className="btn btn-primary" href="/practice">
          Start adaptive practice →
        </a>
      </div>
    </div>
  );
}
