require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ==================== 环境变量 ====================
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '123456';
const DB_NAME = process.env.DB_NAME || 'employment_system';
const JWT_SECRET = process.env.JWT_SECRET || 'employment_system_secret_key_2024';
const PORT = parseInt(process.env.PORT) || 3000;

// ==================== 数据库连接池 ====================
const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
});

(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('MySQL Connected');
    conn.release();

    // 自动升级未哈希的密码
    await upgradePasswords();
  } catch (err) {
    console.error('MySQL连接失败:', err.message);
    process.exit(1);
  }
})();

// 启动时自动将明文密码升级为 bcrypt 哈希
async function upgradePasswords() {
  const [users] = await pool.query('SELECT id, username, password FROM users');
  let upgraded = 0;
  for (const u of users) {
    // bcrypt 哈希以 $2a$ 或 $2b$ 开头
    if (!u.password.startsWith('$2')) {
      const hash = bcrypt.hashSync(u.password, 10);
      await pool.query('UPDATE users SET password = ? WHERE id = ?', [hash, u.id]);
      upgraded++;
    }
  }
  if (upgraded > 0) {
    console.log(`已自动升级 ${upgraded} 个用户的密码为 bcrypt 哈希`);
  }
}

// ==================== JWT 中间件 ====================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: '未登录' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token无效' });
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: '无权限' });
  next();
};

// ==================== 工具函数 ====================

function isMarked(val) {
  if (val === undefined || val === null) return false;
  const s = String(val).trim().toLowerCase();
  if (s === '') return false;
  const truthy = ['√', '✓', '✔', '☑', '是', 'yes', '1', 'true', 'y', '有', 'x', '×'];
  return truthy.includes(s) || s.length > 0;
}

function mapExcelRow(row) {
  const col = (i) => (row[i] !== undefined ? String(row[i] || '').trim() : '');

  let status = null;
  let detail = {};

  if (isMarked(row[19])) {
    status = '工作-参军';
  }
  if (!status && isMarked(row[17])) {
    status = '工作-自主创业';
  }
  if (!status && isMarked(row[18])) {
    status = '工作-灵活就业';
  }
  if (!status && isMarked(row[11])) {
    status = '工作-公务员';
    detail.reexam_passed = true;
  }
  if (!status && isMarked(row[12])) {
    status = '工作-事业单位';
  }
  if (!status && isMarked(row[14])) {
    status = '工作-市场就业';
  }
  if (!status && isMarked(row[8])) {
    status = '升学-出国';
    detail.country = col(9) || null;
  }
  if (!status && isMarked(row[7])) {
    status = '升学-国内';
    detail.reexam_passed = isMarked(row[10]);
  }
  if (!status && isMarked(row[15])) {
    status = '待定-已有目标';
  }
  if (!status && isMarked(row[16])) {
    status = '待定-暂未就业';
  }
  if (!status && isMarked(row[4])) {
    status = '待定-暂未就业';
  }
  if (!status) {
    status = '待定-暂未就业';
  }

  return { status, detail };
}

const STATUS_FILTER_MAP = {
  '升学':       ['升学-国内', '升学-出国'],
  '工作':       ['工作-公务员', '工作-事业单位', '工作-市场就业', '工作-自主创业', '工作-灵活就业', '工作-参军', '待定-已有目标', '待定-暂未就业'],
  '升学-国内': ['升学-国内'],
  '升学-出国': ['升学-出国'],
  '国家单位':   ['工作-公务员', '工作-事业单位'],
  '就业':       ['工作-市场就业', '工作-自主创业', '工作-灵活就业'],
  '参军':       ['工作-参军'],
  '待定':       ['待定-已有目标', '待定-暂未就业'],
  '工作-公务员':     ['工作-公务员'],
  '工作-事业单位':   ['工作-事业单位'],
  '工作-市场就业': ['工作-市场就业'],
  '工作-自主创业':   ['工作-自主创业'],
  '工作-灵活就业':   ['工作-灵活就业'],
  '工作-参军':       ['工作-参军'],
  '待定-已有目标':   ['待定-已有目标'],
  '待定-暂未就业':   ['待定-暂未就业'],
};

