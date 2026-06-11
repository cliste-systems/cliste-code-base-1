"use client";

import {
  useLayoutEffect,
  useState,
  type RefObject,
} from "react";

import { DASHBOARD_HOME_LIST_ROW_HEIGHT_PX } from "@/lib/dashboard-home-panel-limit";

function measureRowHeight(body: HTMLElement, fallbackPx: number): number {
  const firstRow = body.querySelector("ul[role='list'] > li");
  if (firstRow instanceof HTMLElement && firstRow.offsetHeight > 0) {
    return Math.max(firstRow.offsetHeight, fallbackPx);
  }
  return fallbackPx;
}

function rowsThatFill(
  body: HTMLElement,
  cap: number,
  rowHeightPx: number,
): number {
  if (cap <= 0) return 0;

  const available = body.clientHeight;
  if (available <= 0) return Math.min(cap, 1);

  const list = body.querySelector("ul[role='list']");
  const rowHeight = measureRowHeight(body, rowHeightPx);
  if (rowHeight <= 0) return Math.min(cap, 1);

  if (list instanceof HTMLElement && list.childElementCount > 0) {
    let count = 0;
    let used = 0;
    for (let i = 0; i < list.childElementCount; i++) {
      const h = (list.children[i] as HTMLElement).offsetHeight;
      if (used + h <= available + 1) {
        used += h;
        count += 1;
      } else {
        break;
      }
    }
    while (count < cap && used + rowHeight <= available + 1) {
      count += 1;
      used += rowHeight;
    }
    return count;
  }

  let count = Math.min(cap, Math.floor(available / rowHeight));
  while (count > 1 && count * rowHeight > available) count -= 1;
  while (count < cap && (count + 1) * rowHeight <= available) count += 1;

  return count;
}

/**
 * How many home-panel rows fit in the body without scrolling.
 * When `estimateWhenEmpty`, measures from body height before any rows render.
 */
export function useHomePanelRowCapacity(
  bodyRef: RefObject<HTMLDivElement | null>,
  itemCount: number,
  maxRows: number,
  estimateWhenEmpty = false,
  rowHeightPx = DASHBOARD_HOME_LIST_ROW_HEIGHT_PX,
): number {
  const cap = estimateWhenEmpty
    ? maxRows
    : Math.min(maxRows, Math.max(itemCount, 0));

  const [count, setCount] = useState(() =>
    estimateWhenEmpty
      ? Math.max(1, Math.min(maxRows, Math.floor(520 / rowHeightPx)))
      : cap > 0
        ? Math.min(cap, maxRows)
        : 0,
  );

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    const update = () => {
      const list = body.querySelector("ul[role='list']");
      const hasRenderedRows =
        list instanceof HTMLElement && list.childElementCount > 0;
      let next: number;

      if (estimateWhenEmpty && itemCount === 0 && !hasRenderedRows) {
        const available = body.clientHeight;
        next =
          available > 0
            ? Math.max(1, Math.min(maxRows, Math.floor(available / rowHeightPx)))
            : Math.max(1, Math.floor(584 / rowHeightPx));
      } else {
        const fillCap = estimateWhenEmpty ? maxRows : cap;
        next = rowsThatFill(body, fillCap, rowHeightPx);
        if (!estimateWhenEmpty) {
          const measuredRowHeight = measureRowHeight(body, rowHeightPx);
          if (
            list instanceof HTMLElement &&
            measuredRowHeight > 0 &&
            next > 0 &&
            next < fillCap
          ) {
            let slack = body.clientHeight - list.offsetHeight;
            while (next < fillCap && slack >= measuredRowHeight - 2) {
              next += 1;
              slack -= measuredRowHeight;
            }
          }
        }
      }

      setCount((prev) => (prev === next ? prev : next));
    };

    update();
    const frame = requestAnimationFrame(update);
    const frame2 = requestAnimationFrame(update);

    const observer = new ResizeObserver(update);
    observer.observe(body);

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(frame2);
      observer.disconnect();
    };
  }, [bodyRef, cap, estimateWhenEmpty, itemCount, maxRows, rowHeightPx]);

  return count;
}
