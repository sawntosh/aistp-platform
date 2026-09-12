import { useEffect, useState } from "react";
import { ArrowRight, History, X } from "lucide-react";
import { cn } from "../lib/cn";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/Card";
import Button from "./ui/Button";

// Coarse, display-only "how long ago" for a paused session's start time --
// doesn't need second-level precision, just a rough sense of recency.
function timeAgo(iso) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// How far (px) the front card has to be dragged before it counts as a
// swipe to the next/previous card rather than snapping back to center.
const SWIPE_THRESHOLD = 56;

// Practice Mode only: a small stack of Save & Exit'd sessions the learner
// can pick back up. The stack is browsed by dragging the front card itself
// (mouse or touch) -- or the slider underneath -- peeling through one card
// at a time, with the next couple peeking out behind it so it reads as an
// actual physical stack, not a flat list.
export default function ResumeSessionsPanel({ status, sessions, onResume, onDiscard, resumingId }) {
  const [activeIndex, setActiveIndex] = useState(0);
  // In-progress drag on the front card: null while idle, otherwise the
  // pointer id/start position so we can tell how far it's moved.
  const [drag, setDrag] = useState(null);

  // Keep the slider in range as sessions are discarded/resumed out from
  // under it (e.g. clamp back onto the last card if the active one goes).
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, sessions.length - 1)));
  }, [sessions.length]);

  if (status !== "loading" && sessions.length === 0) return null;

  function goTo(nextIndex) {
    setActiveIndex(Math.max(0, Math.min(sessions.length - 1, nextIndex)));
  }

  // Ignore drags that start on a button (Resume / discard) so those keep
  // working as plain clicks -- only the card body itself is the swipe handle.
  function handlePointerDown(e) {
    if (e.target.closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ pointerId: e.pointerId, startX: e.clientX, deltaX: 0 });
  }

  function handlePointerMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    setDrag({ ...drag, deltaX: e.clientX - drag.startX });
  }

  function handlePointerUp(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (drag.deltaX <= -SWIPE_THRESHOLD) goTo(activeIndex + 1);
    else if (drag.deltaX >= SWIPE_THRESHOLD) goTo(activeIndex - 1);
    setDrag(null);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0 pb-0">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-test-muted text-test">
          <History className="h-4 w-4" aria-hidden="true" />
        </span>
        <CardTitle className="text-body font-semibold">Resume practice</CardTitle>
      </CardHeader>
      <CardContent>
        {status === "loading" && (
          <p className="text-body-sm text-text-muted">Checking for paused sessions…</p>
        )}

        {status === "ready" && sessions.length > 0 && (
          <>
            <p className="mb-4 text-body-sm text-text-muted">
              Pick up a saved session right where you left off.
            </p>

            <div className="relative min-h-[164px]">
              {sessions.map((session, index) => {
                const offset = index - activeIndex;
                // Only render the active card plus the next couple peeking
                // behind it -- anything already slid past is dropped.
                if (offset < 0 || offset > 2) return null;
                const isFront = offset === 0;
                const isDraggingThis = isFront && drag != null;
                const dragX = isDraggingThis ? drag.deltaX : 0;
                return (
                  <div
                    key={session.session_id}
                    aria-hidden={!isFront}
                    onPointerDown={isFront ? handlePointerDown : undefined}
                    onPointerMove={isFront ? handlePointerMove : undefined}
                    onPointerUp={isFront ? handlePointerUp : undefined}
                    onPointerCancel={isFront ? handlePointerUp : undefined}
                    className={cn(
                      "absolute inset-x-0 top-0 select-none rounded-lg border p-4 ease-out",
                      isDraggingThis ? "transition-none" : "transition-all duration-300",
                      isFront
                        ? "cursor-grab border-border bg-surface shadow-sm active:cursor-grabbing"
                        : "border-border-strong/60 bg-surface-muted shadow-none",
                      !isFront && "pointer-events-none"
                    )}
                    style={{
                      transform: `translateX(${dragX}px) translateY(${offset * 16}px) rotate(${dragX / 24}deg) scale(${1 - offset * 0.06})`,
                      opacity: 1 - offset * 0.3,
                      zIndex: 10 - offset,
                      touchAction: isFront ? "pan-y" : undefined,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-body-sm font-semibold text-text-primary">
                          {session.answered_count}/{session.question_count} answered
                        </p>
                        <p className="mt-0.5 truncate text-caption text-text-muted">
                          {session.domains.length > 0 ? session.domains.join(", ") : "All domains"}
                        </p>
                      </div>
                      {isFront && (
                        <button
                          type="button"
                          onClick={() => onDiscard(session.session_id)}
                          aria-label="Discard this session"
                          className="-mr-1 -mt-1 shrink-0 cursor-pointer rounded-md p-1 text-text-muted transition-colors hover:bg-error-muted hover:text-error"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    {/* Rendered on every card, not just the front one, so
                        every layer in the stack is the same height and the
                        ones behind actually peek out below the front card
                        instead of being hidden inside its taller footprint. */}
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-caption text-text-muted">{timeAgo(session.started_at)}</span>
                      <Button
                        tone="test"
                        size="sm"
                        onClick={() => onResume(session.session_id)}
                        isLoading={resumingId === session.session_id}
                      >
                        Resume
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {sessions.length > 1 && (
              <div className="mt-4 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={sessions.length - 1}
                  step={1}
                  value={activeIndex}
                  onChange={(e) => goTo(Number(e.target.value))}
                  aria-label="Browse paused sessions"
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-muted accent-test"
                />
                <span className="shrink-0 text-caption tabular-nums text-text-muted">
                  {activeIndex + 1}/{sessions.length}
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