function buildWhere(req) {
  const conditions = [];
  const params = [];

  if (req.query.username) {
    const uname = req.query.username.trim();
    if (uname) {
      conditions.push('username LIKE ?');
      params.push(`%${uname}%`);
    }
  }

  if (req.query.department) {
    const dept = req.query.department.trim();
    if (dept && dept !== '全部' && dept !== 'undefined') {
      conditions.push('department = ?');
      params.push(dept);
    }
  }

  if (req.query.status && req.query.status !== '全部' && req.query.status !== 'undefined') {
    const statuses = STATUS_FILTER_MAP[req.query.status];
    if (statuses) {
      const placeholders = statuses.map(() => '?').join(',');
      conditions.push(`employment_status IN (${placeholders})`);
      params.push(...statuses);
    }
  }

  if (req.query.class_name) {
    const cls = req.query.class_name.trim();
    if (cls && cls !== '全部' && cls !== 'undefined') {
      conditions.push('class_name = ?');
      params.push(cls);
    }
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  return { whereClause, params };
}

// ==================== 全局错误处理 ====================
app.use((err, req, res, next) => {
  console.error('未捕获错误:', err);
  res.status(500).json({ code: 500, message: '服务器内部错误' });
});

// ==================== 路由：包装 async handler ====================
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ==================== 1. 登录 ====================
app.post('/api/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  const [results] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
  if (results.length === 0) {
    return res.status(400).json({ code: 400, message: '用户不存在' });
  }

  const user = results[0];
  let passwordValid = false;

  // 兼容：如果数据库存的是明文（非 bcrypt 哈希），先明文对比再升级
  if (user.password.startsWith('$2')) {
    passwordValid = bcrypt.compareSync(password, user.password);
  } else {
    passwordValid = (user.password === password);
    if (passwordValid) {
      // 自动升级为 bcrypt
      const hash = bcrypt.hashSync(password, 10);
      await pool.query('UPDATE users SET password = ? WHERE id = ?', [hash, user.id]);
    }
  }

  if (!passwordValid) {
    return res.status(400).json({ code: 400, message: '密码错误' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    code: 200,
    data: {
      token,
      userInfo: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        department: user.department || '',
        class_name: user.class_name || '',
      }
    }
  });
}));

// ==================== 2. 当前用户信息 ====================
app.get('/api/user/info', authenticateToken, asyncHandler(async (req, res) => {
  const [results] = await pool.query('SELECT id, username, name, role, department, class_name FROM users WHERE id = ?', [req.user.id]);
  if (results.length === 0) {
    return res.status(404).json({ code: 404, message: '用户不存在' });
  }
  res.json({ code: 200, data: results[0] });
}));

// 修改密码
app.put('/api/user/password', authenticateToken, asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ code: 400, message: '请填写完整' });
  if (!/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/.test(newPassword)) {
    return res.status(400).json({ code: 400, message: '新密码至少8位，需包含数字、大小写字母' });
  }

  const [users] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
  if (users.length === 0) return res.status(404).json({ code: 404, message: '用户不存在' });

  const user = users[0];
  let valid = false;
  if (user.password.startsWith('$2')) {
    valid = bcrypt.compareSync(oldPassword, user.password);
  } else {
    valid = (user.password === oldPassword);
  }
  if (!valid) return res.status(400).json({ code: 400, message: '旧密码错误' });

  const newHash = bcrypt.hashSync(newPassword, 10);
  await pool.query('UPDATE users SET password = ? WHERE id = ?', [newHash, req.user.id]);
  res.json({ code: 200, message: '密码修改成功' });
}));

// ==================== 管理员重置学生密码 ====================
const DEFAULT_PASSWORD = '123456';

// 单个重置
app.put('/api/admin/reset-password', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ code: 400, message: '缺少用户名' });

  const [users] = await pool.query('SELECT id, role FROM users WHERE username = ?', [username]);
  if (users.length === 0) return res.status(404).json({ code: 404, message: '用户不存在' });
  if (users[0].role !== 'student') return res.status(400).json({ code: 400, message: '仅可重置学生账号' });

  const hash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);
  await pool.query('UPDATE users SET password = ? WHERE id = ?', [hash, users[0].id]);
  res.json({ code: 200, message: `已重置 ${username} 的密码为默认密码` });
}));

