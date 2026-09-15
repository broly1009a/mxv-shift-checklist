#!/usr/bin/env node
/**
 * Chạy trên Ubuntu: audit ảnh CCCD gán sai từ mail.
 */
require('dotenv').config({ path: '/opt/mxv-checklist/backend/.env' });
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

function isNamedContractImage(fileName) {
  if (!fileName) return false;
  const n = fileName.toLowerCase().trim();
  if (/^(hd|hđ|hop[\s_-]*dong|hopdong|contract)([_\s.\-]|$)/i.test(n)) return true;
  if (/\b(hop[\s_-]*dong|hopdong|contract)\b/i.test(n)) return true;
  if (/(^|[_\s\-])hd[_\s\-]/i.test(n) && !/cccd|cmnd/i.test(n)) return true;
  if (n.includes('mxv') && /\.(pdf|jpe?g|png|webp)$/i.test(n) && !/cccd/i.test(n)) return true;
  return false;
}

function isNamedCccdFront(fileName) {
  if (!fileName) return false;
  const n = fileName.toLowerCase();
  return (
    /(^|[^a-z0-9])(truoc|front|mat[_-\s]?1|mattruoc)([^a-z0-9]|$)/i.test(n) ||
    n.includes('mặt trước') ||
    (n.includes('cccd') && /(truoc|front|(^|[^a-z0-9])mt([^a-z0-9]|$))/i.test(n)) ||
    /^mt[_\-.\s]/i.test(n)
  );
}

function isNamedCccdBack(fileName) {
  if (!fileName) return false;
  const n = fileName.toLowerCase();
  return (
    /(^|[^a-z0-9])(sau|back|mat[_-\s]?2|matsau)([^a-z0-9]|$)/i.test(n) ||
    n.includes('mặt sau') ||
    (n.includes('cccd') && /(sau|back|(^|[^a-z0-9])ms([^a-z0-9]|$))/i.test(n)) ||
    /^ms[_\-.\s]/i.test(n)
  );
}

function isNamedCccdImage(fileName) {
  if (!fileName) return false;
  const n = fileName.toLowerCase();
  return (
    isNamedCccdFront(n) ||
    isNamedCccdBack(n) ||
    /cccd|cmnd|(^|[^a-z0-9])cmt([^a-z0-9]|$)|can\s*cuoc|căn\s*cước/i.test(n)
  );
}

function isGenericOutlook(n) {
  const lower = (n || '').toLowerCase();
  return (
    /^image\d*\.(png|jpe?g|gif|webp)$/i.test(lower) ||
    lower.startsWith('image0') ||
    /^img[_-]?\d+\./i.test(lower)
  );
}

function isLogo(n) {
  const lower = (n || '').toLowerCase();
  return /logo|banner|favicon|signature|chữ ký|chu ky|facebook|linkedin/i.test(lower);
}

/** OLD bug: gán ảnh thứ 2 bất kỳ làm back (kể cả HD) */
function pickOldBuggy(images) {
  let front;
  let back;
  const namedFront = images.find((f) => isNamedCccdFront(f));
  const namedBack = images.find((f) => isNamedCccdBack(f));
  if (namedFront) front = namedFront;
  if (namedBack) back = namedBack;
  for (const f of images) {
    if (!front) front = f;
    else if (!back && f !== front) back = f;
  }
  return { front, back };
}

/** NEW: không lấy HD làm CCCD; composite chỉ front */
function pickNew(images) {
  const usable = images.filter((f) => !isNamedContractImage(f) && !isLogo(f));
  let front;
  let back;
  for (const f of usable) {
    if (!front && isNamedCccdFront(f)) front = f;
    if (!back && isNamedCccdBack(f)) back = f;
  }
  for (const f of usable) {
    if (!isNamedCccdImage(f)) continue;
    if (!front && f !== back) front = f;
    else if (!back && f !== front && (isNamedCccdFront(f) || isNamedCccdBack(f))) back = f;
  }
  if (!front) {
    const cand = usable.find((f) => !isGenericOutlook(f));
    if (cand) front = cand;
  }
  const isComposite =
    !!front &&
    !back &&
    isNamedCccdImage(front) &&
    !isNamedCccdFront(front) &&
    !isNamedCccdBack(front);
  return { front, back, isComposite };
}

