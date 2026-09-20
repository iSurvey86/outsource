/**
 * Schema tab Báo cáo khảo sát (BCKS) — khớp mẫu Word RTK mục 1–7 + bìa.
 */

import { parseKlNumber, formatKlNumber } from "./klTableUtils";

/** Khóa textarea thân báo cáo (trừ bảng 4.1 / 3.1) */
export const BCKS_REPORT_BODY_KEYS = [
  "muc1_can_cu",
  "muc2_1_dac_diem",
  "muc2_2_vi_tri",
  "muc2_3_tu_nhien",
  "muc3_1_tieu_chuan", // legacy text — đồng bộ từ muc3_1_rows khi xuất Word
  "muc3_2_may_moc",
  "muc3_3a_dia_hinh",
  "muc3_3b_dia_chat",
  "muc4_2_ket_qua",
  "muc5_1_danh_gia",
  "muc5_2_de_xuat",
  "muc6_ket_luan",
  "muc7_1_bang_bieu",
  "muc7_2_ban_ve",
  "muc7_3_ho_so_khac",
];

/**
 * Mục xuất Word dạng đoạn (tách dòng / gạch đầu dòng) — không gồm bảng 3.1.
 * Mỗi dòng → 1 `<w:p>` để tránh soft-break + căn đều làm dãn chữ.
 */
export const BCKS_WORD_PARA_KEYS = BCKS_REPORT_BODY_KEYS.filter((k) => k !== "muc3_1_tieu_chuan");

/** Dòng gạch đầu dòng / a) b) … */
export function isBcksBulletLine(line) {
  const t = String(line || "").trimStart();
  return /^[-–—•*]\s+/.test(t) || /^[a-zđ]\)\s+/i.test(t);
}

/**
 * Tách text thành mảng đoạn cho Docxtemplater `{#…_paras}`.
 * Bullet dạng `- …` → `dash` (ngắn) + `body` để tô đậm riêng dấu `-`.
 * @returns {{ text: string, is_bullet: boolean, dash?: string, body?: string }[]}
 */
export function toBcksWordParas(raw) {
  const text = String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  if (!text.trim()) return [];
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const textLine = line.trimStart();
      const bullet = isBcksBulletLine(textLine);
      const dashMatch = textLine.match(/^([-–—•*])(\s*)(.*)$/);
      if (bullet && dashMatch) {
        const mark = dashMatch[1] === "–" || dashMatch[1] === "—" ? "-" : dashMatch[1];
        const gap = dashMatch[2] || " ";
        return {
          text: textLine,
          is_bullet: true,
          dash: mark,
          body: `${gap}${dashMatch[3]}`,
        };
      }
      return {
        text: textLine,
        is_bullet: bullet,
        dash: "",
        body: textLine,
      };
    });
}

/** Nhãn a)/b) mục 3.3 trên Word (thường, nghiêng) */
export const BCKS_MUC33_WORD_LABELS = {
  a: "a) Quy trình và phương pháp khảo sát địa hình",
  b: "b) Quy trình và phương pháp khảo sát địa chất",
};

export function emptyBcksKlRow(defaults = {}) {
  return {
    id_cong_viec: "",
    stt: "",
    noi_dung: "",
    don_vi: "",
    kl_thuc_hien: "",
    kl_phe_duyet: "",
    chenh_lech: "",
    ghi_chu: "",
    is_header: false,
    ...defaults,
  };
}

/** Dòng tiêu chuẩn/quy chuẩn — khớp Word NVKS `ds_tieu_chuan` */
export function emptyBcksTcRow(defaults = {}) {
  return {
    stt: "",
    ky_hieu: "",
    ten_tai_lieu: "",
    ...defaults,
  };
}

export function normalizeBcksTcRow(row, index = 0) {
  const next = emptyBcksTcRow(row || {});
  next.stt = String(next.stt ?? "").trim() || String(index + 1);
  next.ky_hieu = String(next.ky_hieu ?? "").trim();
  next.ten_tai_lieu = String(next.ten_tai_lieu ?? "").trim();
  return next;
}

