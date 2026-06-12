const mysql = require('mysql2/promise');

(async () => {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'employment_system',
  });

  console.log('开始清洗 employment_status...\n');

  // 1. 升学-国内：单位含大学/学院/研究所等
  const [r1] = await pool.query(
    `UPDATE employment_info SET employment_status = '升学-国内'
     WHERE employment_status IS NULL AND unit IS NOT NULL
     AND (unit LIKE '%大学%' OR unit LIKE '%学院%' OR unit LIKE '%研究所%' OR unit LIKE '%研究院%')`
  );
  console.log(`升学-国内：${r1.affectedRows} 条`);

  // 2. 工作-公务员 / 工作-事业单位：通过 detail JSON 判断
  const [r2] = await pool.query(
    `UPDATE employment_info SET employment_status = '工作-公务员'
     WHERE employment_status IS NULL
     AND JSON_EXTRACT(detail, '$.reexam_passed') = true
     AND (unit LIKE '%省%' OR unit LIKE '%局%' OR unit LIKE '%厅%')`
  );
  console.log(`工作-公务员：${r2.affectedRows} 条`);

  // 3. 市场型就业：单位含公司/集团/厂/企业等
  const [r3] = await pool.query(
    `UPDATE employment_info SET employment_status = '工作-市场就业'
     WHERE employment_status IS NULL AND unit IS NOT NULL
     AND (unit LIKE '%公司%' OR unit LIKE '%集团%' OR unit LIKE '%厂%' OR unit LIKE '%企业%')`
  );
  console.log(`工作-市场就业：${r3.affectedRows} 条`);

  // 4. 剩余标记为暂未就业
  const [r4] = await pool.query(
    `UPDATE employment_info SET employment_status = '待定-暂未就业'
     WHERE employment_status IS NULL`
  );
  console.log(`待定-暂未就业：${r4.affectedRows} 条`);

  console.log('\n清洗完成！');

  // 验证
  const [rows] = await pool.query(
    'SELECT employment_status, COUNT(*) as cnt FROM employment_info GROUP BY employment_status ORDER BY cnt DESC'
  );
  console.log('\n当前分布：');
  rows.forEach(r => console.log(`  ${r.employment_status || 'NULL'} : ${r.cnt} 条`));

  await pool.end();
  process.exit(0);
})();
