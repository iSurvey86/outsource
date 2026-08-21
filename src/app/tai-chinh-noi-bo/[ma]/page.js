"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { loadAuthSession } from "../../../lib/authSession";
import {
  canSuaChiaNoiBo,
  canSeeChiaNoiBo,
  canAccessDuAn,
  filterDuAnForUser,
} from "../../../lib/menuAccess";
import {
  formatPct,
  formatVnd,
  formatVndShort,
  giaTriBenB,
  parseVndInput,
  applyVndLiveInput,
  tongNhanTuA,
  tongTamUngTuA,
  tongThanhToanTuA,
} from "../../../lib/finance";
import { fetchDb, logActivity, replaceChiaNoiBo, uid } from "../../../lib/store";
import { useAppDialog } from "../../../components/AppDialog";

/** Chi tiết: gộp dự án → chia 1 lần trên tổng đã nhận từ A. */
export default function TaiChinhNoiBoDetailPage() {
  const router = useRouter();
  const params = useParams();
  const maRaw = decodeURIComponent(String(params?.ma || ""));
  const { showAlert } = useAppDialog();

  const [db, setDb] = useState(null);
  const [user, setUser] = useState(null);
  const [perms, setPerms] = useState(null);
  /** @type {"ty_le" | "so_cung"} */
  const [cheDo, setCheDo] = useState("ty_le");
  const [drafts, setDrafts] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const { user: u, perms: p } = loadAuthSession();
    setUser(u);
    setPerms(p);
    if (!canSeeChiaNoiBo(u, p)) {
      router.replace("/");
      return;
    }
    fetchDb().then(setDb);
  }, [router]);

  const duAn = useMemo(() => {
    if (!db || !user || !maRaw) return null;
    const list = filterDuAnForUser(db.duAn || [], user);
    return (
      list.find((d) => String(d.ma_du_an || "") === maRaw) ||
      list.find((d) => String(d.ma_du_an || "").toLowerCase() === maRaw.toLowerCase()) ||
      null
    );
  }, [db, user, maRaw]);

  const duAnId = duAn?.id || "";

  const gdList = useMemo(
    () => (db?.giaoDich || []).filter((g) => g.du_an_id === duAnId),
    [db, duAnId]
  );

  const tongTu = tongTamUngTuA(gdList);
  const tongTt = tongThanhToanTuA(gdList);
  const tongNhan = tongNhanTuA(gdList);
  const phanB = duAn ? giaTriBenB(duAn) : 0;

  useEffect(() => {
    if (!db || !duAnId) return;
    const rows = db.chiaNoiBo.filter((c) => c.du_an_id === duAnId);
    const benBUsers = (db.users || []).filter(
      (u) => u.phe === "ben_b" && u.trang_thai === "active"
    );
    const base = tongNhanTuA(
      (db.giaoDich || []).filter((g) => g.du_an_id === duAnId)
    );

    setDrafts(
      benBUsers.map((u) => {
        const existing = rows.find((r) => r.nguoi_dung_id === u.id);
        const tyLe = existing ? Number(existing.ty_le) || 0 : 0;
        const soTien = base > 0 && tyLe > 0 ? Math.round(base * tyLe) : 0;
        return {
          nguoi_dung_id: u.id,
          ho_ten: u.ho_ten,
          ty_le: tyLe,
          soTienText: soTien > 0 ? formatVndShort(soTien) : "",
          ghi_chu: existing?.ghi_chu || "",
        };
      })
    );
    setCheDo("ty_le");
  }, [db, duAnId]);

  const sumTyLe = drafts.reduce((s, d) => s + Number(d.ty_le || 0), 0);
  const sumSoCung = drafts.reduce(
    (s, d) => s + Math.round(parseVndInput(d.soTienText)),
    0
  );
  const canEdit = canSuaChiaNoiBo(user, perms);

  function patchDraft(idx, patch) {
    setDrafts((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  function onChangeTyLe(idx, raw) {
    const ty = Math.max(0, Math.min(1, Number(raw) || 0));
    const so = tongNhan > 0 && ty > 0 ? Math.round(tongNhan * ty) : 0;
    patchDraft(idx, {
      ty_le: ty,
      soTienText: so > 0 ? formatVndShort(so) : "",
    });
  }

  function onChangeSoCung(idx, el) {
    const { text, caret } = applyVndLiveInput(el.value, el.selectionStart);
    const so = Math.round(parseVndInput(text));
    const ty = tongNhan > 0 ? so / tongNhan : 0;
    patchDraft(idx, {
      soTienText: text,
      ty_le: Number.isFinite(ty) ? ty : 0,
    });
    requestAnimationFrame(() => {
      try {
        el.setSelectionRange(caret, caret);
      } catch {
        /* ignore */
      }
    });
  }

  async function save() {
    if (!canEdit || !duAnId) return;

    if (cheDo === "ty_le") {
      if (Math.abs(sumTyLe - 1) > 0.001) {
        await showAlert("Tổng tỷ lệ phải = 100%.");
        return;
      }
    } else {
      if (!(tongNhan > 0)) {
        await showAlert("Chưa có tiền nhận từ A — chưa chia số cứng được.");
        return;
      }
      if (Math.abs(sumSoCung - tongNhan) > 1) {
        await showAlert(
          `Tổng số cứng phải bằng tổng đã nhận từ A (${formatVnd(tongNhan)}).`
        );
        return;
      }
    }

    const rows = drafts
      .map((d) => {
        let tyLe = Number(d.ty_le) || 0;
        if (cheDo === "so_cung") {
          const so = Math.round(parseVndInput(d.soTienText));
          tyLe = tongNhan > 0 ? so / tongNhan : 0;
        }
        return {
          id: uid("cn"),
          du_an_id: duAnId,
          nguoi_dung_id: d.nguoi_dung_id,
          ty_le: tyLe,
          ghi_chu: d.ghi_chu || "",
          _keep: tyLe > 0,
        };
      })
      .filter((r) => r._keep)
      .map(({ _keep, ...r }) => r);

    setSaving(true);
    try {
      await replaceChiaNoiBo(duAnId, rows);
      await logActivity({
        username: user.username,
        ho_ten: user.ho_ten,
        phan_he: "chia_noi_bo",
        hanh_dong: "LUU",
        chi_tiet: `${duAn?.ma_du_an || duAnId} · ${cheDo} · gốc ${formatVnd(tongNhan)}`,
      });
      setDb(await fetchDb());
      await showAlert("Đã lưu bảng chia nội bộ.");
    } catch (err) {
      await showAlert(err.message || "Lỗi lưu");
    } finally {
      setSaving(false);
    }
  }

  if (!db || !user) {
    return <p className="text-sm font-bold text-teal-800">Đang tải…</p>;
  }

  if (!duAn || !canAccessDuAn(duAn, user)) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-bold text-rose-700">Không tìm thấy dự án hoặc không có quyền.</p>
        <Link href="/tai-chinh-noi-bo" className="text-sm font-bold text-blue-700 hover:underline">
          ← Danh sách tài chính nội bộ
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/tai-chinh-noi-bo"
          className="inline-flex items-center gap-1 text-sm font-bold text-indigo-700 hover:text-teal-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Danh sách
        </Link>
        <header className="mt-2">
          <h1 className="text-2xl font-black text-indigo-950">{duAn.ten}</h1>
          <p className="mt-0.5 text-sm font-semibold text-indigo-700">{duAn.ma_du_an}</p>
        </header>
      </div>

      <div className="grid gap-3 rounded-2xl border border-teal-200 bg-teal-50/60 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Tạm ứng từ A" value={formatVnd(tongTu)} />
        <SummaryCard label="Thanh toán từ A" value={formatVnd(tongTt)} />
        <SummaryCard label="Tổng đã nhận (gốc chia)" value={formatVnd(tongNhan)} emphasize />
        <SummaryCard label="Phần B theo GTV (đối chiếu)" value={formatVnd(phanB)} muted />
      </div>

      {tongNhan <= 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
          Chưa ghi nhận tiền từ A trên sổ A↔B. Có thể nhập sẵn tỷ lệ; số cứng chỉ dùng khi đã có tổng
          nhận.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <ModeBtn active={cheDo === "ty_le"} onClick={() => setCheDo("ty_le")} disabled={!canEdit}>
          Theo tỷ lệ
        </ModeBtn>
        <ModeBtn
          active={cheDo === "so_cung"}
          onClick={() => setCheDo("so_cung")}
          disabled={!canEdit || tongNhan <= 0}
        >
          Số cứng
        </ModeBtn>
        <span className="self-center text-xs font-semibold text-indigo-800">
          {cheDo === "ty_le" ? (
            <>
              Tổng %:{" "}
              <span className={Math.abs(sumTyLe - 1) < 0.001 ? "text-emerald-700" : "text-rose-700"}>
                {formatPct(sumTyLe)}
              </span>
            </>
          ) : (
            <>
              Tổng nhập:{" "}
              <span
                className={
                  Math.abs(sumSoCung - tongNhan) <= 1 ? "text-emerald-700" : "text-rose-700"
                }
              >
                {formatVnd(sumSoCung)}
              </span>
              {" / "}
              {formatVnd(tongNhan)}
            </>
          )}
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-indigo-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-indigo-100 text-xs font-black uppercase text-indigo-950">
            <tr>
              <th className="w-12 px-3 py-3">STT</th>
              <th className="px-4 py-3">Thành viên</th>
              <th className="px-4 py-3">{cheDo === "ty_le" ? "Tỷ lệ (%)" : "Số cứng"}</th>
              <th className="px-4 py-3">Được chia</th>
              <th className="px-4 py-3">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((d, idx) => {
              const soHien =
                cheDo === "so_cung"
                  ? Math.round(parseVndInput(d.soTienText))
                  : tongNhan > 0
                    ? Math.round(tongNhan * Number(d.ty_le || 0))
                    : 0;
              return (
                <tr key={d.nguoi_dung_id} className="border-t border-indigo-100">
                  <td className="px-3 py-3 tabular-nums text-indigo-700">{idx + 1}</td>
                  <td className="px-4 py-3 font-bold text-indigo-950">{d.ho_ten}</td>
                  <td className="px-4 py-3">
                    {cheDo === "ty_le" ? (
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        disabled={!canEdit}
                        className="w-24 rounded-lg border border-indigo-300 bg-indigo-50 px-2 py-1 font-bold tabular-nums text-indigo-950 disabled:opacity-60"
                        value={
                          Number(d.ty_le) ? Math.round(Number(d.ty_le) * 1000) / 10 : ""
                        }
                        placeholder="0"
                        onChange={(e) => {
                          const pct = Number(e.target.value);
                          onChangeTyLe(idx, Number.isFinite(pct) ? pct / 100 : 0);
                        }}
                      />
                    ) : (
                      <input
                        type="text"
                        inputMode="numeric"
                        disabled={!canEdit}
                        className="w-36 rounded-lg border border-indigo-300 bg-indigo-50 px-2 py-1 font-bold tabular-nums text-indigo-950 disabled:opacity-60"
                        value={d.soTienText}
                        placeholder="0"
                        onChange={(e) => onChangeSoCung(idx, e.target)}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 font-black tabular-nums text-blue-900">
                    {soHien > 0 ? formatVnd(soHien) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      disabled={!canEdit}
                      className="w-full rounded-lg border border-indigo-300 bg-indigo-50 px-2 py-1 font-medium text-indigo-950 disabled:opacity-60"
                      value={d.ghi_chu}
                      onChange={(e) => patchDraft(idx, { ghi_chu: e.target.value })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canEdit ? (
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded-xl bg-gradient-to-r from-indigo-600 to-teal-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-60"
        >
          {saving ? "Đang lưu…" : "Lưu bảng chia nội bộ"}
        </button>
      ) : (
        <p className="text-sm font-medium text-teal-800">Bạn chỉ có quyền xem.</p>
      )}
    </div>
  );
}

function SummaryCard({ label, value, emphasize = false, muted = false }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${
        emphasize
          ? "border-teal-400 bg-white"
          : muted
            ? "border-indigo-100 bg-white/70"
            : "border-teal-200 bg-white"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-teal-800">{label}</p>
      <p
        className={`mt-0.5 font-black tabular-nums ${
          emphasize ? "text-teal-900" : muted ? "text-indigo-700" : "text-indigo-950"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ModeBtn({ active, onClick, disabled, children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
        active
          ? "bg-indigo-700 text-white"
          : "border border-indigo-300 bg-white text-indigo-900 hover:bg-indigo-50"
      }`}
    >
      {children}
    </button>
  );
}
