"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_PREFIX = "outsrc-table-cols:";

function loadWidths(tableId, defaults) {
  if (typeof window === "undefined") return [...defaults];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${tableId}`);
    if (!raw) return [...defaults];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== defaults.length) return [...defaults];
    return parsed.map((w, i) => {
      const n = Number(w);
      const min = defaults[i] * 0.5;
      return Number.isFinite(n) && n >= min ? Math.round(n) : defaults[i];
    });
  } catch {
    return [...defaults];
  }
}

function saveWidths(tableId, widths) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${tableId}`, JSON.stringify(widths));
  } catch {
    /* quota / private mode */
  }
}

function sumArr(arr) {
  return arr.reduce((s, w) => s + w, 0);
}

/**
 * Phân bổ trọng số → px vừa khít containerWidth (làm tròn, chỉnh cột cuối).
 */
function weightsToPixels(weights, containerWidth, mins) {
  const sum = sumArr(weights);
  if (sum <= 0 || containerWidth <= 0) {
    return weights.map((w) => Math.round(w));
  }
  const raw = weights.map((w, i) => {
    const ideal = (w / sum) * containerWidth;
    const min = mins?.[i] ?? Math.round((w || 80) * 0.45);
    return Math.max(min, ideal);
  });
  // Nếu min làm vượt container → co tỉ lệ về đúng container
  let total = sumArr(raw);
  if (total > containerWidth) {
    const scale = containerWidth / total;
    for (let i = 0; i < raw.length; i++) {
      const min = mins?.[i] ?? 24;
      raw[i] = Math.max(min, raw[i] * scale);
    }
    total = sumArr(raw);
  }
  const rounded = raw.map((w) => Math.round(w));
  let drift = containerWidth - sumArr(rounded);
  // Đẩy phần dư vào cột linh hoạt nhất (rộng nhất)
  let flexIdx = 0;
  for (let i = 1; i < rounded.length; i++) {
    if (rounded[i] >= rounded[flexIdx]) flexIdx = i;
  }
  rounded[flexIdx] = Math.max(mins?.[flexIdx] ?? 24, rounded[flexIdx] + drift);
  return rounded;
}

/**
 * Độ rộng cột bảng — lưu localStorage theo tableId.
 * @param {string} tableId
 * @param {number[]} defaultWidths — trọng số / px mẫu (tỉ lệ)
 * @param {{ fitContainer?: boolean }} [options]
 *   fitContainer: bảng luôn = 100% chiều rộng khung (sidebar / panel trình duyệt đổi → tự căn)
 */
export function useResizableTableColumns(tableId, defaultWidths, options = {}) {
  const fitContainer = Boolean(options.fitContainer);
  const defaultsRef = useRef(defaultWidths);
  const [containerEl, setContainerEl] = useState(null);
  const containerRef = useCallback((node) => {
    setContainerEl(node);
  }, []);
  const [weights, setWeights] = useState(() => loadWidths(tableId, defaultWidths));
  const [containerWidth, setContainerWidth] = useState(0);
  const dragRef = useRef(null);

  useEffect(() => {
    defaultsRef.current = defaultWidths;
    setWeights(loadWidths(tableId, defaultWidths));
  }, [tableId, defaultWidths.length, defaultWidths.join(",")]);

  useEffect(() => {
    if (!fitContainer || !containerEl || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const apply = (width) => {
      const w = Math.floor(width);
      if (w > 0) setContainerWidth((prev) => (prev === w ? prev : w));
    };

    apply(containerEl.clientWidth);
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      apply(entry.contentRect.width);
    });
    ro.observe(containerEl);
    return () => ro.disconnect();
  }, [fitContainer, containerEl]);

  const widths = useMemo(() => {
    if (!fitContainer) return weights;
    if (containerWidth <= 0) return weights;
    const colMins = defaultsRef.current.map((w) => Math.max(28, Math.round((w || 80) * 0.4)));
    return weightsToPixels(weights, containerWidth, colMins);
  }, [fitContainer, weights, containerWidth, defaultWidths.length, defaultWidths.join(",")]);

  const persist = useCallback(
    (next) => {
      setWeights(next);
      saveWidths(tableId, next);
    },
    [tableId]
  );

  const startResize = useCallback(
    (columnIndex, startX) => {
      const startWeights = [...weights];
      const startPx = widths[columnIndex];
      const colMins = defaultsRef.current.map((w) => Math.max(28, Math.round((w || 80) * 0.4)));
      const minW = colMins[columnIndex] ?? Math.round((defaultsRef.current[columnIndex] || 80) * 0.45);
      const boxW =
        fitContainer && containerWidth > 0
          ? containerWidth
          : Math.max(sumArr(widths), sumArr(startWeights));

      dragRef.current = { columnIndex, startX, startWeights, startPx, minW, boxW, colMins };

      const onMove = (e) => {
        const drag = dragRef.current;
        if (!drag) return;
        const dx = e.clientX - drag.startX;
        const newPx = Math.max(drag.minW, drag.startPx + dx);

        if (!fitContainer) {
          const next = [...drag.startWeights];
          next[drag.columnIndex] = Math.round(newPx);
          setWeights(next);
          return;
        }

        // Fit: đổi trọng số cột đang kéo; các cột còn lại giữ tỉ lệ tương đối, tổng = boxW
        const othersSum = sumArr(drag.startWeights) - drag.startWeights[drag.columnIndex];
        const next = [...drag.startWeights];
        next[drag.columnIndex] = newPx;
        const remain = Math.max(drag.boxW - newPx, drag.minW);
        if (othersSum > 0) {
          for (let i = 0; i < next.length; i++) {
            if (i === drag.columnIndex) continue;
            next[i] = (drag.startWeights[i] / othersSum) * remain;
          }
        }
        setWeights(next.map((w) => Math.max(1, Math.round(w * 1000) / 1000)));
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        dragRef.current = null;
        setWeights((current) => {
          const toSave = current.map((w) => Math.max(1, Math.round(w)));
          saveWidths(tableId, toSave);
          return toSave;
        });
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [tableId, weights, widths, fitContainer, containerWidth]
  );

  const totalWidth = fitContainer
    ? containerWidth > 0
      ? containerWidth
      : sumArr(weights)
    : sumArr(widths);

  return {
    widths,
    startResize,
    totalWidth,
    persist,
    containerRef,
    fitContainer,
  };
}

export function tableColGroup(widths) {
  return widths.map((w, i) => ({ key: `col-${i}`, width: w }));
}
