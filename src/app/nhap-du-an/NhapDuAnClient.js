'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    extractNamGiaoA,
    getDesignPhases,
    describePhaseRule,
    parseTmdtTrD,
} from '../../lib/designPhases';
import { normalizeTenDuAn, resolveDiaDiemKs } from '../../lib/giaoALocation';
import { isKhachHangNgoai, normalizeChuDauTu } from '../../lib/chuDauTuAlias';
import {
    assignKhnQdForCongTrinh,
    formatKhnQdDayDu,
    needsKhnQdAssignment,
} from '../../lib/khnGiaoACode';
import { normalizeGiaiDoanChuan } from '../../lib/giaiDoanOrder';
import { formatGiaoAShort, normalizeVietnameseGiaoADate } from '../../lib/formatGiaoA';
import { Trash2, Plus, Loader2, ArrowLeft, FileText, CheckCircle, FileSearch, ExternalLink, PenLine, Files, Eye, AlertTriangle, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useAppDialog } from '../../components/AppDialog';
import BenAUserSelect from '../../components/duAn/BenAUserSelect';
import { loadAuthSession } from '../../lib/authSession';
import { canSuaDuAn } from '../../lib/menuAccess';
import { fetchDb, logActivity } from '../../lib/store';
import {
    mapExistingProjectsForDupCheck,
    saveNhapDuAnPayload,
} from '../../lib/nhapDuAnOutsrc';

/** Shim log ksnpsc → OUTSRC logActivity */
function logHoatDong({ phanHe, hanhDong, chiTietNgan, duLieuDong }) {
    const { user } = loadAuthSession();
    const extra = duLieuDong ? ` ${JSON.stringify(duLieuDong)}` : '';
    return logActivity({
        username: user?.username,
        ho_ten: user?.ho_ten,
        phan_he: String(phanHe || 'du_an').toLowerCase(),
        hanh_dong: hanhDong || 'LOG',
        chi_tiet: `${chiTietNgan || ''}${extra}`.slice(0, 500),
    }).catch(() => {});
}

function preferNewMaWhenReplacing(oldMa) {
    const ma = String(oldMa || "").trim().toUpperCase();
    return ma.startsWith("CHUA-NHAP") || ma.startsWith("AUTO-");
}

function removeVietnameseTones(str) {
    if (!str) return "";
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    return str.replace(/[^a-zA-Z0-9 ]/g, "");
}

// FUZZY SEARCH (So sánh chuỗi mờ)
function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    const s1 = removeVietnameseTones(str1.toLowerCase()).split(/\s+/).filter(w => w);
    const s2 = removeVietnameseTones(str2.toLowerCase()).split(/\s+/).filter(w => w);
    if (s1.length === 0 || s2.length === 0) return 0;
    
    let intersection = 0;
    const set2 = new Set(s2);
    for (const w of s1) {
        if (set2.has(w)) intersection++;
    }
    const union = new Set([...s1, ...s2]).size;
    return intersection / union; // Tỷ lệ giống nhau Jaccard (0.0 đến 1.0)
}

