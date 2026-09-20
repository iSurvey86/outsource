/**
 * Gộp placeholder Docxtemplater bị Word tách thành nhiều w:t
 * (vd. `{` + `chu` + `_` + `nhiem_ks` + `}` → `{chu_nhiem_ks}`).
 * Không gộp cả đoạn văn — chỉ gom đúng các tag {…}.
 */
export function repairSplitTemplateTagsInXml(xml) {
  if (!xml || !xml.includes("{")) return xml;

  return xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (para) => {
    const tRe = /(<w:t[^>]*>)([^<]*)(<\/w:t>)/g;
    const matches = [...para.matchAll(tRe)];
    if (matches.length < 2) return para;

    const texts = matches.map((m) => m[2]);
    const joined = texts.join("");
    const tagMatches = [...joined.matchAll(/\{[/#]?[a-zA-Z0-9_]+\}/g)];
    if (!tagMatches.length) return para;

    const needsFix = tagMatches.some((tm) => !texts.some((t) => t.includes(tm[0])));
    if (!needsFix) return para;

    const lengths = texts.map((t) => t.length);
    const starts = [];
    let acc = 0;
    for (const len of lengths) {
      starts.push(acc);
      acc += len;
    }

    const runIndexAt = (pos) => {
      for (let i = 0; i < starts.length; i++) {
        const end = starts[i] + lengths[i];
        if (pos < end || (pos === joined.length && i === starts.length - 1)) return i;
        if (pos >= starts[i] && pos < end) return i;
      }
      return starts.length - 1;
    };

    const out = texts.map(() => "");
    let i = 0;
    while (i < joined.length) {
      const tag = tagMatches.find((tm) => i >= tm.index && i < tm.index + tm[0].length);
      if (tag && i === tag.index) {
        out[runIndexAt(i)] += tag[0];
        i = tag.index + tag[0].length;
        continue;
      }
      out[runIndexAt(i)] += joined[i];
      i += 1;
    }

    let k = 0;
    return para.replace(tRe, (_full, open, _text, close) => {
      const next = `${open}${out[k]}${close}`;
      k += 1;
      return next;
    });
  });
}

/** Sửa document.xml + header/footer trong zip mẫu trước khi Docxtemplater render. */
export function repairSplitTemplateTagsInZip(zip) {
  if (!zip) return zip;
  const paths = Object.keys(zip.files || {}).filter(
    (p) =>
      /^word\/(document|header\d*|footer\d*)\.xml$/i.test(p) && !zip.files[p].dir
  );
  for (const p of paths) {
    const file = zip.file(p);
    if (!file) continue;
    const xml = file.asText();
    const next = repairSplitTemplateTagsInXml(xml);
    if (next !== xml) zip.file(p, next);
  }
  return zip;
}
