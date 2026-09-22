const fs = require('fs');
const path = require('path');

const repoPath = 'C:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\GitLab\\mxv-datawarehouse\\be\\data-serving\\src\\db\\repositories\\member.repository.ts';
const controllerPath = 'C:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\GitLab\\mxv-datawarehouse\\be\\data-serving\\src\\controllers\\member.controller.ts';

// 1. Sửa member.repository.ts
let repoContent = fs.readFileSync(repoPath, 'utf8');

// Bỏ sortOrder trong destructuring params
repoContent = repoContent.replace(
  'const { pageIndex, pageSize, search = {}, filter = {}, sortBy, sortOrder } = params;',
  'const { pageIndex, pageSize, search = {}, filter = {}, sortBy } = params;'
);

// Thay logic sắp xếp đơn lẻ bằng hỗ trợ Record<string, 'asc' | 'desc'>
const oldSortSection = `    // ─────────────────────────────────────────────────────────────
    // 3. SẮP XẾP & PHÂN TRANG
    // ─────────────────────────────────────────────────────────────
    const sortCol = getDbColumn(sortBy) || 'member_code';
    const sortDir = String(sortOrder).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';`;

const newSortSection = `    // ─────────────────────────────────────────────────────────────
    // 3. SẮP XẾP & PHÂN TRANG
    // ─────────────────────────────────────────────────────────────
    const orderClauses: string[] = [];

    if (sortBy && typeof sortBy === 'object') {
      for (const [colKey, dir] of Object.entries(sortBy)) {
        const dbCol = getDbColumn(colKey);
        if (!dbCol) continue;
        const sortDir = String(dir).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
        orderClauses.push(\`\${dbCol} \${sortDir}\`);
      }
    }

    const orderSql = orderClauses.length > 0 ? \`ORDER BY \${orderClauses.join(', ')}\` : 'ORDER BY member_code ASC';`;

repoContent = repoContent.replace(oldSortSection, newSortSection);

// Thay ORDER BY trong dataSql
repoContent = repoContent.replace(
  'ORDER BY ${sortCol} ${sortDir}',
  '${orderSql}'
);

fs.writeFileSync(repoPath, repoContent, 'utf8');
console.log('Successfully updated member.repository.ts');

// 2. Sửa member.controller.ts
let controllerContent = fs.readFileSync(controllerPath, 'utf8');

const oldControllerSort = `    const search = parseJson<Record<string, string>>(req.query.search);
    const filter = parseJson<Record<string, any>>(req.query.filter);
    const sortBy = String(req.query.sortBy || '');
    const sortOrder = String(req.query.sortOrder).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const result = await memberService.getMembers({ pageIndex, pageSize, search, filter, sortBy, sortOrder });`;

const newControllerSort = `    const search = parseJson<Record<string, string>>(req.query.search);
    const filter = parseJson<Record<string, any>>(req.query.filter);

    let sortBy = parseJson<Record<string, 'asc' | 'desc'>>(req.query.sortBy);
    if (!sortBy && req.query.sortBy && typeof req.query.sortBy === 'string') {
      const field = req.query.sortBy.trim();
      if (field && field !== 'undefined' && field !== 'null') {
        const order = String(req.query.sortOrder).toLowerCase() === 'desc' ? 'desc' : 'asc';
        sortBy = { [field]: order };
      }
    }

    const result = await memberService.getMembers({ pageIndex, pageSize, search, filter, sortBy });`;

controllerContent = controllerContent.replace(oldControllerSort, newControllerSort);
fs.writeFileSync(controllerPath, controllerContent, 'utf8');
console.log('Successfully updated member.controller.ts');
