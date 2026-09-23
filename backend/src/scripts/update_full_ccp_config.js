const { Client } = require('ssh2');

const fullConfig = {
  // ── 1. Thống Kê Số Lot (5 Phân hệ) trong Thong ke ccp ──
  pathNormalLot: "M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Thong ke ccp\\Thong ke so lot giao dich ${YYYY}.xlsx",
  pathAcmLot: "M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Thong ke ccp\\Thong ke so lot giao dich ACM ${YYYY}.xlsx",
  pathLmeLot: "M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Thong ke ccp\\Thong ke so lot giao dich LME ${YYYY}.xlsx",
  pathSpreadLot: "M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Thong ke ccp\\Thong ke so lot giao dich Spread ${YYYY}.xlsx",
  pathOptionsLot: "M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Thong ke ccp\\Thong ke so lot giao dich Options ${YYYY}.xlsx",

  // ── 2. Thống Kê Giá Trị Giao Dịch (5 Phân hệ) trong Thong ke ccp ──
  pathGtgdNormal: "M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Thong ke ccp\\Thong ke gia tri giao dich ${YYYY}.xlsx",
  pathAcmGtgd: "M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Thong ke ccp\\Thong ke gia tri giao dich ACM ${YYYY}.xlsx",
  pathGtgdLme: "M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Thong ke ccp\\Thong ke gia tri giao dich LME ${YYYY}.xlsx",
  pathGtgdSpread: "M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Thong ke ccp\\Thong ke gia tri giao dich Spread ${YYYY}.xlsx",
  pathGtgdOptions: "M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Thong ke ccp\\Thong ke gia tri giao dich Options ${YYYY}.xlsx",

  // ── 3. File Lũy Kế DSGD Thô trong Thong ke ccp ──
  pathDsgdCumulative: "M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Thong ke ccp\\DSGD T${MM}.${YYYY} CCP.xlsx",

  // ── 4. Đường Dẫn Thư Mục Backup CCP Ngày ──
  bot_backup_path_ccp: "M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CCP\\Futures",

  // Backward compatibility keys
  pathAcmCumulative: "M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Thong ke ccp\\Thong ke so lot giao dich ACM ${YYYY}.xlsx",
  pathGtgdAcm: "M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Thong ke ccp\\Thong ke gia tri giao dich ACM ${YYYY}.xlsx",
  pathNormalCumulative: "M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Thong ke ccp\\Thong ke so lot giao dich ${YYYY}.xlsx",
  pathSpreadCumulative: "M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Thong ke ccp\\Thong ke so lot giao dich Spread ${YYYY}.xlsx",
  pathLmeCumulative: "M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Thong ke ccp\\Thong ke so lot giao dich LME ${YYYY}.xlsx",
  pathOptionsCumulative: "M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Thong ke ccp\\Thong ke so lot giao dich Options ${YYYY}.xlsx",
};

const conn = new Client();
conn.on('ready', () => {
  const jsonStr = JSON.stringify(fullConfig).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const cmd = `mongosh mxv_shift_checklist --quiet --eval 'db.system_settings.updateOne({ key: "ccp_lot_statistics_config" }, { $set: { value: JSON.stringify(${JSON.stringify(fullConfig)}) } }, { upsert: true }); db.system_settings.findOne({ key: "ccp_lot_statistics_config" });'`;
  
  conn.exec(cmd, (err, stream) => {
    let out = '';
    stream.on('data', d => out += d);
    stream.on('close', () => {
      console.log('Updated ccp_lot_statistics_config in MongoDB:');
      console.log(out);
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