// 批量重置
app.post('/api/admin/batch-reset-password', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { usernames } = req.body;
  if (!Array.isArray(usernames) || usernames.length === 0) {
    return res.status(400).json({ code: 400, message: '未选择用户' });
  }

  const hash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);
  let success = 0;
  let skipped = 0;

  for (const uname of usernames) {
    const [users] = await pool.query('SELECT id, role FROM users WHERE username = ?', [uname]);
    if (users.length === 0 || users[0].role !== 'student') {
      skipped++;
      continue;
    }
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hash, users[0].id]);
    success++;
  }

  res.json({ code: 200, message: `成功重置 ${success} 个密码` + (skipped > 0 ? `，跳过 ${skipped} 个` : '') });
}));

// ==================== 3. 就业信息列表 ====================
app.get('/api/employment/list', authenticateToken, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 10;
  const offset = (page - 1) * pageSize;
  const { whereClause, params } = buildWhere(req);

  // 学生只能看到自己的数据
  if (req.user.role === 'student') {
    const studentWhere = whereClause
      ? `${whereClause} AND username = ?`
      : 'WHERE username = ?';
    const studentParams = [...params, req.user.username];

    const [countRes] = await pool.query(
      `SELECT COUNT(*) as total FROM employment_info ${studentWhere}`,
      studentParams
    );
    const total = countRes[0].total;

    const [data] = await pool.query(
      `SELECT * FROM employment_info ${studentWhere} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...studentParams, pageSize, offset]
    );

    return res.json({ code: 200, data: { list: data, total, page, pageSize } });
  }

  const [countRes] = await pool.query(
    `SELECT COUNT(*) as total FROM employment_info ${whereClause}`,
    params
  );
  const total = countRes[0].total;

  const [data] = await pool.query(
    `SELECT * FROM employment_info ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  res.json({ code: 200, data: { list: data, total, page, pageSize } });
}));

// ==================== 4. CRUD ====================
app.get('/api/employment/detail/:id', authenticateToken, asyncHandler(async (req, res) => {
  const [results] = await pool.query('SELECT * FROM employment_info WHERE id = ?', [req.params.id]);
  res.json({ code: 200, data: results[0] || null });
}));

