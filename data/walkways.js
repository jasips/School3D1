/* ============================================================
   礁溪國小 3D 校園導覽 — 步行路網資料
   座標：campus-map.png 像素座標（原點左上角, y 向下）
   說明：
     spots  = 可作為起訖點的節點（地標 / 建物出入口 / 路口）
     edges  = 路網骨幹（節點之間的可行走連線，主程式會併入 A* 網格）
     cell   = A* 導航網格邊長（公尺）
     一般戶外空間（草地、廣場、跑道）皆可行走；建物內部與圍牆外不可行走。
   ============================================================ */

window.WALK_NETWORK = {
  cell: 3.0,          // 導航網格邊長（公尺）
  nodeRadius: 1.4,    // 節點吸附半徑（公尺）

  /* ---- 節點（id, 名稱, 地圖像素座標, 所屬建物/樓層可省略） ---- */
  spots: [
    { id: 'gate',      name: '校門口',        px: [466, 60],   tag: '入口' },
    { id: 'northwalk', name: '北側走道',      px: [464, 210],  tag: '走道' },
    { id: 'parking',   name: '停車場',        px: [240, 146],  tag: '設施' },
    { id: 'kitchen',   name: '廚房（舊）',    px: [159, 316],  tag: '建物' },
    { id: 'library',   name: '圖書館入口',    px: [154, 540],  tag: '建物' },
    { id: 'old',       name: '舊教室入口',    px: [148, 750],  tag: '建物' },
    { id: 'teachN',    name: '教學大樓北側',  px: [464, 350],  tag: '建物' },
    { id: 'lobby',     name: '教學大樓穿堂',  px: [464, 470],  tag: '建物' },
    { id: 'teachS',    name: '教學大樓南側',  px: [464, 530],  tag: '路口' },
    { id: 'court',     name: '中庭',          px: [450, 687],  tag: '廣場' },
    { id: 'courtE',    name: '中庭東側',      px: [640, 687],  tag: '廣場' },
    { id: 'courtW',    name: '中庭西側',      px: [260, 687],  tag: '廣場' },
    { id: 'hall',      name: '行政大樓川堂',  px: [464, 800],  tag: '建物' },
    { id: 'adminW',    name: '行政大樓西側',  px: [220, 905],  tag: '路口' },
    { id: 'adminE',    name: '行政大樓東側',  px: [700, 850],  tag: '路口' },
    { id: 'gym',       name: '體育館入口',    px: [760, 650],  tag: '建物' },
    { id: 'bell',      name: '鐘樓',          px: [820, 800],  tag: '地標' },
    { id: 'stand',     name: '看台',          px: [470, 960],  tag: '設施' },
    { id: 'track',     name: '操場',          px: [470, 1160], tag: '設施' },
    { id: 'trackE',    name: '操場東側',      px: [830, 1160], tag: '設施' },
    { id: 'yuying',    name: '育英樓入口',    px: [700, 330],  tag: '建物' },
    { id: 'yuyingN',   name: '育英樓北側',    px: [770, 60],   tag: '路口' },
    { id: 'sw',        name: '西南角',        px: [90, 880],   tag: '路口' },
    { id: 'se',        name: '東南角',        px: [900, 1000], tag: '路口' }
  ],

  /* ---- 路網骨幹（[起點 id, 終點 id]） ---- */
  edges: [
    ['gate', 'northwalk'],
    ['gate', 'parking'],
    ['northwalk', 'teachN'],
    ['northwalk', 'yuyingN'],
    ['parking', 'kitchen'],
    ['kitchen', 'library'],
    ['library', 'old'],
    ['old', 'sw'],
    ['sw', 'adminW'],
    ['teachN', 'lobby'],
    ['lobby', 'teachS'],
    ['teachS', 'court'],
    ['court', 'courtW'],
    ['court', 'courtE'],
    ['courtW', 'library'],
    ['courtW', 'old'],
    ['courtE', 'gym'],
    ['courtE', 'adminE'],
    ['court', 'hall'],
    ['hall', 'adminW'],
    ['hall', 'adminE'],
    ['adminW', 'stand'],
    ['adminE', 'bell'],
    ['bell', 'se'],
    ['stand', 'track'],
    ['track', 'trackE'],
    ['trackE', 'se'],
    ['gym', 'teachS'],
    ['yuying', 'yuyingN'],
    ['yuying', 'courtE'],
    ['yuyingN', 'northwalk'],
    ['yuying', 'gym']
  ],

  /* ---- 不可行走區域：建物本體由主程式依 BUILDINGS 自動扣除，
         可行走範圍由 GROUND_FEATURES.bounds 決定，故此處僅保留例外封閉區 ---- */
  blocked: []
};
