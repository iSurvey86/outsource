import { NextResponse } from "next/server";
import { convertDocxBufferToPdf } from "../../../lib/nvksPdfConvert";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const downloadName = (formData.get("fileName") || "NVKS_export.pdf").toString();

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Thiếu file Word (.docx)" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const docxBuffer = Buffer.from(arrayBuffer);

    if (docxBuffer.length < 100) {
      return NextResponse.json({ error: "File Word không hợp lệ" }, { status: 400 });
    }

    const pdfBuffer = await convertDocxBufferToPdf(docxBuffer);
    const safeName = downloadName.replace(/\.docx$/i, ".pdf").replace(/[^\w.\-]+/g, "_");

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error("export-nvks-pdf:", error);
    return NextResponse.json(
      { error: error?.message || "Lỗi convert PDF" },
      { status: 500 }
    );
  }
}