function classifyBugs(files) {
  const mailImages = files.filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && !/_ms_/i.test(f));
  const oldP = pickOldBuggy(mailImages);
  const newP = pickNew(mailImages);
  const flags = [];
  if (oldP.back && isNamedContractImage(oldP.back)) flags.push('OLD_BACK_IS_HD');
  if (oldP.front && isNamedContractImage(oldP.front)) flags.push('OLD_FRONT_IS_HD');
  if (
    mailImages.some(isNamedContractImage) &&
    mailImages.some(isNamedCccdImage) &&
    oldP.back &&
    isNamedContractImage(oldP.back)
  ) {
    flags.push('HD_STOLEN_CCCD_BACK_SLOT');
  }
  if (
    mailImages.some(isNamedCccdImage) &&
    mailImages.some(isNamedContractImage) &&
    !mailImages.some(isNamedCccdBack)
  ) {
    flags.push('COMPOSITE_CCCD_PLUS_HD');
  }
  if (!mailImages.some(isNamedCccdImage) && mailImages.length > 0) flags.push('NO_NAMED_CCCD_BUT_HAS_IMAGES');
  if (mailImages.some(isLogo)) flags.push('HAS_LOGO_NAMED');
  if (mailImages.some(isGenericOutlook)) flags.push('HAS_GENERIC_OUTLOOK_IMAGE');
  if (mailImages.length === 0) flags.push('NO_MAIL_IMAGES');
  if (newP.isComposite) flags.push('COMPOSITE_CCCD_ONLY');
  if (oldP.front !== newP.front || oldP.back !== newP.back) flags.push('PICK_DIFF_OLD_VS_NEW');
  return { mailImages, oldPick: oldP, newPick: newP, flags };
}