app.post('/api/employment/add', authenticateToken, asyncHandler(async (req, res) => {
  const { username, name, department, class_name, employment_status, unit, phone, detail, notes } = req.body;
  const [result] = await pool.query(
    `INSERT INTO employment_info (username, name, department, class_name, employment_status, unit, phone, detail, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      username || '',
      name || '',
      department || '',
      class_name || '',
      employment_status || null,
      unit || '',
      phone || '',
      detail ? JSON.stringify(detail) : null,
      notes || null,
    ]
  );

  // 自动为学生创建登录账号（学号=用户名，默认密码=123456，忽略已存在）
  if (username && username !== 'admin') {
    await pool.query(
      `INSERT IGNORE INTO users (username, name, password, department, class_name, role) VALUES (?, ?, ?, ?, ?, 'student')`,
      [username, name || username, bcrypt.hashSync('123456', 10), department || '', class_name || '']
    );
  }

  res.json({ code: 200, data: { id: result.insertId }, message: '新增成功' });
}));

app.put('/api/employment/update/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { username, name, department, class_name, employment_status, unit, phone, detail, notes } = req.body;

  // 学生只能更新自己的记录
  if (req.user.role === 'student') {
    const [rows] = await pool.query('SELECT username FROM employment_info WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ code: 404, message: '记录不存在' });
    if (rows[0].username !== req.user.username) return res.status(403).json({ code: 403, message: '无权修改他人记录' });
  }

  await pool.query(
    `UPDATE employment_info SET
       username=?, name=?, department=?, class_name=?, employment_status=?, unit=?, phone=?, detail=?, notes=?
     WHERE id=?`,
    [
      username || '',
      name || '',
      department || '',
      class_name || '',
      employment_status || null,
      unit || '',
      phone || '',
      detail ? JSON.stringify(detail) : null,
      notes || null,
      req.params.id,
    ]
  );
  res.json({ code: 200, message: '更新成功' });
}));

app.delete('/api/employment/delete/:id', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM employment_info WHERE id = ?', [req.params.id]);
  res.json({ code: 200, message: '删除成功' });
}));

// 批量删除
app.post('/api/employment/batch-delete', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const ids = req.body.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ code: 400, message: '未选择记录' });
  }
  await pool.query('DELETE FROM employment_info WHERE id IN (?)', [ids]);
  res.json({ code: 200, message: `成功删除 ${ids.length} 条记录` });
}));

// 按筛选条件全部删除
app.post('/api/employment/batch-delete-all', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { whereClause, params } = buildWhere(req);
  const [result] = await pool.query(`DELETE FROM employment_info ${whereClause}`, params);
  res.json({ code: 200, message: `成功删除 ${result.affectedRows} 条记录` });
}));

// ==================== 5. 导入 ====================
const upload = multer({ dest: 'uploads/' });

app.post('/api/employment/import', authenticateToken, requireAdmin, upload.single('file'), asyncHandler(async (req, res) => {
  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (rawRows.length < 2) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ code: 400, message: '表格格式错误，至少需要表头+1行数据' });
    }

    const headerSample = rawRows.slice(0, 3).flat().join(',');
    const isBadTable = headerSample.includes('参军') && headerSample.includes('出国') && !headerSample.includes('employment_status');

    let headerRow = [];
    let dataStart = 1;

    if (isBadTable) {
      const r0 = rawRows[0].map(h => String(h || '').trim());
      const r1 = (rawRows[1] || []).map(h => String(h || '').trim());
      for (let i = 0; i < Math.max(r0.length, r1.length); i++) {
        headerRow[i] = r1[i] || r0[i] || `COL_${i}`;
      }
      dataStart = 2;
    } else {
      headerRow = rawRows[0].map(h => String(h || '').trim());
    }

    const findCol = (keywords) => {
      for (let i = 0; i < headerRow.length; i++) {
        for (const kw of keywords) {
          if (headerRow[i].includes(kw) || kw.includes(headerRow[i])) return i;
        }
      }
      return -1;
    };

    const c = {
      name:       findCol(['姓名']),
      username:   findCol(['学号']),
      dept:       findCol(['系', '院系']),
      cls:        findCol(['班级']),
      other:      findCol(['其他']),
      notes:      findCol(['简述', '困难', '个性化']),
      abroad:     findCol(['出国']),
      civil:      findCol(['省考']),
      institution: findCol(['事业单位']),
      market:     findCol(['市场型就业', '已初步落实', '已有目标', '暂未有目标']),
      self:       findCol(['自主创业']),
      flex:       findCol(['灵活就业']),
      army:       findCol(['参军']),
      study:      findCol(['升学']),
      status:     findCol(['就业状态', 'employment_status', '毕业去向']),
    };

    const records = [];
    for (let i = dataStart; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.length === 0) continue;
      if (!row[c.username] && !row[c.name]) continue;

      let status = null;
      let detail = {};

      if (isBadTable) {
        const res = mapExcelRow(row);
        status = res.status;
        detail = res.detail;
      } else {
        status = c.status !== -1 ? String(row[c.status] || '').trim() : null;
        if (!status) status = '待定-暂未就业';
      }

      records.push([
        String(row[c.username] || '').trim(),
        String(row[c.name] || '').trim(),
        c.dept !== -1 ? String(row[c.dept] || '').trim() : '',
        c.cls !== -1 ? String(row[c.cls] || '').trim() : '',
        status,
        '',
        '',
        JSON.stringify(detail),
        c.notes !== -1 ? String(row[c.notes] || '').trim() : null,
        c.other !== -1 ? String(row[c.other] || '').trim() : null,
        JSON.stringify(row.slice(0, 20)),
      ]);
    }

    if (records.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ code: 400, message: '未解析到有效数据' });
    }

    const sql = `REPLACE INTO employment_info
      (username, name, department, class_name, employment_status, unit, phone, detail, notes, other_info, raw_excel_row)
      VALUES ?`;

    await pool.query(sql, [records]);

    // 自动为导入的学生创建登录账号（学号=用户名，默认密码=123456）
    const importedUsernames = [...new Set(records.map(r => r[0]).filter(Boolean))];
    if (importedUsernames.length > 0) {
      // 批量创建：所有学生共享默认密码，只计算一次哈希
      const defaultHash = bcrypt.hashSync('123456', 10);
      const studentUsers = importedUsernames.map(uname => [
        uname,
        uname,
        defaultHash,
        '',
        '',
        'student',
      ]);
      await pool.query(
        `INSERT IGNORE INTO users (username, name, password, department, class_name, role) VALUES ?`,
        [studentUsers]
      );
      // 用 employment_info 中的正确数据回填 users 表的姓名/院系/班级
      await pool.query(
        `UPDATE users u
         INNER JOIN employment_info e ON u.username = e.username
         SET u.name = e.name,
             u.department = e.department,
             u.class_name = e.class_name
         WHERE u.role = 'student'`
      );
    }

    fs.unlinkSync(req.file.path);
    res.json({ code: 200, message: `成功导入 ${records.length} 条记录` });

  } catch (e) {
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    throw e;
  }
}));

// 下载模板
app.get('/api/employment/template', authenticateToken, asyncHandler(async (req, res) => {
  const data = [['姓名', '学号', '院系', '班级', '就业状态', '就业单位', '电话']];
  const ws = xlsx.utils.aoa_to_sheet(data);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, '模板');
  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename=template.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
}));

// ==================== 6. 导出 ====================
app.get('/api/employment/export/excel', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { whereClause, params } = buildWhere(req);
  const [results] = await pool.query(`SELECT * FROM employment_info ${whereClause}`, params);

  const out = results.map(r => ({
    '学号': r.username || '',
    '姓名': r.name || '',
    '院系': r.department || '',
    '班级': r.class_name || '',
    '去向状态': r.employment_status ? r.employment_status.replace(/-/g, '/') : '未填写',
    '单位/院校': r.unit || '',
    '电话': r.phone || '',
    '备注': r.notes || '',
  }));

  const ws = xlsx.utils.json_to_sheet(out);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, '就业信息');
  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename=employment.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
}));

app.get('/api/employment/export/pdf', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { whereClause, params } = buildWhere(req);
  const [results] = await pool.query(`SELECT * FROM employment_info ${whereClause}`, params);

  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margins: { top: 30, bottom: 30, left: 20, right: 20 } });
  const buffers = [];

  // 尝试注册中文字体（使用黑体 simhei.ttf，pdfkit 不支持 .ttc 格式）
  const fontPath = 'C:/Windows/Fonts/simhei.ttf';
  let useChineseFont = false;
  if (fs.existsSync(fontPath)) {
    try {
      doc.registerFont('SimHei', fontPath);
      useChineseFont = true;
    } catch (_) {}
  }

  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {
    const pdfData = Buffer.concat(buffers);
    res.setHeader('Content-Disposition', 'attachment; filename=employment.pdf');
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfData);
  });

  const font = useChineseFont ? 'SimHei' : 'Helvetica';
  const fontSize = 9;
  const lineHeight = 14;

  // 表头
  const headers = ['序号', '学号', '姓名', '院系', '班级', '去向状态', '单位/院校', '备注'];
  const colWidths = [30, 100, 60, 100, 100, 80, 150, 120];

  // 标题
  doc.font(font).fontSize(14).text('学生就业信息表', { align: 'center' });
  doc.moveDown(0.5);

  // 画表头行背景
  let y = doc.y;
  const drawTableHeader = (startY) => {
    let x = doc.page.margins.left;
    doc.font(font).fontSize(fontSize);

    // 灰色背景
    doc.rect(x, startY, colWidths.reduce((a, b) => a + b, 0), lineHeight).fill('#e0e0e0');

    // 表头文字
    headers.forEach((h, i) => {
      doc.fillColor('#000');
      doc.text(h, x + 2, startY + 2, { width: colWidths[i] - 4, align: 'center', lineBreak: false });
      x += colWidths[i];
    });
  };

  const drawRow = (row, rowY, rowIdx) => {
    let x = doc.page.margins.left;
    const bgColor = rowIdx % 2 === 0 ? '#ffffff' : '#f5f5f5';

    doc.rect(x, rowY, colWidths.reduce((a, b) => a + b, 0), lineHeight).fill(bgColor);

    const values = [
      String(rowIdx),
      row.username || '',
      row.name || '',
      row.department || '',
      row.class_name || '',
      row.employment_status ? row.employment_status.replace(/-/g, '/') : '未填写',
      row.unit || '',
      (row.notes || '').slice(0, 20),
    ];

    values.forEach((v, i) => {
      doc.fillColor('#000');
      doc.font(font).fontSize(fontSize);
      doc.text(v, x + 2, rowY + 2, { width: colWidths[i] - 4, align: 'left', lineBreak: false });
      x += colWidths[i];
    });
  };

  drawTableHeader(y);
  y += lineHeight;

  // 画横线
  const drawHLine = (yy) => {
    doc.moveTo(doc.page.margins.left, yy)
       .lineTo(doc.page.margins.left + colWidths.reduce((a, b) => a + b, 0), yy)
       .stroke('#cccccc');
  };

  drawHLine(y);

  results.forEach((r, idx) => {
    if (y + lineHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
      drawTableHeader(y);
      y += lineHeight;
      drawHLine(y);
    }
    drawRow(r, y, idx + 1);
    y += lineHeight;
    drawHLine(y);
  });

  doc.end();
}));

// ==================== 7. 动态表单配置接口 ====================
const FORM_CONFIG = {
  '升学-国内': {
    fields: [
      { key: 'reexam_passed', label: '是否过线准备复试？', type: 'radio', required: true,
        options: [{ label: '是', value: true }, { label: '否', value: false }] },
      { key: 'school', label: '目标升学学校', type: 'input', required: false, showWhen: { reexam_passed: true } },
    ]
  },
  '升学-出国': {
    fields: [
      { key: 'country', label: '目标国家', type: 'input', required: true },
      { key: 'school', label: '目标学校', type: 'input', required: false },
    ]
  },
  '工作-公务员': {
    fields: [
      { key: 'reexam_passed', label: '省考是否进面？', type: 'radio', required: true,
        options: [{ label: '是', value: true }, { label: '否', value: false }] },
      { key: 'unit_name', label: '报考单位名称', type: 'input', required: false, showWhen: { reexam_passed: true } },
    ]
  },
  '工作-事业单位': {
    fields: [
      { key: 'reexam_passed', label: '是否进入面试？', type: 'radio', required: true,
        options: [{ label: '是', value: true }, { label: '否', value: false }] },
      { key: 'unit_name', label: '拟报名单位名称', type: 'input', required: false, showWhen: { reexam_passed: true } },
    ]
  },
  '工作-市场就业': {
    fields: [
      { key: 'unit_name', label: '就业单位名称', type: 'input', required: false },
      { key: 'position', label: '岗位', type: 'input', required: false },
    ]
  },
  '工作-自主创业': {
    fields: [
      { key: 'project_name', label: '创业项目名称', type: 'input', required: false },
    ]
  },
  '工作-灵活就业': {
    fields: [
      { key: 'job_desc', label: '灵活就业类型说明', type: 'textarea', required: false },
    ]
  },
  '工作-参军': {
    fields: [
      { key: 'enlist_region', label: '应征地区', type: 'input', required: false },
    ]
  },
  '待定-已有目标': {
    fields: [
      { key: 'target_desc', label: '目标描述', type: 'textarea', required: false },
    ]
  },
  '待定-暂未就业': {
    fields: [
      { key: 'reason', label: '暂未就业原因', type: 'textarea', required: false },
    ]
  },
};

app.get('/api/employment/form-config/:status', authenticateToken, asyncHandler(async (req, res) => {
  const config = FORM_CONFIG[req.params.status];
  res.json({ code: 200, data: config || { fields: [] } });
}));

// ==================== 8. 获取院系列表 ====================
app.get('/api/employment/options', authenticateToken, asyncHandler(async (req, res) => {
  const [deptResults] = await pool.query(
    "SELECT DISTINCT department FROM employment_info WHERE department IS NOT NULL AND department != '' ORDER BY department"
  );
  const [classResults] = await pool.query(
    "SELECT DISTINCT class_name FROM employment_info WHERE class_name IS NOT NULL AND class_name != '' ORDER BY class_name"
  );
  const departments = deptResults.map(r => r.department);
  const classes = classResults.map(r => r.class_name);
  res.json({ code: 200, data: { departments, classes } });
}));

// ==================== 启动 ====================
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
