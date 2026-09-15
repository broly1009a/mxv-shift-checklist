#!/usr/bin/env node
/**
 * Ubuntu: reparse all LECH + audit remaining for false-positive patterns.
 */
require('dotenv').config({ path: '/opt/mxv-checklist/backend/.env' });
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const http = require('http');

function postJson(urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3001,
        path: urlPath,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'x-user-email': 'hieptruong@mxv.vn',
        },
        timeout: 300000,
      },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(buf || '{}') });
          } catch {
            resolve({ status: res.statusCode, body: { raw: buf.slice(0, 500) } });
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.write(data);
    req.end();
  });
}

function normalizeDateStr(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  const iso = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (iso) return `${iso[3].padStart(2, '0')}/${iso[2].padStart(2, '0')}/${iso[1]}`;
  const dmy = s.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/);
  if (dmy) return `${dmy[1].padStart(2, '0')}/${dmy[2].padStart(2, '0')}/${dmy[3]}`;
  return '';
}

function isJunkName(n) {
  if (!n) return false;
  const s = String(n).toLowerCase();
  return /để thực hiện|de thuc hien|camscanner|được quét|duoc quet|^lối$|^loi$|scanned with/i.test(s);
}

function verdictForLech(doc) {
  const errs = doc.ketLuan?.danhSachLoi || [];
  const notes = [];
  let verdict = 'LIKELY_CORRECT';

  const joined = errs.join(' | ');

  // Same date both sides after normalize (broken compare leftover)
  for (const e of errs) {
    const m = e.match(/Lệch ngày[^:]*:\s*([^!]+)\s*!=\s*MS:\s*(.+?)\)?\s*$/i);
    if (m) {
      const a = normalizeDateStr(m[1]);
      const b = normalizeDateStr(m[2]);
      if (a && b && a === b) {
        notes.push('FALSE_POSITIVE: cùng ngày sau normalize: ' + e);
        verdict = 'FALSE_POSITIVE';
      }
    }
  }

  if (/sai định dạng quy chuẩn/i.test(joined) && /thay vì DD\/MM\/YYYY/i.test(joined)) {
    notes.push('FALSE_POSITIVE: chỉ khác format ISO');
    verdict = 'FALSE_POSITIVE';
  }

  if (/chưa được tạo trên M-System|chưa có trên M-System/i.test(joined)) {
    if (doc.ms?.isFoundOnMS || doc.ms?.soCMND_HoChieu || doc.ms?.hoVaTen) {
      notes.push('FALSE_POSITIVE: stale MS missing nhưng đã có MS data');
      verdict = 'FALSE_POSITIVE';
    }
  }

  // Name junk in error text
  const nameErr = errs.find((e) => /Lệch họ tên/i.test(e));
  if (nameErr && isJunkName(nameErr)) {
    notes.push('MIXED: lệch tên chứa OCR rác (ĐỂ THỰC HIỆN / CamScanner...)');
    if (verdict === 'LIKELY_CORRECT') verdict = 'MIXED';
  }

  // Missing CCCD but clearly has named CCCD image evidence + partial OCR
  if (/thiếu CCCD|Không đọc được số CCCD/i.test(joined)) {
    if (doc.canCuoc?.hoVaTen || doc.canCuoc?.rawNgaySinh || doc.canCuoc?.source) {
      notes.push('MIXED: có dấu hiệu ảnh CCCD nhưng chưa đọc số');
      if (verdict === 'LIKELY_CORRECT') verdict = 'MIXED';
    }
  }

  // Real field mismatches
  if (/Lệch số CCCD|Lệch ngày sinh|Lệch ngày cấp|Lệch giới tính|Lệch họ tên/i.test(joined)) {
    if (verdict === 'LIKELY_CORRECT') notes.push('Có lệch field cụ thể');
  }

  if (/thiếu CCCD/i.test(joined) && !doc.canCuoc?.soCanCuoc && !doc.hopDong?.soCanCuoc) {
    if (verdict === 'LIKELY_CORRECT') notes.push('Không có số CCCD trên hồ sơ mail/OCR');
  }

  return { verdict, notes, errs: errs.slice(0, 5) };
}

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db().collection('clean_account_records');

  const countBy = async () => {
    const by = {};
    for (const s of ['KHOP', 'LECH', 'CAN_KIEM_TRA', 'CHUA_XU_LY']) {
      by[s] = await col.countDocuments({ 'ketLuan.trangThai': s });
    }
    return { total: await col.countDocuments(), by };
  };

  const before = await countBy();
  console.log('BEFORE=' + JSON.stringify(before));

  const lechDocs = await col
    .find({ 'ketLuan.trangThai': 'LECH' })
    .project({ _id: 1, maTKGD: 1, maTKGDBase: 1, batchDate: 1, 'ketLuan.danhSachLoi': 1 })
    .sort({ batchDate: -1 })
    .toArray();

  const seen = new Set();
  const targets = [];
  for (const d of lechDocs) {
    const key = (d.maTKGDBase || d.maTKGD || '').split('-')[0];
    if (!key || seen.has(key)) continue;
    seen.add(key);
    targets.push(d);
  }

  console.log('LECH_RECORDS=' + lechDocs.length + ' UNIQUE_BASE=' + targets.length);
  console.log('TARGETS=' + JSON.stringify(targets.map((t) => t.maTKGD || t.maTKGDBase)));

  const results = [];
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const code = t.maTKGD || t.maTKGDBase;
    process.stdout.write(`[${i + 1}/${targets.length}] reparse ${code} ... `);
    try {
      const res = await postJson('/api/v1/tkgd/reparse-account', {
        recordId: String(t._id),
        accountCode: code,
        batchDate: t.batchDate,
      });
      const status = res.body?.record?.ketLuan?.trangThai || res.body?.ketLuan?.trangThai || 'UNKNOWN';
      const errs = res.body?.record?.ketLuan?.danhSachLoi || [];
      console.log(res.status + ' -> ' + status + (errs[0] ? ' | ' + String(errs[0]).slice(0, 80) : ''));
      results.push({ code, http: res.status, status, errs: errs.slice(0, 3), ok: !!res.body?.success });
    } catch (e) {
      console.log('ERR ' + e.message);
      results.push({ code, http: 0, status: 'ERROR', errs: [e.message], ok: false });
    }
  }

  // Skip full /run here — reparse already re-evaluates each LECH with new pick/OCR logic.
  console.log('SKIP_FULL_RUN — using reparse results only');

  const after = await countBy();
  console.log('AFTER=' + JSON.stringify(after));

  const transitions = { to_KHOP: 0, to_CAN_KIEM_TRA: 0, stay_LECH: 0, error: 0, other: 0 };
  for (const r of results) {
    if (!r.ok || r.status === 'ERROR') transitions.error++;
    else if (r.status === 'KHOP') transitions.to_KHOP++;
    else if (r.status === 'CAN_KIEM_TRA') transitions.to_CAN_KIEM_TRA++;
    else if (r.status === 'LECH') transitions.stay_LECH++;
    else transitions.other++;
  }
  console.log('FIRST_PASS_TRANSITIONS=' + JSON.stringify(transitions));

  // Audit remaining LECH
  const remain = await col
    .find({ 'ketLuan.trangThai': 'LECH' })
    .project({
      maTKGD: 1,
      maTKGDBase: 1,
      batchDate: 1,
      'ketLuan.danhSachLoi': 1,
      'ms.isFoundOnMS': 1,
      'ms.soCMND_HoChieu': 1,
      'ms.hoVaTen': 1,
      'ms.tenTKGD': 1,
      'ms.ngaySinh': 1,
      'ms.rawNgaySinh': 1,
      'ms.ngayCap': 1,
      'ms.rawNgayCap': 1,
      'ms.gioiTinh': 1,
      'canCuoc.soCanCuoc': 1,
      'canCuoc.hoVaTen': 1,
      'canCuoc.rawNgaySinh': 1,
      'canCuoc.source': 1,
      'hopDong.soCanCuoc': 1,
      'hopDong.hoVaTen': 1,
      'hopDong.rawNgaySinh': 1,
      'hopDong.rawNgayCap': 1,
      'hopDong.rawGioiTinh': 1,
      'noiDungMail.tenTaiKhoan': 1,
    })
    .toArray();

  const byBase = new Map();
  for (const d of remain) {
    const code = (d.maTKGDBase || d.maTKGD || '').split('-')[0];
    if (!code) continue;
    const prev = byBase.get(code);
    if (!prev || String(d.batchDate) > String(prev.batchDate)) byBase.set(code, d);
  }

  const audited = [];
  const verdictCounts = { FALSE_POSITIVE: 0, MIXED: 0, LIKELY_CORRECT: 0 };
  for (const [code, doc] of byBase) {
    const v = verdictForLech(doc);
    verdictCounts[v.verdict] = (verdictCounts[v.verdict] || 0) + 1;
    audited.push({
      code,
      batchDate: doc.batchDate,
      ...v,
      mailName: doc.noiDungMail?.tenTaiKhoan || null,
      msName: doc.ms?.hoVaTen || null,
      soCccdHd: doc.hopDong?.soCanCuoc || null,
      soCccdImg: doc.canCuoc?.soCanCuoc || null,
      soCccdMs: doc.ms?.soCMND_HoChieu || null,
    });
  }

  const summary = {
    before,
    after,
    transitions,
    remainingLechUnique: byBase.size,
    remainingLechRecords: remain.length,
    verdictCounts,
    falsePositives: audited.filter((a) => a.verdict === 'FALSE_POSITIVE'),
    mixed: audited.filter((a) => a.verdict === 'MIXED'),
    likelyCorrect: audited.filter((a) => a.verdict === 'LIKELY_CORRECT'),
  };

  console.log('AUDIT_SUMMARY=' + JSON.stringify({
    remainingLechUnique: summary.remainingLechUnique,
    verdictCounts: summary.verdictCounts,
    falsePositiveCodes: summary.falsePositives.map((x) => x.code),
    mixedCodes: summary.mixed.map((x) => x.code),
    likelyCorrectSample: summary.likelyCorrect.slice(0, 25).map((x) => ({
      code: x.code,
      errs: x.errs,
    })),
  }, null, 2));

  fs.writeFileSync('/tmp/_lech_accuracy_audit.json', JSON.stringify(summary, null, 2));
  console.log('WROTE=/tmp/_lech_accuracy_audit.json');
  console.log(
    'SUMMARY=' +
      JSON.stringify({
        beforeLech: before.by.LECH,
        afterLech: after.by.LECH,
        afterKhop: after.by.KHOP,
        afterCanKiemTra: after.by.CAN_KIEM_TRA,
        deltaLech: after.by.LECH - before.by.LECH,
        falsePositive: verdictCounts.FALSE_POSITIVE,
        mixed: verdictCounts.MIXED,
        likelyCorrect: verdictCounts.LIKELY_CORRECT,
      }),
  );

  await client.close();
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