function findAccountDirs(bases, code, batchDate) {
  const found = [];
  for (const base of bases) {
    if (!fs.existsSync(base)) continue;
    const candidates = [];
    if (batchDate) {
      candidates.push(path.join(base, batchDate, code));
    }
    candidates.push(path.join(base, code));
    try {
      for (const d of fs.readdirSync(base)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
        candidates.push(path.join(base, d, code));
        const dateDir = path.join(base, d);
        try {
          for (const c of fs.readdirSync(dateDir)) {
            if (c === code || c.startsWith(`${code}_`)) candidates.push(path.join(dateDir, c));
          }
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
    for (const c of candidates) {
      if (fs.existsSync(c) && fs.statSync(c).isDirectory()) {
        try {
          const files = fs.readdirSync(c).filter((f) => fs.statSync(path.join(c, f)).isFile());
          if (files.length) found.push({ dir: c, files });
        } catch {
          /* ignore */
        }
      }
    }
  }
  const seen = new Set();
  return found.filter((x) => (seen.has(x.dir) ? false : (seen.add(x.dir), true)));
}

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const col = db.collection('clean_account_records');

  const bases = [
    '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem',
    '/opt/mxv-checklist/backend/data/temp_tkgd_attachments',
    path.join(process.cwd(), 'data/temp_tkgd_attachments'),
  ];

  console.log(
    'BASES=' +
      JSON.stringify(
        bases.map((b) => ({ path: b, exists: fs.existsSync(b) })),
      ),
  );

  const lech = await col
    .find({
      $or: [
        { 'ketLuan.trangThai': 'LECH' },
        { 'ketLuan.danhSachLoi': { $regex: /CCCD|căn cước|can cuoc/i } },
      ],
    })
    .project({
      maTKGD: 1,
      maTKGDBase: 1,
      batchDate: 1,
      'ketLuan.trangThai': 1,
      'ketLuan.danhSachLoi': 1,
      'canCuoc.soCanCuoc': 1,
      'canCuoc.hoVaTen': 1,
      'hopDong.soCanCuoc': 1,
      'noiDungMail.tenTaiKhoan': 1,
    })
    .toArray();

  const byBase = new Map();
  for (const r of lech) {
    const code = (r.maTKGDBase || r.maTKGD || '').split('-')[0];
    if (!code) continue;
    const prev = byBase.get(code);
    if (!prev || String(r.batchDate) > String(prev.batchDate)) byBase.set(code, r);
  }

  const cases = [];
  const flagCounts = {};
  for (const [code, r] of byBase) {
    const dirs = findAccountDirs(bases, code, r.batchDate);
    const allFiles = [...new Set(dirs.flatMap((d) => d.files))];
    const audit = classifyBugs(allFiles);
    for (const f of audit.flags) flagCounts[f] = (flagCounts[f] || 0) + 1;
    cases.push({
      code,
      batchDate: r.batchDate,
      status: r.ketLuan?.trangThai,
      errs: (r.ketLuan?.danhSachLoi || []).slice(0, 3),
      soCccdMail: r.canCuoc?.soCanCuoc || r.hopDong?.soCanCuoc || null,
      dirs: dirs.map((d) => d.dir),
      files: allFiles.filter((f) => /\.(jpe?g|png|webp|pdf)$/i.test(f)),
      mailImages: audit.mailImages,
      oldPick: audit.oldPick,
      newPick: audit.newPick,
      flags: audit.flags,
    });
  }

  const broadHits = [];
  const hoso = bases[0];
  if (fs.existsSync(hoso)) {
    for (const d of fs.readdirSync(hoso)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
      const dateDir = path.join(hoso, d);
      let accounts = [];
      try {
        accounts = fs.readdirSync(dateDir);
      } catch {
        continue;
      }
      for (const acc of accounts) {
        const accPath = path.join(dateDir, acc);
        let files = [];
        try {
          if (!fs.statSync(accPath).isDirectory()) continue;
          files = fs.readdirSync(accPath);
        } catch {
          continue;
        }
        const mailImgs = files.filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && !/_ms_/i.test(f));
        if (!mailImgs.some(isNamedContractImage)) continue;
        if (!mailImgs.some(isNamedCccdImage)) continue;
        const oldP = pickOldBuggy(mailImgs);
        if (oldP.back && isNamedContractImage(oldP.back)) {
          broadHits.push({
            code: acc,
            batchDate: d,
            files: mailImgs,
            oldPick: oldP,
            newPick: pickNew(mailImgs),
          });
        }
      }
    }
  }

  // raw mail attachment names (nếu có)
  let rawAttSample = [];
  try {
    const rawCol = db.collection('raw_account_mails');
    const raws = await rawCol
      .find({})
      .project({ subject: 1, 'attachments.name': 1, 'attachments.size': 1, receivedAt: 1 })
      .sort({ receivedAt: -1 })
      .limit(80)
      .toArray();
    rawAttSample = raws.map((m) => ({
      subject: (m.subject || '').slice(0, 80),
      atts: (m.attachments || []).map((a) => ({
        name: a.name,
        size: a.size,
        contract: isNamedContractImage(a.name),
        cccd: isNamedCccdImage(a.name),
        generic: isGenericOutlook(a.name),
        logo: isLogo(a.name),
      })),
    }));
  } catch (e) {
    console.log('RAW_MAIL_SKIP=' + e.message);
  }

  const summary = {
    lechUnique: byBase.size,
    flaggedCases: cases.length,
    flagCounts,
    hdStolenBackCount: broadHits.length,
    sampleHdStolen: broadHits.slice(0, 30),
    topBugCases: cases
      .filter((c) =>
        c.flags.some((f) =>
          [
            'HD_STOLEN_CCCD_BACK_SLOT',
            'OLD_BACK_IS_HD',
            'COMPOSITE_CCCD_PLUS_HD',
            'NO_MAIL_IMAGES',
            'PICK_DIFF_OLD_VS_NEW',
            'NO_NAMED_CCCD_BUT_HAS_IMAGES',
          ].includes(f),
        ),
      )
      .slice(0, 50),
    rawMailWithSuspiciousAtts: rawAttSample.filter((m) =>
      m.atts.some((a) => a.logo || (a.generic && a.size && a.size < 45000) || (a.contract && a.cccd === false)),
    ).length,
  };

  console.log('SUMMARY=' + JSON.stringify(summary, null, 2));
  fs.writeFileSync('/tmp/_cccd_mail_attach_audit.json', JSON.stringify({ summary, cases, broadHits, rawAttSample }, null, 2));
  console.log('WROTE=/tmp/_cccd_mail_attach_audit.json cases=' + cases.length + ' broadHdStolen=' + broadHits.length);
  await client.close();
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
