/* ============================================================
   礁溪國小 115 學年度 教室配置（資料檔）
   來源：D:\School3D1\classrooms.png「礁溪國小 115 學年度教室配置圖暨電話分機」
   ※ 每學年只需修改本檔，其餘程式與建物幾何不需變動。
   格式：
     { building: 建物 id, floor: 樓層, rooms: [ '名稱+房號', ... ] }
   房號首碼代表年級（一~六），樓層以 floor 欄為準。
   rooms 由左至右、由上至下對應建物平面上的教室方塊（主程式自動產生）。
   ============================================================ */

window.CLASSROOMS_115 = {
  year: '115',
  title: '礁溪國小 115 學年度教室配置',
  source: 'classrooms.png',
  data: [
    /* ---------- 教學大樓 ---------- */
    {
      building: 'teaching', floor: 3,
      rooms: ['六忠601', '六孝602', '六仁603', '科任251', '科任252', '三忠301', '三孝302', '三仁303', '三愛304']
    },
    {
      building: 'teaching', floor: 2,
      rooms: ['科任253', '六愛604', '六信605', '四忠401', '電腦254', '四孝402', '四仁403', '四愛404', '四信405']
    },
    {
      building: 'teaching', floor: 1,
      rooms: ['一忠101', '一孝102', '一仁103', '一愛104', '穿堂', '模學(一)223', '模學(二)224', '特教225', '知動226']
    },

    /* ---------- 行政大樓 ---------- */
    {
      building: 'admin', floor: 4,
      rooms: ['科任234', '科任233', '校史室', '階梯教室', '視聽教室']
    },
    {
      building: 'admin', floor: 3,
      rooms: ['五愛504', '五仁503', '五孝502', '五忠501', '模學(三)231', '統整教室',
              '科任235', '諮商室', '資融教室', '會議室188', '校長室100', '會長室', '接待室', '秘書室']
    },
    {
      building: 'admin', floor: 2,
      rooms: ['教務處120', '教學121', '學藝122', '課研123', '圖資124',
              '英語', '英語', '六義606', '五信505',
              '輔導處160', '資料162', '特教163', '專輔164',
              '總務處150', '事務151', '出納152', '文書153', '午餐155', '總機156',
              '人事170', '主計180']
    },
    {
      building: 'admin', floor: 1,
      rooms: ['二忠201', '二孝202', '二仁203', '二愛204', '科任232', '穿堂',
              '學務處130', '體育132', '生教134', '活動131', '衛生133', '教練135',
              '傳達室', '職工室230', '體育器材室', '健康中心190']
    },

    /* ---------- 育英樓（幼兒園） ---------- */
    {
      building: 'yuying', floor: 3,
      rooms: ['多功能活動室', '廚房222']
    },
    {
      building: 'yuying', floor: 2,
      rooms: ['向日葵班212', '梅花班217', '百合班213', '茉莉班216', '蘭花班215']
    },
    {
      building: 'yuying', floor: 1,
      rooms: ['滿天星班218', '蒲公英班219', '幼兒園圖書室221', '教保準備室211', '學前特教220', '中庭']
    },

    /* ---------- 圖書館·音樂大樓 ---------- */
    {
      building: 'library', floor: 3,
      rooms: ['樂齡教室264', '社區共讀站262', '科任263']
    },
    {
      building: 'library', floor: 2,
      rooms: ['國樂269', '個語教室265', '科任266']
    },
    {
      building: 'library', floor: 1,
      rooms: ['圖書館260', '音樂261', '科任267', '科任268']
    },

    /* ---------- 舊教室 ---------- */
    {
      building: 'old', floor: 2,
      rooms: ['諮商室', '社區共讀站', '科任教室', '科任教室']
    },
    {
      building: 'old', floor: 1,
      rooms: ['科任教室', '科任教室', '交通器材', '倉庫']
    },

    /* ---------- 其他 ---------- */
    { building: 'gym', floor: 1, rooms: ['主球場', '體育器材室', '更衣室'] },
    { building: 'kitchen', floor: 1, rooms: ['儲藏室', '備餐區'] },
    { building: 'bell', floor: 3, rooms: ['鐘室'] },
    { building: 'bell', floor: 2, rooms: ['儲藏室'] },
    { building: 'bell', floor: 1, rooms: ['入口'] },
    { building: 'bleachers', floor: 1, rooms: ['觀眾席'] }
  ],

  /* 處室索引：供搜尋使用（名稱 → 建物/樓層） */
  offices: [
    { name: '校長室', no: '100', building: 'admin', floor: 3 },
    { name: '教務處', no: '120', building: 'admin', floor: 2 },
    { name: '學務處', no: '130', building: 'admin', floor: 1 },
    { name: '總務處', no: '150', building: 'admin', floor: 2 },
    { name: '輔導處', no: '160', building: 'admin', floor: 2 },
    { name: '人事室', no: '170', building: 'admin', floor: 2 },
    { name: '主計室', no: '180', building: 'admin', floor: 2 },
    { name: '保健室', no: '190', building: 'admin', floor: 1 },
    { name: '會議室', no: '188', building: 'admin', floor: 3 },
    { name: '傳達室', no: '', building: 'admin', floor: 1 },
    { name: '健康中心', no: '190', building: 'admin', floor: 1 },
    { name: '圖書館', no: '260', building: 'library', floor: 1 },
    { name: '音樂教室', no: '261', building: 'library', floor: 1 },
    { name: '電腦教室', no: '254', building: 'teaching', floor: 2 },
    { name: '特教教室', no: '225', building: 'teaching', floor: 1 },
    { name: '統整教室', no: '', building: 'admin', floor: 3 },
    { name: '階梯教室', no: '', building: 'admin', floor: 4 },
    { name: '校史室', no: '', building: 'admin', floor: 4 },
    { name: '多功能活動室', no: '', building: 'yuying', floor: 3 },
    { name: '樂齡教室', no: '264', building: 'library', floor: 3 },
    { name: '社區共讀站', no: '262', building: 'library', floor: 3 },
    { name: '個語教室', no: '265', building: 'library', floor: 2 }
  ]
};
