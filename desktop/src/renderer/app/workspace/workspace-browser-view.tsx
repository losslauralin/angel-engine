import type {
  WorkspaceBrowserBounds,
  WorkspaceBrowserState,
} from "@shared/workspace-browser";
import type { FormEvent } from "react";

import {
  RiArrowLeftLine as ArrowLeft,
  RiArrowRightLine as ArrowRight,
  RiRefreshLine as Refresh,
} from "@remixicon/react";
import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/platform/utils";

export function WorkspaceBrowserNativeView({
  active,
  browserViewId,
  className,
  onStateChange,
  url,
}: {
  active: boolean;
  browserViewId: string;
  className?: string;
  onStateChange?: (state: WorkspaceBrowserState) => void;
  url: string;
}) {
  const cleanupRef = useRef<() => void>(() => {});
  const propsRef = useRef({ browserViewId, onStateChange, url });
  propsRef.current = { browserViewId, onStateChange, url };

  const setContainer = useCallback((container: HTMLDivElement | null) => {
    cleanupRef.current();
    cleanupRef.current = () => {};

    if (!container) {
      return;
    }

    const attachmentId = crypto.randomUUID();
    let disposed = false;
    const currentProps = propsRef.current;
    const emitState = (state: WorkspaceBrowserState) => {
      propsRef.current.onStateChange?.(state);
    };
    let stopTrackingBounds = () => {};
    const unsubscribe = window.workspaceBrowser.onEvent(
      currentProps.browserViewId,
      (event) => {
        emitState(event.state);
      },
    );
    void window.workspaceBrowser
      .create({
        browserViewId: currentProps.browserViewId,
        url: currentProps.url,
      })
      .then(async (state) => {
        if (disposed) {
          return;
        }
        emitState(state);
        const bounds = readWorkspaceBrowserBounds(container);
        const nextState = await window.workspaceBrowser.attach({
          attachmentId,
          bounds,
          browserViewId: currentProps.browserViewId,
        });
        return { bounds, state: nextState };
      })
      .then((result) => {
        if (!disposed && result !== undefined) {
          emitState(result.state);
          stopTrackingBounds = trackWorkspaceBrowserBounds({
            attachmentId,
            browserViewId: currentProps.browserViewId,
            container,
            initialBounds: result.bounds,
          });
        }
      })
      .catch((error: unknown) => {
        console.error("Failed to attach workspace browser view.", {
          browserViewId: currentProps.browserViewId,
          error,
        });
      });

    cleanupRef.current = () => {
      disposed = true;
      stopTrackingBounds();
      unsubscribe();
      void window.workspaceBrowser
        .detach({
          attachmentId,
          browserViewId: currentProps.browserViewId,
        })
        .catch((error: unknown) => {
          console.error("Failed to detach workspace browser view.", {
            browserViewId: currentProps.browserViewId,
            error,
          });
        });
    };
  }, []);

  return (
    <div
      className={cn(
        "size-full min-h-0 overflow-hidden bg-background",
        className,
      )}
      ref={active ? setContainer : undefined}
    />
  );
}

export function WorkspaceBrowserToolView({
  active = true,
  browserViewId,
  initialUrl,
}: {
  active?: boolean;
  browserViewId: string;
  initialUrl: string;
}) {
  const [browserState, setBrowserState] = useState<WorkspaceBrowserState>({
    canGoBack: false,
    canGoForward: false,
    ready: false,
    title: browserTitleFromUrl(initialUrl),
    url: initialUrl,
  });
  const [draftUrl, setDraftUrl] = useState(initialUrl);
  const handleStateChange = useCallback((state: WorkspaceBrowserState) => {
    setBrowserState(state);
    setDraftUrl(state.url);
  }, []);
  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const nextUrl = normalizeWorkspaceBrowserUrl(draftUrl);
      setDraftUrl(nextUrl);
      setBrowserState((current) => ({
        ...current,
        title: browserTitleFromUrl(nextUrl),
        url: nextUrl,
      }));
      void window.workspaceBrowser.navigate({ browserViewId, url: nextUrl });
    },
    [browserViewId, draftUrl],
  );
  const goBack = useCallback(() => {
    void window.workspaceBrowser
      .goBack({ browserViewId })
      .then(handleStateChange);
  }, [browserViewId, handleStateChange]);
  const goForward = useCallback(() => {
    void window.workspaceBrowser
      .goForward({ browserViewId })
      .then(handleStateChange);
  }, [browserViewId, handleStateChange]);
  const reload = useCallback(() => {
    void window.workspaceBrowser
      .reload({ browserViewId })
      .then(handleStateChange);
  }, [browserViewId, handleStateChange]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <form
        className="flex h-11 shrink-0 items-center gap-1 border-b border-border/70 px-2"
        onSubmit={handleSubmit}
      >
        <Button
          aria-label="Back"
          disabled={!browserState.canGoBack}
          onClick={goBack}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <ArrowLeft />
        </Button>
        <Button
          aria-label="Forward"
          disabled={!browserState.canGoForward}
          onClick={goForward}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <ArrowRight />
        </Button>
        <Button
          aria-label="Reload"
          disabled={!browserState.ready}
          onClick={reload}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <Refresh />
        </Button>
        <Input
          aria-label="URL"
          className="h-7 rounded-md px-2 text-xs"
          onChange={(event) => setDraftUrl(event.currentTarget.value)}
          value={draftUrl}
        />
      </form>
      <WorkspaceBrowserNativeView
        active={active}
        browserViewId={browserViewId}
        onStateChange={handleStateChange}
        url={browserState.url}
      />
    </div>
  );
}

export function normalizeWorkspaceBrowserUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "about:blank";
  if (trimmed === "about:blank") return trimmed;
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function browserTitleFromUrl(url: string) {
  const trimmedUrl = url.trim();

  if (!trimmedUrl || trimmedUrl === "about:blank") {
    return "Blank";
  }

  try {
    const parsedUrl = new URL(trimmedUrl);
    return parsedUrl.host || parsedUrl.href;
  } catch {
    return trimmedUrl;
  }
}

function readWorkspaceBrowserBounds(container: HTMLElement) {
  const rect = readVisibleWorkspaceBrowserRect(container);

  return {
    height: Math.max(1, Math.round(rect.bottom - rect.top)),
    width: Math.max(1, Math.round(rect.right - rect.left)),
    x: Math.round(rect.left),
    y: Math.round(rect.top),
  };
}

interface WorkspaceBrowserRect {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

function readVisibleWorkspaceBrowserRect(container: HTMLElement) {
  let rect = toWorkspaceBrowserRect(container.getBoundingClientRect());
  for (
    let ancestor = container.parentElement;
    ancestor;
    ancestor = ancestor.parentElement
  ) {
    rect = clipWorkspaceBrowserRectToAncestor(rect, ancestor);
  }

  return intersectWorkspaceBrowserRects(rect, {
    bottom: window.innerHeight,
    left: 0,
    right: window.innerWidth,
    top: 0,
  });
}

function toWorkspaceBrowserRect(rect: DOMRect): WorkspaceBrowserRect {
  return {
    bottom: rect.bottom,
    left: rect.left,
    right: rect.right,
    top: rect.top,
  };
}

function intersectWorkspaceBrowserRects(
  left: WorkspaceBrowserRect,
  right: WorkspaceBrowserRect,
): WorkspaceBrowserRect {
  const nextLeft = Math.max(left.left, right.left);
  const nextTop = Math.max(left.top, right.top);
  const nextRight = Math.max(nextLeft, Math.min(left.right, right.right));
  const nextBottom = Math.max(nextTop, Math.min(left.bottom, right.bottom));

  return {
    bottom: nextBottom,
    left: nextLeft,
    right: nextRight,
    top: nextTop,
  };
}

function clipWorkspaceBrowserRectToAncestor(
  rect: WorkspaceBrowserRect,
  ancestor: HTMLElement,
) {
  const ancestorRect = toWorkspaceBrowserRect(ancestor.getBoundingClientRect());
  const style = window.getComputedStyle(ancestor);
  const clipsX =
    clipsWorkspaceBrowserOverflow(style.overflowX) ||
    clipsWorkspaceBrowserOverflow(style.overflow);
  const clipsY =
    clipsWorkspaceBrowserOverflow(style.overflowY) ||
    clipsWorkspaceBrowserOverflow(style.overflow);
  const nextLeft = clipsX ? Math.max(rect.left, ancestorRect.left) : rect.left;
  const nextRight = clipsX
    ? Math.max(nextLeft, Math.min(rect.right, ancestorRect.right))
    : rect.right;
  const nextTop = clipsY ? Math.max(rect.top, ancestorRect.top) : rect.top;
  const nextBottom = clipsY
    ? Math.max(nextTop, Math.min(rect.bottom, ancestorRect.bottom))
    : rect.bottom;

  return {
    bottom: nextBottom,
    left: nextLeft,
    right: nextRight,
    top: nextTop,
  };
}

function clipsWorkspaceBrowserOverflow(value: string) {
  return (
    value === "auto" ||
    value === "clip" ||
    value === "hidden" ||
    value === "scroll"
  );
}

function trackWorkspaceBrowserBounds({
  attachmentId,
  browserViewId,
  container,
  initialBounds,
}: {
  attachmentId: string;
  browserViewId: string;
  container: HTMLElement;
  initialBounds: WorkspaceBrowserBounds;
}) {
  let animationFrame = 0;
  let disposed = false;
  let lastBounds = initialBounds;

  const tick = () => {
    if (disposed) {
      return;
    }

    const bounds = readWorkspaceBrowserBounds(container);
    if (!areWorkspaceBrowserBoundsEqual(bounds, lastBounds)) {
      lastBounds = bounds;
      void window.workspaceBrowser
        .setBounds({
          attachmentId,
          bounds,
          browserViewId,
        })
        .catch((error: unknown) => {
          console.error("Failed to update workspace browser bounds.", {
            browserViewId,
            error,
          });
        });
    }

    animationFrame = window.requestAnimationFrame(tick);
  };

  animationFrame = window.requestAnimationFrame(tick);

  return () => {
    disposed = true;
    window.cancelAnimationFrame(animationFrame);
  };
}

function areWorkspaceBrowserBoundsEqual(
  left: WorkspaceBrowserBounds,
  right: WorkspaceBrowserBounds,
) {
  return (
    left.height === right.height &&
    left.width === right.width &&
    left.x === right.x &&
    left.y === right.y
  );
}