/** Parse text `- Ký hiệu: Tên` (bản cũ) → bảng */
export function parseBcksTcTextToRows(raw) {
  const lines = String(raw || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const rows = [];
  for (const line of lines) {
    const cleaned = line.replace(/^[-•*]\s*/, "").trim();
    if (!cleaned) continue;
    const m = cleaned.match(/^([^:：]{2,80})\s*[:：]\s*(.+)$/);
    if (m) {
      rows.push(normalizeBcksTcRow({ ky_hieu: m[1].trim(), ten_tai_lieu: m[2].trim() }, rows.length));
    } else {
      rows.push(normalizeBcksTcRow({ ky_hieu: "", ten_tai_lieu: cleaned }, rows.length));
    }
  }
  return rows;
}

export function formatBcksTcRowsForWord(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .map((r) => {
      const ky = String(r?.ky_hieu || "").trim();
      const ten = String(r?.ten_tai_lieu || "").trim();
      if (ky && ten) return `- ${ky}: ${ten}`;
      if (ten) return `- ${ten}`;
      if (ky) return `- ${ky}`;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

/** Mảng Docxtemplater giống NVKS/PAKTKS */
export function toBcksDsTieuChuan(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((r, idx) => normalizeBcksTcRow(r, idx))
    .filter((r) => r.ky_hieu || r.ten_tai_lieu)
    .map((r, idx) => ({
      stt: idx + 1,
      ky_hieu: r.ky_hieu,
      ten_tai_lieu: r.ten_tai_lieu,
    }));
}

/** Chênh = thực hiện − phê duyệt (số); không đủ số → "" */
export function computeBcksKlChenh(klThucHien, klPheDuyet) {
  const aRaw = String(klThucHien ?? "").trim();
  const bRaw = String(klPheDuyet ?? "").trim();
  if (!aRaw || !bRaw) return "";
  const a = parseKlNumber(aRaw);
  const b = parseKlNumber(bRaw);
  if (Number.isNaN(a) || Number.isNaN(b)) return "";
  return formatKlNumber(a - b);
}

export function recomputeBcksKlRow(row) {
  const next = { ...emptyBcksKlRow(), ...row };
  if (next.is_header) {
    next.chenh_lech = "";
    return next;
  }
  next.chenh_lech = computeBcksKlChenh(next.kl_thuc_hien, next.kl_phe_duyet);
  return next;
}

/** Nội dung mẫu khung (khi chưa seed / thiếu catalog) */
export const BCKS_RTK_SAMPLE_BODY = {
  muc1_can_cu: `Báo cáo khảo sát xây dựng được lập dựa trên các căn cứ pháp lý và tài liệu sau:
- Luật Xây dựng số 50/2014/QH13; Luật sửa đổi, bổ sung một số điều của Luật Xây dựng số 62/2020/QH14.
- Nghị định số 15/2021/NĐ-CP (và Nghị định 35/2023/NĐ-CP) của Chính phủ về quản lý dự án đầu tư xây dựng.
- Hợp đồng tư vấn khảo sát số …/HĐ-KS ngày …/…/…. ký giữa Chủ đầu tư và Công ty Dịch vụ Điện lực Miền Bắc.
- Nhiệm vụ khảo sát được phê duyệt theo Quyết định số …/QĐ-CĐT ngày …/…/…..
- Phương án kỹ thuật khảo sát đã được Chủ đầu tư chấp thuận.`,

  muc2_1_dac_diem: `- Tên công trình: …
- Quy mô:
+ …
- Tính chất công trình: Công trình công nghiệp năng lượng`,

  muc2_2_vi_tri: `- Vị trí địa lý: 
- Mô tả tuyến:
`,

  muc2_3_tu_nhien: `- Khí tượng: …
- Thủy văn - Địa hình: …`,

  muc3_1_tieu_chuan: "",

  muc3_2_may_moc: "",

  muc3_3a_dia_hinh: `Quy trình khảo sát địa hình được triển khai tuần tự qua các bước: (1) Công tác chuẩn bị, nhận mốc bàn giao và lập lưới khống chế cơ sở; (2) Tiến hành đo đạc chi tiết tại thực địa (thu thập tọa độ, cao độ, hình ảnh bề mặt); (3) Xử lý số liệu nội nghiệp, bình sai, nắn ảnh; (4) Thành lập bản đồ, bình đồ tuyến, cắt dọc, cắt ngang và lập báo cáo. Để thực hiện quy trình này, các phương pháp kỹ thuật được áp dụng cụ thể như sau:
- Phương pháp xây dựng lưới khống chế cơ sở:
Công tác xây dựng lưới khống chế mặt phẳng và độ cao cơ sở được thực hiện bằng phương pháp đo định vị vệ tinh tĩnh (GNSS Static). Đây là phương pháp tối ưu nhằm thiết lập hệ thống mốc tọa độ có độ chính xác cao, làm cơ sở thống nhất cho toàn bộ quá trình đo vẽ chi tiết, phóng tuyến và cắm mốc công trình sau này.
  + Thiết lập mốc: Các mốc khống chế cơ sở (cấp 1, cấp 2 hoặc đường chuyền tương đương) được đúc bằng bê tông cốt thép mác M200, kích thước tiêu chuẩn 15x15x40cm, tâm mốc gắn đinh sứ chữ thập và được chôn ổn định tại các vị trí quang đãng, nền đất cứng, không bị che khuất góc ngưỡng vệ tinh (Elevation Mask > 15°) và tránh các trạm phát sóng điện từ mạnh.
  + Quy trình đo tĩnh (Static): Hệ thống máy thu GNSS 2 hoặc đa tần số được đặt chính tâm và cân bằng bọt thủy tại các mốc cơ sở. Máy thu tín hiệu đồng thời từ các hệ thống vệ tinh (GPS, GLONASS, Galileo, BeiDou). Thời gian thu tín hiệu cho mỗi ca đo kéo dài liên tục tối thiểu từ 1.5 đến 2.0 giờ nhằm thu thập đủ số lượng Epoch, đảm bảo thuật toán giải đa trị (Ambiguity Resolution) đạt kết quả tốt nhất.
  + Xử lý nội nghiệp: Dữ liệu đo tĩnh (.DAT, .T02, .RINEX) được trút vào các phần mềm bình sai chuyên dụng (như Trimble Business Center). Kỹ sư tiến hành kiểm tra chất lượng Baseline, loại bỏ các tín hiệu nhiễu (Cycle Slips) và thực hiện bình sai mạng lưới lưới không gian 3D. Tọa độ sau bình sai được chuyển đổi về hệ tọa độ Quốc gia VN-2000, kinh tuyến trục địa phương, múi chiếu 3°, đảm bảo sai số khép lưới nằm trong giới hạn cho phép của QCVN 11:2008/BTNMT.
- Phương pháp đo chi tiết bằng RTK:
Công tác đo vẽ bình đồ địa hình và đo mặt cắt được thực hiện chủ yếu bằng phương pháp Đo động thời gian thực (Real-Time Kinematic - RTK). Công nghệ này cho phép xác định tọa độ không gian 3 chiều (X, Y, H) của điểm đo ngay tại thực địa với độ chính xác cỡ centimet.
  + Thiết lập Base/Rover: Kết nối máy thu Rover với hệ thống trạm CORS Quốc gia (Cục Đo đạc, Bản đồ và Thông tin địa lý Việt Nam) thông qua giao thức NTRIP qua sóng 3G/4G, hoặc thiết lập trạm Base tĩnh phát sóng Radio UHF nội bộ. Các thông số hệ tọa độ VN-2000, Ellipsoid WGS-84, cùng mô hình Geoid địa phương được khai báo chính xác vào sổ tay điều khiển (Controller).
  + Quy trình đo hiện trường: Người đo dựng sào ăng-ten mang máy Rover tại các điểm đặc trưng của địa hình, địa vật. Điểm đo chỉ được ghi nhận (Record) khi thuật toán RTK chuyển sang trạng thái cố định (FIXED), với chỉ số suy giảm độ chính xác vị trí không gian (PDOP) ≤ 3.0 và sai số ước tính tọa độ mặt phẳng/cao độ < 0.02m/0.05m. Thời gian đo tối thiểu từ 5 đến 10 giây cho mỗi điểm chi tiết.
  + Kiểm soát chất lượng: Mật độ điểm đo được lấy theo quy phạm đo vẽ bản đồ tỷ lệ 1/500. Kỹ sư thường xuyên kiểm tra chéo tọa độ tại các mốc khống chế cơ sở để phát hiện sớm các hiện tượng trôi tọa độ hoặc sai lệch do nhiễu sóng tín hiệu viễn thông.
- Phương pháp Bay chụp UAV (Photogrammetry & LiDAR):
Đối với các khu vực địa hình rộng lớn, đồi núi phức tạp, hiểm trở hoặc bị chia cắt mạnh, công tác khảo sát được tích hợp thêm công nghệ Đo ảnh hàng không bằng Thiết bị bay không người lái (UAV) kết hợp cảm biến Photogrammetry và LiDAR nhằm lập mô hình địa hình số (DTM) với mật độ điểm cực cao.
  + Rải điểm khống chế ảnh (GCP): Trước khi bay, mạng lưới các điểm kiểm soát mặt đất (GCP - Ground Control Points) được rải đều khắp khu vực khảo sát. Dấu mốc GCP là các tấm tiêu phản quang (kích thước 60x60cm). Tọa độ tâm GCP được đo bằng phương pháp GNSS-RTK với độ chính xác cao nhất (đo lặp nhiều lần).
  + Lập kế hoạch và thực thi bay (Flight Planning): Lập trình tuyến bay tự động trên phần mềm điều khiển. Cao độ bay được thiết lập ở mức 100 - 150m so với mặt đất (sử dụng Terrain Awareness để bám địa hình). Độ chồng phủ ảnh dọc (Front-overlap) tối thiểu 80%, chồng phủ ngang (Side-overlap) 75%. Tốc độ bay và khẩu độ camera được tinh chỉnh để đạt độ phân giải mặt đất (GSD) < 3cm/pixel.
  + Xử lý nội nghiệp chuyên sâu: Dữ liệu bay (Ảnh định dạng RAW/JPG, dữ liệu quét LiDAR) và dữ liệu PPK/RTK được đưa vào các hệ thống phần mềm chuyên dụng (như DJI Terra hoặc Agisoft). Quá trình bình sai khối ảnh (Aerial Triangulation) kết hợp tọa độ GCP giúp nắn chỉnh ảnh về đúng hệ tọa độ Quốc gia. Đám mây điểm (Point Cloud) sau khi khởi tạo sẽ được đưa qua phần mềm Global Mapper Pro để thực hiện phân loại (Classification), lọc bỏ tự động các lớp thảm thực vật, nhà cửa, đường dây điện hiện hữu nhằm tạo ra Mô hình số bề mặt (DSM) và Mô hình số độ cao (DEM) của nền đất tự nhiên.
  + Thành lập bản đồ và tự động hóa thiết kế: Từ DEM chuẩn xác, hệ thống xuất ảnh trực giao (Orthophoto) độ nét cao. Bộ dữ liệu này được liên kết trực tiếp vào các môi trường thiết kế chuyên sâu như AutoCAD Civil 3D, ADSCivil để số hóa đường bình độ, ranh giới địa vật và chiết xuất mặt cắt dọc, ngang tự động. Đồng thời, toàn bộ dữ liệu không gian được đồng bộ hóa và quản lý thuộc tính thông qua nền tảng QGIS, giúp tự động hóa quá trình xuất hồ sơ tuyến và tính toán khối lượng đào đắp.`,

  muc3_3b_dia_chat: `Quy trình khảo sát địa chất công trình được triển khai theo các bước liên hoàn: (1) Xác định và định vị vị trí hố khoan/tuyến đo ngoài thực địa; (2) Tiến hành khoan máy, lấy mẫu đất/đá và thực hiện thí nghiệm xuyên tiêu chuẩn (SPT) ngay trong lỗ khoan; (3) Triển khai đo điện trở suất đất nền dọc tuyến; (4) Vận chuyển mẫu về phòng để thí nghiệm cơ lý; (5) Tổng hợp số liệu và lập hình trụ lỗ khoan. Chi tiết phương pháp thực hiện cho từng công đoạn như sau:
- Phương pháp khoan máy và lấy mẫu:
Công tác khoan thăm dò địa chất công trình đóng vai trò then chốt trong việc xác định cấu trúc địa tầng, tính chất cơ lý của đất đá làm cơ sở thiết kế nền móng công trình.
  + Kỹ thuật khoan: Sử dụng phương pháp khoan xoay bơm rửa luân hồi bằng dung dịch sét (bentonite) hoặc dung dịch polymer để duy trì sự ổn định của thành lỗ khoan, chống sạt lở đối với các lớp đất yếu. Tại lớp đất phủ bề mặt bở rời, ống vách thép (Casing) đường kính 110mm được hạ ép để bảo vệ.
  + Mũi khoan: Tùy thuộc vào địa tầng, mũi khoan hợp kim (đường kính 91mm) được sử dụng cho các lớp đất đá phong hóa; mũi khoan kim cương (đường kính 76mm) kèm ống lấy lõi nòng đôi được sử dụng khi khoan vào đá cứng nhằm tối đa hóa tỷ lệ lấy mẫu.
  + Công tác lấy và bảo quản mẫu đất: Mẫu đất nguyên dạng (Undisturbed samples) được lấy tại các lớp đất dính bằng ống lấy mẫu thành mỏng (Shelby tube). Quá trình ấn ống lấy mẫu được thực hiện bằng sức ép cơ học liên tục, cấm tuyệt đối việc đóng bằng búa để tránh phá vỡ kết cấu tự nhiên của đất. Sau khi vớt lên, mẫu đất được dán kín hai đầu bằng sáp parafin nóng chảy, bọc nilon cách ẩm, ghi rõ thẻ mẫu (số hiệu hố khoan, độ sâu lấy mẫu, ngày lấy) và xếp vào các hộp gỗ/nhựa có chèn xốp giảm xóc để vận chuyển về phòng thí nghiệm cơ lý.
  + Lấy mẫu đá: Lõi đá khoan lên được sắp xếp liên tục vào hộp đựng lõi (Core box). Kỹ sư hiện trường đo trực tiếp tỷ lệ lấy mẫu (Core Recovery) và chỉ số phân mảnh đá (RQD - Rock Quality Designation) để đánh giá sơ bộ mức độ nứt nẻ và cường độ của đá gốc.
- Phương pháp Thí nghiệm SPT:
Thí nghiệm xuyên tiêu chuẩn (SPT - Standard Penetration Test) được tiến hành xen kẽ trực tiếp trong quá trình khoan nhằm xác định sức kháng xuyên động của đất nền hiện trường, từ đó đánh giá độ chặt của đất rời và độ cứng của đất dính.
  + Thiết bị thí nghiệm: Bao gồm búa xuyên tự động có trọng lượng tiêu chuẩn 63.5 kg (140 lbs), khoảng cách rơi tự do định chuẩn là 76 cm (30 inches). Đầu xuyên là loại ống chẻ tiêu chuẩn (Split-spoon sampler).
  + Quy trình thực hiện: Trước khi xuyên, đáy lỗ khoan được làm sạch. Lắp đầu xuyên vào cần khoan và hạ xuống đáy lỗ. Quá trình đóng búa được chia làm ba hiệp, mỗi hiệp xuyên 15 cm. Ghi chép số nhát búa tương ứng với từng hiệp. Số nhát búa của 15 cm đầu tiên bị loại bỏ (do đất đáy lỗ khoan đã bị xáo trộn). Tổng số nhát búa của hai hiệp sau (30 cm tiếp theo) được ghi nhận là giá trị N (N30).
  + Tần suất thí nghiệm: Thí nghiệm SPT thường được thực hiện với mật độ định kỳ 2.0 mét/lần hoặc ngay khi có sự thay đổi rõ rệt về địa tầng quan sát được qua mùn khoan.
- Phương pháp Đo điện trở suất:
Công tác đo điện trở suất (Resistivity Survey) đất nền là một phần không thể thiếu, đặc biệt đối với các công trình công nghiệp và năng lượng, nhằm cung cấp cơ sở dữ liệu quan trọng phục vụ tính toán, thiết kế hệ thống tiếp địa an toàn và chống sét.
  + Phương pháp và cấu hình đo: Thông thường, sử dụng cấu hình điện cực đối xứng Schlumberger hoặc Wenner (cấu hình 4 cực). Tuyến đo được bố trí theo một đường thẳng tại các bãi đất dự kiến xây dựng công trình (như trạm biến áp, móng cột đường dây).
  + Quy trình đo: Hai cực phát (A, B) được cắm vào đất để phóng một dòng điện một chiều (I) hoặc xoay chiều tần số thấp vào lòng đất. Hai cực thu (M, N) đo hiệu điện thế (ΔV) sinh ra. Tăng dần khoảng cách giữa các điện cực (AB/2) từ 1.5m, 3m, 6m đến 30m... để quét chiều sâu đâm xuyên tương ứng của dòng điện vào sâu trong lòng đất.
  + Xử lý số liệu: Số liệu hiện trường (điện trở suất biểu kiến) được trút vào các phần mềm mô phỏng (Inversion software). Qua các vòng lặp tính toán, phần mềm sẽ bóc tách và xuất ra mô hình điện trở suất thực của từng lớp đất theo độ sâu (Ω.m). Dữ liệu này giúp thiết kế quyết định chiều dài cọc tiếp địa, diện tích lưới tiếp địa hoặc sự cần thiết phải sử dụng các hóa chất làm giảm điện trở đất (GEM) nhằm đạt được trị số điện trở nối đất an toàn theo đúng quy chuẩn ngành.`,

  muc4_2_ket_qua: `- Sai số địa hình: …
- Điều tra đền bù: …
- Địa tầng: …
- Điện trở suất: …`,

  muc5_1_danh_gia: `- Điều kiện địa hình: …
- Đánh giá địa chất: …`,

  muc5_2_de_xuat: `- Móng cột góc/TBA: …
- Móng qua ruộng trũng: …
- Tiếp địa, chống sét: …`,

  muc6_ket_luan: `- Công tác khảo sát đã thực hiện tuân thủ đề cương, tiêu chuẩn hiện hành.
- Khối lượng, chất lượng số liệu đáp ứng yêu cầu thiết kế.
- Kính đề nghị Chủ đầu tư xem xét, nghiệm thu Báo cáo.`,

  muc7_1_bang_bieu: `- Tọa độ, cao độ, góc lái mốc tuyến & lưới khống chế.
- Giao chéo, nhà cửa, hoa màu, đền bù.
- Chỉ tiêu cơ lý đất đá; kết quả đo ĐTS.`,

  muc7_2_ban_ve: `- Bình đồ, mặt cắt dọc/ngang (1/500, 1/200).
- Hình trụ lỗ khoan & mặt cắt địa chất (1/100).`,

  muc7_3_ho_so_khac: `- Nhật ký hiện trường, ảnh hố khoan/GCP.
- Chứng chỉ kiểm định máy; GP bay UAV (nếu có).`,
};

/** Slot phụ lục 7.x — đính kèm tệp */
export const BCKS_PHU_LUC_SLOTS = [
  {
    filesKey: "muc7_1_files",
    textKey: "muc7_1_bang_bieu",
    label: "7.1. Bảng biểu tổng hợp số liệu",
  },
  {
    filesKey: "muc7_2_files",
    textKey: "muc7_2_ban_ve",
    label: "7.2. Bản vẽ kỹ thuật",
  },
  {
    filesKey: "muc7_3_files",
    textKey: "muc7_3_ho_so_khac",
    label: "7.3. Hồ sơ khác",
  },
];

export function newBcksPhuLucFileId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `pl_${crypto.randomUUID()}`;
  }
  return `pl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyBcksPhuLucFile(defaults = {}) {
  return {
    id: newBcksPhuLucFileId(),
    ten: "",
    size: 0,
    mime: "",
    link: "",
    path: "",
    ...defaults,
  };
}

export function parseBcksPhuLucFiles(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, i) => {
      if (!item || typeof item !== "object") return null;
      const ten = String(item.ten || item.file_ten_goc || "").trim();
      if (!ten && !item.link && !item.path) return null;
      return {
        id: String(item.id || `pl_${i + 1}`),
        ten: ten || "Tệp đính kèm",
        size: Number(item.size) || 0,
        mime: String(item.mime || "").trim(),
        link: String(item.link || "").trim(),
        path: String(item.path || "").trim(),
      };
    })
    .filter(Boolean);
}

/** Word: ưu tiên danh sách tệp; không có file → giữ mô tả gợi ý */
export function formatBcksPhuLucForWord(text, files) {
  const list = parseBcksPhuLucFiles(files);
  if (list.length) {
    return list.map((f) => `- ${f.ten}`).join("\n");
  }
  return String(text || "").trim();
}

/** Tách mục 2.2 từ chuỗi lưu DB / Word */
export function parseMuc22ViTri(text) {
  const s = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!s) return { viTri: "", moTa: "" };
  const m = s.match(
    /^- Vị trí địa lý:\s*([\s\S]*?)(?=^- Mô tả tuyến:|$)/im
  );
  const m2 = s.match(/^- Mô tả tuyến:\s*([\s\S]*)$/im);
  let viTri = m ? String(m[1] || "").trim() : "";
  let moTa = m2 ? String(m2[1] || "").trim() : "";
  if (!m && !m2) {
    // Không đúng khung — giữ nguyên ở mô tả để không mất dữ liệu
    moTa = s;
  }
  // Bỏ placeholder …
  if (/^[.…]+$|\.{3}/.test(viTri) || viTri === "…") viTri = "";
  if (/^[.…]+$|\.{3}/.test(moTa) || moTa === "…") moTa = "";
  return { viTri, moTa };
}

export function joinMuc22ViTri(viTri, moTa) {
  const vt = String(viTri || "").trim();
  const mt = String(moTa || "").trim();
  return [`- Vị trí địa lý: ${vt}`, `- Mô tả tuyến:${mt ? `\n${mt}` : ""}`].join("\n");
}

export function isMuc22ViTriPlaceholder(text) {
  const s = String(text || "").trim();
  if (!s) return true;
  const { viTri, moTa } = parseMuc22ViTri(s);
  if (!viTri && !moTa) return true;
  if (/^[.…]+$|\.{3}/.test(String(viTri || "").trim())) return true;
  if (s.includes("Vị trí địa lý: …") || s.includes("Mô tả tuyến: …")) return true;
  return false;
}

export function createEmptyBcksReport() {
  const body = {};
  for (const k of BCKS_REPORT_BODY_KEYS) {
    body[k] = BCKS_RTK_SAMPLE_BODY[k] ?? "";
  }
  return {
    loai_mau: "rtk",
    is_dieu_chinh: false,
    nguoi_lap: "",
    chu_nhiem_ks: "",
    lanh_dao_duyet: "",
    thoi_diem_lap: "",
    seed_version: 0,
    muc3_1_rows: [],
    muc4_1_rows: [],
    muc7_1_files: [],
    muc7_2_files: [],
    muc7_3_files: [],
    ...body,
    tom_tat: "",
    ket_luan: "",
    kien_nghi: "",
    ghi_chu: "",
  };
}

function splitLegacyQuyTrinh(raw) {
  const s = String(raw || "").trim();
  if (!s) return { a: BCKS_RTK_SAMPLE_BODY.muc3_3a_dia_hinh, b: BCKS_RTK_SAMPLE_BODY.muc3_3b_dia_chat };
  const idx = s.search(/\nb\s*\)/i);
  if (idx > 0) {
    return { a: stripLegacyMuc33Lead(s.slice(0, idx).trim(), "a"), b: stripLegacyMuc33Lead(s.slice(idx).trim(), "b") };
  }
  if (/^b\s*\)/i.test(s)) {
    return { a: BCKS_RTK_SAMPLE_BODY.muc3_3a_dia_hinh, b: stripLegacyMuc33Lead(s, "b") };
  }
  return { a: stripLegacyMuc33Lead(s, "a"), b: BCKS_RTK_SAMPLE_BODY.muc3_3b_dia_chat };
}

/** Bỏ dòng tiêu đề a)/b) / 3.3.A cũ — đã chuyển thành nhãn 3.3.1 / 3.3.2 */
function stripLegacyMuc33Lead(text, which) {
  const s = String(text || "");
  if (which === "b") {
    return s
      .replace(/^b\s*\)\s*Quy trình tổng quát và phương pháp khảo sát địa chất\s*:?\s*/i, "")
      .replace(/^b\s*\)\s*Phương pháp khảo sát địa chất\s*:?\s*/i, "")
      .replace(/^\s+/, "");
  }
  return s
    .replace(/^a\s*\)\s*Quy trình tổng quát và phương pháp khảo sát địa hình\s*:?\s*/i, "")
    .replace(/^a\s*\)\s*Phương pháp khảo sát địa hình\s*:?\s*/i, "")
    .replace(/^\s+/, "");
}

/** Gộp bản đã lưu / nháp cũ vào schema mới */
export function normalizeBcksReport(raw) {
  const base = createEmptyBcksReport();
  const src = raw && typeof raw === "object" ? raw : {};
  const next = { ...base };

  next.loai_mau = src.loai_mau || "rtk";
  next.is_dieu_chinh = Boolean(src.is_dieu_chinh);
  next.seed_version = Number(src.seed_version) || 0;

  for (const k of [
    "nguoi_lap",
    "chu_nhiem_ks",
    "lanh_dao_duyet",
    "thoi_diem_lap",
    "tom_tat",
    "ket_luan",
    "kien_nghi",
    "ghi_chu",
  ]) {
    if (Object.prototype.hasOwnProperty.call(src, k)) next[k] = String(src[k] ?? "");
  }

  for (const k of BCKS_REPORT_BODY_KEYS) {
    if (Object.prototype.hasOwnProperty.call(src, k)) {
      next[k] = String(src[k] ?? "");
    }
  }

  // Migrate 3.3 gộp → a/b
  if (
    (!Object.prototype.hasOwnProperty.call(src, "muc3_3a_dia_hinh") ||
      !String(src.muc3_3a_dia_hinh || "").trim()) &&
    String(src.muc3_3_quy_trinh || "").trim()
  ) {
    const split = splitLegacyQuyTrinh(src.muc3_3_quy_trinh);
    next.muc3_3a_dia_hinh = split.a;
    next.muc3_3b_dia_chat = split.b;
  } else {
    next.muc3_3a_dia_hinh = stripLegacyMuc33Lead(next.muc3_3a_dia_hinh, "a");
    next.muc3_3b_dia_chat = stripLegacyMuc33Lead(next.muc3_3b_dia_chat, "b");
  }

  if (
    !Object.prototype.hasOwnProperty.call(src, "muc6_ket_luan") ||
    !String(src.muc6_ket_luan || "").trim()
  ) {
    const legacy = [src.ket_luan, src.kien_nghi].filter((s) => String(s || "").trim()).join("\n");
    if (legacy) next.muc6_ket_luan = legacy;
  }

  if (Array.isArray(src.muc4_1_rows)) {
    next.muc4_1_rows = src.muc4_1_rows.map((r) => recomputeBcksKlRow(r || {}));
  } else if (String(src.muc4_1_khoi_luong || "").trim()) {
    // Bản cũ textarea → 1 dòng ghi chú
    next.muc4_1_rows = [
      recomputeBcksKlRow({
        stt: "",
        noi_dung: String(src.muc4_1_khoi_luong),
        is_header: false,
      }),
    ];
  }

  if (Array.isArray(src.muc3_1_rows) && src.muc3_1_rows.length) {
    next.muc3_1_rows = src.muc3_1_rows.map((r, i) => normalizeBcksTcRow(r || {}, i));
  } else if (String(src.muc3_1_tieu_chuan || "").trim()) {
    next.muc3_1_rows = parseBcksTcTextToRows(src.muc3_1_tieu_chuan);
  } else {
    next.muc3_1_rows = [];
  }
  next.muc3_1_tieu_chuan = formatBcksTcRowsForWord(next.muc3_1_rows);

  for (const slot of BCKS_PHU_LUC_SLOTS) {
    next[slot.filesKey] = parseBcksPhuLucFiles(src[slot.filesKey]);
  }

  return next;
}

/** Text khối lượng cho Word (1 tag) — legacy fallback */
export function formatBcksKlRowsForWord(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const lines = [];
  for (const r of list) {
    if (!r) continue;
    if (r.is_header) {
      const t = String(r.noi_dung || "").trim();
      if (t) lines.push(t);
      continue;
    }
    const stt = String(r.stt || "").trim();
    const nd = String(r.noi_dung || "").trim();
    if (!nd && !stt) continue;
    const parts = [
      stt ? `${stt}.` : "",
      nd,
      r.don_vi ? `(${r.don_vi})` : "",
      `TH: ${r.kl_thuc_hien || "-"}`,
      `PD: ${r.kl_phe_duyet || "-"}`,
      `CL: ${r.chenh_lech || "-"}`,
    ].filter(Boolean);
    lines.push(parts.join(" "));
    if (String(r.ghi_chu || "").trim()) lines.push(`  Ghi chú: ${r.ghi_chu}`);
  }
  return lines.join("\n");
}

/** Dấu gạch ngắn trong bảng Word (không dùng em-dash —) */
const BCKS_KL_EMPTY = "-";

/**
 * Mảng Docxtemplater `{#ds_bcks_kl}` — cột như màn hình, không thao tác / ghi chú.
 * Mục cha (is_header): chỉ STT + Nội dung, ô còn lại để trống.
 * Ô dữ liệu trống: "-" ngắn.
 */
export function toBcksDsKlForWord(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((r) => recomputeBcksKlRow(r || {}))
    .filter((r) => {
      if (r.is_header) return Boolean(String(r.noi_dung || "").trim() || String(r.stt || "").trim());
      return Boolean(String(r.noi_dung || "").trim() || String(r.stt || "").trim());
    })
    .map((r) => {
      if (r.is_header) {
        return {
          stt: String(r.stt || "").trim(),
          noi_dung: String(r.noi_dung || "").trim(),
          don_vi: "",
          kl_thuc_hien: "",
          kl_phe_duyet: "",
          chenh_lech: "",
          is_header: true,
        };
      }
      return {
        stt: String(r.stt || "").trim(),
        noi_dung: String(r.noi_dung || "").trim(),
        don_vi: String(r.don_vi || "").trim() || BCKS_KL_EMPTY,
        kl_thuc_hien: String(r.kl_thuc_hien || "").trim() || BCKS_KL_EMPTY,
        kl_phe_duyet: String(r.kl_phe_duyet || "").trim() || BCKS_KL_EMPTY,
        chenh_lech: String(r.chenh_lech || "").trim() || BCKS_KL_EMPTY,
        is_header: false,
      };
    });
}
