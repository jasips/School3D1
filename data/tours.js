/* ============================================================
   礁溪國小 3D 校園導覽 — 精選導覽路線資料
   stops 為 data/walkways.js 中的節點 id，依序連成導覽動線。
   highlight 為該站會切換到的建物（可省略）。
   ============================================================ */

window.TOURS = [
  {
    id: 'classic',
    name: '校園巡禮（經典路線）',
    desc: '從校門口出發，經教學大樓、中庭、行政大樓到操場，一次看遍校園主軸。',
    color: '#4f83cc',
    duration: 12,
    stops: [
      { spot: 'gate', title: '校門口', text: '礁溪國小正門，由此展開今日的校園導覽。' },
      { spot: 'northwalk', title: '北側走道', text: '連接校門口與校園南北向的林蔭步道。' },
      { spot: 'teachN', title: '教學大樓', text: '三層樓之主要校舍，教室配置依 115 學年度課表。' },
      { spot: 'lobby', title: '穿堂', text: '教學大樓一樓穿堂，南北動線交會處。', highlight: 'teaching', floor: 1 },
      { spot: 'teachS', title: '教學大樓南側', text: '往中庭與行政大樓的主要路口。' },
      { spot: 'court', title: '中庭', text: '教學大樓與行政大樓之間的開闊廣場。' },
      { spot: 'hall', title: '行政大樓川堂', text: '行政大樓入口川堂，兩側為各處室。', highlight: 'admin', floor: 1 },
      { spot: 'stand', title: '看台', text: '操場北側觀眾席，運動會主要觀賽區。' },
      { spot: 'track', title: '操場', text: '校園南側操場與跑道。' }
    ]
  },
  {
    id: 'academic',
    name: '教學區導覽',
    desc: '聚焦教學大樓、圖書館與舊教室，適合新生熟悉上課環境。',
    color: '#5fae8a',
    duration: 8,
    stops: [
      { spot: 'gate', title: '校門口', text: '由正門進入校園。' },
      { spot: 'teachN', title: '教學大樓北側', text: '教學大樓背面，鄰接北側走道。' },
      { spot: 'lobby', title: '穿堂', text: '一樓穿堂，左右兩側為一、二年級教室。', highlight: 'teaching', floor: 1 },
      { spot: 'teachS', title: '教學大樓南側', text: '往中庭方向。' },
      { spot: 'courtW', title: '中庭西側', text: '通往圖書館與舊教室。' },
      { spot: 'library', title: '圖書館', text: '一樓為圖書館與音樂教室，二樓為國樂與個語教室。', highlight: 'library', floor: 1 },
      { spot: 'old', title: '舊教室', text: '早期校舍，現為教師辦公與諮商空間。', highlight: 'old', floor: 1 }
    ]
  },
  {
    id: 'admin',
    name: '行政服務導覽',
    desc: '拜訪校長室、教務處、學務處、總務處等行政處室，一次掌握洽公動線。',
    color: '#e0a15c',
    duration: 7,
    stops: [
      { spot: 'hall', title: '川堂', text: '行政大樓入口，正前方為一樓處室。', highlight: 'admin', floor: 1 },
      { spot: 'adminW', title: '行政大樓西側', text: '一樓傳達室、健康中心與二年級教室。', highlight: 'admin', floor: 1 },
      { spot: 'adminE', title: '行政大樓東側', text: '二樓教務處、輔導處、總務處與人事主計。', highlight: 'admin', floor: 2 },
      { spot: 'bell', title: '鐘樓', text: '校園東側鐘樓，上課鐘聲的來源。', highlight: 'bell', floor: 3 },
      { spot: 'courtE', title: '中庭東側', text: '回程經中庭返回教學區。' }
    ]
  },
  {
    id: 'sports',
    name: '體育與幼兒園路線',
    desc: '從育英樓幼兒園出發，經體育館到操場，適合體育課與親子參訪。',
    color: '#c76b6b',
    duration: 9,
    stops: [
      { spot: 'yuyingN', title: '育英樓北側', text: '幼兒園園舍外圍。' },
      { spot: 'yuying', title: '育英樓', text: '幼兒園教室與中庭，三層樓園舍。', highlight: 'yuying', floor: 1 },
      { spot: 'gym', title: '體育館', text: '挑高室內體育館，風雨天體育課場地。', highlight: 'gym', floor: 1 },
      { spot: 'courtE', title: '中庭東側', text: '連接教學區與運動區。' },
      { spot: 'stand', title: '看台', text: '操場北側觀眾席與植栽帶。', highlight: 'bleachers', floor: 1 },
      { spot: 'track', title: '操場', text: '跑道與中央草坪。' }
    ]
  },
  {
    id: 'jog',
    name: '操場環場慢跑',
    desc: '沿著操場外圍走一圈，欣賞校園綠帶與看台植栽。',
    color: '#8f7fd0',
    duration: 6,
    stops: [
      { spot: 'stand', title: '看台', text: '起點，看台前有整排植栽。' },
      { spot: 'track', title: '操場西側', text: '沿跑道西側前進。' },
      { spot: 'trackE', title: '操場東側', text: '跑道東側，鄰近鐘樓。' },
      { spot: 'se', title: '東南角', text: '校園東南側圍牆邊。' },
      { spot: 'stand', title: '回到看台', text: '環場一圈結束。' }
    ]
  }
];
