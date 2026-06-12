const mysql = require('mysql2/promise');

(async () => {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'employment_system',
  });

  const [t] = await pool.query('SELECT COUNT(*) as c FROM employment_info');
  console.log('总记录:', t[0].c);

  console.log('\n=== employment_status 分布 ===');
  const [s] = await pool.query('SELECT employment_status, COUNT(*) as c FROM employment_info GROUP BY employment_status ORDER BY c DESC');
  s.forEach(r => console.log('  ', r.employment_status || 'NULL', ':', r.c));

  console.log('\n=== department 分布 ===');
  const [d] = await pool.query('SELECT department, COUNT(*) as c FROM employment_info GROUP BY department ORDER BY c DESC');
  d.forEach(r => console.log('  ', r.department || 'NULL', ':', r.c));

  // 按子类别（国内/出国等）统计
  console.log('\n=== 子类别分布 ===');
  const [sub] = await pool.query(`
    SELECT 
      CASE 
        WHEN employment_status LIKE '升学%' THEN '升学'
        WHEN employment_status LIKE '工作%' THEN '工作'
        WHEN employment_status LIKE '待定%' THEN '待定'
        ELSE '其他'
      END AS category,
      employment_status, 
      COUNT(*) as c 
    FROM employment_info 
    GROUP BY category, employment_status 
    ORDER BY category, c DESC
  `);
  sub.forEach(r => console.log('  ', r.category, '→', r.employment_status, ':', r.c));

  console.log('\n=== 前3条 ===');
  const [rows] = await pool.query('SELECT username, name, department, class_name, employment_status, unit FROM employment_info LIMIT 3');
  rows.forEach(r => console.log(JSON.stringify(r)));

  await pool.end();
  process.exit(0);
})();
