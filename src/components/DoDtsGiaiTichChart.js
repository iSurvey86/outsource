"use client";

import React, { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { parseDoDtsNumber } from "../lib/bcksFormRegistry";
import {
  buildDoDtsModelStepSeries,
  buildDoDtsTheorySeries,
  decadeDomain,
  logSpace,
} from "../lib/doDtsVesForward";

function toNum(v) {
  if (v === null || v === undefined || v === "") return NaN;
  const n = parseDoDtsNumber(v);
  return Number.isFinite(n) ? n : NaN;
}

/** Điểm thực đo log–log từ bảng Đo ĐTS */
export function buildDoDtsMeasuredSeries(rows) {
  return (rows || [])
    .map((r) => {
      const ab2 = toNum(r.ab2);
      const rho = toNum(r.rho_k);
      if (!(ab2 > 0) || !(rho > 0)) return null;
      return { ab2, rho };
    })
    .filter(Boolean);
}

const NAME = {
  do: "Thực đo ρₖ",
  lyThuyet: "Lý thuyết (từ mô hình lớp)",
  model: "Mô hình lớp ρ–d",
};

/**
 * Đồ thị log–log gần mẫu Excel/IPI2Win:
 * đen = thực đo · đỏ = lý thuyết forward · xanh = bậc mô hình lớp.
 */
export default function DoDtsGiaiTichChart({ rows, phanTich, diemDo }) {
  const measured = useMemo(() => buildDoDtsMeasuredSeries(rows), [rows]);

  const { xMin, xMax, yMin, yMax } = useMemo(() => {
    const xs = measured.map((p) => p.ab2);
    const ys = measured.map((p) => p.rho);
    for (const row of phanTich || []) {
      const rho = toNum(row?.rho);
      const d = toNum(row?.d);
      const h = toNum(row?.h);
      if (rho > 0) ys.push(rho);
      if (d > 0) {
        xs.push(d);
        xs.push(d * 0.15);
      }
      if (h > 0) xs.push(h);
    }
    const [x0, x1] = decadeDomain(xs.length ? xs : [1, 100], 1, 100);
    const [y0, y1] = decadeDomain(ys.length ? ys : [100, 1000], 100, 1000);
    return { xMin: x0, xMax: x1, yMin: y0, yMax: y1 };
  }, [measured, phanTich]);

  const model = useMemo(
    () => buildDoDtsModelStepSeries(phanTich, xMin, xMax),
    [phanTich, xMin, xMax]
  );

  const theory = useMemo(() => {
    const grid = logSpace(xMin, xMax, 56);
    const measuredAb2 = measured.map((p) => p.ab2);
    const ab2List = [...new Set([...grid, ...measuredAb2])].sort((a, b) => a - b);
    return buildDoDtsTheorySeries(phanTich, ab2List);
  }, [phanTich, measured, xMin, xMax]);

  const measuredData = useMemo(
    () => measured.map((p) => ({ ab2: p.ab2, do: p.rho })),
    [measured]
  );
  const theoryData = useMemo(
    () => theory.map((p) => ({ ab2: p.ab2, lyThuyet: p.rho })),
    [theory]
  );
  const modelData = useMemo(
    () => model.map((p) => ({ ab2: p.ab2, model: p.rho })),
    [model]
  );

  if (!measured.length) {
    return (
      <div className="bcks-do-dts-chart flex h-64 items-center justify-center rounded-lg border border-dashed border-amber-300 bg-white px-4 text-center text-xs text-amber-800/90" data-do-dts-capture="chart">
        Chưa có cặp AB/2 và ρₖ hợp lệ để vẽ. Nhập U, I (hoặc ρₖ) ở bảng trang 1.
      </div>
    );
  }

  return (
    <div className="bcks-do-dts-chart rounded-lg border border-amber-200 bg-white p-2" data-do-dts-capture="chart">
      <p className="mb-1 text-center text-[11px] font-semibold text-amber-950">
        Đồ thị quan hệ điện trở suất và khoảng cách AB/2
        {diemDo ? ` — điểm đo: ${diemDo}` : ""}
      </p>
      <div className="bcks-do-dts-chart-plot h-[280px] w-full min-w-0" style={{ height: 280, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart margin={{ top: 12, right: 28, left: 8, bottom: 18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.55} />
            <XAxis
              dataKey="ab2"
              type="number"
              scale="log"
              domain={[xMin, xMax]}
              allowDataOverflow
              ticks={logTicks(xMin, xMax)}
              tick={{ fontSize: 10 }}
              label={{
                value: "AB/2",
                position: "insideBottomRight",
                offset: 6,
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              scale="log"
              domain={[yMin, yMax]}
              allowDataOverflow
              ticks={logTicks(yMin, yMax)}
              tick={{ fontSize: 10 }}
              width={52}
              label={{
                value: "ρₐ",
                angle: -90,
                position: "insideLeft",
                offset: 8,
                fontSize: 11,
              }}
            />
            <Tooltip
              formatter={(v, name) => [
                typeof v === "number" ? v.toFixed(2) : v,
                NAME[name] || name,
              ]}
              labelFormatter={(x) => `AB/2 = ${Number(x).toPrecision(4)}`}
            />
            {modelData.length > 1 ? (
              <Line
                data={modelData}
                type="linear"
                dataKey="model"
                name="model"
                stroke="#1d4ed8"
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ) : null}
            {theoryData.length > 1 ? (
              <Line
                data={theoryData}
                type="monotone"
                dataKey="lyThuyet"
                name="lyThuyet"
                stroke="#dc2626"
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ) : null}
            <Line
              data={measuredData}
              type="linear"
              dataKey="do"
              name="do"
              stroke="#111827"
              strokeWidth={1.75}
              dot={{ r: 4, fill: "#fff", stroke: "#111827", strokeWidth: 1.75 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div
        className="bcks-do-dts-chart-legend"
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: "12px 20px",
          marginTop: 10,
          marginBottom: 0,
          padding: 0,
          fontSize: 11,
          color: "#334155",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              border: "2px solid #111827",
              background: "#fff",
              display: "inline-block",
            }}
          />
          {NAME.do}
        </span>
        {theoryData.length > 1 ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 20, height: 2, background: "#dc2626", display: "inline-block" }} />
            {NAME.lyThuyet}
          </span>
        ) : null}
        {modelData.length > 1 ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 20, height: 2, background: "#1d4ed8", display: "inline-block" }} />
            {NAME.model}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function logTicks(min, max) {
  const ticks = [];
  const start = Math.floor(Math.log10(min));
  const end = Math.ceil(Math.log10(max));
  for (let e = start; e <= end; e++) {
    const v = 10 ** e;
    if (v >= min * 0.999 && v <= max * 1.001) ticks.push(v);
  }
  return ticks.length ? ticks : undefined;
}
