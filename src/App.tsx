/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ===== Types =====
type Timeframe = "hourly" | "daily" | "weekly" | "monthly";

type Point = { date: string | number; close: number };

// ===== Tabs =====
const TABS: { label: string; key: Timeframe }[] = [
  { label: "Daily", key: "daily" },
  { label: "Hourly", key: "hourly" },
  { label: "Weekly", key: "weekly" },
  { label: "Monthly", key: "monthly" },
];

// ===== Utils =====
function toPoints(raw: unknown): Point[] {
  // Lấy mảng dữ liệu từ nhiều cấu trúc phổ biến
  const pickArray = (x: any): any[] => {
    if (Array.isArray(x)) return x;
    if (Array.isArray(x?.data)) return x.data;
    if (Array.isArray(x?.candles)) return x.candles; // <— API của bạn
    if (Array.isArray(x?.results)) return x.results;
    return [];
  };

  // Chuẩn hoá thời gian: nếu là giây thì đổi sang ms để Date hiển thị đúng
  const normalizeTime = (t: any): number | string => {
    if (typeof t === "number") {
      return t < 1e12 ? t * 1000 : t; // 1710000000 -> 1710000000000
    }
    return t;
  };

  const src = pickArray(raw);

  return src
    .map((it: any) => {
      // Dạng mảng: [t, o, h, l, c, v?]
      if (Array.isArray(it) && it.length >= 5) {
        const [t, , , , c] = it;
        if (t != null && c != null) {
          return { date: normalizeTime(t), close: Number(c) } as Point;
        }
      }

      // Dạng object: có thể là { date/time/t, close/c }
      if (it && typeof it === "object") {
        const t = it.date ?? it.time ?? it.t ?? it.timestamp ?? it.start;
        const c = it.close ?? it.c ?? it.price ?? it.vwap;
        if (t != null && c != null) {
          return { date: normalizeTime(t), close: Number(c) } as Point;
        }
      }

      return null;
    })
    .filter(Boolean) as Point[];
}

function formatDateLabel(v: string | number, tf: Timeframe): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  if (tf === "hourly")
    return d.toLocaleString(undefined, {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  if (tf === "monthly")
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

function niceDomain(values: number[]): [number, number] | ["auto", "auto"] {
  if (!values.length) return ["auto", "auto"];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.05 || Math.max(1, max * 0.02);
  return [Math.max(0, min - pad), max + pad];
}

// ===== Component =====
export default function TSLAChartCSS() {
  const [tf, setTf] = useState<Timeframe>("daily"); // default: Daily
  const [data, setData] = useState<Point[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Record<Timeframe, Point[]>>({} as any);

  useEffect(() => {
    let ignore = false;
    const cached = cacheRef.current[tf];
    if (cached) {
      setData(cached);
      return;
    }

    const controller = new AbortController();
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const url = `https://chart.stockscan.io/candle/v3/TSLA/${tf}/NASDAQ`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        const pts = toPoints(json);
        if (!ignore) {
          cacheRef.current[tf] = pts;
          setData(pts);
        }
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setError(e?.message || "Không lấy được dữ liệu");
      } finally {
        setLoading(false);
      }
    }
    run();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [tf]);

  const domain = useMemo(() => niceDomain(data.map((d) => d.close)), [data]);

  return (
    <div className="tsla-root">
      <style>
  {`
    .tsla-root {
      height: 100vh; 
      width: 100vw;
      background:#fff;
      margin:0;
      padding:0;
      box-sizing:border-box;
    }
    .tsla-wrap {
      height: 100%;
      width: 100%;
    }
    .tsla-card {
      border: 2px solid #111;
      border-radius: 2px;
      background: #fff;
      height: 100%;
      width: 100%;
      display: flex;
      flex-direction: column;
    }
    .tsla-tabs {
      display:flex;
      gap:24px;
      padding:12px 24px 8px;
      font-size:16px;
      line-height:1;
    }
    .tsla-tab { color:#222; background:transparent; border:none; padding:0; cursor:pointer; font: inherit; }
    .tsla-tab:hover { opacity:0.75; }
    .tsla-tab.active { color:#F59E0B; font-weight:600; }

    .tsla-chart {
      flex:1;   /* chart chiếm hết phần còn lại */
      width:90%;
    }

    .tsla-loading {
      display:flex; align-items:center; justify-content:center;
      height:100%; color:#666;
      animation: tsla-pulse 1.5s ease-in-out infinite;
    }
    @keyframes tsla-pulse { 0%{opacity:.5} 50%{opacity:1} 100%{opacity:.5} }
    .tsla-error { margin:8px 16px; background:#FEF2F2; border:1px solid #FECACA; color:#991B1B; padding:8px; border-radius:6px; font-size:14px; }
  `}
</style>

      <div className="tsla-wrap">
        <div className="tsla-card">
          <div className="tsla-tabs">
            {TABS.map(({ label, key }) => (
              <button
                key={key}
                onClick={() => setTf(key)}
                className={`tsla-tab ${tf === key ? "active" : ""}`}
                aria-pressed={tf === key}
              >
                {label}
              </button>
            ))}
          </div>

          {error && <div className="tsla-error">Lỗi tải dữ liệu: {error}</div>}

          <div className="tsla-chart">
            {loading ? (
              <div className="tsla-loading">Đang tải dữ liệu…</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data}
                  margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                >
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={{ stroke: "#111", strokeWidth: 2 }}
                    minTickGap={20}
                    tickFormatter={(v) => formatDateLabel(v as any, tf)}
                  />
                  <YAxis
                    dataKey="close"
                    tickLine={false}
                    axisLine={{ stroke: "#111", strokeWidth: 2 }}
                    domain={domain as any}
                    width={64}
                    tickFormatter={(v) =>
                      (typeof v === "number" ? v : Number(v)).toLocaleString(
                        undefined,
                        { maximumFractionDigits: 2 }
                      )
                    }
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      Number(value).toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      }),
                      name === "close" ? "Close" : name,
                    ]}
                    labelFormatter={(label: any) => formatDateLabel(label, tf)}
                    key={tf}
                  />
                  <Line
                    type="monotone"
                    dataKey="close"
                    stroke="#2563eb"       // đảm bảo có màu
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
