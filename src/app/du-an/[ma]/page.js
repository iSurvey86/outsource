"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { loadAuthSession, isBenB } from "../../../lib/authSession";
import { canLapKs, canSuaChiaNoiBo } from "../../../lib/menuAccess";
import {
  KS_MODULE_DEFS,
  conLai,
  formatPct,
  formatVnd,
  giaTriBenB,
  tamUngKyVong,
  tongThu,
} from "../../../lib/finance";
import { fetchDb, logActivity, insertRow, updateRow, uid } from "../../../lib/store";
import { KsStatusChip, PipelineChip } from "../../../components/StatusChip";
import { useAppDialog } from "../../../components/AppDialog";

export default function DuAnWorkspacePage() {
  const params = useParams();
  const ma = decodeURIComponent(params.ma || "");
  const { showAlert } = useAppDialog();
  const [tick, setTick] = useState(0);
  const [bundle, setBundle] = useState(undefined);
  const [user, setUser] = useState(null);
  const [perms, setPerms] = useState(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadKho, setUploadKho] = useState("khao_sat");
  const [gdForm, setGdForm] = useState({ loai: "tam_ung", so_tien: "", noi_dung: "" });

  useEffect(() => {
    const { user: u, perms: p } = loadAuthSession();
    setUser(u);
    setPerms(p);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchDb()
      .then((db) => {
        if (cancelled) return;
        const duAn = db.duAn.find((d) => d.ma_du_an === ma);
        if (!duAn) {
          setBundle(null);
          return;
        }
        setBundle({
          db,
          duAn,
          benAUser: db.users.find((u) => u.id === duAn.ben_a_user_id),
          moc: db.moc.filter((m) => m.du_an_id === duAn.id).sort((a, b) => a.thu_tu - b.thu_tu),
          ks: db.ksModules.filter((k) => k.du_an_id === duAn.id),
          gd: db.giaoDich.filter((g) => g.du_an_id === duAn.id),
          tl: db.taiLieu.filter((t) => t.du_an_id === duAn.id),
          chia: db.chiaNoiBo.filter((c) => c.du_an_id === duAn.id),
        });
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [ma, tick]);

  function refresh() {
    setTick((t) => t + 1);
  }

  if (!user || bundle === undefined) {
    return <p className="text-sm font-bold text-teal-800">Đang tải…</p>;
  }
  if (!bundle) {
    return (
      <div>
        <p className="font-bold text-rose-700">Không tìm thấy dự án {ma}</p>
        <Link href="/du-an" className="mt-2 inline-block text-sm font-bold text-blue-700">
          ← Danh mục
        </Link>
      </div>
    );
  }

  const { duAn, benAUser, moc, ks, gd, tl, chia, db } = bundle;
  const benBUser = isBenB(user);
  const canWorkKs = canLapKs(user, perms);

  async function setKsStatus(loai, trang_thai) {
    if (!canWorkKs) return;
    const row = ks.find((k) => k.loai === loai);
    if (!row) return;
    try {
      await updateRow("ks_module", row.id, { trang_thai });
      if (trang_thai === "da_xuat_ban") {
        await insertRow("tai_lieu", {
          id: uid("tl"),
          du_an_id: duAn.id,
          loai_kho: "khao_sat",
          nguon: "xuat_ban",
          ten_file: `${loai.toUpperCase()}-${duAn.ma_du_an}.pdf`,
          ghi_chu: `Xuất bản từ module ${loai}`,
          nguoi_up_id: user.id,
          thoi_gian: new Date().toISOString(),
          module_loai: loai,
          storage_path: null,
        });
      }
      await logActivity({
        username: user.username,
        ho_ten: user.ho_ten,
        phan_he: "khao_sat",
        hanh_dong: trang_thai === "da_xuat_ban" ? "XUAT_BAN" : "CAP_NHAT",
        chi_tiet: `${duAn.ma_du_an} / ${loai} → ${trang_thai}`,
      });
      refresh();
    } catch (err) {
      showAlert(err.message || "Lỗi cập nhật KS");
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!uploadName.trim()) return;
    try {
      await insertRow("tai_lieu", {
        id: uid("tl"),
        du_an_id: duAn.id,
        loai_kho: uploadKho,
        nguon: "upload",
        ten_file: uploadName.trim(),
        ghi_chu: "Upload thủ công (metadata)",
        nguoi_up_id: user.id,
        thoi_gian: new Date().toISOString(),
        module_loai: null,
        storage_path: null,
      });
      await logActivity({
        username: user.username,
        ho_ten: user.ho_ten,
        phan_he: "ho_so",
        hanh_dong: "UPLOAD",
        chi_tiet: `${uploadKho}: ${uploadName}`,
      });
      setUploadName("");
      refresh();
      showAlert("Đã ghi nhận tài liệu.");
    } catch (err) {
      showAlert(err.message || "Lỗi upload");
    }
  }

  async function handleAddGd(e) {
    e.preventDefault();
    try {
      await insertRow("giao_dich", {
        id: uid("gd"),
        du_an_id: duAn.id,
        loai: gdForm.loai,
        so_tien: Number(gdForm.so_tien) || 0,
        ngay: new Date().toISOString().slice(0, 10),
        noi_dung: gdForm.noi_dung || "",
        nguoi_tao_id: user.id,
      });
      await logActivity({
        username: user.username,
        ho_ten: user.ho_ten,
        phan_he: "tai_chinh",
        hanh_dong: "GHI_GD",
        chi_tiet: `${gdForm.loai} ${gdForm.so_tien}`,
      });
      setGdForm({ loai: "tam_ung", so_tien: "", noi_dung: "" });
      refresh();
    } catch (err) {
      showAlert(err.message || "Lỗi ghi giao dịch");
    }
  }

  const tlKs = tl.filter((t) => t.loai_kho === "khao_sat");
  const tlTk = tl.filter((t) => t.loai_kho === "thiet_ke");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/du-an" className="text-sm font-bold text-blue-700 hover:text-teal-700">
          ← Danh mục dự án
        </Link>
        <PipelineChip status={duAn.trang_thai} />
      </div>

      {/* Thông tin chung — kiểu ksnpsc */}
      <section className="rounded-2xl border border-sky-200 bg-white p-5 shadow-sm shadow-sky-100">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-teal-600">
              {duAn.ma_du_an} · {duAn.giai_doan || "—"}
            </p>
            <h1 className="mt-1 text-2xl font-black text-blue-950">{duAn.ten}</h1>
          </div>
          <div className="rounded-xl bg-teal-50 px-3 py-2 text-right text-xs font-bold text-teal-900 ring-1 ring-teal-200">
            <p>Nguồn GT: {duAn.nguon_gia_tri === "hop_dong" ? "HĐ tư vấn" : "PAĐT tạm tính"}</p>
            <p className="mt-1 text-sm tabular-nums text-blue-900">
              GT TV {formatVnd(duAn.gia_tri_tu_van)}
            </p>
          </div>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Chủ đầu tư" value={duAn.chu_dau_tu} />
          <Info label="Quy mô" value={duAn.quy_mo} />
          <Info label="Địa điểm" value={duAn.dia_diem} />
          <Info
            label="Bên A giao việc"
            value={
              benAUser
                ? `${benAUser.ho_ten}${benAUser.username ? ` (${benAUser.username})` : ""}`
                : null
            }
          />
        </dl>
        <div className="mt-4 grid gap-3 rounded-xl bg-sky-50 p-3 sm:grid-cols-3">
          <MiniMoney label="Phần B (25%)" value={formatVnd(giaTriBenB(duAn))} />
          <MiniMoney label="Tạm ứng kỳ vọng" value={formatVnd(tamUngKyVong(duAn))} />
          <MiniMoney label="Còn lại" value={formatVnd(conLai(duAn, gd))} />
        </div>
      </section>

      {/* Tiến độ */}
      <section className="rounded-2xl border border-teal-200 bg-white p-5">
        <h2 className="text-sm font-black uppercase tracking-wide text-teal-900">Tiến độ</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {moc.map((m) => (
            <div
              key={m.id}
              className="min-w-[160px] flex-1 rounded-xl border border-teal-200 bg-teal-50 px-3 py-3"
            >
              <p className="font-black text-teal-950">{m.ten}</p>
              <p className="mt-1 text-xs font-semibold text-blue-800">Hạn: {m.han || "—"}</p>
              <p className="mt-2 text-xs font-bold uppercase text-teal-700">{m.trang_thai}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Khảo sát */}
      <section className="rounded-2xl border border-blue-200 bg-white p-5">
        <h2 className="text-sm font-black uppercase tracking-wide text-blue-900">
          Khảo sát {benBUser ? "(lập / xuất bản)" : "(chỉ trạng thái)"}
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {KS_MODULE_DEFS.map((def) => {
            const row = ks.find((k) => k.loai === def.key) || {
              trang_thai: "chua_lam",
            };
            return (
              <div
                key={def.key}
                className="rounded-xl border border-sky-200 bg-sky-50/80 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-black text-blue-950">{def.ten}</p>
                  <KsStatusChip status={row.trang_thai} />
                </div>
                {canWorkKs ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <SmallBtn onClick={() => setKsStatus(def.key, "dang_lam")}>Đang làm</SmallBtn>
                    <SmallBtn onClick={() => setKsStatus(def.key, "da_xuat_ban")} tone="emerald">
                      Lưu → Xuất bản
                    </SmallBtn>
                  </div>
                ) : (
                  <p className="mt-2 text-xs font-medium text-teal-800">
                    {row.trang_thai === "da_xuat_ban"
                      ? "Đã xuất bản — xem tại Hồ sơ khảo sát bên dưới."
                      : "Bên A chỉ theo dõi trạng thái."}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Hồ sơ khảo sát */}
      <HoSoSection
        title="Hồ sơ khảo sát (xem chung)"
        hint="Nhận bản xuất bản NVKS/PAKTKS/… và upload tay (mặt cắt, mặt bằng…)"
        items={tlKs}
        users={db.users}
      />

      {/* Hồ sơ thiết kế */}
      <HoSoSection
        title="Hồ sơ thiết kế (xem chung)"
        hint="Chỉ upload thủ công"
        items={tlTk}
        users={db.users}
      />

      {/* Upload chung */}
      <form
        onSubmit={handleUpload}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-sky-200 bg-white p-4"
      >
        <label className="text-xs font-bold text-blue-900">
          Kho
          <select
            className="mt-1 block rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-blue-950"
            value={uploadKho}
            onChange={(e) => setUploadKho(e.target.value)}
          >
            <option value="khao_sat">Hồ sơ khảo sát</option>
            <option value="thiet_ke">Hồ sơ thiết kế</option>
          </select>
        </label>
        <label className="min-w-[200px] flex-1 text-xs font-bold text-blue-900">
          Tên file
          <input
            className="mt-1 w-full rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-blue-950"
            value={uploadName}
            onChange={(e) => setUploadName(e.target.value)}
            placeholder="VD: mat-cat-A.pdf"
          />
        </label>
        <button
          type="submit"
          className="rounded-xl bg-gradient-to-r from-blue-600 to-teal-600 px-4 py-2 text-sm font-black text-white"
        >
          Upload metadata
        </button>
      </form>

      {/* Tài chính A↔B */}
      <section className="rounded-2xl border border-emerald-200 bg-white p-5">
        <h2 className="text-sm font-black uppercase tracking-wide text-emerald-900">
          Tài chính A↔B (chung)
        </h2>
        <p className="mt-1 text-xs font-medium text-teal-800">
          Đã thu {formatVnd(tongThu(gd))} · Còn lại {formatVnd(conLai(duAn, gd))}
        </p>
        <ul className="mt-3 divide-y divide-emerald-100">
          {gd.map((g) => (
            <li key={g.id} className="flex justify-between py-2 text-sm">
              <span className="font-semibold text-emerald-950">
                {g.ngay} · {g.loai} · {g.noi_dung || "—"}
              </span>
              <span className="font-black tabular-nums text-blue-900">
                {formatVnd(g.so_tien)}
              </span>
            </li>
          ))}
          {!gd.length ? (
            <li className="py-2 text-sm font-medium text-teal-700">Chưa có giao dịch.</li>
          ) : null}
        </ul>
        {benBUser ? (
          <form onSubmit={handleAddGd} className="mt-4 grid gap-2 sm:grid-cols-4">
            <select
              className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-950"
              value={gdForm.loai}
              onChange={(e) => setGdForm({ ...gdForm, loai: e.target.value })}
            >
              <option value="tam_ung">Tạm ứng</option>
              <option value="thanh_toan">Thanh toán</option>
              <option value="chi_phi">Chi phí</option>
            </select>
            <input
              required
              type="number"
              placeholder="Số tiền"
              className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-950"
              value={gdForm.so_tien}
              onChange={(e) => setGdForm({ ...gdForm, so_tien: e.target.value })}
            />
            <input
              placeholder="Nội dung"
              className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-950"
              value={gdForm.noi_dung}
              onChange={(e) => setGdForm({ ...gdForm, noi_dung: e.target.value })}
            />
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-2 text-sm font-black text-white"
            >
              Ghi nhận
            </button>
          </form>
        ) : null}
      </section>

      {/* Tài chính nội bộ — chỉ B */}
      {benBUser ? (
        <section className="rounded-2xl border border-indigo-200 bg-white p-5">
          <h2 className="text-sm font-black uppercase tracking-wide text-indigo-900">
            Tài chính nội bộ (riêng Bên B)
          </h2>
          <ul className="mt-3 space-y-2">
            {chia.map((c) => {
              const u = db.users.find((x) => x.id === c.nguoi_dung_id);
              return (
                <li
                  key={c.id}
                  className="flex justify-between rounded-xl bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-950"
                >
                  <span>
                    {u?.ho_ten || c.nguoi_dung_id}
                    {c.ghi_chu ? ` · ${c.ghi_chu}` : ""}
                  </span>
                  <span>
                    {formatPct(c.ty_le)} · {formatVnd(giaTriBenB(duAn) * c.ty_le)}
                  </span>
                </li>
              );
            })}
            {!chia.length ? (
              <li className="text-sm font-medium text-indigo-700">
                Chưa có bảng chia — chỉnh tại menu Tài chính nội bộ.
                {canSuaChiaNoiBo(user, perms) ? "" : ""}
              </li>
            ) : null}
          </ul>
          <Link
            href="/tai-chinh-noi-bo"
            className="mt-3 inline-block text-sm font-bold text-indigo-700 hover:text-teal-700"
          >
            Mở tài chính nội bộ →
          </Link>
        </section>
      ) : null}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl bg-sky-50 px-3 py-2 ring-1 ring-sky-100">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-teal-700">{label}</dt>
      <dd className="mt-1 text-sm font-bold text-blue-950">{value || "—"}</dd>
    </div>
  );
}

function MiniMoney({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase text-teal-700">{label}</p>
      <p className="text-sm font-black tabular-nums text-blue-950">{value}</p>
    </div>
  );
}

function SmallBtn({ children, onClick, tone = "blue" }) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-600 hover:bg-emerald-700"
      : "bg-blue-600 hover:bg-blue-700";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1 text-[11px] font-black text-white ${cls}`}
    >
      {children}
    </button>
  );
}

function HoSoSection({ title, hint, items, users }) {
  return (
    <section className="rounded-2xl border border-sky-200 bg-white p-5">
      <h2 className="text-sm font-black uppercase tracking-wide text-blue-900">{title}</h2>
      <p className="mt-1 text-xs font-medium text-teal-800">{hint}</p>
      <ul className="mt-3 divide-y divide-sky-100">
        {items.map((t) => {
          const u = users.find((x) => x.id === t.nguoi_up_id);
          return (
            <li key={t.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
              <span className="font-bold text-blue-950">
                {t.ten_file}{" "}
                <span className="text-xs font-semibold text-teal-700">
                  ({t.nguon === "xuat_ban" ? "xuất bản" : "upload"})
                </span>
              </span>
              <span className="text-xs font-medium text-teal-800">
                {u?.ho_ten || "—"} · {t.thoi_gian?.slice(0, 10)}
              </span>
            </li>
          );
        })}
        {!items.length ? (
          <li className="py-2 text-sm font-medium text-teal-700">Chưa có tài liệu.</li>
        ) : null}
      </ul>
    </section>
  );
}