function normalizeTenForMatch(str) {
    return removeVietnameseTones(str || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeGiaiDoan(gd) {
    const g = String(gd || '').trim().toUpperCase();
    if (g === 'BCNCKT' || g === 'FS') return 'FS';
    if (g === 'TKBVTC' || g === 'TKKT-TKBVTC') return 'TKBVTC';
    return g;
}

/** Nhãn giai đoạn trên modal trùng — FS/BCNCKT → BCNCKT (khớp bảng QLDA) */
function formatGiaiDoanHienThi(gd) {
    const label = normalizeGiaiDoanChuan(gd);
    return label || '—';
}

const FUZZY_NAME_THRESHOLD = 0.85;
const FUZZY_NAME_WITH_QUYMO = 0.75;
const FUZZY_QUYMO_THRESHOLD = 0.85;

/** Danh sách trùng/tương tự sau quét — dùng bảng trong AppDialog (cuộn được, không cần zoom). */
function buildDuplicateScanTable(projects) {
    const rows = [];
    const seen = new Set();

    for (const p of projects || []) {
        if (!p.duplicateCandidate) continue;
        const key = `${p.duplicateMatchType}-${p.duplicateCandidate.ma_du_an}-${p.giai_doan}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const exact = p.duplicateMatchType === 'EXACT';
        const pct = Math.round((p.duplicateMatchScore || 0) * 100);
        rows.push({
            key,
            mucDo: exact ? 'Trùng 100%' : `Tương tự ~${pct}%`,
            tenScan: p.ten_du_an || '—',
            giaiDoan: formatGiaiDoanHienThi(p.giai_doan),
            maDb: p.duplicateCandidate.ma_du_an || '—',
            tenDb: exact ? '—' : (p.duplicateCandidate.ten_du_an || '—'),
        });
    }

    if (rows.length === 0) return null;

    return {
        caption: `Phát hiện ${rows.length} dự án đã có / tương tự trên hệ thống. Kiểm tra biểu tượng ⚠️ trên bảng và xử lý trước khi lưu.`,
        columns: [
            { key: 'mucDo', label: 'Mức độ', narrow: true },
            { key: 'tenScan', label: 'Tên vừa quét' },
            { key: 'giaiDoan', label: 'Giai đoạn', narrow: true },
            { key: 'maDb', label: 'Mã trên DB', mono: true, narrow: true },
            { key: 'tenDb', label: 'Tên gần nhất (DB)' },
        ],
        rows,
    };
}

function cleanForFileName(str) {
    if (!str) return "QuyetDinh";
    let cleaned = removeVietnameseTones(str);
    cleaned = cleaned.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_");
    return cleaned.replace(/^_|_$/g, "");
}

const PROVINCE_MAP = {
    'lào cai': 'LK', 'lai châu': 'LC', 'sơn la': 'SL', 'phú thọ': 'PT',
    'bắc giang': 'BG', 'hưng yên': 'HY', 'bắc ninh': 'BN', 'lạng sơn': 'LS',
    'hải phòng': 'HP', 'ninh bình': 'NB', 'thanh hóa': 'TH', 'quảng ninh': 'QN', 
    'nghệ an': 'NA', 'hà tĩnh': 'HT', 'thái nguyên': 'TN', 'vĩnh phúc': 'VP', 
    'hòa bình': 'HB', 'hải dương': 'HD', 'thái bình': 'TB', 'hà nam': 'HNA', 
    'nam định': 'ND', 'yên bái': 'YB', 'tuyên quang': 'TQ', 'bắc kạn': 'BK', 
    'cao bằng': 'CB', 'hà giang': 'HG', 'điện biên': 'DB'
};

const getProvinceCode = (diaDiem, tenDuAn) => {
    const searchString = ((diaDiem || '') + ' ' + (tenDuAn || '')).toLowerCase();
    let provinceCount = 0;
    let singleProvinceCode = 'DA';

    for (let key in PROVINCE_MAP) {
        if (searchString.includes(key)) {
            provinceCount++;
            singleProvinceCode = PROVINCE_MAP[key];
        }
    }

    // Nhiều tỉnh hoặc không xác định được → DA (Dự án); một tỉnh → mã tỉnh
    if (provinceCount >= 2) return 'DA';
    if (provinceCount === 1) return singleProvinceCode;
    return 'DA';
};

const getNameAcronym = (tenDuAn) => {
    const cleanStr = removeVietnameseTones(tenDuAn).replace(/[^a-zA-Z0-9 ]/g, '');
    return cleanStr.split(/\s+/).filter(w => w).map(w => w[0]?.toUpperCase()).join('');
};

const buildProjectCode = (pCode, nam, giaiDoan, acronymSuffix) =>
    `${pCode}-${nam}-${giaiDoan}-${acronymSuffix}`;

/** Sinh suffix viết tắt dùng chung cho mọi giai đoạn của cùng một dự án */
const resolveSharedAcronymSuffix = (pCode, nam, tenDuAn, giaiDoanList, localCodes, existingCodes) => {
    const acronym = getNameAcronym(tenDuAn) || "DA";
    const allChecked = [...existingCodes, ...localCodes];

    for (let attempt = 0; attempt <= 99; attempt++) {
        const numSuffix = attempt > 0 ? String(attempt) : "";
        const acronymSuffix = acronym.substring(0, Math.max(1, 10 - numSuffix.length)) + numSuffix;
        const allFree = giaiDoanList.every(
            (gd) => !allChecked.includes(buildProjectCode(pCode, nam, gd, acronymSuffix))
        );
        if (allFree) return acronymSuffix;
    }

    // Fallback cuối: thêm timestamp ngắn để không trùng trong cùng lệnh upsert
    return `${acronym.substring(0, 6)}${String(Date.now()).slice(-4)}`;
};

/**
 * Đảm bảo mỗi dòng trong batch có ma_du_an duy nhất (tránh lỗi Postgres
 * «ON CONFLICT DO UPDATE cannot affect row a second time»).
 * Trả về { projects, fixedCodes: string[] }.
 */
const ensureUniqueProjectCodes = (projectList, existingCodes = []) => {
    const usedInBatch = new Set();
    const fixedCodes = [];
    const projects = (projectList || []).map((p) => {
        if (!p?.ten_du_an?.trim()) return p;
        let code = String(p.ma_du_an || "").trim();
        if (!code) {
            const pCode = getProvinceCode(p.dia_diem_ks, p.ten_du_an);
            const nam = new Date().getFullYear().toString();
            const gd = p.giai_doan || "BCKTKT";
            const suffix = resolveSharedAcronymSuffix(
                pCode,
                nam,
                p.ten_du_an,
                [gd],
                [...usedInBatch],
                existingCodes
            );
            code = buildProjectCode(pCode, nam, gd, suffix);
        }
        if (!usedInBatch.has(code)) {
            usedInBatch.add(code);
            return code === p.ma_du_an ? p : { ...p, ma_du_an: code };
        }

        // Trùng trong cùng lần lưu: sinh mã mới (không đụng mã đã có trên DB / trong batch)
        const pCode = getProvinceCode(p.dia_diem_ks, p.ten_du_an);
        const parts = code.split("-");
        const nam = parts.length >= 2 ? parts[1] : new Date().getFullYear().toString();
        const gd = p.giai_doan || parts[2] || "BCKTKT";
        const suffix = resolveSharedAcronymSuffix(
            pCode,
            nam,
            p.ten_du_an,
            [gd],
            [...usedInBatch],
            existingCodes
        );
        const nextCode = buildProjectCode(pCode, nam, gd, suffix);
        usedInBatch.add(nextCode);
        fixedCodes.push(`${code} → ${nextCode} (${p.ten_du_an})`);
        return { ...p, ma_du_an: nextCode };
    });

    return { projects, fixedCodes };
};

/** Gộp payload upsert theo ma_du_an (giữ dòng sau cùng) — lớp an toàn cuối. */
const dedupeUpsertPayloadByMaDuAn = (payload = []) => {
    const byMa = new Map();
    for (const row of payload) {
        const ma = String(row?.ma_du_an || "").trim();
        if (!ma) continue;
        byMa.set(ma, row);
    }
    return [...byMa.values()];
};

const MAX_BATCH_FILES = 9;
const BATCH_FILE_COOLDOWN_MS = 28000;
const BATCH_SCAN_MAX_RETRIES = 2;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(errorMessage) {
    const match = String(errorMessage || '').match(/retry in ([\d.]+)\s*s/i);
    if (match) return Math.ceil(parseFloat(match[1]) * 1000) + 500;
    return null;
}

function isRetryableScanError(err) {
    const status = err?.status;
    const msg = String(err?.message || err || '');
    return status === 429 || status === 503
        || /429|503|quota|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand/i.test(msg);
}

function buildScanResultFromApiData(data, existingProjects) {
    let qdAPI = data.so_quyet_dinh?.value || data.qdGiaoA?.value || data.so_quyet_dinh || data.qdGiaoA || '';
    let qdDayDuAPI = data.qd_giao_a_day_du?.value || data.quyet_dinh_day_du?.value || data.qd_giao_a_day_du || data.quyet_dinh_day_du || '';
    qdDayDuAPI = normalizeVietnameseGiaoADate(String(qdDayDuAPI || '').trim());
    const qdNorm = formatGiaoAShort(qdAPI, qdDayDuAPI);
    if (qdNorm && qdNorm !== '-') {
        qdAPI = qdNorm.replace(/\n/g, ' ').trim();
    } else {
        qdAPI = normalizeVietnameseGiaoADate(String(qdAPI || '').trim());
    }
    const namAPI = data.nam_giao_a?.value || data.namGiaoA?.value || data.nam_giao_a || data.namGiaoA || new Date().getFullYear().toString();
    const namForCodes = extractNamGiaoA(qdAPI, qdDayDuAPI) || namAPI;
    const cdtAPI = normalizeChuDauTu(
        data.chu_dau_tu?.value || data.chuDauTu?.value || data.chu_dau_tu || data.chuDauTu || ''
    );
    const capDienApAPI = data.cap_dien_ap?.value || data.capDienAp?.value || data.cap_dien_ap || data.capDienAp || '110kV';

    const masterInfo = {
        qd_giao_a: qdAPI,
        qd_giao_a_conf: data.so_quyet_dinh?.confidence || 100,
        qd_giao_a_warn: data.so_quyet_dinh?.warning || '',
        qd_giao_a_day_du: qdDayDuAPI,
        qd_giao_a_day_du_conf: data.qd_giao_a_day_du?.confidence || 100,
        qd_giao_a_day_du_warn: data.qd_giao_a_day_du?.warning || '',
        nam_giao_a: namForCodes,
        nam_giao_a_conf: data.nam_giao_a?.confidence || 100,
        nam_giao_a_warn: data.nam_giao_a?.warning || '',
        chu_dau_tu: cdtAPI,
        chu_dau_tu_conf: data.chu_dau_tu?.confidence || 100,
        chu_dau_tu_warn: data.chu_dau_tu?.warning || '',
        cap_dien_ap: capDienApAPI,
        cap_dien_ap_conf: data.cap_dien_ap?.confidence || 100,
        cap_dien_ap_warn: data.cap_dien_ap?.warning || '',
        ben_a_user_id: '',
        ben_a_user_ids: [],
    };

    const newProjectsList = [];
    const localCodes = [];
    const dsDuAn = data.danh_sach_du_an?.value || data.projects?.value || data.danh_sach_du_an || data.projects || [];

    const getMatchedProjectInfo = (ten, giaiDoan, quyMo) => {
        if (!ten) return null;
        const normTen = normalizeTenForMatch(ten);
        const normPhase = normalizeGiaiDoan(giaiDoan);

        for (const p of existingProjects) {
            if (normalizeGiaiDoan(p.giai_doan) !== normPhase) continue;
            if (normalizeTenForMatch(p.ten_du_an) === normTen) {
                return { type: 'EXACT', project: p, score: 1 };
            }
        }

        let bestMatch = null;
        let highestScore = 0;
        for (const p of existingProjects) {
            if (normalizeGiaiDoan(p.giai_doan) !== normPhase) continue;
            const nameScore = calculateSimilarity(ten, p.ten_du_an);
            const quyMoScore = quyMo && p.quy_mo ? calculateSimilarity(quyMo, p.quy_mo) : 0;
            const isFuzzy =
                nameScore >= FUZZY_NAME_THRESHOLD ||
                (nameScore >= FUZZY_NAME_WITH_QUYMO && quyMoScore >= FUZZY_QUYMO_THRESHOLD);
            if (!isFuzzy) continue;

            const score = nameScore >= FUZZY_NAME_THRESHOLD
                ? nameScore
                : nameScore * 0.65 + quyMoScore * 0.35;
            if (score > highestScore) {
                highestScore = score;
                bestMatch = p;
            }
        }

        if (bestMatch) return { type: 'FUZZY', project: bestMatch, score: highestScore };
        return null;
    };

    dsDuAn.forEach((p, index) => {
        const tmdtRaw = p.tmdt?.value || p.tongMucDauTu?.value || p.tmdt || p.tongMucDauTu || "0";
        const tmdtVal = parseTmdtTrD(tmdtRaw);

        const tenAPI = normalizeTenDuAn(
            p.ten_du_an?.value || p.tenDuAn?.value || p.ten_du_an || p.tenDuAn || ""
        );
        const diaDiemAPI = p.dia_diem?.value || p.diaDiem?.value || p.dia_diem || p.diaDiem || "";

        const diaDiemResolved = resolveDiaDiemKs({
            diaDiemAppendix: diaDiemAPI,
            chuDauTu: cdtAPI,
            existingConf: p.dia_diem?.confidence ?? 95,
            existingWarn: p.dia_diem?.warning || '',
        });
        const quyMoAPI = p.quy_mo?.value || p.quyMo?.value || p.quy_mo || p.quyMo || "";

        const tenConf = p.ten_du_an?.confidence || 100;
        const diaDiemConf = diaDiemResolved.confidence;
        const tmdtConf = p.tmdt?.confidence || 100;
        const quyMoConf = p.quy_mo?.confidence || 100;

        const tenWarn = p.ten_du_an?.warning || '';
        const diaDiemWarn = diaDiemResolved.warning;
        const tmdtWarn = p.tmdt?.warning || '';
        const quyMoWarn = p.quy_mo?.warning || '';

        const neededPhases = getDesignPhases(qdAPI, qdDayDuAPI, tmdtVal);
        const pCode = getProvinceCode(diaDiemResolved.value, tenAPI);
        const existingCodes = existingProjects.map(ep => ep.ma_du_an);
        const sharedSuffix = resolveSharedAcronymSuffix(
            pCode, namForCodes, tenAPI, neededPhases, localCodes, existingCodes
        );

        const resolveCodeAndMatch = (giaiDoanStr) => {
            const matchInfo = getMatchedProjectInfo(tenAPI, giaiDoanStr, quyMoAPI);
            let finalCode = '';
            let duplicateCandidate = null;
            let duplicateMatchType = null;
            let duplicateMatchScore = null;

            if (matchInfo) {
                if (matchInfo.type === 'EXACT') {
                    finalCode = matchInfo.project.ma_du_an;
                    // Mã tạm (CHUA-NHAP/AUTO): vẫn sinh mã chuẩn để có thể thay khi lưu.
                    if (preferNewMaWhenReplacing(finalCode)) {
                        finalCode = buildProjectCode(pCode, namForCodes, giaiDoanStr, sharedSuffix);
                    }
                } else {
                    finalCode = buildProjectCode(pCode, namForCodes, giaiDoanStr, sharedSuffix);
                }
                duplicateCandidate = matchInfo.project;
                duplicateMatchType = matchInfo.type;
                duplicateMatchScore = matchInfo.score;
            } else {
                finalCode = buildProjectCode(pCode, namForCodes, giaiDoanStr, sharedSuffix);
            }

            // Không dùng lại mã đã có trong batch (PDF liệt kê trùng / 2 dòng cùng giai đoạn).
            // Mã đã có trên DB (EXACT) vẫn giữ — chỉ đổi khi trùng lần 2 trong cùng lần quét.
            if (localCodes.includes(finalCode)) {
                const uniqSuffix = resolveSharedAcronymSuffix(
                    pCode,
                    namForCodes,
                    tenAPI,
                    [giaiDoanStr],
                    localCodes,
                    existingCodes
                );
                finalCode = buildProjectCode(pCode, namForCodes, giaiDoanStr, uniqSuffix);
            }

            if (!localCodes.includes(finalCode)) localCodes.push(finalCode);
            return { finalCode, duplicateCandidate, duplicateMatchType, duplicateMatchScore };
        };

        const rowBase = {
            ten_du_an: tenAPI, ten_conf: tenConf, ten_warn: tenWarn,
            quy_mo: quyMoAPI, quy_mo_conf: quyMoConf, quy_mo_warn: quyMoWarn,
            dia_diem_ks: diaDiemResolved.value,
            dia_diem_conf: diaDiemConf,
            dia_diem_warn: diaDiemWarn,
            dia_diem_requires_manual: diaDiemResolved.requiresManual,
            tong_muc_dau_tu: tmdtVal, tmdt_conf: tmdtConf, tmdt_warn: tmdtWarn,
        };

        if (neededPhases.length === 2) {
            const resFS = resolveCodeAndMatch('FS');
            newProjectsList.push({
                id: Date.now() + index + 'fs',
                ma_du_an: resFS.finalCode,
                giai_doan: 'FS',
                duplicateCandidate: resFS.duplicateCandidate,
                duplicateMatchType: resFS.duplicateMatchType,
                duplicateMatchScore: resFS.duplicateMatchScore,
                ...rowBase,
            });
            const resTK = resolveCodeAndMatch('TKBVTC');
            newProjectsList.push({
                id: Date.now() + index + 'tk',
                ma_du_an: resTK.finalCode,
                giai_doan: 'TKBVTC',
                duplicateCandidate: resTK.duplicateCandidate,
                duplicateMatchType: resTK.duplicateMatchType,
                duplicateMatchScore: resTK.duplicateMatchScore,
                ...rowBase,
            });
        } else {
            const resBC = resolveCodeAndMatch('BCKTKT');
            newProjectsList.push({
                id: Date.now() + index + 'bc',
                ma_du_an: resBC.finalCode,
                giai_doan: 'BCKTKT',
                duplicateCandidate: resBC.duplicateCandidate,
                duplicateMatchType: resBC.duplicateMatchType,
                duplicateMatchScore: resBC.duplicateMatchScore,
                ...rowBase,
            });
        }
    });

    const projectCount = dsDuAn.filter(p => {
        const ten = p.ten_du_an?.value || p.tenDuAn?.value || p.ten_du_an || p.tenDuAn || '';
        return ten.trim();
    }).length;

    return { masterInfo, projects: newProjectsList, projectCount, qdAPI };
}

function computeScanConfidenceMetrics(masterInfo, projects) {
    const scores = [];
    let warningCount = 0;
    const addScore = (conf) => {
        const c = Number(conf) || 100;
        scores.push(c);
        if (c < 85 && c > 0) warningCount++;
    };

    addScore(masterInfo.qd_giao_a_conf);
    addScore(masterInfo.qd_giao_a_day_du_conf);
    addScore(masterInfo.chu_dau_tu_conf);
    addScore(masterInfo.cap_dien_ap_conf);
    addScore(masterInfo.nam_giao_a_conf);
    projects.forEach(p => {
        addScore(p.ten_conf);
        addScore(p.quy_mo_conf);
        addScore(p.dia_diem_conf);
        addScore(p.tmdt_conf);
    });

    const avgConfidence = scores.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;
    return { avgConfidence, warningCount };
}

export default function NhapDuAnMoi() {
    const router = useRouter();
    const { showAlert, showConfirm } = useAppDialog();
    const [file, setFile] = useState(null);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [batchQueue, setBatchQueue] = useState([]);
    const [activeBatchId, setActiveBatchId] = useState(null);
    const [batchProgress, setBatchProgress] = useState({ completed: 0, total: 0, fileName: '' });
    const [scanPercent, setScanPercent] = useState(0);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // KIỂM TRA QUYỀN
    const [loadingAuth, setLoadingAuth] = useState(true);

    useEffect(() => {
        const { user, perms } = loadAuthSession();
        if (!user) {
            router.push('/login');
            return;
        }
        if (!canSuaDuAn(perms)) {
            showAlert('Tài khoản của anh/chị không được cấp quyền thực hiện chức năng Nhập Dự án mới!').then(() =>
                router.push('/du-an')
            );
            return;
        }
        setLoadingAuth(false);
    }, [router, showAlert]);
    
    // TỐI ƯU: Lưu trữ toàn bộ thông tin dự án cũ để nhận diện trùng lặp
    const [existingProjects, setExistingProjects] = useState([]);
    const [benAUsersDb, setBenAUsersDb] = useState([]);
    
    const [masterInfo, setMasterInfo] = useState({ 
        qd_giao_a: '', qd_giao_a_conf: 100, qd_giao_a_warn: '',
        qd_giao_a_day_du: '', qd_giao_a_day_du_conf: 100, qd_giao_a_day_du_warn: '',
        nam_giao_a: '', nam_giao_a_conf: 100, nam_giao_a_warn: '',
        chu_dau_tu: '', chu_dau_tu_conf: 100, chu_dau_tu_warn: '',
        cap_dien_ap: '110kV', cap_dien_ap_conf: 100, cap_dien_ap_warn: '',
        ben_a_user_id: '',
        ben_a_user_ids: [],
    });
    const [projects, setProjects] = useState([]);
    const [entryMode, setEntryMode] = useState('scan'); // 'scan' | 'manual'
    
    // STATE DÀNH CHO CƠ CHẾ GỘP DỮ LIỆU
    const [mergeModal, setMergeModal] = useState({ isOpen: false, currentProjectIndex: 0, candidates: [], codeChoice: 'old' });

    useEffect(() => {
        if (file) {
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        } else {
            setPreviewUrl(null);
        }
    }, [file]);

    useEffect(() => {
        async function fetchProjects() {
            try {
                const db = await fetchDb();
                setExistingProjects(mapExistingProjectsForDupCheck(db.duAn || []));
                setBenAUsersDb(db.users || []);
            } catch (e) {
                console.warn('Không tải được danh mục DA:', e?.message || e);
            }
        }
        fetchProjects();
    }, []);

    const regenerateAllProjectCodes = (projectList, namOverride = null) => {
        const localCodes = [];
        const existingCodes = existingProjects.map(p => p.ma_du_an);
        const nam =
            namOverride ||
            extractNamGiaoA(masterInfo.qd_giao_a, masterInfo.qd_giao_a_day_du) ||
            String(masterInfo.nam_giao_a || "").trim() ||
            String(new Date().getFullYear());
        const byGroup = {};

        projectList.forEach(p => {
            if (!p.ten_du_an?.trim()) return;
            const key = `${p.ten_du_an.trim().toLowerCase()}|${(p.dia_diem_ks || '').trim().toLowerCase()}`;
            if (!byGroup[key]) byGroup[key] = [];
            byGroup[key].push(p);
        });

        const codeById = {};
        Object.values(byGroup).forEach(rows => {
            const sample = rows[0];
            const phases = [...new Set(rows.map(r => r.giai_doan))];
            const pCode = getProvinceCode(sample.dia_diem_ks, sample.ten_du_an);
            const suffix = resolveSharedAcronymSuffix(pCode, nam, sample.ten_du_an, phases, localCodes, existingCodes);
            rows.forEach(r => {
                const code = buildProjectCode(pCode, nam, r.giai_doan, suffix);
                codeById[r.id] = code;
                if (!localCodes.includes(code)) localCodes.push(code);
            });
        });

        return projectList.map(p => {
            if (!p.ten_du_an?.trim() || !codeById[p.id]) return p;
            return { ...p, ma_du_an: codeById[p.id] };
        });
    };

    /** Đồng bộ số dòng / giai đoạn theo ngày Giao A + TMĐT (mỗi nhóm tên + địa điểm) */
    const reconcileProjectPhases = (projectList, qdGiaoA, qdGiaoADayDu, namOverride = null) => {
        const named = projectList.filter(p => p.ten_du_an?.trim());
        const unnamed = projectList.filter(p => !p.ten_du_an?.trim());
        const byGroup = {};

        named.forEach(p => {
            const key = `${p.ten_du_an.trim().toLowerCase()}|${(p.dia_diem_ks || '').trim().toLowerCase()}`;
            if (!byGroup[key]) byGroup[key] = [];
            byGroup[key].push(p);
        });

        const reconciled = [];

        Object.values(byGroup).forEach(rows => {
            const sample = rows[0];
            const tmdt = parseTmdtTrD(sample.tong_muc_dau_tu);
            const neededPhases = getDesignPhases(qdGiaoA, qdGiaoADayDu, tmdt);
            const rowBase = {
                ten_du_an: sample.ten_du_an,
                ten_conf: sample.ten_conf,
                ten_warn: sample.ten_warn,
                quy_mo: sample.quy_mo,
                quy_mo_conf: sample.quy_mo_conf,
                quy_mo_warn: sample.quy_mo_warn,
                dia_diem_ks: sample.dia_diem_ks,
                dia_diem_conf: sample.dia_diem_conf,
                dia_diem_warn: sample.dia_diem_warn,
                dia_diem_requires_manual: sample.dia_diem_requires_manual,
                tong_muc_dau_tu: tmdt,
                tmdt_conf: sample.tmdt_conf,
                tmdt_warn: sample.tmdt_warn,
            };

            if (neededPhases.length === 1) {
                const keep = rows.find(r => r.giai_doan === 'BCKTKT') || rows[0];
                reconciled.push({
                    ...keep,
                    ...rowBase,
                    giai_doan: 'BCKTKT',
                    duplicateCandidate: keep.duplicateCandidate,
                });
                return;
            }

            const fsRow = rows.find(r => r.giai_doan === 'FS');
            const tkRow = rows.find(r => r.giai_doan === 'TKBVTC');
            const seed = fsRow || tkRow || rows[0];

            reconciled.push({
                ...(fsRow || seed),
                id: fsRow?.id ?? Date.now() + Math.random(),
                ...rowBase,
                giai_doan: 'FS',
                duplicateCandidate: fsRow?.duplicateCandidate ?? seed.duplicateCandidate,
            });
            reconciled.push({
                ...(tkRow || seed),
                id: tkRow?.id ?? Date.now() + Math.random() + 0.001,
                ...rowBase,
                giai_doan: 'TKBVTC',
                duplicateCandidate: tkRow?.duplicateCandidate,
            });
        });

        const next = [...unnamed, ...reconciled];
        return regenerateAllProjectCodes(next, namOverride);
    };

    const applyMasterInfoChange = (updater) => {
        setMasterInfo(prev => {
            const nextMaster = typeof updater === 'function' ? updater(prev) : updater;
            setProjects(current => reconcileProjectPhases(
                current,
                nextMaster.qd_giao_a,
                nextMaster.qd_giao_a_day_du,
                extractNamGiaoA(nextMaster.qd_giao_a, nextMaster.qd_giao_a_day_du) || nextMaster.nam_giao_a
            ));
            return nextMaster;
        });
    };

    const phaseRuleHint = describePhaseRule(masterInfo.qd_giao_a, masterInfo.qd_giao_a_day_du);
    const isKhnMaster = isKhachHangNgoai(masterInfo.chu_dau_tu);

    const createBlankProjectRow = () => ({
        id: Date.now() + Math.random(),
        ma_du_an: '',
        ten_du_an: '',
        quy_mo: '',
        giai_doan: 'BCKTKT',
        dia_diem_ks: '',
        tong_muc_dau_tu: 0,
        ten_conf: 100,
        quy_mo_conf: 100,
        dia_diem_conf: 100,
        dia_diem_warn: '',
        dia_diem_requires_manual: false,
        tmdt_conf: 100,
    });

    const handleStartManual = async () => {
        if (entryMode === 'manual') return;
        if (projects.length > 0 || file || selectedFiles.length > 0 || batchQueue.length > 0) {
            if (!(await showConfirm('Chuyển sang nhập thủ công sẽ thay thế dữ liệu hiện tại. Tiếp tục?'))) return;
        }
        setFile(null);
        setSelectedFiles([]);
        setBatchQueue([]);
        setActiveBatchId(null);
        setEntryMode('manual');
        setMasterInfo(prev => ({
            ...prev,
            qd_giao_a_conf: 100, qd_giao_a_warn: '',
            qd_giao_a_day_du_conf: 100, qd_giao_a_day_du_warn: '',
            chu_dau_tu_conf: 100, chu_dau_tu_warn: '',
            cap_dien_ap_conf: 100, cap_dien_ap_warn: '',
        }));
        setProjects([createBlankProjectRow()]);
    };

    const handleBackToScan = async () => {
        const hasData = projects.some(p => p.ten_du_an?.trim() || p.ma_du_an?.trim() || p.quy_mo?.trim());
        if (hasData || masterInfo.qd_giao_a?.trim() || masterInfo.chu_dau_tu?.trim()) {
            if (!(await showConfirm('Chuyển về chế độ quét PDF sẽ xóa dữ liệu đang nhập. Tiếp tục?'))) return;
        }
        setEntryMode('scan');
        setProjects([]);
        setBatchQueue([]);
        setActiveBatchId(null);
        setSelectedFiles([]);
    };

    const hasUnsavedEntryData = () =>
        projects.some(p => p.ten_du_an?.trim() || p.ma_du_an?.trim() || p.quy_mo?.trim()) ||
        Boolean(masterInfo.qd_giao_a?.trim() || masterInfo.chu_dau_tu?.trim() || masterInfo.qd_giao_a_day_du?.trim()) ||
        Boolean(file) ||
        selectedFiles.length > 0 ||
        batchQueue.length > 0;

    const resetEntryForm = () => {
        setFile(null);
        setSelectedFiles([]);
        setBatchQueue([]);
        setActiveBatchId(null);
        setProjects([]);
        setEntryMode('scan');
        setMergeModal({ isOpen: false, currentProjectIndex: 0, candidates: [], codeChoice: 'old' });
        setMasterInfo({
            qd_giao_a: '', qd_giao_a_conf: 100, qd_giao_a_warn: '',
            qd_giao_a_day_du: '', qd_giao_a_day_du_conf: 100, qd_giao_a_day_du_warn: '',
            nam_giao_a: '', nam_giao_a_conf: 100, nam_giao_a_warn: '',
            chu_dau_tu: '', chu_dau_tu_conf: 100, chu_dau_tu_warn: '',
            cap_dien_ap: '110kV', cap_dien_ap_conf: 100, cap_dien_ap_warn: '',
            ben_a_user_id: '',
            ben_a_user_ids: [],
        });
        const input = document.getElementById('pdf-upload-input');
        if (input) input.value = '';
    };

    const handleCancelOperation = async () => {
        if (isScanning || isSaving || !hasUnsavedEntryData()) return;
        if (!(await showConfirm(
            'Hủy thao tác sẽ xóa toàn bộ dữ liệu đang nhập/quét trên màn hình.\nDữ liệu đã lưu trên cơ sở dữ liệu không bị thay đổi.\n\nTiếp tục hủy?',
            { confirmLabel: 'Hủy thao tác', cancelLabel: 'Quay lại', variant: 'warning' }
        ))) return;
        resetEntryForm();
    };

    const handleGoDashboard = async () => {
        if (hasUnsavedEntryData()) {
            if (!(await showConfirm(
                'Rời trang sẽ bỏ dữ liệu đang nhập/quét trên màn hình.\nDữ liệu trên cơ sở dữ liệu không bị thay đổi nếu anh/chị chưa bấm Lưu.\n\nVề danh mục dự án?',
                { confirmLabel: 'Về danh mục', cancelLabel: 'Ở lại' }
            ))) return;
        }
        router.push('/du-an');
    };

    const handleAddRow = () => {
        setProjects(prev => [...prev, createBlankProjectRow()]);
    };

    const handleFilesSelected = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) {
            setSelectedFiles([]);
            setFile(null);
            setBatchQueue([]);
            setActiveBatchId(null);
            return;
        }
        if (files.length > MAX_BATCH_FILES) {
            await showAlert(`Chỉ được chọn tối đa ${MAX_BATCH_FILES} file (< 10 file) để tránh quá tải hệ thống.`);
            e.target.value = '';
            return;
        }
        const invalid = files.filter(f => f.type !== 'application/pdf');
        if (invalid.length > 0) {
            await showAlert('Chỉ chấp nhận file PDF.');
            e.target.value = '';
            return;
        }
        setSelectedFiles(files);
        setFile(files.length === 1 ? files[0] : null);
        setBatchQueue([]);
        setActiveBatchId(null);
        setProjects([]);
        setMasterInfo({
            qd_giao_a: '', qd_giao_a_conf: 100, qd_giao_a_warn: '',
            qd_giao_a_day_du: '', qd_giao_a_day_du_conf: 100, qd_giao_a_day_du_warn: '',
            nam_giao_a: '', nam_giao_a_conf: 100, nam_giao_a_warn: '',
            chu_dau_tu: '', chu_dau_tu_conf: 100, chu_dau_tu_warn: '',
            cap_dien_ap: '110kV', cap_dien_ap_conf: 100, cap_dien_ap_warn: '',
            ben_a_user_id: '',
            ben_a_user_ids: [],
        });
    };

    const syncActiveBatchItem = () => {
        if (!activeBatchId) return;
        const metrics = computeScanConfidenceMetrics(masterInfo, projects);
        setBatchQueue(prev => prev.map(item => {
            if (item.id !== activeBatchId || item.status !== 'done') return item;
            return {
                ...item,
                masterInfo: { ...masterInfo },
                projects: projects.map(p => ({ ...p })),
                avgConfidence: metrics.avgConfidence,
                warningCount: metrics.warningCount,
            };
        }));
    };

    const loadBatchItemForReview = (batchItem) => {
        if (activeBatchId && activeBatchId !== batchItem.id) syncActiveBatchItem();
        if (!batchItem || batchItem.status !== 'done') return;
        setActiveBatchId(batchItem.id);
        setFile(batchItem.file);
        setMasterInfo({ ...batchItem.masterInfo });
        setProjects(batchItem.projects.map(p => ({ ...p })));
        setEntryMode('scan');
    };

    const handleMarkBatchReviewed = async () => {
        if (!activeBatchId) {
            await showAlert('Vui lòng chọn một file trong danh sách batch để duyệt.');
            return;
        }
        const metrics = computeScanConfidenceMetrics(masterInfo, projects);
        setBatchQueue(prev => prev.map(item =>
            item.id === activeBatchId ? {
                ...item,
                masterInfo: { ...masterInfo },
                projects: projects.map(p => ({ ...p })),
                avgConfidence: metrics.avgConfidence,
                warningCount: metrics.warningCount,
                reviewStatus: 'reviewed',
            } : item
        ));
    };

    const clampScanPercent = (value) => Math.max(1, Math.min(100, Math.round(value)));

    const updateOverallScanPercent = (completedFiles, totalFiles, currentFilePercent = 0) => {
        if (totalFiles <= 0) return;
        if (completedFiles >= totalFiles) {
            setScanPercent(100);
            return;
        }
        const overall = Math.round(((completedFiles + currentFilePercent / 100) / totalFiles) * 100);
        if (completedFiles === 0 && currentFilePercent <= 1) {
            setScanPercent(1);
            return;
        }
        setScanPercent(clampScanPercent(Math.min(99, overall)));
    };

    const scanSingleFile = async (scanFile, existingProjectsList, seenQdSet = new Set(), onProgress = null) => {
        const formData = new FormData();
        formData.append('file', scanFile);

        const data = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/parse-giao-a');
            xhr.onload = () => {
                try {
                    const parsed = JSON.parse(xhr.responseText || '{}');
                    if (xhr.status >= 200 && xhr.status < 300) {
                        if (onProgress) onProgress(95);
                        resolve(parsed);
                    } else {
                        const err = new Error(parsed.error || 'Lỗi từ máy chủ khi quét tài liệu.');
                        err.status = xhr.status;
                        reject(err);
                    }
                } catch {
                    reject(new Error('Lỗi từ máy chủ khi quét tài liệu.'));
                }
            };
            xhr.onerror = () => reject(new Error('Không thể kết nối máy chủ.'));
            xhr.onabort = () => reject(new Error('Đã hủy quét tài liệu.'));
            if (onProgress) {
                onProgress(1);
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable && e.total > 0) {
                        const uploadPct = Math.round((e.loaded / e.total) * 25);
                        onProgress(clampScanPercent(Math.max(2, uploadPct)));
                    }
                };
            }
            xhr.send(formData);
        });

        if (onProgress) onProgress(98);

        const { masterInfo: mi, projects: pl, projectCount, qdAPI } = buildScanResultFromApiData(data, existingProjectsList);
        const metrics = computeScanConfidenceMetrics(mi, pl);

        let duplicateQdInDb = false;
        if (qdAPI) {
            duplicateQdInDb = existingProjectsList.some(
                (p) => String(p.qd_giao_a || "").trim().toLowerCase() === String(qdAPI).trim().toLowerCase()
            );
        }

        const duplicateQdInBatch = qdAPI ? seenQdSet.has(qdAPI.trim().toLowerCase()) : false;
        if (qdAPI) seenQdSet.add(qdAPI.trim().toLowerCase());

        if (onProgress) onProgress(100);

        return {
            masterInfo: mi,
            projects: pl,
            projectCount,
            qdAPI,
            duplicateQdInDb,
            duplicateQdInBatch,
            ...metrics,
        };
    };

    const scanSingleFileWithRetry = async (scanFile, existingProjectsList, seenQdSet, onProgress, onRetryWait) => {
        let lastError;
        for (let attempt = 0; attempt <= BATCH_SCAN_MAX_RETRIES; attempt++) {
            try {
                return await scanSingleFile(scanFile, existingProjectsList, seenQdSet, onProgress);
            } catch (err) {
                lastError = err;
                if (!isRetryableScanError(err) || attempt >= BATCH_SCAN_MAX_RETRIES) throw err;
                const waitMs = parseRetryAfterMs(err.message)
                    ?? (err.status === 503 ? 65000 : BATCH_FILE_COOLDOWN_MS);
                if (onRetryWait) onRetryWait(waitMs, attempt + 1);
                await sleep(waitMs);
            }
        }
        throw lastError;
    };

    const handleBatchScan = async (filesToScan) => {
        setIsScanning(true);
        setScanPercent(1);
        setBatchProgress({ completed: 0, total: filesToScan.length, fileName: '' });

        const initialQueue = filesToScan.map((f, i) => ({
            id: `batch-${Date.now()}-${i}`,
            file: f,
            fileName: f.name,
            status: 'pending',
            reviewStatus: 'pending',
            masterInfo: null,
            projects: [],
            projectCount: 0,
            avgConfidence: 0,
            warningCount: 0,
            duplicateQdInDb: false,
            duplicateQdInBatch: false,
            qdAPI: '',
            errorMessage: '',
        }));
        setBatchQueue(initialQueue);
        setActiveBatchId(null);
        setProjects([]);
        setFile(null);

        const seenQdSet = new Set();
        let successCount = 0;
        let errorCount = 0;
        const updatedQueue = [...initialQueue];

        for (let i = 0; i < filesToScan.length; i++) {
            const scanFile = filesToScan[i];

            if (i > 0) {
                updatedQueue[i] = { ...updatedQueue[i], status: 'cooldown' };
                setBatchQueue([...updatedQueue]);
                setBatchProgress({
                    completed: i,
                    total: filesToScan.length,
                    fileName: `Chờ ${Math.round(BATCH_FILE_COOLDOWN_MS / 1000)}s trước file ${i + 1}/${filesToScan.length}...`,
                });
                await sleep(BATCH_FILE_COOLDOWN_MS);
            }

            setBatchProgress({ completed: i, total: filesToScan.length, fileName: scanFile.name });
            updateOverallScanPercent(i, filesToScan.length, 1);
            updatedQueue[i] = { ...updatedQueue[i], status: 'scanning', errorMessage: '' };
            setBatchQueue([...updatedQueue]);

            try {
                const result = await scanSingleFileWithRetry(
                    scanFile,
                    existingProjects,
                    seenQdSet,
                    (filePct) => updateOverallScanPercent(i, filesToScan.length, filePct),
                    (waitMs, attempt) => {
                        updatedQueue[i] = {
                            ...updatedQueue[i],
                            status: 'scanning',
                            errorMessage: `Quota API — thử lại lần ${attempt} sau ${Math.round(waitMs / 1000)}s`,
                        };
                        setBatchQueue([...updatedQueue]);
                        setBatchProgress({
                            completed: i,
                            total: filesToScan.length,
                            fileName: `${scanFile.name} (chờ API ${Math.round(waitMs / 1000)}s, lần ${attempt})...`,
                        });
                    }
                );
                updatedQueue[i] = {
                    ...updatedQueue[i],
                    status: 'done',
                    masterInfo: result.masterInfo,
                    projects: result.projects,
                    projectCount: result.projectCount,
                    avgConfidence: result.avgConfidence,
                    warningCount: result.warningCount,
                    duplicateQdInDb: result.duplicateQdInDb,
                    duplicateQdInBatch: result.duplicateQdInBatch,
                    qdAPI: result.qdAPI,
                };
                successCount++;

                logHoatDong({
                    phanHe: 'DA',
                    hanhDong: 'AI_SCAN',
                    chiTietNgan: `AI batch — ${scanFile.name}`,
                    duLieuDong: {
                        so_luong_du_an: result.projectCount,
                        qd_giao_a: result.qdAPI,
                        avg_confidence: result.avgConfidence,
                        file_name: scanFile.name,
                    },
                });
            } catch (error) {
                updatedQueue[i] = {
                    ...updatedQueue[i],
                    status: 'error',
                    errorMessage: error.message || 'Lỗi quét file',
                };
                errorCount++;
                logHoatDong({
                    phanHe: 'DA',
                    hanhDong: 'AI_SCAN_FAIL',
                    chiTietNgan: `AI batch lỗi — ${scanFile.name}`,
                    trangThai: 'Thất bại',
                    duLieuDong: { error: error.message, file_name: scanFile.name },
                });
            }
            setBatchProgress({ completed: i + 1, total: filesToScan.length, fileName: '' });
            updateOverallScanPercent(i + 1, filesToScan.length, 0);
            setBatchQueue([...updatedQueue]);
        }

        setScanPercent(100);
        setBatchProgress({ completed: filesToScan.length, total: filesToScan.length, fileName: '' });
        setIsScanning(false);

        const firstDone = updatedQueue.find(b => b.status === 'done');
        if (firstDone) loadBatchItemForReview(firstDone);

        await showAlert(
            `Hoàn tất quét batch!\n` +
            `✅ Thành công: ${successCount} file\n` +
            (errorCount ? `❌ Lỗi: ${errorCount} file\n` : '') +
            `\nVui lòng duyệt từng file trước khi lưu.`
        );
    };

    const handleScanPDF = async () => {
        const filesToScan = selectedFiles.length > 0 ? selectedFiles : (file ? [file] : []);
        if (filesToScan.length === 0) {
            await showAlert('Vui lòng chọn file Quyết định Giao A đính kèm!');
            return;
        }

        if (filesToScan.length > 1) {
            return handleBatchScan(filesToScan);
        }

        const scanFile = filesToScan[0];
        setFile(scanFile);
        setIsScanning(true);
        setScanPercent(1);
        setBatchProgress({ completed: 0, total: 1, fileName: scanFile.name });

        try {
            const result = await scanSingleFile(scanFile, existingProjects, new Set(), (filePct) => {
                updateOverallScanPercent(0, 1, filePct);
            });
            setScanPercent(100);

            if (result.duplicateQdInDb) {
                await showAlert(`Cảnh báo: Quyết định số "${result.qdAPI}" đã có trong hệ thống. Việc quét lại sẽ sinh ra các bản ghi cập nhật.`);
            }

            setMasterInfo(result.masterInfo);
            setProjects(result.projects);
            setEntryMode('scan');
            setBatchQueue([]);
            setActiveBatchId(null);

            logHoatDong({
                phanHe: 'DA',
                hanhDong: 'AI_SCAN',
                chiTietNgan: `AI bóc tách QĐ Giao A: ${scanFile.name}`,
                duLieuDong: {
                    so_luong_du_an: result.projectCount,
                    so_dong_giai_doan: result.projects.length,
                    qd_giao_a: result.qdAPI,
                    avg_confidence: result.avgConfidence,
                    file_name: scanFile.name,
                },
            });

            if (result.projectCount > 0) {
                const dupTable = buildDuplicateScanTable(result.projects);
                if (dupTable) {
                    await showAlert(
                        `Quét thành công! Đã bóc tách được ${result.projectCount} dự án. (ĐTB tin cậy: ${result.avgConfidence}%)`,
                        {
                            variant: 'warning',
                            title: 'Quét xong — cần xem lại',
                            table: dupTable,
                            size: 'xl',
                        }
                    );
                } else {
                    await showAlert(`Quét thành công! Đã bóc tách được ${result.projectCount} dự án. (ĐTB tin cậy: ${result.avgConfidence}%)`);
                }
            } else {
                await showAlert('Quét thành công nhưng không tìm thấy dự án nào trong file!');
            }
        } catch (error) {
            console.error('Chi tiết lỗi quét PDF:', error);
            await showAlert(error.message || 'Lỗi khi quét tài liệu. Nhấn F12 (Console) để xem chi tiết lỗi kỹ thuật.');
            logHoatDong({
                phanHe: 'DA',
                hanhDong: 'AI_SCAN_FAIL',
                chiTietNgan: 'Lỗi AI bóc tách QĐ Giao A',
                trangThai: 'Thất bại',
                duLieuDong: { error: error.message },
            });
        } finally {
            setIsScanning(false);
            setTimeout(() => {
                setScanPercent(0);
                setBatchProgress({ completed: 0, total: 0, fileName: '' });
            }, 500);
        }
    };

    const handleSaveAll = async () => {
        const validProjects = projects.filter(p => p.ten_du_an?.trim());
        if (validProjects.length === 0) {
            await showAlert("Chưa có dữ liệu dự án! Vui lòng nhập ít nhất một tên dự án.");
            return;
        }
        const isKhn = isKhachHangNgoai(masterInfo.chu_dau_tu);
        if (!isKhn && !String(masterInfo.qd_giao_a || "").trim()) {
            await showAlert("Vui lòng nhập hoặc quét Số quyết định giao A!");
            return;
        }
        if (isKhn && !normalizeChuDauTu(masterInfo.chu_dau_tu)) {
            await showAlert("Dự án khách hàng ngoài: vui lòng chọn Chủ đầu tư = Khách hàng ngoài (hoặc gõ KHN).");
            return;
        }
        if (!(masterInfo.ben_a_user_ids || []).length) {
            await showAlert(
                "Vui lòng chọn ít nhất một Tài khoản Bên A trước khi lưu.\nCó thể chọn nhiều người (nhóm)."
            );
            return;
        }
        const namGiaoA =
            extractNamGiaoA(masterInfo.qd_giao_a, masterInfo.qd_giao_a_day_du) ||
            String(masterInfo.nam_giao_a || "").trim() ||
            (isKhn ? String(new Date().getFullYear()) : "");
        if (!namGiaoA) {
            await showAlert(
                isKhn
                    ? "Vui lòng nhập Năm (vd. 2026) — dùng để sinh mã dự án khi không có QĐ Giao A."
                    : "Không xác định được năm Giao A từ Số QĐ. Vui lòng nhập đủ dạng: ... ngày dd/mm/yyyy"
            );
            return;
        }

        if (batchQueue.length > 0 && activeBatchId) {
            syncActiveBatchItem();
            const item = batchQueue.find(b => b.id === activeBatchId);
            if (item?.reviewStatus !== 'reviewed') {
                await showAlert('Vui lòng kiểm tra dữ liệu và bấm "Xác nhận đã duyệt" trước khi lưu file này.');
                return;
            }
        }
        
        // KIỂM TRA TRÙNG LẶP TRƯỚC KHI LƯU
        const candidates = projects.filter(p => p.ten_du_an?.trim() && p.duplicateCandidate);
        
        if (candidates.length > 0) {
            setMergeModal({
                isOpen: true,
                currentProjectIndex: 0,
                candidates,
                codeChoice: preferNewMaWhenReplacing(candidates[0]?.duplicateCandidate?.ma_du_an)
                    ? "new"
                    : "old",
            });
            return;
        }

        await processSaving();
    };

    const processSaving = async () => {
        setIsSaving(true);
        let projectsToSave = projects.filter(p => p.ten_du_an?.trim());
        const isKhn = isKhachHangNgoai(masterInfo.chu_dau_tu);
        const namGiaoA =
            extractNamGiaoA(masterInfo.qd_giao_a, masterInfo.qd_giao_a_day_du) ||
            String(masterInfo.nam_giao_a || "").trim() ||
            (isKhn ? String(new Date().getFullYear()) : "");
        try {
            const { user } = loadAuthSession();
            const existingCodes = existingProjects.map((p) => p.ma_du_an);
            const { projects: uniqueProjects, fixedCodes } = ensureUniqueProjectCodes(
                projectsToSave,
                existingCodes
            );
            if (fixedCodes.length) {
                projectsToSave = uniqueProjects;
                setProjects((prev) => {
                    const byId = new Map(uniqueProjects.map((p) => [p.id, p.ma_du_an]));
                    return prev.map((p) =>
                        byId.has(p.id) ? { ...p, ma_du_an: byId.get(p.id) } : p
                    );
                });
                const preview = fixedCodes.slice(0, 8).join("\n");
                const more =
                    fixedCodes.length > 8 ? `\n… và ${fixedCodes.length - 8} mã khác` : "";
                const cont = await showConfirm(
                    `Phát hiện mã dự án trùng trong danh sách lưu.\n\nĐã tự đổi mã:\n${preview}${more}\n\nTiếp tục lưu?`,
                    {
                        title: "Mã dự án trùng — đã chỉnh",
                        variant: "warning",
                        confirmLabel: "Lưu tiếp",
                        cancelLabel: "Hủy để kiểm tra",
                    }
                );
                if (!cont) {
                    setIsSaving(false);
                    return;
                }
            } else {
                projectsToSave = uniqueProjects;
            }

            const projectCodes = projectsToSave.map(p => p.ma_du_an);
            const duplicateProjects = existingProjects.filter((d) =>
                projectCodes.includes(d.ma_du_an)
            );

            if (duplicateProjects.length > 0) {
                const dupCodes = duplicateProjects.map(d => d.ma_du_an).join(', ');
                const confirmSave = await showConfirm(`CẢNH BÁO: Phát hiện các dự án đã tồn tại (Mã: ${dupCodes}).\n\nHệ thống sẽ TIẾN HÀNH GHI ĐÈ / CẬP NHẬT thông tin mới nhất vào các dự án này. Bạn có đồng ý không?`);
                if (!confirmSave) {
                    setIsSaving(false);
                    return;
                }
            }

            const projectsToReplaceOldCode = projectsToSave.filter((p) => {
                const oldMa =
                    p.replaceOldMaDuAn ||
                    (p.duplicateCandidate?.ma_du_an &&
                    p.duplicateCandidate.ma_du_an !== p.ma_du_an
                        ? p.duplicateCandidate.ma_du_an
                        : "");
                return Boolean(oldMa && oldMa !== p.ma_du_an);
            });

            // PDF Giao A: upload Storage (Supabase) hoặc IndexedDB (local)
            let fileUrl = null;
            if (file) {
                const { uploadPdfGiaoAGoc } = await import("../../lib/pdfGiaoAStorage");
                fileUrl = await uploadPdfGiaoAGoc(file, masterInfo.qd_giao_a);
            }

            let existingKhnQds = [];
            if (isKhn) {
                existingKhnQds = existingProjects
                    .map((r) => r.qd_giao_a)
                    .filter((qd) => String(qd || "").toUpperCase().startsWith(`KHN-${namGiaoA}-`));
            }

            const cdtNormalized = normalizeChuDauTu(masterInfo.chu_dau_tu);
            const khnReservedSlugs = [];
            const khnCodeByTen = new Map();

            const payload = dedupeUpsertPayloadByMaDuAn(
                projectsToSave.map((p) => {
                    let qd = masterInfo.qd_giao_a;
                    let qdDayDu = masterInfo.qd_giao_a_day_du;
                    if (isKhn && needsKhnQdAssignment(qd, cdtNormalized)) {
                        const tenKey = String(p.ten_du_an || "")
                            .trim()
                            .toLowerCase()
                            .replace(/\s+/g, " ");
                        if (!khnCodeByTen.has(tenKey)) {
                            const assigned = assignKhnQdForCongTrinh({
                                tenDuAn: p.ten_du_an,
                                year: namGiaoA,
                                existingQdList: existingKhnQds,
                                reservedSlugs: khnReservedSlugs,
                            });
                            khnReservedSlugs.push(assigned.slug);
                            khnCodeByTen.set(tenKey, assigned);
                        }
                        const assigned = khnCodeByTen.get(tenKey);
                        qd = assigned.qd;
                        qdDayDu = assigned.dayDu;
                    } else if (isKhn && String(qd || "").trim()) {
                        qdDayDu = qdDayDu || formatKhnQdDayDu(qd);
                    }
                    return {
                        ma_du_an: p.ma_du_an,
                        ten_du_an: p.ten_du_an,
                        quy_mo: p.quy_mo,
                        giai_doan: p.giai_doan,
                        dia_diem_ks: p.dia_diem_ks,
                        tmdt: p.tong_muc_dau_tu,
                        qd_giao_a: qd,
                        qd_giao_a_day_du: qdDayDu,
                        nam_giao_a: namGiaoA,
                        chu_dau_tu: cdtNormalized,
                        cap_dien_ap: masterInfo.cap_dien_ap,
                        ben_a_user_ids: masterInfo.ben_a_user_ids || [],
                        ben_a_user_id: (masterInfo.ben_a_user_ids || [])[0] || "",
                        ...(fileUrl && { link_pdf_giao_a_goc: fileUrl }),
                    };
                })
            );

            if (!payload.length) {
                throw new Error("Không có dòng hợp lệ để lưu (thiếu mã dự án).");
            }

            await saveNhapDuAnPayload({
                payload,
                projectsToReplaceOldCode,
                user,
                entryMode,
                pdfFileName: file?.name || "",
            });

            // refresh danh mục trùng
            const db = await fetchDb();
            setExistingProjects(mapExistingProjectsForDupCheck(db.duAn || []));

            if (activeBatchId) {
                syncActiveBatchItem();
                const nextQueue = batchQueue.map(item =>
                    item.id === activeBatchId ? { ...item, reviewStatus: 'saved' } : item
                );
                setBatchQueue(nextQueue);
                const allHandled = nextQueue.every(b => b.status === 'error' || b.reviewStatus === 'saved');
                const pendingSave = nextQueue.filter(b => b.status === 'done' && b.reviewStatus === 'reviewed');
                const pendingReview = nextQueue.filter(b => b.status === 'done' && b.reviewStatus === 'pending');
                const nextItem = pendingSave[0] || pendingReview[0];

                await showAlert('🎉 Đã lưu file hiện tại thành công!');
                logHoatDong({
                    phanHe: 'DA',
                    hanhDong: 'CREATE',
                    chiTietNgan: `Batch — Lưu ${projectsToSave.length} dự án từ QĐ ${masterInfo.qd_giao_a}`,
                    duLieuDong: {
                        so_luong: projectsToSave.length,
                        so_quyet_dinh: masterInfo.qd_giao_a,
                        file_name: file?.name,
                    },
                });

                if (!allHandled && nextItem) {
                    if (await showConfirm(`Chuyển sang file "${nextItem.fileName}"?`)) {
                        loadBatchItemForReview(nextItem);
                    }
                } else if (allHandled) {
                    router.push('/du-an');
                }
                setIsSaving(false);
                return;
            }

            await showAlert("🎉 Đã lưu trữ / cập nhật thành công danh sách dự án!");
            
            logHoatDong({
                phanHe: 'DA',
                hanhDong: 'CREATE',
                chiTietNgan: entryMode === 'manual'
                    ? `Thêm mới/Cập nhật ${projectsToSave.length} dự án (nhập thủ công)`
                    : `Thêm mới/Cập nhật ${projectsToSave.length} dự án từ QĐ Giao A`,
                duLieuDong: {
                    so_luong: projectsToSave.length,
                    so_quyet_dinh: masterInfo.qd_giao_a,
                    danh_sach_du_an: projects.map(p => p.ten_du_an)
                }
            });
            
            router.push('/du-an');
        } catch (error) {
            console.error("Lỗi khi lưu:", error);
            await showAlert("Lỗi khi lưu dữ liệu: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const updateProjectField = (id, field, value) => {
        setProjects(prev => {
            const target = prev.find(p => p.id === id);
            if (!target) return prev;

            let next = prev.map(p => {
                if (p.id === id) {
                    if (field === 'dia_diem_ks') {
                        const trimmed = String(value).trim();
                        return {
                            ...p,
                            dia_diem_ks: value,
                            dia_diem_requires_manual: trimmed ? false : p.dia_diem_requires_manual,
                            dia_diem_conf: trimmed ? 100 : p.dia_diem_conf,
                            dia_diem_warn: trimmed ? '' : p.dia_diem_warn,
                        };
                    }
                    return { ...p, [field]: value };
                }
                if (field === 'ten_du_an' && target.ten_du_an?.trim()) {
                    const sameGroup =
                        p.ten_du_an?.trim().toLowerCase() === target.ten_du_an.trim().toLowerCase() &&
                        (p.dia_diem_ks || '').trim().toLowerCase() === (target.dia_diem_ks || '').trim().toLowerCase();
                    if (sameGroup) return { ...p, ten_du_an: value };
                }
                return p;
            });

            if (field === 'ten_du_an' || field === 'giai_doan' || field === 'dia_diem_ks') {
                next = regenerateAllProjectCodes(next);
            }
            if (field === 'tong_muc_dau_tu') {
                next = reconcileProjectPhases(next, masterInfo.qd_giao_a, masterInfo.qd_giao_a_day_du);
            }
            return next;
        });
    };
    
    const removeRow = (id) => setProjects(projects.filter(p => p.id !== id));

    const renderConfidenceInput = (value, onChange, confidence, warning, className, placeholder = "Trống", requiresManual = false) => {
        const isLowConf = confidence < 85 && confidence > 0;
        const isManualRequired = requiresManual && !String(value || '').trim();
        const warnMessage = warning || (isManualRequired ? 'Vui lòng nhập địa điểm khảo sát.' : 'Cảnh báo: Độ tin cậy thấp, vui lòng kiểm tra lại.');
        return (
            <div className="relative group w-full">
                <input 
                    type="text" 
                    placeholder={placeholder} 
                    className={`${className} ${isManualRequired ? '!bg-red-50/60 focus:!ring-red-400/50 placeholder:text-red-300' : isLowConf ? '!bg-amber-50/50 focus:!ring-amber-400/50' : ''}`} 
                    value={value} 
                    onChange={onChange} 
                />
                {(isManualRequired || isLowConf) && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 cursor-help z-10">
                        <span className={`animate-pulse font-bold ${isManualRequired ? 'text-red-500' : 'text-amber-500'}`}>⚠️</span>
                        <div className="absolute bottom-full right-0 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                            {warnMessage}
                            <div className="absolute top-full right-2 border-4 border-transparent border-t-gray-800"></div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderConfidenceTextarea = (value, onChange, confidence, warning, className, placeholder = "Trống") => {
        const isLowConf = confidence < 85 && confidence > 0;
        return (
            <div className="relative group w-full flex items-center">
                <textarea 
                    rows={1} 
                    placeholder={placeholder} 
                    className={`${className} ${isLowConf ? '!bg-amber-50/50 focus:!ring-amber-400/50' : ''}`} 
                    value={value} 
                    onChange={onChange}
                />
                {isLowConf && (
                    <div className="absolute right-2 top-3 cursor-help z-10">
                        <span className="animate-pulse text-amber-500 font-bold">⚠️</span>
                        <div className="absolute bottom-full right-0 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                            {warning || 'Cảnh báo: Độ tin cậy thấp, vui lòng kiểm tra lại.'}
                            <div className="absolute top-full right-2 border-4 border-transparent border-t-gray-800"></div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // HÀM XỬ LÝ KHI NGƯỜI DÙNG QUYẾT ĐỊNH MERGE
    const openMergeModalForProject = (projectId) => {
        const candidates = projects.filter(p => p.ten_du_an?.trim() && p.duplicateCandidate);
        if (candidates.length === 0) return;

        const index = candidates.findIndex(p => p.id === projectId);
        const start = index >= 0 ? index : 0;
        setMergeModal({
            isOpen: true,
            currentProjectIndex: start,
            candidates,
            codeChoice: preferNewMaWhenReplacing(candidates[start]?.duplicateCandidate?.ma_du_an)
                ? "new"
                : "old",
        });
    };

    const handleCancelMerge = () => {
        setMergeModal({ isOpen: false, currentProjectIndex: 0, candidates: [], codeChoice: 'old' });
    };

    const handleMergeNavigate = (delta) => {
        setMergeModal(prev => {
            const nextIndex = prev.currentProjectIndex + delta;
            if (nextIndex < 0 || nextIndex >= prev.candidates.length) return prev;
            const nextCand = prev.candidates[nextIndex];
            return {
                ...prev,
                currentProjectIndex: nextIndex,
                codeChoice: preferNewMaWhenReplacing(nextCand?.duplicateCandidate?.ma_du_an)
                    ? "new"
                    : "old",
            };
        });
    };

    const handleResolveMerge = async (decision) => {
        const currentCandidate = mergeModal.candidates[mergeModal.currentProjectIndex];
        const codeChoice = mergeModal.codeChoice || 'old';

        setProjects(prev => prev.map(p => {
            if (p.id !== currentCandidate.id) return p;
            const newP = { ...p };
            if (decision === 'REPLACE') {
                const oldMa = newP.duplicateCandidate?.ma_du_an;
                const newMa = newP.ma_du_an;

                if (codeChoice === 'old' && oldMa) {
                    newP.ma_du_an = oldMa;
                    delete newP.replaceOldMaDuAn;
                } else if (codeChoice === 'new' && oldMa && oldMa !== newMa) {
                    newP.replaceOldMaDuAn = oldMa;
                } else {
                    delete newP.replaceOldMaDuAn;
                }
            } else {
                delete newP.replaceOldMaDuAn;
            }
            delete newP.duplicateCandidate;
            return newP;
        }));

        if (mergeModal.currentProjectIndex < mergeModal.candidates.length - 1) {
            const nextCand = mergeModal.candidates[mergeModal.currentProjectIndex + 1];
            setMergeModal(prev => ({
                ...prev,
                currentProjectIndex: prev.currentProjectIndex + 1,
                codeChoice: preferNewMaWhenReplacing(nextCand?.duplicateCandidate?.ma_du_an)
                    ? "new"
                    : "old",
            }));
        } else {
            setMergeModal({ isOpen: false, currentProjectIndex: 0, candidates: [], codeChoice: 'old' });
            await showAlert("Đã giải quyết xong các cảnh báo trùng lặp. Anh/Chị vui lòng kiểm tra lại bảng và bấm 'LƯU VÀO CƠ SỞ DỮ LIỆU' một lần nữa.");
        }
    };

    const displayScanPercent = isScanning ? scanPercent : 0;

    const fileAreaLabel = (() => {
        if (isScanning) {
            if (batchProgress.fileName) {
                return batchProgress.total > 1
                    ? `Đang quét (${batchProgress.completed + 1}/${batchProgress.total}): ${batchProgress.fileName}`
                    : `Đang quét: ${batchProgress.fileName}`;
            }
            return 'Đang quét dữ liệu...';
        }
        if (selectedFiles.length === 1) return selectedFiles[0].name;
        if (selectedFiles.length > 1) return `Đã chọn ${selectedFiles.length} file PDF`;
        if (file) return file.name;
        return 'Chọn tối đa 9 file PDF để xử lý, duyệt từng file trước khi lưu';
    })();

    if (loadingAuth) return null;

    return (
        <div className="min-h-screen bg-slate-50 relative flex flex-col antialiased">
            <header className="bg-white border-b border-gray-100 px-6 md:px-10 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-50 text-blue-600 border border-blue-100 p-2 rounded-xl">
                        <FileText className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-[17px] font-black text-slate-800 tracking-tight uppercase leading-none">NHẬP THÔNG TIN DỰ ÁN MỚI</h1>
                        <p className="text-[11px] font-semibold text-gray-400 mt-1.5 uppercase tracking-wider leading-none">
                            {entryMode === 'scan'
                                ? 'Tải lên file giao A (pdf) để hệ thống tự nhận dạng, phân loại dữ liệu.'
                                : 'Nhập thủ công thông tin quyết định và danh sách dự án bên dưới.'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={handleGoDashboard} className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition cursor-pointer text-xs shadow-sm">
                        <ArrowLeft className="w-4 h-4"/> Về danh mục
                    </button>
                </div>
            </header>

            <main className="flex-1 w-full px-4 md:px-10 py-6 space-y-6">
                {entryMode === 'scan' ? (
                    <div className="space-y-4">
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 flex flex-col md:flex-row items-center gap-4 shadow-sm">
                            <div className="flex-1 w-full">
                                <div className={`relative rounded-xl border overflow-hidden transition-colors ${isScanning ? 'border-blue-200 bg-white' : 'border-gray-200 bg-slate-50'}`}>
                                    {isScanning && (
                                        <div
                                            className="absolute inset-y-0 left-0 bg-blue-100/70 transition-all duration-500 ease-out pointer-events-none"
                                            style={{ width: `${displayScanPercent}%` }}
                                        />
                                    )}
                                    <div className="relative flex items-center gap-3 px-3 py-2.5 min-h-[44px]">
                                        <label
                                            htmlFor="pdf-upload-input"
                                            className={`shrink-0 py-1.5 px-4 rounded-lg text-xs font-bold text-white transition-colors select-none ${isScanning ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'}`}
                                        >
                                            Chọn Tệp
                                        </label>
                                        <span className={`flex-1 text-xs truncate ${isScanning ? 'text-blue-800 font-semibold' : (selectedFiles.length || file) ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                                            {fileAreaLabel}
                                        </span>
                                        {isScanning && (
                                            <span className="shrink-0 text-xs font-black text-blue-700 tabular-nums min-w-[36px] text-right">
                                                {displayScanPercent}%
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        id="pdf-upload-input"
                                        type="file"
                                        accept="application/pdf"
                                        multiple
                                        onChange={handleFilesSelected}
                                        disabled={isScanning}
                                        className="hidden"
                                    />
                                </div>
                            </div>
                            <button 
                                onClick={handleScanPDF} 
                                disabled={isScanning || (selectedFiles.length === 0 && !file)} 
                                className={`w-full md:w-auto px-8 py-3 rounded-xl font-bold text-sm flex items-center justify-center transition-all text-white shadow-sm shrink-0 ${isScanning || (selectedFiles.length === 0 && !file) ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 cursor-pointer hover:shadow-md'}`}
                            >
                                {isScanning ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : (selectedFiles.length > 1 ? <Files className="w-5 h-5 mr-2" /> : <FileSearch className="w-5 h-5 mr-2" />)}
                                {isScanning
                                    ? (batchProgress.total > 1
                                        ? `Đang quét ${batchProgress.completed + 1}/${batchProgress.total}...`
                                        : 'Đang quét dữ liệu...')
                                    : (selectedFiles.length > 1
                                        ? `Quét batch (${selectedFiles.length} file)`
                                        : 'Quét dữ liệu')}
                            </button>
                            {!isScanning && (
                                <button
                                    onClick={handleStartManual}
                                    className="w-full md:w-auto px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center transition-all shadow-sm border-2 border-emerald-500 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 cursor-pointer shrink-0"
                                >
                                    <Plus className="w-5 h-5 mr-2" />
                                    Tạo mới thủ công
                                </button>
                            )}
                        </div>

                        {batchQueue.length > 0 && (
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                                    <Files className="w-4 h-4 text-indigo-600" />
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Kết quả quét batch</h3>
                                    <span className="text-[10px] font-bold text-gray-400 ml-auto">
                                        {batchQueue.filter(b => b.reviewStatus === 'saved').length}/{batchQueue.filter(b => b.status === 'done').length} đã lưu
                                    </span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-[12px]">
                                        <thead className="bg-slate-50 text-[10px] uppercase font-bold text-gray-500">
                                            <tr>
                                                <th className="px-4 py-3 text-center w-10">#</th>
                                                <th className="px-4 py-3">Tên file</th>
                                                <th className="px-4 py-3">Số QĐ</th>
                                                <th className="px-4 py-3 text-center">Số DA</th>
                                                <th className="px-4 py-3 text-center">ĐTB tin cậy</th>
                                                <th className="px-4 py-3 text-center">Cảnh báo</th>
                                                <th className="px-4 py-3 text-center">Trạng thái</th>
                                                <th className="px-4 py-3 text-center w-28">Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {batchQueue.map((item, idx) => (
                                                <tr
                                                    key={item.id}
                                                    className={`${activeBatchId === item.id ? 'bg-indigo-50/60' : 'hover:bg-slate-50/80'} transition-colors`}
                                                >
                                                    <td className="px-4 py-3 text-center text-gray-400 font-bold">{idx + 1}</td>
                                                    <td className="px-4 py-3 font-semibold text-gray-800 max-w-[180px] truncate" title={item.fileName}>{item.fileName}</td>
                                                    <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate" title={item.qdAPI}>{item.qdAPI || '—'}</td>
                                                    <td className="px-4 py-3 text-center font-bold text-gray-700">{item.status === 'done' ? item.projectCount : '—'}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        {item.status === 'done' ? (
                                                            <span className={`font-black px-2 py-0.5 rounded-md ${item.avgConfidence >= 85 ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
                                                                {item.avgConfidence}%
                                                            </span>
                                                        ) : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {item.status === 'done' && item.warningCount > 0 ? (
                                                            <span className="inline-flex items-center gap-1 text-amber-600 font-bold">
                                                                <AlertTriangle className="w-3.5 h-3.5" /> {item.warningCount}
                                                            </span>
                                                        ) : item.status === 'done' ? (
                                                            <span className="text-emerald-600 font-bold">0</span>
                                                        ) : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {item.status === 'pending' && <span className="text-gray-400 font-bold">Chờ quét</span>}
                                                        {item.status === 'cooldown' && <span className="text-sky-600 font-bold animate-pulse">Chờ API...</span>}
                                                        {item.status === 'scanning' && (
                                                            <>
                                                                <span className="text-blue-600 font-bold animate-pulse">Đang quét...</span>
                                                                {item.errorMessage && (
                                                                    <span className="block text-[10px] text-blue-500/90 mt-0.5 max-w-[160px] truncate mx-auto" title={item.errorMessage}>
                                                                        {item.errorMessage}
                                                                    </span>
                                                                )}
                                                            </>
                                                        )}
                                                        {item.status === 'error' && (
                                                            <>
                                                                <span className="text-red-600 font-bold">Lỗi</span>
                                                                {item.errorMessage && (
                                                                    <span className="block text-[10px] text-red-500/90 mt-0.5 max-w-[160px] truncate mx-auto" title={item.errorMessage}>
                                                                        {item.errorMessage}
                                                                    </span>
                                                                )}
                                                            </>
                                                        )}
                                                        {item.status === 'done' && item.reviewStatus === 'saved' && <span className="text-emerald-600 font-bold">✓ Đã lưu</span>}
                                                        {item.status === 'done' && item.reviewStatus === 'reviewed' && <span className="text-indigo-600 font-bold">Đã duyệt</span>}
                                                        {item.status === 'done' && item.reviewStatus === 'pending' && <span className="text-amber-600 font-bold">Chờ duyệt</span>}
                                                        {item.duplicateQdInDb && item.status === 'done' && (
                                                            <span className="block text-[10px] text-orange-600 font-bold mt-0.5">QĐ đã có DB</span>
                                                        )}
                                                        {item.duplicateQdInBatch && item.status === 'done' && (
                                                            <span className="block text-[10px] text-orange-600 font-bold mt-0.5">Trùng batch</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {item.status === 'done' && item.reviewStatus !== 'saved' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => loadBatchItemForReview(item)}
                                                                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
                                                            >
                                                                <Eye className="w-3.5 h-3.5" /> Duyệt
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className="bg-emerald-100 text-emerald-700 p-2 rounded-xl border border-emerald-200">
                                <PenLine className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-sm font-black text-emerald-800 uppercase tracking-tight">Đang nhập thủ công</p>
                                <p className="text-xs text-emerald-700/80 mt-1">
                                    {isKhnMaster
                                        ? "Khách hàng ngoài: chọn CĐT = Khách hàng ngoài (KHN), có thể bỏ trống Số QĐ Giao A — năm dùng để sinh mã; sau đó gắn HĐ 2 bên trên sổ hợp đồng."
                                        : "Điền Số QĐ, Chủ đầu tư, Năm giao A và nhập trực tiếp vào bảng dự án bên dưới."}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleBackToScan}
                            className="text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 px-4 py-2 rounded-lg border border-emerald-300 transition cursor-pointer whitespace-nowrap"
                        >
                            ← Quay lại quét PDF
                        </button>
                    </div>
                )}

                <div className="bg-white p-6 rounded-2xl border border-gray-100 flex flex-wrap gap-4 shadow-sm items-end">
                    <div className="flex-[2] min-w-[280px]">
                        <label className="block text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-2">
                            {isKhnMaster ? "Số Quyết Định (không bắt buộc — KHN)" : "Số Quyết Định"}
                        </label>
                        <div className="relative flex">
                            {renderConfidenceInput(
                                masterInfo.qd_giao_a, 
                                e => {
                                    const qd = e.target.value;
                                    applyMasterInfoChange(prev => {
                                        const nam = extractNamGiaoA(qd, prev.qd_giao_a_day_du);
                                        return { ...prev, qd_giao_a: qd, ...(nam ? { nam_giao_a: nam } : {}) };
                                    });
                                },
                                masterInfo.qd_giao_a_conf, 
                                masterInfo.qd_giao_a_warn, 
                                "w-full border border-blue-200 bg-blue-50/50 p-2.5 pr-10 rounded-xl text-blue-900 font-bold text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                            )}
                            {previewUrl && (
                                <a 
                                    href={previewUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer z-10"
                                    title="Xem trước file PDF giao A"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            )}
                        </div>
                    </div>

                    <div className="flex-[3] min-w-[250px]">
                        <label className="block text-[11px] font-bold text-indigo-600 uppercase tracking-wider mb-2">Chủ đầu tư / Đại diện CĐT</label>
                        {renderConfidenceInput(
                            masterInfo.chu_dau_tu, 
                            e => {
                                const raw = e.target.value;
                                applyMasterInfoChange((prev) => {
                                    const next = { ...prev, chu_dau_tu: raw };
                                    if (isKhachHangNgoai(raw) && !String(prev.nam_giao_a || "").trim()) {
                                        next.nam_giao_a = String(new Date().getFullYear());
                                    }
                                    return next;
                                });
                            }, 
                            masterInfo.chu_dau_tu_conf, 
                            masterInfo.chu_dau_tu_warn, 
                            "w-full border border-indigo-200 bg-indigo-50/50 p-2.5 rounded-xl text-indigo-900 font-semibold text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                        )}
                        {isKhnMaster ? (
                            <p className="mt-1.5 text-[11px] text-indigo-700/90 leading-snug">
                                Đã nhận diện <strong>Khách hàng ngoài</strong> — workspace sẽ hiện «Căn cứ hợp đồng» thay vì Giao A.
                            </p>
                        ) : null}
                    </div>

                    <div className="flex-[2] min-w-[220px]">
                        <BenAUserSelect
                            id="nhap-ben-a"
                            users={benAUsersDb}
                            value={masterInfo.ben_a_user_ids || []}
                            required
                            onChange={(ids) =>
                                applyMasterInfoChange((prev) => ({
                                    ...prev,
                                    ben_a_user_ids: ids,
                                    ben_a_user_id: ids[0] || "",
                                }))
                            }
                        />
                    </div>

                    {isKhnMaster ? (
                        <div className="flex-[1] min-w-[120px] max-w-[160px]">
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">Năm (mã DA)</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                maxLength={4}
                                className="w-full border border-slate-200 bg-slate-50/80 p-2.5 rounded-xl text-slate-900 font-semibold text-sm focus:ring-2 focus:ring-slate-400/50 outline-none"
                                value={masterInfo.nam_giao_a || ""}
                                onChange={(e) => {
                                    const nam = e.target.value.replace(/\D/g, "").slice(0, 4);
                                    applyMasterInfoChange((prev) => ({ ...prev, nam_giao_a: nam }));
                                }}
                                placeholder={String(new Date().getFullYear())}
                            />
                        </div>
                    ) : null}

                    <div className="flex-[1.5] min-w-[150px] max-w-[200px]">
                        <label className="block text-[11px] font-bold text-teal-600 uppercase tracking-wider mb-2">Cấp điện áp chung</label>
                        <select className="w-full border border-teal-200 bg-teal-50/50 p-2.5 rounded-xl text-teal-900 font-semibold text-sm focus:ring-2 focus:ring-teal-500/50 outline-none cursor-pointer transition-all appearance-none" value={masterInfo.cap_dien_ap} onChange={e => setMasterInfo({...masterInfo, cap_dien_ap: e.target.value})}>
                            <option value="110kV">110kV</option>
                            <option value="220kV">220kV</option>
                            <option value="THA">Trung Hạ Áp</option>
                        </select>
                    </div>
                </div>

                <div className="bg-white rounded-2xl flex flex-col shadow-sm overflow-hidden">
                    <div className="overflow-x-auto overflow-y-auto max-h-[650px]">
                        <table className="w-full min-w-[1100px] table-fixed text-left border-collapse relative text-[13px] [&_th]:border-r [&_th]:border-b [&_td]:border-r [&_td]:border-b [&_th]:border-gray-200 [&_td]:border-gray-200 [&_th:last-child]:border-r-0 [&_td:last-child]:border-r-0 [&_tbody_tr:last-child_td]:border-b-0">
                            <colgroup>
                                <col className="w-11" />
                                <col className="w-[210px]" />
                                <col />
                                <col style={{ width: '32%' }} />
                                <col className="w-[108px]" />
                                <col className="w-[120px]" />
                                <col className="w-[108px]" />
                                <col className="w-11" />
                            </colgroup>
                            <thead className="bg-indigo-50 text-[12px] text-indigo-700 uppercase font-extrabold tracking-wide sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-2 py-3 text-center bg-indigo-50">STT</th>
                                    <th className="px-3 py-3 text-center bg-indigo-50">Mã Dự Án</th>
                                    <th className="px-3 py-3 text-center bg-indigo-50">Tên Dự Án</th>
                                    <th className="px-3 py-3 text-center bg-indigo-50">Quy mô</th>
                                    <th className="px-2 py-3 text-center bg-indigo-50">Giai đoạn</th>
                                    <th className="px-3 py-3 text-center bg-indigo-50">Địa điểm</th>
                                    <th className="px-2 py-3 text-center bg-indigo-50">TMĐT (Tr.đ)</th>
                                    <th className="px-1 py-3 text-center bg-indigo-50">Xóa</th>
                                </tr>
                            </thead>
                            <tbody>
                                {projects.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="px-4 py-20 text-center">
                                            <div className="flex flex-col items-center justify-center text-gray-400">
                                                <svg className="w-12 h-12 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                                <p className="text-sm font-bold text-gray-500">Chưa có dữ liệu dự án</p>
                                                <p className="text-xs mt-1">
                                                    {entryMode === 'manual'
                                                        ? 'Bấm "Tạo mới thủ công" để mở bảng nhập liệu'
                                                        : 'Vui lòng tải lên Quyết định Giao A và chọn Quét dữ liệu, hoặc bấm Tạo mới thủ công'}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    projects.map((p, index) => (
                                        <tr key={p.id} className="hover:bg-slate-50/50 transition">
                                            <td className="px-2 py-3 text-center text-gray-500 font-bold align-middle">{index + 1}</td>
                                            <td className="px-3 py-3 align-middle">
                                                <input
                                                    type="text"
                                                    className="w-full px-1.5 py-1.5 border-0 bg-transparent rounded-none text-[13px] text-blue-800 font-semibold font-mono leading-snug outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400/40 focus:bg-slate-50/80 transition-colors"
                                                    value={p.ma_du_an}
                                                    onChange={e => updateProjectField(p.id, 'ma_du_an', e.target.value)}
                                                />
                                            </td>
                                            
                                            <td className="px-3 py-3 align-middle">
                                                {p.duplicateCandidate && (
                                                    <div className="mb-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => openMergeModalForProject(p.id)}
                                                            className={`inline-flex items-center gap-1 text-[12px] font-bold px-2 py-1 rounded-md border shadow-sm cursor-pointer transition-colors ${
                                                                p.duplicateMatchType === 'EXACT'
                                                                    ? 'text-red-800 bg-red-50 hover:bg-red-100 border-red-300'
                                                                    : 'text-amber-700 bg-amber-100 hover:bg-amber-200 border-amber-300'
                                                            }`}
                                                            title={`${p.duplicateMatchType === 'EXACT' ? 'Trùng 100%' : `Tương tự ~${Math.round((p.duplicateMatchScore || 0) * 100)}%`} với dự án:\n- Mã: ${p.duplicateCandidate.ma_du_an}\n- Tên: ${p.duplicateCandidate.ten_du_an}\n\nNhấn để mở hộp thoại xử lý`}
                                                        >
                                                            <span className="animate-pulse">⚠️</span>
                                                            {p.duplicateMatchType === 'EXACT'
                                                                ? 'Trùng 100% trên DB — Nhấn xử lý'
                                                                : `Tương tự ~${Math.round((p.duplicateMatchScore || 0) * 100)}% — Nhấn xử lý`}
                                                        </button>
                                                    </div>
                                                )}
                                                {renderConfidenceTextarea(
                                                    p.ten_du_an,
                                                    e => updateProjectField(p.id, 'ten_du_an', e.target.value),
                                                    p.ten_conf, p.ten_warn,
                                                    "w-full px-1.5 py-1.5 border-0 bg-transparent rounded-none leading-relaxed text-[13px] text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400/40 focus:bg-slate-50/80 transition-colors [field-sizing:content] resize-none min-h-[42px]"
                                                )}
                                            </td>

                                            <td className="px-3 py-3 align-middle">
                                                {renderConfidenceTextarea(
                                                    p.quy_mo,
                                                    e => updateProjectField(p.id, 'quy_mo', e.target.value),
                                                    p.quy_mo_conf, p.quy_mo_warn,
                                                    "w-full px-1.5 py-1.5 border-0 bg-transparent rounded-none leading-relaxed text-[13px] text-emerald-900 font-medium outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-400/35 focus:bg-slate-50/80 transition-colors [field-sizing:content] resize-none min-h-[42px]",
                                                    "Chi tiết quy mô..."
                                                )}
                                            </td>
                                            
                                            <td className="px-2 py-3 align-middle">
                                                <select className="w-full px-1 py-1.5 border-0 bg-transparent rounded-none font-semibold text-[13px] text-gray-700 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400/40 focus:bg-slate-50/80 transition-colors cursor-pointer text-center appearance-none" value={p.giai_doan} onChange={e => updateProjectField(p.id, 'giai_doan', e.target.value)}>
                                                    <option value="FS">FS</option><option value="BCKTKT">BCKTKT</option><option value="TKBVTC">TKBVTC</option>
                                                </select>
                                            </td>
                                            <td className="px-3 py-3 align-middle">
                                                {renderConfidenceInput(
                                                    p.dia_diem_ks,
                                                    e => updateProjectField(p.id, 'dia_diem_ks', e.target.value),
                                                    p.dia_diem_conf, p.dia_diem_warn,
                                                    "w-full px-1.5 py-1.5 border-0 bg-transparent rounded-none text-[13px] font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400/40 focus:bg-slate-50/80 transition-colors text-center",
                                                    "Nhập địa điểm KS",
                                                    p.dia_diem_requires_manual
                                                )}
                                            </td>
                                            <td className="px-2 py-3 align-middle">
                                                <div className="relative group w-full">
                                                    <input 
                                                        type="text" 
                                                        className={`w-full px-1.5 py-1.5 border-0 bg-transparent rounded-none text-right font-semibold text-[13px] text-blue-700 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400/40 focus:bg-slate-50/80 transition-colors ${p.tmdt_conf < 85 && p.tmdt_conf > 0 ? '!bg-amber-50/50 focus:!ring-amber-400/50' : ''}`} 
                                                        value={Number(p.tong_muc_dau_tu).toLocaleString('vi-VN')} 
                                                        onChange={e => {
                                                            const rawValue = e.target.value.replace(/\./g, '');
                                                            if (!isNaN(rawValue)) {
                                                                updateProjectField(p.id, 'tong_muc_dau_tu', rawValue);
                                                            }
                                                        }} 
                                                    />
                                                    {p.tmdt_conf < 85 && p.tmdt_conf > 0 && (
                                                        <div className="absolute left-2 top-1/2 -translate-y-1/2 cursor-help z-10">
                                                            <span className="animate-pulse text-amber-500 font-bold">⚠️</span>
                                                            <div className="absolute bottom-full left-0 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all text-left">
                                                                {p.tmdt_warn || 'Cảnh báo: Độ tin cậy thấp, vui lòng kiểm tra lại.'}
                                                                <div className="absolute top-full left-2 border-4 border-transparent border-t-gray-800"></div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-1 py-3 text-center align-middle">
                                                <button onClick={() => removeRow(p.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition cursor-pointer"><Trash2 className="w-4 h-4 mx-auto" /></button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {projects.length > 0 && (
                        <div className="p-4 bg-indigo-50/30 border-t border-indigo-50 flex justify-between items-center">
                            <button onClick={handleAddRow} className="text-xs flex items-center text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer border border-transparent hover:border-indigo-200">
                                <Plus className="w-4 h-4 mr-1.5" /> Thêm dòng
                            </button>
                            <div className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider max-w-xl text-right leading-snug">
                                {entryMode === 'manual'
                                    ? 'STT tự đánh số. Mã dự án tự sinh khi nhập tên, địa điểm, giai đoạn.'
                                    : phaseRuleHint}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 pb-12">
                    {hasUnsavedEntryData() ? (
                        <button
                            type="button"
                            onClick={handleCancelOperation}
                            disabled={isSaving || isScanning}
                            className="px-5 py-3 rounded-xl font-bold text-sm flex items-center justify-center transition-all shadow-sm border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-400 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed order-2 sm:order-1"
                        >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Hủy thao tác
                        </button>
                    ) : (
                        <div className="hidden sm:block order-2 sm:order-1" />
                    )}
                    <div className="flex flex-col sm:flex-row justify-end gap-3 order-1 sm:order-2">
                        {batchQueue.length > 0 && activeBatchId && (
                            <button
                                type="button"
                                onClick={handleMarkBatchReviewed}
                                disabled={isSaving || isScanning}
                                className="px-6 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center transition-all shadow-sm border-2 border-indigo-500 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <CheckCircle className="w-5 h-5 mr-2" />
                                Xác nhận đã duyệt
                            </button>
                        )}
                        <button 
                            onClick={handleSaveAll} 
                            disabled={isSaving || projects.filter(p => p.ten_du_an?.trim()).length === 0} 
                            className={`px-8 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center transition-all shadow-sm text-white ${projects.filter(p => p.ten_du_an?.trim()).length === 0 || isSaving ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer hover:shadow-md transform hover:-translate-y-0.5'}`}
                        >
                            {isSaving ? <Loader2 className="w-5 h-5 mr-2.5 animate-spin" /> : <CheckCircle className="w-5 h-5 mr-2.5" />}
                            {isSaving
                                ? 'Đang lưu trữ / Cập nhật...'
                                : (batchQueue.length > 0 && activeBatchId ? 'Lưu file đang duyệt' : 'LƯU VÀO CƠ SỞ DỮ LIỆU')}
                        </button>
                    </div>
                </div>
            </main>
            {/* MODAL GIẢI QUYẾT TRÙNG LẶP */}
            {mergeModal.isOpen && mergeModal.candidates.length > 0 && (() => {
                const mergeCurrent = mergeModal.candidates[mergeModal.currentProjectIndex];
                const oldRecord = mergeCurrent?.duplicateCandidate;
                const oldQd = oldRecord?.qd_giao_a?.trim() || '';
                const newQd = masterInfo.qd_giao_a?.trim() || '';
                const qdWillChange = newQd && newQd !== oldQd;
                const codeChoice = mergeModal.codeChoice || 'old';
                const oldMa = oldRecord?.ma_du_an || '';
                const newMa = mergeCurrent?.ma_du_an || '';
                const codesDiffer = oldMa && newMa && oldMa !== newMa;
                const selectedMa = codeChoice === 'new' ? newMa : oldMa;

                return (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] overflow-y-auto overscroll-contain p-3 sm:p-4">
                    <div className="flex min-h-full items-start sm:items-center justify-center py-2 sm:py-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 my-auto">
                        <div className="bg-amber-50 border-b border-amber-100 p-4 sm:p-5 flex items-center justify-between gap-3 shrink-0">
                            <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-xl shadow-inner animate-pulse shrink-0">
                                ⚠️
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-[17px] font-black text-amber-800 tracking-tight">PHÁT HIỆN DỰ ÁN TRÙNG LẶP</h3>
                                <p className="text-[13px] font-medium text-amber-600/80 mt-0.5">
                                    Đang xử lý {mergeModal.currentProjectIndex + 1} / {mergeModal.candidates.length}
                                </p>
                            </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => handleMergeNavigate(-1)}
                                    disabled={mergeModal.currentProjectIndex === 0}
                                    className="p-2 rounded-lg border border-amber-200 bg-white text-amber-800 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
                                    title="Xem cảnh báo trước"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleMergeNavigate(1)}
                                    disabled={mergeModal.currentProjectIndex >= mergeModal.candidates.length - 1}
                                    className="p-2 rounded-lg border border-amber-200 bg-white text-amber-800 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
                                    title="Xem cảnh báo tiếp theo"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 bg-slate-50/50">
                            <p className="text-[13px] font-medium text-slate-600 mb-4 sm:mb-6 bg-white p-3 sm:p-4 border border-slate-200 rounded-xl shadow-sm leading-relaxed break-words">
                                Hệ thống phát hiện dự án <span className="font-bold text-slate-800">"{mergeModal.candidates[mergeModal.currentProjectIndex].ten_du_an}"</span> trong file quét có mức độ tương đồng cao với một dự án đã tồn tại trên cơ sở dữ liệu.
                            </p>

                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 min-w-0">
                                {/* Cột Dữ liệu Cũ */}
                                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm min-w-0">
                                    <div className="bg-slate-100/50 border-b border-slate-200 px-4 py-3">
                                        <h4 className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Dữ liệu đang có (Trên hệ thống)</h4>
                                    </div>
                                    <div className="p-4 space-y-4">
                                        <div>
                                            <div className="text-[11px] font-bold text-slate-400 uppercase mb-1">Mã dự án</div>
                                            <div className="text-[13px] font-semibold text-slate-800 bg-slate-50 p-2 rounded-lg border border-slate-100 break-words">{oldRecord?.ma_du_an}</div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] font-bold text-slate-400 uppercase mb-1">Tên dự án</div>
                                            <div className="text-[13px] font-semibold text-slate-800 bg-slate-50 p-2 rounded-lg border border-slate-100 break-words">{oldRecord?.ten_du_an}</div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] font-bold text-slate-400 uppercase mb-1">Quyết định Giao A</div>
                                            <div className="text-[13px] font-semibold text-slate-800 bg-slate-50 p-2 rounded-lg border border-slate-100 break-words">{oldQd || 'Chưa rõ'}</div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] font-bold text-slate-400 uppercase mb-1">Giai đoạn</div>
                                            <div className="text-[13px] font-semibold text-slate-800 bg-slate-50 p-2 rounded-lg border border-slate-100">{formatGiaiDoanHienThi(oldRecord?.giai_doan)}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Cột Dữ liệu Mới */}
                                <div className="border border-blue-200 rounded-xl overflow-hidden bg-white shadow-sm ring-2 ring-blue-50/80 min-w-0">
                                    <div className="bg-blue-50/50 border-b border-blue-100 px-4 py-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                                        <h4 className="text-[12px] font-bold text-blue-600 uppercase tracking-wider">Dữ liệu mới (Từ file quét)</h4>
                                        <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full shrink-0">Nguồn cập nhật</span>
                                    </div>
                                    <div className="p-4 space-y-4">
                                        <div>
                                            <div className="text-[11px] font-bold text-blue-400 uppercase mb-1">Mã dự án (Tạm tính)</div>
                                            <div className="text-[13px] font-semibold text-blue-800 bg-blue-50/50 p-2 rounded-lg border border-blue-50 break-words">{mergeCurrent.ma_du_an}</div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] font-bold text-blue-400 uppercase mb-1">Tên dự án</div>
                                            <div className="text-[13px] font-semibold text-blue-800 bg-blue-50/50 p-2 rounded-lg border border-blue-50 break-words">{mergeCurrent.ten_du_an}</div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] font-bold text-blue-400 uppercase mb-1">Quyết định Giao A</div>
                                            <div className="text-[13px] font-semibold text-blue-800 bg-blue-50/50 p-2 rounded-lg border border-blue-50 break-words">{newQd || '—'}</div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] font-bold text-blue-400 uppercase mb-1">Giai đoạn</div>
                                            <div className="text-[13px] font-semibold text-blue-800 bg-blue-50/50 p-2 rounded-lg border border-blue-50">{formatGiaiDoanHienThi(mergeCurrent.giai_doan)}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Cột Sau cập nhật — kết quả khi chọn "Cùng là một dự án" */}
                                <div className="border border-emerald-300 rounded-xl overflow-hidden bg-white shadow-sm ring-2 ring-emerald-50 min-w-0">
                                    <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                                        <h4 className="text-[12px] font-bold text-emerald-700 uppercase tracking-wider">Sau cập nhật</h4>
                                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Kết quả lưu</span>
                                    </div>
                                    <div className="p-4 space-y-4">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="text-[11px] font-bold text-emerald-500 uppercase">Mã dự án</div>
                                                {codesDiffer ? (
                                                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Chọn mã lưu</span>
                                                ) : (
                                                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">Giữ nguyên</span>
                                                )}
                                            </div>

                                            {codesDiffer ? (
                                                <div className="space-y-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setMergeModal(prev => ({ ...prev, codeChoice: 'old' }))}
                                                        className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer ${codeChoice === 'old' ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/30'}`}
                                                    >
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${codeChoice === 'old' ? 'border-emerald-600' : 'border-slate-300'}`}>
                                                                {codeChoice === 'old' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Giữ mã cũ</span>
                                                        </div>
                                                        <div className="text-[12px] font-semibold text-slate-800 break-all pl-5">{oldMa}</div>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setMergeModal(prev => ({ ...prev, codeChoice: 'new' }))}
                                                        className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer ${codeChoice === 'new' ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/30'}`}
                                                    >
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${codeChoice === 'new' ? 'border-emerald-600' : 'border-slate-300'}`}>
                                                                {codeChoice === 'new' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-blue-600 uppercase">Dùng mã mới</span>
                                                        </div>
                                                        <div className="text-[12px] font-semibold text-blue-800 break-all pl-5">{newMa}</div>
                                                    </button>
                                                    {codeChoice === 'new' && (
                                                        <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5 leading-relaxed">
                                                            Bản ghi mã cũ sẽ bị xóa khi lưu. Hồ sơ NVKS (nếu có) sẽ được chuyển sang mã mới.
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-[13px] font-semibold text-emerald-900 bg-emerald-50/60 p-2 rounded-lg border border-emerald-100">{selectedMa || '—'}</div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="text-[11px] font-bold text-emerald-500 uppercase">Tên dự án</div>
                                                <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Từ file quét</span>
                                            </div>
                                            <div className="text-[13px] font-semibold text-emerald-900 bg-emerald-50/60 p-2 rounded-lg border border-emerald-100 break-words">{mergeCurrent.ten_du_an}</div>
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="text-[11px] font-bold text-emerald-500 uppercase">Quyết định Giao A</div>
                                                {qdWillChange ? (
                                                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Sẽ cập nhật</span>
                                                ) : (
                                                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">Giữ nguyên</span>
                                                )}
                                            </div>
                                            <div className={`text-[13px] font-semibold p-2 rounded-lg border break-words ${qdWillChange ? 'text-emerald-900 bg-emerald-50/60 border-emerald-200' : 'text-slate-700 bg-slate-50 border-slate-100'}`}>
                                                {newQd || oldQd || 'Chưa rõ'}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="text-[11px] font-bold text-emerald-500 uppercase">Giai đoạn</div>
                                                <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Từ file quét</span>
                                            </div>
                                            <div className="text-[13px] font-semibold text-emerald-900 bg-emerald-50/60 p-2 rounded-lg border border-emerald-100">{formatGiaiDoanHienThi(mergeCurrent.giai_doan)}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <p className="mt-4 text-[12px] text-slate-500 leading-relaxed">
                                Nếu chọn <span className="font-bold text-emerald-700">Cùng là một dự án</span>, hệ thống cập nhật thông tin từ file quét lên bản ghi hiện có. Anh/Chị có thể chọn <span className="font-bold">giữ mã cũ</span> hoặc <span className="font-bold">dùng mã mới</span> ở cột &quot;Sau cập nhật&quot; trước khi xác nhận, rồi bấm Lưu lần nữa.
                            </p>
                        </div>

                        <div className="bg-slate-100 p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 shrink-0">
                            <button
                                type="button"
                                onClick={handleCancelMerge}
                                className="w-full sm:w-auto px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-600 text-[12px] sm:text-[13px] font-bold rounded-xl border border-slate-300 shadow-sm transition-all cursor-pointer shrink-0"
                            >
                                Hủy
                            </button>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                            <button 
                                type="button"
                                onClick={() => handleResolveMerge('CREATE_NEW')}
                                className="w-full sm:w-auto px-4 sm:px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-[11px] sm:text-[13px] font-bold rounded-xl border border-slate-300 shadow-sm transition-all cursor-pointer text-center leading-snug"
                            >
                                ĐÓ LÀ DỰ ÁN KHÁC (Tạo mới)
                            </button>
                            <button 
                                type="button"
                                onClick={() => handleResolveMerge('REPLACE')}
                                className="w-full sm:w-auto px-4 sm:px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[11px] sm:text-[13px] font-bold rounded-xl shadow-md shadow-blue-200 transition-all flex items-center justify-center gap-2 cursor-pointer text-center leading-snug"
                            >
                                CÙNG LÀ MỘT DỰ ÁN (Cập nhật dữ liệu cũ)
                            </button>
                            </div>
                        </div>
                    </div>
                    </div>
                </div>
                );
            })()}
        </div>
    );
}