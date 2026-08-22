/**
 * Xuất ma trận phân quyền OUTSRC → docs/Phan_quyen_OUTSRC.docx
 * Ky hieu: Co / Khong (tranh loi font ✓ ✗)
 * Chạy: node scripts/export-phan-quyen-docx.js
 */
const fs = require("fs");
const path = require("path");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
  BorderStyle,
  AlignmentType,
  ShadingType,
} = require("docx");

const OUT = path.join(__dirname, "..", "docs", "Phan_quyen_OUTSRC_v2.docx");

const border = { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" };
const borders = { top: border, bottom: border, left: border, right: border };

function cell(text, opts = {}) {
  const { bold = false, header = false, width = 1400, align = AlignmentType.CENTER } = opts;
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: header ? { type: ShadingType.CLEAR, fill: "1E40AF" } : undefined,
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text: String(text),
            bold: bold || header,
            color: header ? "FFFFFF" : "0F172A",
            size: header ? 18 : 17,
            font: "Arial",
          }),
        ],
      }),
    ],
  });
}

function table(headers, rows, widths) {
  const w = widths || headers.map(() => 1400);
  return new Table({
    width: { size: w.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    rows: [
      new TableRow({
        children: headers.map((h, i) => cell(h, { header: true, width: w[i] })),
      }),
      ...rows.map(
        (r) =>
          new TableRow({
            children: r.map((v, i) =>
              cell(v, {
                width: w[i],
                align: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
                bold: i === 0,
              })
            ),
          })
      ),
    ],
  });
}

function h(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, bold: true, font: "Arial", size: 28 })],
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 100 },
    children: [
      new TextRun({
        text,
        font: "Arial",
        size: 22,
        bold: opts.bold,
        italics: opts.italics,
      }),
    ],
  });
}

const roles = ["Admin", "PM", "Member", "Ben A"];
const w5 = [3200, 1200, 1200, 1200, 1600];

const doc = new Document({
  sections: [
    {
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 720, right: 720 },
        },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: "OUTSRC - MA TRAN PHAN QUYEN",
              bold: true,
              size: 32,
              font: "Arial",
            }),
          ],
        }),
        p("Phien ban thong nhat nghiep vu (truoc khi trien khai code).", { italics: true }),
        p("Ngay: 21/08/2026"),
        p(
          "Vai tro: Admin (Ben B) | PM / Quan ly du an (Ben B) | Member (Ben B, du phong) | Ben A (viewer, gan theo du an)."
        ),
        p(
          "Quy tac cot loi Ben A: moi du an co ben_a_user_id. A1 chi thay du an cua A1; A2 chi thay du an cua A2. Member = PM, khac dung 1 diem: khong duoc xem tai chinh noi bo."
        ),
        p("Ky hieu trong bang: Co = duoc phep | Khong = khong duoc phep."),

        h("1. He thong & tai khoan", HeadingLevel.HEADING_2),
        table(
          ["Hang muc", ...roles],
          [
            ["Quan ly he thong / nhat ky hoat dong", "Co", "Khong", "Khong", "Khong"],
            ["Tao / sua / xoa / khoa tai khoan", "Co", "Khong", "Khong", "Khong"],
          ],
          w5
        ),

        h("2. Du an (QLDA)", HeadingLevel.HEADING_2),
        table(
          ["Hang muc", ...roles],
          [
            ["Xem danh sach du an", "Moi DA", "Moi DA", "Moi DA (MVP)", "Chi DA gan minh"],
            ["Tao du an", "Co", "Khong", "Khong", "Khong"],
            ["Sua metadata DA (ten, Giao A, HD, GTV...)", "Co", "Khong", "Khong", "Khong"],
            ["Doi gan Ben A sau khi tao", "Co", "Khong", "Khong", "Khong"],
            ["Xoa du an", "Co", "Khong", "Khong", "Khong"],
            ["Tao DA - chon Ben A", "Bat buoc + canh bao manh", "-", "-", "-"],
          ],
          w5
        ),

        h("3. Chi tiet du an (workspace)", HeadingLevel.HEADING_2),
        table(
          ["Hang muc", ...roles],
          [
            ["TT co ban, ten DA, Giao A, HD, GTV", "Co", "Xem", "Xem", "Xem (DA minh)"],
            ["Khoi Khao sat (NVKS, PAKTKS...)", "Co", "Lap/luu/xuat", "Lap/luu/xuat (=PM)", "An"],
            ["Ho so chung (KS / TK / nghiem thu)", "Co", "Co + upload", "Co + upload (=PM)", "Chi xem"],
            ["Upload ho so", "Co", "Co", "Co (=PM)", "Khong"],
          ],
          w5
        ),

        h("4. Tai chinh", HeadingLevel.HEADING_2),
        table(
          ["Hang muc", ...roles],
          [
            ["So A-B (PADT, HD, lan tam ung...)", "Sua / nhan TU", "Chi xem", "Chi xem", "Chi xem (DA minh)"],
            ["Tai chinh noi bo", "Co (sua)", "Chi xem", "Khong (khac PM)", "An"],
          ],
          w5
        ),

        h("5. Tai lieu huong dan", HeadingLevel.HEADING_2),
        table(
          ["Hang muc", ...roles],
          [["HDSD / Co gi moi", "Co", "Co", "Co", "Co"]],
          w5
        ),

        h("6. Quy tac gan Ben A", HeadingLevel.HEADING_2),
        p("- Moi du an co mot truong ben_a_user_id tro toi tai khoan Ben A."),
        p("- A1 chi thay / chi xem cac DA co ben_a_user_id = A1; A2 tuong tu - khong lan."),
        p("- Mo URL DA khong thuoc minh -> chan / chuyen huong, khong lo du lieu."),
        p("- DA chua gan Ben A: khong tai khoan A nao thay."),
        p("- Chi Admin duoc doi gan Ben A sau khi tao."),
        p("- Tao DA bat buoc chon Ben A kem canh bao manh (nham lan rat nguy hiem)."),

        h("7. Tom tat nhanh theo vai tro", HeadingLevel.HEADING_2),
        p("Admin: Toan quyen - QLHT, tao/sua/xoa DA, gan Ben A, thao tac so A-B, noi bo, KS, ho so.", {
          bold: true,
        }),
        p(
          "PM: Khong QLHT; khong tao/sua/xoa DA; lap/luu/xuat KS; upload ho so; xem so A-B; xem tai chinh noi bo (khong sua)."
        ),
        p(
          "Member: Giong PM; khac dung 1 diem - khong xem tai chinh noi bo. (Du phong; hien Ben B chu yeu Admin + PM.)"
        ),
        p(
          "Ben A: Chi DA cua minh; xem TT co ban + Giao A + HD + GTV + Ho so; an khoi KS; xem so A-B (DA minh); khong noi bo; khong sua gi."
        ),

        new Paragraph({ spacing: { before: 400 }, children: [] }),
        p("- Het tai lieu thong nhat phan quyen OUTSRC -", { italics: true }),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, buffer);
  console.log("Wrote", OUT);
});
