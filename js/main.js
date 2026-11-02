/* ============================================================
   礁溪國小 3D 校園導覽 — 主程式
   由 index.html 以 <script type="module"> 匯入 three.js 後呼叫：
       window.startApp(THREE)
   資料來源（皆為傳統 <script>，file:// 可直接載入）：
       data/mapimg.js        校園平面圖 (base64)
       data/buildings.js     建物幾何 / 樓層
       data/classrooms-115.js 115 學年度教室配置
       data/walkways.js      步行路網
       data/tours.js         精選導覽路線
   ============================================================ */

window.startApp = function (THREE) {
  'use strict';

  /* =========================================================
     0. 基本常數與工具
     ========================================================= */
  const M = window.CAMPUS_META;
  const S = M.scale;
  const FH = M.floorHeight;
  const IMG_W = M.imageWidth, IMG_H = M.imageHeight;
  const BUILDINGS = window.BUILDINGS;
  const GF = window.GROUND_FEATURES;
  const CLASS_DATA = window.CLASSROOMS_115;
  const NET = window.WALK_NETWORK;
  const TOURS = window.TOURS;
  const TREES = window.TREES || [];

  const FLOOR_COLORS = ['#4f83cc', '#57a88a', '#e0a15c', '#c76b6b', '#8f7fd0', '#3fb0c7'];

  const toX = px => (px - M.centerX) * S;
  const toZ = py => (py - M.centerY) * S;
  const toPx = x => x / S + M.centerX;
  const toPy = z => z / S + M.centerY;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const deg = r => r * 180 / Math.PI;

  function pip(px, py, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function bbox(poly) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of poly) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    return { x0, y0, x1, y1 };
  }
  function centroid(poly) {
    let x = 0, y = 0;
    for (const p of poly) { x += p[0]; y += p[1]; }
    return [x / poly.length, y / poly.length];
  }
  function polyArea(poly) {
    let a = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
      a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
    return Math.abs(a / 2);
  }

  /* 依名稱解析： '一忠101' -> {label, name:'一忠', no:'101'} */
  function parseRoom(s) {
    const m = /^(.*?)(\d+)$/.exec(s);
    if (m) return { label: s, name: m[1] || s, no: m[2] };
    return { label: s, name: s, no: '' };
  }
  function roomKind(s) {
    if (/穿堂|中庭|樓梯|川堂/.test(s)) return 'lobby';
    if (/圖書|音樂|國樂|電腦|統整|階梯|視聽|多功能|活動|倉庫|交通|器材|廚房/.test(s)) return 'special';
    if (/處|中心|傳達|職工|校長|會議|接待|秘書|會長|主計|人事|保健|校史/.test(s)) return 'office';
    if (/室$/.test(s) && !/\d{3}$/.test(s)) return 'office';
    if (/處\d|室\d{3}|中心\d{3}/.test(s)) return 'office';
    return 'class';
  }

  /* =========================================================
     1. DOM
     ========================================================= */
  const $ = id => document.getElementById(id);
  const app = $('app');

  const el = {};
  ['header', 'brand', 'searchWrap', 'searchInput', 'searchResults', 'searchClear',
    'hdrBtns', 'compass', 'leftNav', 'detail', 'detailBody', 'detailTitle',
    'minimapWrap', 'minimap', 'minimapLabel', 'tourBar', 'tourName', 'tourStep',
    'tourText', 'walkBar', 'walkInfo', 'routeSteps', 'fpHud', 'joystick', 'joyKnob',
    'dock', 'footer', 'toast', 'loading', 'loadPct'].forEach(id => el[id] = $(id));

  /* 建立標籤圖層 */
  const labelLayer = document.createElement('div');
  labelLayer.id = 'labelLayer';
  Object.assign(labelLayer.style, {
    position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '20', overflow: 'hidden'
  });
  app.appendChild(labelLayer);

  function toast(msg, ms) {
    el.toast.textContent = msg;
    el.toast.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.toast.classList.remove('on'), ms || 2200);
  }

  /* =========================================================
     2. 場景
     ========================================================= */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.id = 'scene';
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd0f5);
  const BASE_FOG = new THREE.Fog(0x9fd0f5, 340, 980);
  scene.fog = BASE_FOG;

  const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.4, 3000);

  const hemi = new THREE.HemisphereLight(0xdff0ff, 0x6f7c66, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.55);
  sun.position.set(140, 220, 90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -190; sc.right = 190; sc.top = 190; sc.bottom = -190; sc.near = 20; sc.far = 700;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  const amb = new THREE.AmbientLight(0xffffff, 0.22);
  scene.add(amb);

  /* 夜晚窗光 */
  const windowMats = [];

  /* =========================================================
     3. 狀態
     ========================================================= */
  const state = {
    mode: 'orbit',          // 'orbit' | 'fp'
    night: false,
    powerSave: false,
    selectedBuilding: null,
    selectedFloor: null,    // null = 全棟
    tour: null, tourIdx: 0, tourPlaying: false,
    route: null,            // A* 結果
    walking: false,
    marker: null,
    mobile: matchMedia('(pointer:coarse)').matches || innerWidth <= 720
  };

  /* =========================================================
     4. 相機控制
     ========================================================= */
  const orbit = { target: new THREE.Vector3(0, 0, -6), dist: 250, azim: 0, elev: 0.95 };
  const fp = { pos: new THREE.Vector3(toX(466), 1.55, toZ(130)), yaw: 0, pitch: -0.05 };
  const keys = {};
  const joy = { active: false, x: 0, y: 0 };

  let fly = null; // {from:{...}, to:{...}, t, dur}

  function orbitCameraPosition() {
    const ce = Math.cos(orbit.elev), se = Math.sin(orbit.elev);
    return new THREE.Vector3(
      orbit.target.x + orbit.dist * ce * Math.sin(orbit.azim),
      orbit.target.y + orbit.dist * se,
      orbit.target.z + orbit.dist * ce * Math.cos(orbit.azim)
    );
  }

  function applyOrbitCamera() {
    camera.position.copy(orbitCameraPosition());
    camera.lookAt(orbit.target);
  }

  function applyFpCamera() {
    camera.position.copy(fp.pos);
    const dir = new THREE.Vector3(
      Math.cos(fp.pitch) * Math.sin(fp.yaw),
      Math.sin(fp.pitch),
      Math.cos(fp.pitch) * Math.cos(fp.yaw)
    );
    camera.lookAt(fp.pos.clone().add(dir));
  }

  function flyTo(opts, dur) {
    const from = { pos: camera.position.clone(), look: currentLookTarget() };
    const to = { pos: opts.pos.clone(), look: opts.look.clone() };
    fly = { from, to, t: 0, dur: dur || 1.1 };
  }
  function currentLookTarget() {
    const d = new THREE.Vector3();
    camera.getWorldDirection(d);
    return camera.position.clone().add(d.multiplyScalar(state.mode === 'fp' ? 12 : 60));
  }

  function flyToBuilding(b, floor) {
    const bb = bbox(b.poly);
    const cx = toX((bb.x0 + bb.x1) / 2), cz = toZ((bb.y0 + bb.y1) / 2);
    const w = (bb.x1 - bb.x0) * S, d = (bb.y1 - bb.y0) * S;
    const dist = Math.max(w, d) * 2.0 + 34;
    state.mode = 'orbit';
    if (fly) fly = null;
    syncModeUI();
    orbit.target.set(cx, 5, cz);
    orbit.dist = dist;
    orbit.azim = Math.atan2(0.5, 0.95);   // 由東南側看向建物，畫面右側仍為北
    orbit.elev = 0.66;
    flyTo({ pos: orbitCameraPosition(), look: orbit.target.clone() }, 1.1);
    if (floor) selectFloor(b.id, floor);
  }

  /* =========================================================
     5. 世界建構
     ========================================================= */
  const world = new THREE.Group();
  scene.add(world);

  const buildingMeshes = {};   // id -> {group, floors:[mesh], roof, label, poly, bb}
  const roomGroups = {};       // id -> {floor: Group}
  const raycastTargets = [];
  const navBlocked = [];       // 像素座標的不可行走多邊形
  let groundMesh = null;

  function shapeFromPoly(poly) {
    const sh = new THREE.Shape();
    poly.forEach((p, i) => {
      const x = toX(p[0]), y = -toZ(p[1]);
      i === 0 ? sh.moveTo(x, y) : sh.lineTo(x, y);
    });
    sh.closePath();
    return sh;
  }

  /* --- 地面（平面圖貼圖） --- */
  function buildGround(texOrMat) {
    const w = IMG_W * S, h = IMG_H * S;
    const geo = new THREE.PlaneGeometry(w, h, 1, 1);
    let mat;
    if (texOrMat && texOrMat.isTexture) {
      mat = new THREE.MeshStandardMaterial({ map: texOrMat, roughness: 0.96, metalness: 0.0 });
    } else if (texOrMat && texOrMat.isMaterial) {
      mat = texOrMat;
    } else {
      mat = new THREE.MeshStandardMaterial({ color: 0xdfe7ee, roughness: 1 });
    }
    groundMesh = new THREE.Mesh(geo, mat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    groundMesh.name = 'ground';
    world.add(groundMesh);

    /* 地面外擴一圈（避免邊緣露白） */
    const ext = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 3, h * 3),
      new THREE.MeshStandardMaterial({ color: 0x6f8f5f, roughness: 1 })
    );
    ext.rotation.x = -Math.PI / 2;
    ext.position.y = -0.06;
    world.add(ext);

    /* 中庭鋪面（半透明浮起，便於辨識） */
    addGroundOverlay(GF.courtyard.poly, 0xe8e2d2, 0.35, 0.02);
    addGroundOverlay(GF.parking.poly, 0x555b63, 0.5, 0.015);

    buildTrack();
    buildWalkwayRoofs();
  }

  function addGroundOverlay(poly, color, opacity, y) {
    const sh = shapeFromPoly(poly);
    const geo = new THREE.ShapeGeometry(sh);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color, transparent: true, opacity, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2
    }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    world.add(mesh);
  }

  function buildTrack() {
    const t = GF.track;
    const outer = new THREE.Shape();
    roundedRect(outer, t.outer, 26);
    const hole = new THREE.Path();
    roundedRectPath(hole, t.inner, 20);
    outer.holes.push(hole);
    const geo = new THREE.ShapeGeometry(outer, 24);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xc1553f, roughness: 0.95 }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.03;
    mesh.receiveShadow = true;
    world.add(mesh);

    /* 中央草坪 */
    const inner = new THREE.Shape();
    roundedRect(inner, t.inner, 20);
    const g2 = new THREE.Mesh(new THREE.ShapeGeometry(inner, 24),
      new THREE.MeshStandardMaterial({ color: 0x74a35c, roughness: 1 }));
    g2.rotation.x = -Math.PI / 2;
    g2.position.y = 0.035;
    g2.receiveShadow = true;
    world.add(g2);
  }

  function roundedRect(shape, pts, r) {
    const bb = bbox(pts);
    const x0 = bb.x0, y0 = bb.y0, x1 = bb.x1, y1 = bb.y1;
    const rr = Math.min(r, (x1 - x0) / 3, (y1 - y0) / 3);
    const P = (px, py) => [toX(px), -toZ(py)];
    shape.moveTo(...P(x0 + rr, y0));
    shape.lineTo(...P(x1 - rr, y0));
    shape.quadraticCurveTo(...P(x1, y0), ...P(x1, y0 + rr));
    shape.lineTo(...P(x1, y1 - rr));
    shape.quadraticCurveTo(...P(x1, y1), ...P(x1 - rr, y1));
    shape.lineTo(...P(x0 + rr, y1));
    shape.quadraticCurveTo(...P(x0, y1), ...P(x0, y1 - rr));
    shape.lineTo(...P(x0, y0 + rr));
    shape.quadraticCurveTo(...P(x0, y0), ...P(x0 + rr, y0));
    shape.closePath();
  }
  function roundedRectPath(path, pts, r) { roundedRect(path, pts, r); }

  function buildWalkwayRoofs() {
    GF.walkways.forEach(w => {
      const bb = bbox(w.poly);
      const wM = (bb.x1 - bb.x0) * S, dM = (bb.y1 - bb.y0) * S;
      const geo = new THREE.BoxGeometry(wM, 0.35, dM);
      const mat = new THREE.MeshStandardMaterial({ color: 0xf2f5f8, roughness: 0.8 });
      const roof = new THREE.Mesh(geo, mat);
      roof.position.set(toX((bb.x0 + bb.x1) / 2), 3.4, toZ((bb.y0 + bb.y1) / 2));
      roof.castShadow = true; roof.receiveShadow = true;
      world.add(roof);
      /* 支柱 */
      const postMat = new THREE.MeshStandardMaterial({ color: 0xcfd6de, roughness: 0.7 });
      const corners = [[bb.x0, bb.y0], [bb.x1, bb.y0], [bb.x0, bb.y1], [bb.x1, bb.y1],
      [(bb.x0 + bb.x1) / 2, bb.y0], [(bb.x0 + bb.x1) / 2, bb.y1]];
      corners.forEach(c => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.4, 8), postMat);
        post.position.set(toX(c[0]), 1.7, toZ(c[1]));
        post.castShadow = true;
        world.add(post);
      });
    });
  }

  /* --- 建物 --- */
  function buildBuildings() {
    BUILDINGS.forEach(b => {
      const g = new THREE.Group();
      g.userData.buildingId = b.id;
      const sh = shapeFromPoly(b.poly);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: FH, bevelEnabled: false, curveSegments: 6 });
      geo.rotateX(-Math.PI / 2);          // 擠出方向 +Z → 世界 +Y（樓高）
      geo.computeVertexNormals();

      const bb = bbox(b.poly);
      const floors = [];
      const nFloors = b.floors;
      for (let f = 1; f <= nFloors; f++) {
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(FLOOR_COLORS[(f - 1) % FLOOR_COLORS.length]),
          roughness: 0.78, metalness: 0.02
        });
        const m = new THREE.Mesh(geo, mat);
        m.position.y = (f - 1) * FH;
        m.castShadow = true; m.receiveShadow = true;
        m.userData.buildingId = b.id;
        m.userData.floor = f;
        g.add(m);
        floors.push(m);
        raycastTargets.push(m);
        windowMats.push(mat);
        /* 樓層分隔線 */
        const bandGeo = new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: false, curveSegments: 6 });
        bandGeo.rotateX(-Math.PI / 2);
        const band = new THREE.Mesh(
          bandGeo,
          new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })
        );
        band.position.y = f * FH - 0.16;
        band.scale.set(1.006, 1, 1.006);
        band.userData.buildingId = b.id;
        band.userData.floor = f;
        g.add(band);
        floors.push(band);
        raycastTargets.push(band);
      }

      /* 屋頂 */
      const top = nFloors * FH;
      const roofGeo = new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: false, curveSegments: 6 });
      roofGeo.rotateX(-Math.PI / 2);
      const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: b.roof || b.color, roughness: 0.85 }));
      roof.position.y = top;
      roof.castShadow = true;
      roof.userData.buildingId = b.id;
      g.add(roof);
      raycastTargets.push(roof);

      /* 屋頂突出物（樓梯間 / 水塔） */
      const stairBb = stairWellPos(b);
      if (stairBb) {
        const sw = new THREE.Mesh(
          new THREE.BoxGeometry((stairBb[2] - stairBb[0]) * S, 2.4, (stairBb[3] - stairBb[1]) * S),
          new THREE.MeshStandardMaterial({ color: 0xdfe5ec, roughness: 0.8 })
        );
        sw.position.set(toX((stairBb[0] + stairBb[2]) / 2), top + 1.2, toZ((stairBb[1] + stairBb[3]) / 2));
        sw.castShadow = true;
        sw.userData.buildingId = b.id;
        g.add(sw);
        raycastTargets.push(sw);
      }

      world.add(g);
      buildingMeshes[b.id] = { group: g, floors, roof, b, bb, poly: b.poly };
      navBlocked.push(b.poly);
    });
  }

  function stairWellPos(b) {
    const bb = bbox(b.poly);
    const w = bb.x1 - bb.x0, h = bb.y1 - bb.y0;
    if (w < 24 || h < 16) return null;
    const sw = Math.min(34, w * 0.12), sh = Math.min(26, h * 0.4);
    return [bb.x0 + w * 0.42, bb.y0 + h * 0.28, bb.x0 + w * 0.42 + sw, bb.y0 + h * 0.28 + sh];
  }

  /* --- 樹木（依樹冠符號） --- */
  let treeGroup = null;
  function buildTrees() {
    treeGroup = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
    const leafMats = [0x3f7d3a, 0x4c8f43, 0x35703a, 0x56a04a].map(c =>
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, flatShading: true }));
    TREES.forEach((t, i) => {
      const scale = 0.85 + ((i * 37) % 45) / 100;   // 依樹冠大小產生變化
      const h = 4.2 * scale;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.26 * scale, h, 6), trunkMat);
      trunk.position.set(toX(t[0]), h / 2, toZ(t[1]));
      trunk.castShadow = true;
      treeGroup.add(trunk);
      const r = 2.5 * scale;
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leafMats[i % leafMats.length]);
      crown.position.set(toX(t[0]), h + r * 0.55, toZ(t[1]));
      crown.scale.y = 0.85;
      crown.rotation.y = i;
      crown.castShadow = true;
      treeGroup.add(crown);
      const crown2 = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.7, 1), leafMats[(i + 1) % leafMats.length]);
      crown2.position.set(toX(t[0]) + r * 0.45, h + r * 0.2, toZ(t[1]) - r * 0.35);
      crown2.castShadow = true;
      treeGroup.add(crown2);
    });
    world.add(treeGroup);
  }

  /* =========================================================
     6. 教室方塊（樓層切換時自動產生）
     ========================================================= */
  function roomsFor(bid, floor) {
    const d = (CLASS_DATA.data || []).find(x => x.building === bid && x.floor === floor);
    return d ? d.rooms.slice() : [];
  }
  function floorsOf(bid) {
    const set = {};
    (CLASS_DATA.data || []).forEach(x => { if (x.building === bid) set[x.floor] = true; });
    return Object.keys(set).map(Number).sort((a, b) => b - a);
  }
  function roomCount(bid) {
    return (CLASS_DATA.data || []).filter(x => x.building === bid)
      .reduce((s, x) => s + x.rooms.length, 0);
  }

  function layoutRooms(poly, n) {
    const bb = bbox(poly);
    const W = (bb.x1 - bb.x0) * S, D = (bb.y1 - bb.y0) * S;
    const horiz = W >= D;
    const L = horiz ? W : D, Dp = horiz ? D : W;
    let best = null;
    for (let rows = 1; rows <= 4; rows++) {
      const cols = Math.ceil(n / rows);
      const cw = L / cols, ch = Dp / rows;
      if (cw < 3.6 || ch < 3.6) continue;
      const score = Math.abs(cw - 10) + Math.abs(ch - 8.5) * 1.2;
      if (!best || score < best.score) best = { rows, cols, cw, ch, score };
    }
    if (!best) best = { rows: 1, cols: n, cw: L / n, ch: Dp };
    const cellLongM = L / best.cols, cellShortM = Dp / best.rows;
    const out = [];
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / best.cols), c = i % best.cols;
      let x, y, w, h;
      if (horiz) {
        w = cellLongM / S; h = cellShortM / S;
        x = bb.x0 + c * w; y = bb.y0 + r * h;
      } else {
        w = cellShortM / S; h = cellLongM / S;
        x = bb.x0 + r * w; y = bb.y0 + c * h;
      }
      out.push({ x: x + 0.6, y: y + 0.6, w: Math.max(1, w - 1.2), h: Math.max(1, h - 1.2) });
    }
    return out;
  }

  function ensureRoomGroup(bid, floor) {
    roomGroups[bid] = roomGroups[bid] || {};
    if (roomGroups[bid][floor]) return roomGroups[bid][floor];
    const b = BUILDINGS.find(x => x.id === bid);
    const rooms = roomsFor(bid, floor);
    const g = new THREE.Group();
    g.visible = false;
    const cells = layoutRooms(b.poly, rooms.length);
    const baseY = (floor - 1) * FH;
    const roomH = FH - 0.85;
    rooms.forEach((r, i) => {
      const c = cells[i]; if (!c) return;
      const kind = roomKind(r);
      const col = kind === 'lobby' ? '#dfe6ee'
        : kind === 'office' ? '#57a88a'
          : kind === 'special' ? '#8f7fd0' : '#f6c453';
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(c.w * S, roomH, c.h * S),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.75, transparent: true, opacity: 0.94 })
      );
      mesh.position.set(toX(c.x + c.w / 2), baseY + roomH / 2 + 0.1, toZ(c.y + c.h / 2));
      mesh.castShadow = true;
      mesh.userData.buildingId = bid;
      mesh.userData.roomIndex = i;
      mesh.userData.roomLabel = r;
      g.add(mesh);
      raycastTargets.push(mesh);
    });
    world.add(g);
    roomGroups[bid][floor] = g;
    return g;
  }

  function clearRoomGroups() {
    Object.keys(roomGroups).forEach(bid => {
      Object.keys(roomGroups[bid]).forEach(f => {
        const g = roomGroups[bid][f];
        g.children.forEach(m => {
          const i = raycastTargets.indexOf(m);
          if (i >= 0) raycastTargets.splice(i, 1);
          m.geometry.dispose(); m.material.dispose();
        });
        world.remove(g);
      });
      roomGroups[bid] = {};
    });
  }

  /* =========================================================
     7. 標籤系統（含自動避讓）
     ========================================================= */
  const labelItems = [];   // {node, anchor(), priority, show(), placed}
  const OFFSETS = [
    [0, 0], [0, -1], [0, 1], [-1, 0], [1, 0],
    [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1],
    [-2, 0], [2, 0], [0, -3], [0, 3]
  ];

  function addLabel(opts) {
    const node = document.createElement('div');
    node.className = 'slabel ' + (opts.cls || '');
    Object.assign(node.style, {
      position: 'absolute', transform: 'translate(-50%,-50%)',
      padding: '3px 9px', borderRadius: '999px', fontSize: opts.fs || '12.5px',
      fontWeight: '700', whiteSpace: 'nowrap', pointerEvents: 'none',
      background: opts.bg || 'rgba(255,255,255,.92)',
      color: opts.fg || '#16202c',
      border: '1px solid rgba(20,40,70,.18)',
      boxShadow: '0 2px 8px rgba(10,25,45,.22)',
      opacity: '0', transition: 'opacity .18s', lineHeight: '1.35'
    });
    if (opts.html) node.innerHTML = opts.html; else node.textContent = opts.text;
    labelLayer.appendChild(node);
    const item = {
      node, anchor: opts.anchor, priority: opts.priority || 0,
      show: opts.show || (() => true), minDist: opts.minDist || 0,
      placed: null, on: true
    };
    labelItems.push(item);
    return item;
  }

  function updateLabels() {
    const W = innerWidth, H = innerHeight;
    const placed = [];
    const vis = [];
    const v = new THREE.Vector3();
    for (const it of labelItems) {
      if (!it.on) { it.node.style.opacity = '0'; continue; }
      const a = it.anchor();
      if (!a) { it.node.style.opacity = '0'; continue; }
      v.copy(a).project(camera);
      if (v.z > 1 || v.z < -1) { it.node.style.opacity = '0'; continue; }
      const sx = (v.x * 0.5 + 0.5) * W, sy = (-v.y * 0.5 + 0.5) * H;
      const dist = camera.position.distanceTo(a);
      if (it.minDist && dist > it.minDist) { it.node.style.opacity = '0'; continue; }
      if (!it.show()) { it.node.style.opacity = '0'; continue; }
      vis.push({ it, sx, sy, dist });
    }
    vis.sort((p, q) => (q.it.priority - p.it.priority) || (p.dist - q.dist));
    for (const v2 of vis) {
      const it = v2.it;
      const w = it.node.offsetWidth, h = it.node.offsetHeight;
      let ok = false, bx = v2.sx, by = v2.sy;
      for (const o of OFFSETS) {
        const x = v2.sx + o[0] * (w * 0.55 + 6) + (o[0] === 0 ? 0 : 0);
        const y = v2.sy + o[1] * (h * 0.75 + 7);
        const r = { x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 };
        if (r.x0 < 4 || r.y0 < 62 || r.x1 > W - 4 || r.y1 > H - 8) continue;
        let hit = false;
        for (const p of placed) {
          if (r.x0 < p.x1 && r.x1 > p.x0 && r.y0 < p.y1 && r.y1 > p.y0) { hit = true; break; }
        }
        if (!hit) { ok = true; bx = x; by = y; placed.push(r); break; }
      }
      if (ok) {
        it.node.style.left = bx + 'px';
        it.node.style.top = by + 'px';
        it.node.style.opacity = '1';
      } else {
        it.node.style.opacity = '0';
      }
    }
  }

  function buildBuildingLabels() {
    BUILDINGS.forEach(b => {
      const bb = bbox(b.poly);
      const h = (b.tall || b.floors * FH);
      addLabel({
        text: b.name,
        cls: 'blabel',
        priority: 100 - polyArea(b.poly) / 1000,
        anchor: () => new THREE.Vector3(toX((bb.x0 + bb.x1) / 2), h + 5.5, toZ(bb.y1)),
        show: () => state.selectedFloor === null || state.selectedBuilding !== b.id
      });
      addLabel({
        text: b.floors + 'F · ' + roomCount(b.id) + '室',
        cls: 'bsub',
        fs: '10.5px', fg: '#3c4b5c', bg: 'rgba(255,255,255,.82)',
        priority: 40,
        anchor: () => new THREE.Vector3(toX((bb.x0 + bb.x1) / 2), h + 2.4, toZ(bb.y1)),
        show: () => state.selectedFloor === null || state.selectedBuilding !== b.id
      });
    });
    /* 地表特徵標籤 */
    [['中庭', GF.courtyard.poly, 0], ['停車場', GF.parking.poly, 0], ['操場', GF.track.outer, 0]].forEach(([n, p, pr]) => {
      const bb = bbox(p);
      addLabel({
        text: n, fs: '11.5px', fg: '#42505f', priority: 25,
        anchor: () => new THREE.Vector3(toX((bb.x0 + bb.x1) / 2), 2.2, toZ((bb.y0 + bb.y1) / 2)),
        show: () => true, minDist: 340
      });
    });
  }

  const roomLabelItems = [];
  function refreshRoomLabels() {
    roomLabelItems.forEach(it => {
      it.on = false;
      const i = labelItems.indexOf(it);
      if (i >= 0) labelItems.splice(i, 1);
      if (it.node.parentNode) it.node.parentNode.removeChild(it.node);
    });
    roomLabelItems.length = 0;
    const bid = state.selectedBuilding, fl = state.selectedFloor;
    if (!bid || !fl) return;
    const g = ensureRoomGroup(bid, fl);
    g.children.forEach(m => {
      const item = addLabel({
        text: m.userData.roomLabel, fs: '10.5px', priority: 70,
        fg: '#22303f', bg: 'rgba(255,255,255,.95)',
        anchor: () => {
          const p = new THREE.Vector3();
          m.getWorldPosition(p);
          p.y += 1.7;
          return p;
        },
        show: () => state.selectedBuilding === bid && state.selectedFloor === fl,
        minDist: 420
      });
      roomLabelItems.push(item);
    });
  }

  /* =========================================================
     8. 步行路網 + A*
     ========================================================= */
  let nav = null;
  function buildNav() {
    const cellM = NET.cell, cellPx = cellM / S;
    const B = GF.bounds;
    const cols = Math.floor((B.x1 - B.x0) / cellPx);
    const rows = Math.floor((B.y1 - B.y0) / cellPx);
    /* 收集所有阻擋多邊形的邊 */
    const edges = [];
    const polys = navBlocked.concat((NET.blocked || []).map(x => x.poly));
    polys.forEach(poly => {
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
        edges.push([poly[j][0], poly[j][1], poly[i][0], poly[i][1]]);
    });
    const walk = new Uint8Array(cols * rows);
    const margin = 1.2 / S;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = B.x0 + (c + 0.5) * cellPx;
        const py = B.y0 + (r + 0.5) * cellPx;
        let ok = true;
        for (const e of edges) {
          if (distToSeg(px, py, e[0], e[1], e[2], e[3]) < margin) { ok = false; break; }
        }
        if (ok) for (const p of polys) { if (pip(px, py, p)) { ok = false; break; } }
        walk[r * cols + c] = ok ? 1 : 0;
      }
    }
    nav = { cols, rows, cellPx, cellM, x0: B.x0, y0: B.y0, walk };
  }
  function distToSeg(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
    t = clamp(t, 0, 1);
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }
  function navIdx(c, r) { return r * nav.cols + c; }
  function navCellOf(px, py) {
    const c = Math.floor((px - nav.x0) / nav.cellPx);
    const r = Math.floor((py - nav.y0) / nav.cellPx);
    if (c < 0 || r < 0 || c >= nav.cols || r >= nav.rows) return null;
    return { c, r };
  }
  function nearestWalkable(c, r) {
    if (nav.walk[navIdx(c, r)]) return { c, r };
    for (let rad = 1; rad < 24; rad++) {
      for (let dr = -rad; dr <= rad; dr++) {
        for (let dc = -rad; dc <= rad; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
          const cc = c + dc, rr = r + dr;
          if (cc < 0 || rr < 0 || cc >= nav.cols || rr >= nav.rows) continue;
          if (nav.walk[navIdx(cc, rr)]) return { c: cc, r: rr };
        }
      }
    }
    return null;
  }

  class MinHeap {
    constructor() { this.a = []; }
    get size() { return this.a.length; }
    push(n, f) {
      const a = this.a; a.push({ n, f });
      let i = a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (a[p].f <= a[i].f) break;
        [a[p], a[i]] = [a[i], a[p]]; i = p;
      }
    }
    pop() {
      const a = this.a, top = a[0], last = a.pop();
      if (a.length) {
        a[0] = last;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1, r = l + 1;
          let s = i;
          if (l < a.length && a[l].f < a[s].f) s = l;
          if (r < a.length && a[r].f < a[s].f) s = r;
          if (s === i) break;
          [a[s], a[i]] = [a[i], a[s]]; i = s;
        }
      }
      return top.n;
    }
  }

  function findPath(px0, py0, px1, py1) {
    if (!nav) return null;
    const s = navCellOf(px0, py0), g = navCellOf(px1, py1);
    if (!s || !g) return null;
    const ss = nearestWalkable(s.c, s.r);
    const gg = nearestWalkable(g.c, g.r);
    if (!ss || !gg) return null;
    const start = navIdx(ss.c, ss.r), goal = navIdx(gg.c, gg.r);
    if (start === goal) return [{ px: px1, py: py1 }];
    const N = nav.cols * nav.rows;
    const gScore = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const h = (i) => {
      const c = i % nav.cols, r = (i / nav.cols) | 0;
      const dc = Math.abs(c - gg.c), dr = Math.abs(r - gg.r);
      return nav.cellM * (dc + dr + (Math.SQRT2 - 2) * Math.min(dc, dr));
    };
    gScore[start] = 0;
    const open = new MinHeap();
    open.push(start, h(start));
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    let found = false, guard = 0;
    while (open.size && guard++ < 400000) {
      const cur = open.pop();
      if (cur === goal) { found = true; break; }
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cc = cur % nav.cols, cr = (cur / nav.cols) | 0;
      for (const d of DIRS) {
        const nc = cc + d[0], nr = cr + d[1];
        if (nc < 0 || nr < 0 || nc >= nav.cols || nr >= nav.rows) continue;
        const ni = navIdx(nc, nr);
        if (!nav.walk[ni] || closed[ni]) continue;
        if (d[0] && d[1]) {
          if (!nav.walk[navIdx(cc + d[0], cr)] || !nav.walk[navIdx(cc, cr + d[1])]) continue;
        }
        const step = (d[0] && d[1]) ? nav.cellM * Math.SQRT2 : nav.cellM;
        const ng = gScore[cur] + step;
        if (ng < gScore[ni]) {
          gScore[ni] = ng; came[ni] = cur;
          open.push(ni, ng + h(ni));
        }
      }
    }
    if (!found) return null;
    const cells = [];
    let c = goal;
    while (c !== -1) { cells.push(c); if (c === start) break; c = came[c]; }
    cells.reverse();
    const pts = cells.map(i => ({
      px: nav.x0 + ((i % nav.cols) + 0.5) * nav.cellPx,
      py: nav.y0 + (((i / nav.cols) | 0) + 0.5) * nav.cellPx
    }));
    pts[0] = { px: px0, py: py0 };
    pts.push({ px: px1, py: py1 });
    return simplify(pts);
  }

  function simplify(pts) {
    if (pts.length < 3) return pts;
    const out = [pts[0]];
    let prevDir = null;
    for (let i = 1; i < pts.length; i++) {
      const d = { x: pts[i].px - pts[i - 1].px, y: pts[i].py - pts[i - 1].py };
      const len = Math.hypot(d.x, d.y);
      if (!len) continue;
      const dir = { x: d.x / len, y: d.y / len };
      if (prevDir && (Math.abs(dir.x - prevDir.x) > 0.02 || Math.abs(dir.y - prevDir.y) > 0.02)) {
        out.push(pts[i - 1]);
      }
      prevDir = dir;
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  /* ---- 路線指示 ---- */
  function routeInfo(pts) {
    const steps = [];
    let dist = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const dx = toX(b.px) - toX(a.px), dz = toZ(b.py) - toZ(a.py);
      const d = Math.hypot(dx, dz);
      dist += d;
      if (i < pts.length - 2) {
        const c = pts[i + 2];
        const dx2 = toX(c.px) - toX(b.px), dz2 = toZ(c.py) - toZ(b.py);
        const d2 = Math.hypot(dx2, dz2);
        if (d2 < 0.01) continue;
        const a1 = Math.atan2(dz, dx), a2 = Math.atan2(dz2, dx2);
        let delta = deg(a2 - a1);
        while (delta > 180) delta -= 360;
        while (delta < -180) delta += 360;
        if (Math.abs(delta) > 32) {
          const dirWord = cardinal(a2);
          steps.push({
            at: dist, turn: delta > 0 ? '右轉' : '左轉',
            text: (delta > 0 ? '右轉' : '左轉') + '往' + dirWord,
            kind: 'turn'
          });
        } else {
          steps.push({ at: dist, text: '沿' + cardinal(a2) + '直行', kind: 'go' });
        }
      }
    }
    steps.push({ at: dist, text: '抵達目的地', kind: 'end' });
    return { dist, time: dist / M.walkSpeed, steps };
  }
  function cardinal(angle) {
    let d = deg(angle);
    while (d < 0) d += 360;
    while (d >= 360) d -= 360;
    const names = ['北', '北北東', '東北', '東東北', '東', '東南東', '東南', '南南東',
      '南', '南南西', '西南', '西西南', '西', '西西北', '西北', '北北西'];
    return names[Math.round(d / 22.5) % 16];
  }

  /* ---- 路線視覺 ---- */
  let routeLine = null, turnMarks = [];
  function showRoute(pts, info) {
    clearRoute();
    const v = pts.map(p => new THREE.Vector3(toX(p.px), 0.16, toZ(p.py)));
    const geo = new THREE.BufferGeometry().setFromPoints(v);
    routeLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x1f6feb, linewidth: 3 }));
    world.add(routeLine);
    /* 底部寬帶，讓路線在鳥瞰下看得清楚 */
    const band = [];
    for (let i = 0; i < v.length - 1; i++) {
      const a = v[i], b = v[i + 1];
      const d = new THREE.Vector3().subVectors(b, a);
      const len = d.length(); if (!len) continue;
      d.normalize();
      const n = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(0.7);
      const q = new THREE.Mesh(
        new THREE.PlaneGeometry(len, 1.4),
        new THREE.MeshBasicMaterial({ color: 0x2f7ff0, transparent: true, opacity: 0.75, depthWrite: false })
      );
      q.rotation.x = -Math.PI / 2;
      q.rotation.z = -Math.atan2(d.z, d.x);
      q.position.copy(a).add(b).multiplyScalar(0.5);
      q.position.y = 0.14;
      world.add(q);
      band.push(q);
    }
    routeLine.userData.band = band;
    info.steps.filter(s => s.kind === 'turn').forEach(s => {
      const i = pts.findIndex((p, k) => {
        let acc = 0;
        for (let j = 0; j < k; j++) acc += Math.hypot(toX(pts[j + 1].px) - toX(pts[j].px), toZ(pts[j + 1].py) - toZ(pts[j].py));
        return acc >= s.at - 0.01;
      });
      if (i <= 0) return;
      const p = pts[i];
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.8, 2.4, 10),
        new THREE.MeshBasicMaterial({ color: s.turn === '右轉' ? 0xffb020 : 0x2f9e6e })
      );
      cone.position.set(toX(p.px), 1.2, toZ(p.py));
      world.add(cone);
      turnMarks.push(cone);
    });
  }
  function clearRoute() {
    if (routeLine) {
      (routeLine.userData.band || []).forEach(q => { world.remove(q); q.geometry.dispose(); q.material.dispose(); });
      world.remove(routeLine);
      routeLine.geometry.dispose(); routeLine.material.dispose();
      routeLine = null;
    }
    turnMarks.forEach(m => { world.remove(m); m.geometry.dispose(); m.material.dispose(); });
    turnMarks = [];
  }

  function setRoute(pts) {
    if (!pts || pts.length < 2) { state.route = null; clearRoute(); updateWalkBar(); return; }
    const info = routeInfo(pts);
    state.route = { pts, info };
    showRoute(pts, info);
    updateWalkBar();
  }

  /* =========================================================
     9. 互動
     ========================================================= */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let drag = null, downAt = null, moved = 0;
  const touches = new Map();
  let pinchBase = 0;

  function pick(clientX, clientY) {
    ndc.x = (clientX / innerWidth) * 2 - 1;
    ndc.y = -(clientY / innerHeight) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(raycastTargets, false);
    return hits.length ? hits[0] : null;
  }
  function groundPoint(clientX, clientY) {
    ndc.x = (clientX / innerWidth) * 2 - 1;
    ndc.y = -(clientY / innerHeight) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const p = new THREE.Vector3();
    return ray.ray.intersectPlane(plane, p) ? p : null;
  }

  function onPointerDown(e) {
    if (e.target !== renderer.domElement) return;
    downAt = { x: e.clientX, y: e.clientY, btn: e.button, t: Date.now() };
    moved = 0;
    drag = { x: e.clientX, y: e.clientY, btn: e.button };
    renderer.domElement.setPointerCapture && renderer.domElement.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (!drag) return;
    if (touches.size > 1) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    if (state.mode === 'fp') {
      fp.yaw -= dx * 0.0035;
      fp.pitch = clamp(fp.pitch - dy * 0.0032, -0.9, 0.75);
      stopAutoWalk();
    } else {
      if (drag.btn === 2 || e.shiftKey || drag.btn === 1) {
        const right = new THREE.Vector3().subVectors(camera.position, orbit.target).cross(new THREE.Vector3(0, 1, 0)).normalize();
        const fwd = new THREE.Vector3(-Math.sin(orbit.azim), 0, -Math.cos(orbit.azim));
        const k = orbit.dist * 0.0016;
        orbit.target.addScaledVector(right, dx * k).addScaledVector(fwd, dy * k);
        orbit.target.x = clamp(orbit.target.x, -140, 140);
        orbit.target.z = clamp(orbit.target.z, -170, 170);
      } else {
        orbit.azim -= dx * 0.005;
        orbit.elev = clamp(orbit.elev + dy * 0.004, 0.12, 1.45);
      }
      fly = null;
    }
  }
  function onPointerUp(e) {
    if (!drag) { return; }
    const wasClick = moved < 6 && downAt && downAt.btn === 0;
    drag = null;
    if (!wasClick) return;
    handleClick(e.clientX, e.clientY);
  }
  function handleClick(cx, cy) {
    const hit = pick(cx, cy);
    if (hit && hit.object.userData.buildingId) {
      const bid = hit.object.userData.buildingId;
      if (hit.object.userData.roomLabel) {
        selectBuilding(bid, true);
        toast(hit.object.userData.roomLabel + '（' + buildingName(bid) + '）');
        return;
      }
      selectBuilding(bid, state.mode !== 'fp');
      return;
    }
    if (state.mode === 'fp') {
      const p = groundPoint(cx, cy);
      if (p) {
        const from = { px: toPx(fp.pos.x), py: toPy(fp.pos.z) };
        const pts = findPath(from.px, from.py, toPx(p.x), toPy(p.z));
        if (pts) { setRoute(pts); startAutoWalk(); }
        else toast('此處無法到達');
      }
      return;
    }
    if (state.selectedBuilding) { state.selectedBuilding = null; state.selectedFloor = null; syncDetail(); refreshRoomLabels(); applyFloorView(); }
  }

  function onWheel(e) {
    if (state.mode !== 'orbit') return;
    orbit.dist = clamp(orbit.dist * Math.exp(e.deltaY * 0.0011), 22, 720);
    fly = null;
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('wheel', onWheel, { passive: true });
  renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

  /* 觸控：雙指縮放 */
  renderer.domElement.addEventListener('pointerdown', e => {
    touches.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
  });
  renderer.domElement.addEventListener('pointermove', e => {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    if (touches.size === 2 && state.mode === 'orbit') {
      const v = Array.from(touches.values());
      const d = Math.hypot(v[0].clientX - v[1].clientX, v[0].clientY - v[1].clientY);
      if (pinchBase > 0 && d > 0) {
        orbit.dist = clamp(orbit.dist * (pinchBase / d), 22, 720);
        fly = null;
      }
      pinchBase = d;
    }
  });
  const dropTouch = e => { touches.delete(e.pointerId); if (touches.size < 2) pinchBase = 0; };
  renderer.domElement.addEventListener('pointerup', dropTouch);
  renderer.domElement.addEventListener('pointercancel', dropTouch);

  /* =========================================================
     10. 建物選擇 / 樓層切換
     ========================================================= */
  function buildingName(id) { const b = BUILDINGS.find(x => x.id === id); return b ? b.name : id; }

  function selectBuilding(id, flyCam) {
    const b = BUILDINGS.find(x => x.id === id);
    if (!b) return;
    state.selectedBuilding = id;
    if (state.selectedFloor !== null && !floorsOf(id).includes(state.selectedFloor)) state.selectedFloor = null;
    syncDetail();
    syncNavList();
    applyFloorView();
    if (flyCam) flyToBuilding(b, null);
    el.detail.classList.add('on');
    if (state.mobile) { el.leftNav.classList.remove('on'); }
  }

  function selectFloor(bid, floor) {
    state.selectedBuilding = bid;
    state.selectedFloor = floor;
    applyFloorView();
    syncDetail();
    syncFloorList();
  }

  function applyFloorView() {
    const bid = state.selectedBuilding, fl = state.selectedFloor;
    clearRoomGroups();
    BUILDINGS.forEach(b => {
      const rec = buildingMeshes[b.id];
      const showAll = !(bid === b.id && fl !== null);
      rec.floors.forEach((m, i) => {
        const f = m.userData.floor;
        if (showAll) { m.visible = true; if (m.material.transparent) { m.material.transparent = false; m.material.opacity = 1; } }
        else if (f <= fl) { m.visible = true; if (m.material.transparent) { m.material.transparent = false; m.material.opacity = 1; } }
        else {
          m.visible = true;
          m.material.transparent = true;
          m.material.opacity = 0.14;
          m.material.depthWrite = false;
        }
      });
      rec.roof.visible = showAll || fl >= b.floors;
      if (!showAll && fl < b.floors) rec.roof.visible = false;
    });
    if (bid && fl) {
      const g = ensureRoomGroup(bid, fl);
      g.visible = true;
      const b = BUILDINGS.find(x => x.id === bid);
      const bb = bbox(b.poly);
      const dist = Math.max((bb.x1 - bb.x0) * S, (bb.y1 - bb.y0) * S) * 1.7 + 26;
      if (state.mode === 'orbit') {
        orbit.target.set(toX((bb.x0 + bb.x1) / 2), (fl - 0.4) * FH, toZ((bb.y0 + bb.y1) / 2));
        orbit.dist = Math.max(orbit.dist, dist);
        orbit.elev = Math.max(orbit.elev, 0.72);
        flyTo({ pos: orbitCameraPosition(), look: orbit.target.clone() }, 0.85);
      }
    }
    refreshRoomLabels();
    updateLabels();
  }

  /* =========================================================
     11. 搜尋
     ========================================================= */
  const searchIndex = [];
  function buildSearchIndex() {
    BUILDINGS.forEach(b => {
      searchIndex.push({ kind: '建物', label: b.name, sub: b.nameEn + ' · ' + b.floors + '樓', bid: b.id, floor: null, key: b.name + b.nameEn + b.id });
    });
    (CLASS_DATA.data || []).forEach(d => {
      d.rooms.forEach(r => {
        const p = parseRoom(r);
        searchIndex.push({
          kind: p.no ? '班級' : '空間', label: r,
          sub: buildingName(d.building) + ' ' + d.floor + 'F' + (p.no ? ' · 房號 ' + p.no : ''),
          bid: d.building, floor: d.floor, key: r + p.name + p.no
        });
      });
    });
    (CLASS_DATA.offices || []).forEach(o => {
      searchIndex.push({
        kind: '處室', label: o.name + (o.no ? ' ' + o.no : ''),
        sub: buildingName(o.building) + ' ' + o.floor + 'F',
        bid: o.building, floor: o.floor, key: o.name + o.no
      });
    });
    TOURS.forEach(t => searchIndex.push({ kind: '導覽', label: t.name, sub: t.desc, tour: t.id, key: t.name + t.desc }));
  }

  let searchTimer = null;
  function runSearch(q) {
    q = (q || '').trim();
    if (!q) { el.searchResults.classList.remove('on'); el.searchResults.innerHTML = ''; return; }
    const ql = q.toLowerCase();
    const hits = searchIndex
      .map(it => {
        const k = it.key.toLowerCase();
        let sc = -1;
        if (k === ql) sc = 100;
        else if (it.label.toLowerCase().startsWith(ql)) sc = 80;
        else if (k.indexOf(ql) >= 0) sc = 60;
        else if (it.sub.toLowerCase().indexOf(ql) >= 0) sc = 30;
        return { it, sc };
      })
      .filter(x => x.sc > 0)
      .sort((a, b) => b.sc - a.sc)
      .slice(0, 24);

    el.searchResults.innerHTML = '';
    if (!hits.length) {
      el.searchResults.innerHTML = '<div class="sr-empty">找不到符合「' + escapeHtml(q) + '」的結果</div>';
    } else {
      hits.forEach((h, i) => {
        const d = document.createElement('div');
        d.className = 'sr-item' + (i === 0 ? ' act' : '');
        d.innerHTML = '<b>' + escapeHtml(h.it.label) + '</b><span>' + escapeHtml(h.it.kind + ' · ' + h.it.sub) + '</span>';
        d.onclick = () => chooseSearch(h.it);
        el.searchResults.appendChild(d);
      });
    }
    el.searchResults.classList.add('on');
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  function chooseSearch(it) {
    el.searchResults.classList.remove('on');
    el.searchInput.value = it.label;
    if (it.tour) { startTour(it.tour); return; }
    selectBuilding(it.bid, true);
    if (it.floor) selectFloor(it.bid, it.floor);
    setMarker(it.bid, it.floor);
    toast('已前往 ' + it.label);
  }

  let markerGroup = null;
  function setMarker(bid, floor) {
    clearMarker();
    const b = BUILDINGS.find(x => x.id === bid); if (!b) return;
    const bb = bbox(b.poly);
    const cx = toX((bb.x0 + bb.x1) / 2), cz = toZ((bb.y0 + bb.y1) / 2);
    const y = floor ? (floor - 0.5) * FH : 0.2;
    markerGroup = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(6.5, 8.2, 48),
      new THREE.MeshBasicMaterial({ color: 0xff3b5c, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(cx, y + 0.4, cz);
    markerGroup.add(ring);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 26, 8),
      new THREE.MeshBasicMaterial({ color: 0xff3b5c, transparent: true, opacity: 0.45, depthWrite: false })
    );
    beam.position.set(cx, y + 13, cz);
    markerGroup.add(beam);
    markerGroup.userData.ring = ring;
    world.add(markerGroup);
  }
  function clearMarker() {
    if (markerGroup) {
      markerGroup.children.forEach(m => { m.geometry.dispose(); m.material.dispose(); });
      world.remove(markerGroup); markerGroup = null;
    }
  }

  /* =========================================================
     12. 使用者介面
     ========================================================= */
  const navTabs = { bld: '建物', flr: '樓層', tour: '導覽' };
  let navTab = 'bld';

  function buildChrome() {
    /* --- 左側面板 --- */
    el.leftNav.innerHTML =
      '<div class="nav-tabs">' +
      '<button data-tab="bld">建物</button>' +
      '<button data-tab="flr">樓層</button>' +
      '<button data-tab="tour">導覽</button>' +
      '</div><div class="nav-body scroll" id="navBody"></div>';
    el.leftNav.querySelectorAll('.nav-tabs button').forEach(btn => {
      btn.onclick = () => { navTab = btn.dataset.tab; syncNav(); };
    });

    /* --- 右側資訊抽屜 --- */
    el.detail.innerHTML =
      '<h3>建物資訊 <span class="sub" id="detailKind"></span>' +
      '<button id="detailClose" title="關閉">✕</button></h3>' +
      '<div id="detailBody" class="scroll"></div>';
    $('detailClose').onclick = () => {
      el.detail.classList.remove('on');
      state.selectedBuilding = null; state.selectedFloor = null;
      applyFloorView(); refreshRoomLabels(); syncNavList();
    };

    /* --- 頂部按鈕 --- */
    el.hdrBtns.innerHTML =
      '<button class="tbtn" id="btnMode" title="切換鳥瞰 / 第一人稱"><span class="ic">🧭</span><span class="lbl">鳥瞰</span></button>' +
      '<button class="tbtn" id="btnNight" title="白天 / 夜晚"><span class="ic">🌙</span><span class="lbl">夜晚</span></button>' +
      '<button class="tbtn" id="btnPower" title="省電模式"><span class="ic">🍃</span><span class="lbl">省電</span></button>' +
      '<button class="tbtn icon" id="btnMini" title="小地圖放大">🗺</button>' +
      '<button class="tbtn icon" id="btnHelp" title="操作說明">？</button>';
    $('btnMode').onclick = () => setMode(state.mode === 'orbit' ? 'fp' : 'orbit');
    $('btnNight').onclick = () => setNight(!state.night);
    $('btnPower').onclick = () => setPowerSave(!state.powerSave);
    $('btnMini').onclick = () => {
      el.minimapWrap.classList.toggle('big');
      $('btnMini').classList.toggle('on', el.minimapWrap.classList.contains('big'));
      resize();
    };
    $('btnHelp').onclick = showHelp;

    /* --- 搜尋 --- */
    el.searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => runSearch(el.searchInput.value), 120);
    });
    el.searchInput.addEventListener('focus', () => { if (el.searchInput.value) runSearch(el.searchInput.value); });
    el.searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const first = el.searchResults.querySelector('.sr-item');
        if (first) first.click();
      } else if (e.key === 'Escape') { el.searchResults.classList.remove('on'); el.searchInput.blur(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); const a = el.searchResults.querySelectorAll('.sr-item'); if (a.length) a[0].focus(); }
    });
    el.searchClear.onclick = () => { el.searchInput.value = ''; el.searchResults.classList.remove('on'); el.searchInput.focus(); };
    document.addEventListener('click', e => {
      if (!el.searchWrap.contains(e.target)) el.searchResults.classList.remove('on');
    });

    /* --- 指北針 --- */
    el.compass.innerHTML =
      '<svg viewBox="0 0 68 68">' +
      '<circle cx="34" cy="34" r="30" fill="rgba(255,255,255,.7)" stroke="rgba(20,40,70,.25)"/>' +
      '<g class="needle">' +
      '<polygon points="34,14 39,34 34,30 29,34" fill="#e5484d"/>' +
      '<polygon points="34,54 39,34 34,38 29,34" fill="#7c8896"/>' +
      '<text x="34" y="10.5" text-anchor="middle" font-size="7.5" font-weight="700" fill="#c62828">N</text>' +
      '</g>' +
      '<circle cx="34" cy="34" r="2.4" fill="#1b2430"/>' +
      '</svg>';
    el.compass.onclick = () => {
      if (state.mode === 'fp') setMode('orbit');
      fly = null;
      orbit.azim = 0; orbit.elev = 0.95; orbit.dist = 250;
      orbit.target.set(0, 0, -6);
      applyOrbitCamera();
      toast('已校正方位：右側為北');
    };

    /* --- 導覽列 / 步行列 --- */
    el.tourBar.innerHTML =
      '<span id="tourName"></span><span id="tourStep"></span><span id="tourText"></span>' +
      '<button class="btn ghost" id="tourPrev">上一站</button>' +
      '<button class="btn" id="tourNext">下一站</button>' +
      '<button class="btn ghost" id="tourEnd">結束</button>';
    $('tourPrev').onclick = () => tourMove(-1);
    $('tourNext').onclick = () => tourMove(1);
    $('tourEnd').onclick = endTour;

    el.walkBar.innerHTML =
      '<div id="walkInfo">' +
      '<div><span class="k">路線長度</span><b id="wDist">–</b></div>' +
      '<div><span class="k">步行時間</span><b id="wTime">–</b></div>' +
      '</div><div id="routeSteps"></div>' +
      '<button class="btn" id="wWalk">開始步行</button>' +
      '<button class="btn ghost" id="wClear">清除</button>';
    $('wWalk').onclick = () => { if (state.route) { setMode('fp'); startAutoWalk(); } };
    $('wClear').onclick = () => { setRoute(null); stopAutoWalk(); };

    /* --- 手機 dock --- */
    el.dock.innerHTML =
      '<button class="d" data-a="nav"><i>📋</i>導覽</button>' +
      '<button class="d" data-a="search"><i>🔍</i>搜尋</button>' +
      '<button class="d" data-a="floor"><i>🏢</i>樓層</button>' +
      '<button class="d" data-a="mode"><i>🧭</i>視角</button>' +
      '<button class="d" data-a="night"><i>🌙</i>晝夜</button>';
    el.dock.querySelectorAll('.d').forEach(b => {
      b.onclick = () => {
        const a = b.dataset.a;
        if (a === 'nav') { navTab = 'bld'; el.leftNav.classList.toggle('on'); el.detail.classList.remove('on'); syncNav(); }
        else if (a === 'search') { el.searchInput.focus(); el.searchInput.select(); }
        else if (a === 'floor') { navTab = 'flr'; el.leftNav.classList.add('on'); el.detail.classList.remove('on'); syncNav(); }
        else if (a === 'mode') setMode(state.mode === 'orbit' ? 'fp' : 'orbit');
        else if (a === 'night') setNight(!state.night);
      };
    });

    /* --- 說明 --- */
    el.fpHud.innerHTML = '<div id="fpCross"></div><div id="fpHint">WASD / 方向鍵移動 · 拖曳滑鼠轉頭 · 點地面自動走過去</div>';

    /* 動態產生的元素重新取得參考 */
    ['detailBody', 'tourName', 'tourStep', 'tourText', 'routeSteps',
      'walkInfo', 'wDist', 'wTime', 'wWalk', 'wClear', 'navBody', 'detailKind']
      .forEach(id => { el[id] = $(id); });

    syncNav();
  }

  function showHelp() {
    toast('鳥瞰：拖曳旋轉、滾輪縮放、右鍵平移。第一人稱：WASD/方向鍵移動、拖曳轉頭、點地面走過去。手機：虛擬搖桿移動、拖曳轉頭。', 6000);
  }

  /* ---- 左側面板內容 ---- */
  function syncNav() {
    el.leftNav.querySelectorAll('.nav-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === navTab));
    const body = $('navBody');
    if (navTab === 'bld') {
      body.innerHTML = '<div class="nav-hint">點選建物可查看介紹與教室配置；或直接搜尋班級號碼。</div>' +
        BUILDINGS.map(b =>
          '<div class="bld-item" data-id="' + b.id + '">' +
          '<span class="bld-dot" style="background:' + b.color + '"></span>' +
          '<span>' + b.name + '</span>' +
          '<span class="bld-meta">' + b.floors + 'F · ' + roomCount(b.id) + '</span>' +
          '</div>').join('');
      body.querySelectorAll('.bld-item').forEach(it => it.onclick = () => { navTab = 'flr'; selectBuilding(it.dataset.id, true); syncNav(); });
      syncNavList();
    } else if (navTab === 'flr') {
      syncFloorList();
    } else {
      body.innerHTML = '<div class="nav-hint">精選導覽路線，依序帶您認識校園。</div>' +
        TOURS.map(t =>
          '<div class="bld-item" data-id="' + t.id + '">' +
          '<span class="bld-dot" style="background:' + t.color + '"></span>' +
          '<span>' + t.name + '</span>' +
          '<span class="bld-meta">' + t.stops.length + ' 站</span>' +
          '</div>').join('');
      body.querySelectorAll('.bld-item').forEach(it => it.onclick = () => startTour(it.dataset.id));
    }
  }
  function syncNavList() {
    const body = $('navBody'); if (!body || navTab !== 'bld') return;
    body.querySelectorAll('.bld-item').forEach(it => it.classList.toggle('on', it.dataset.id === state.selectedBuilding));
  }
  function syncFloorList() {
    const body = $('navBody'); if (!body) return;
    const bid = state.selectedBuilding;
    if (!bid) {
      body.innerHTML = '<div class="nav-hint">請先於「建物」分頁選擇一棟建築物，再切換樓層。</div>';
      return;
    }
    const b = BUILDINGS.find(x => x.id === bid);
    const fl = floorsOf(bid);
    const rows = [];
    rows.push('<button class="floor-btn' + (state.selectedFloor === null ? ' on' : '') + '" data-f="all">🏬 全棟外觀<span class="cnt">' + roomCount(bid) + ' 室</span></button>');
    for (let f = b.floors; f >= 1; f--) {
      const n = roomsFor(bid, f).length;
      const has = fl.includes(f);
      rows.push('<button class="floor-btn' + (state.selectedFloor === f ? ' on' : '') + (has ? '' : ' disabled') + '" data-f="' + f + '">' +
        '<span class="swatch" style="background:' + FLOOR_COLORS[(f - 1) % FLOOR_COLORS.length] + ';width:11px;height:11px;border-radius:3px;display:inline-block"></span>' +
        f + 'F<span class="cnt">' + (has ? n + ' 室' : '無資料') + '</span></button>');
    }
    rows.push('<button class="floor-btn disabled" data-f="b1">地下一樓<span class="cnt">本校無地下層</span></button>');
    body.innerHTML = '<div class="nav-hint">' + b.name + ' · 共 ' + b.floors + ' 層</div><div class="floor-list">' + rows.join('') + '</div>';
    body.querySelectorAll('.floor-btn').forEach(btn => {
      btn.onclick = () => {
        if (btn.classList.contains('disabled')) return;
        const f = btn.dataset.f;
        selectFloor(bid, f === 'all' ? null : Number(f));
        syncFloorList();
        if (f !== 'all') toast(b.name + ' ' + f + 'F 教室配置');
      };
    });
  }

  /* ---- 右側資訊 ---- */
  function syncDetail() {
    const bid = state.selectedBuilding;
    const kind = $('detailKind');
    if (!bid) { el.detail.classList.remove('on'); if (kind) kind.textContent = ''; return; }
    const b = BUILDINGS.find(x => x.id === bid);
    const fl = floorsOf(bid);
    const total = roomCount(bid);
    kind.textContent = CLASS_DATA.year + ' 學年度';
    let html = '';
    html += '<div class="d-title">' + b.name + '</div>';
    html += '<div class="d-en">' + (b.nameEn || '') + '</div>';
    html += '<div class="d-stats">' +
      '<div class="d-stat"><b>' + b.floors + '</b><span>樓層數</span></div>' +
      '<div class="d-stat"><b>' + total + '</b><span>教室 / 空間</span></div>' +
      '<div class="d-stat"><b>' + fl.length + '</b><span>有配置樓層</span></div>' +
      '</div>';
    html += '<div class="d-intro">' + (b.intro || '') + '</div>';
    html += '<div class="d-sec">樓層配置（同顏色）</div>';
    html += '<table class="floor-table"><tr><th>樓層</th><th>空間配置</th></tr>';
    for (let f = b.floors; f >= 1; f--) {
      const rooms = roomsFor(bid, f);
      const col = FLOOR_COLORS[(f - 1) % FLOOR_COLORS.length];
      html += '<tr data-f="' + f + '"><td><span class="swatch" style="background:' + col + '"></span>' + f + 'F</td>' +
        '<td>' + (rooms.length ? escapeHtml(rooms.join('、')) : '<span style="opacity:.5">無配置</span>') + '</td></tr>';
    }
    html += '</table>';
    html += '<div class="d-sec">快速前往</div><div class="chip-row">';
    html += '<span class="chip' + (state.selectedFloor === null ? ' on' : '') + '" data-f="all">全棟</span>';
    fl.forEach(f => {
      html += '<span class="chip' + (state.selectedFloor === f ? ' on' : '') + '" data-f="' + f + '">' + f + 'F</span>';
    });
    html += '</div>';
    html += '<div class="d-actions">' +
      '<button class="btn" id="dGo">鏡頭前往</button>' +
      '<button class="btn ghost" id="dFp">進入第一人稱</button>' +
      '</div>';
    if (b.sensitive || (window.SENSITIVE_AREAS || []).some(s => s.building === bid)) {
      html += '<div style="margin-top:10px;font-size:11.5px;color:#8a5a00;background:#fff7e6;border:1px solid #ffe1a6;border-radius:8px;padding:6px 9px">⚠ 敏感區域：僅呈現建物外觀，不開放進入。</div>';
    }
    el.detailBody.innerHTML = html;
    el.detailBody.querySelectorAll('.floor-table tr[data-f]').forEach(tr => {
      tr.onclick = () => { selectFloor(bid, Number(tr.dataset.f)); syncDetail(); syncFloorList(); };
    });
    el.detailBody.querySelectorAll('.chip').forEach(c => {
      c.onclick = () => { selectFloor(bid, c.dataset.f === 'all' ? null : Number(c.dataset.f)); syncDetail(); syncFloorList(); };
    });
    $('dGo').onclick = () => flyToBuilding(b, state.selectedFloor);
    $('dFp').onclick = () => { enterFpAt(b); };
    el.detail.classList.add('on');
  }

  function enterFpAt(b) {
    const bb = bbox(b.poly);
    /* 找一個可站立的位置：建物正門側 */
    const cx = (bb.x0 + bb.x1) / 2, cy = bb.y1 + 14;
    const start = nearestWalkableCellPx(cx, cy);
    fp.pos.set(toX(start.px), 1.55, toZ(start.py));
    fp.yaw = Math.PI;             // 面向建物（北 = +X，這裡由南側往北看）
    fp.pitch = -0.02;
    setMode('fp');
    toast('第一人稱：WASD 移動、拖曳轉頭、點地面走過去');
  }
  function nearestWalkableCellPx(px, py) {
    const c = navCellOf(px, py); if (!c) return { px, py };
    const w = nearestWalkable(c.c, c.r) || c;
    return { px: nav.x0 + (w.c + 0.5) * nav.cellPx, py: nav.y0 + (w.r + 0.5) * nav.cellPx };
  }

  /* ---- 步行 HUD ---- */
  function updateWalkBar() {
    if (!state.route) { el.walkBar.classList.remove('on'); el.routeSteps.innerHTML = ''; return; }
    const info = state.route.info;
    $('wDist').textContent = info.dist.toFixed(0) + ' m';
    $('wTime').textContent = fmtTime(info.time);
    el.routeSteps.innerHTML = info.steps.map((s, i) =>
      '<div class="' + (s.kind === 'turn' ? 'cur' : '') + '">' + (i + 1) + '. ' + s.text + '（' + s.at.toFixed(0) + 'm）</div>').join('');
    el.walkBar.classList.add('on');
    $('wWalk').textContent = state.walking ? '步行中…' : '開始步行';
  }
  function fmtTime(sec) {
    const m = Math.floor(sec / 60), s = Math.round(sec % 60);
    return m + ' 分 ' + (s < 10 ? '0' : '') + s + ' 秒';
  }

  /* ---- 模式 ---- */
  function setMode(m) {
    state.mode = m;
    stopAutoWalk();
    syncModeUI();
    if (m === 'fp') {
      toast('第一人稱：WASD / 方向鍵移動、拖曳轉頭、點地面自動走過去', 3600);
    } else {
      toast('鳥瞰：拖曳旋轉、滾輪縮放、右鍵平移');
    }
  }
  function syncModeUI() {
    const fpMode = state.mode === 'fp';
    el.fpHud.classList.toggle('on', fpMode);
    el.joystick.classList.toggle('on', fpMode && state.mobile);
    const b = $('btnMode');
    if (b) {
      b.classList.toggle('on', fpMode);
      b.querySelector('.lbl').textContent = fpMode ? '第一人稱' : '鳥瞰';
      b.querySelector('.ic').textContent = fpMode ? '🚶' : '🧭';
    }
    el.dock.querySelectorAll('.d').forEach(d => d.classList.toggle('on', d.dataset.a === 'mode' && fpMode));
    if (fpMode) applyFpCamera();
  }

  /* ---- 導覽路線 ---- */
  function startTour(id) {
    const t = TOURS.find(x => x.id === id); if (!t) return;
    state.tour = t; state.tourIdx = 0;
    el.tourBar.classList.add('on');
    navTab = 'tour'; syncNav();
    if (state.mobile) el.leftNav.classList.remove('on');
    tourShow();
    toast('開始導覽：' + t.name);
  }
  function tourShow() {
    const t = state.tour; if (!t) return;
    const s = t.stops[state.tourIdx];
    $('tourName').textContent = t.name;
    $('tourName').style.color = t.color;
    $('tourStep').textContent = (state.tourIdx + 1) + ' / ' + t.stops.length;
    $('tourText').textContent = s.title + '：' + s.text;
    const spot = NET.spots.find(x => x.id === s.spot);
    if (spot) {
      clearMarker();
      const px = spot.px[0], py = spot.px[1];
      state.mode = 'orbit'; syncModeUI();
      orbit.target.set(toX(px), 4, toZ(py));
      orbit.dist = 92; orbit.azim = 0.25; orbit.elev = 0.75;
      flyTo({ pos: orbitCameraPosition(), look: orbit.target.clone() }, 1.0);
    }
    if (s.highlight) {
      state.selectedBuilding = s.highlight;
      state.selectedFloor = s.floor || null;
      applyFloorView(); refreshRoomLabels(); syncDetail();
      if (state.mobile) el.detail.classList.remove('on');
    }
  }
  function tourMove(d) {
    if (!state.tour) return;
    state.tourIdx = clamp(state.tourIdx + d, 0, state.tour.stops.length - 1);
    tourShow();
  }
  function endTour() {
    state.tour = null;
    el.tourBar.classList.remove('on');
    clearMarker();
    toast('導覽結束');
  }

  /* =========================================================
     13. 日夜 / 省電
     ========================================================= */
  function setNight(on) {
    state.night = on;
    const sky = on ? 0x0b1a33 : 0x9fd0f5;
    scene.background.setHex(sky);
    if (scene.fog) scene.fog.color.setHex(sky);
    hemi.intensity = on ? 0.3 : 0.85;
    hemi.color.setHex(on ? 0x5b7bb5 : 0xdff0ff);
    sun.intensity = on ? 0.28 : 1.55;
    sun.color.setHex(on ? 0x9fbaff : 0xffffff);
    amb.intensity = on ? 0.12 : 0.22;
    windowMats.forEach(m => {
      m.emissive.setHex(on ? 0xffc98a : 0x000000);
      m.emissiveIntensity = on ? 0.6 : 0;
      m.needsUpdate = true;
    });
    const b = $('btnNight');
    if (b) { b.classList.toggle('on', on); b.querySelector('.lbl').textContent = on ? '白天' : '夜晚'; b.querySelector('.ic').textContent = on ? '☀️' : '🌙'; }
    el.dock.querySelectorAll('.d').forEach(d => d.classList.toggle('on', d.dataset.a === 'night' && on));
    toast(on ? '夜晚模式' : '白天模式');
  }

  function setPowerSave(on) {
    state.powerSave = on;
    renderer.setPixelRatio(on ? 1 : Math.min(devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !on && !state.mobile;
    BASE_FOG.color.setHex(state.night ? 0x0b1a33 : 0x9fd0f5);
    scene.fog = on ? null : BASE_FOG;
    world.traverse(o => {
      if (!o.material) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(m => m.needsUpdate = true);
    });
    const b = $('btnPower');
    if (b) b.classList.toggle('on', on);
    resize();
    toast(on ? '已開啟省電模式（關閉陰影、降低解析度）' : '已關閉省電模式');
  }

  /* =========================================================
     14. 鍵盤 / 虛擬搖桿
     ========================================================= */
  const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  window.addEventListener('keydown', e => {
    if (/input|textarea/i.test(e.target.tagName)) return;
    keys[e.code] = true;
    if (MOVE_KEYS.includes(e.code)) {
      e.preventDefault();
      if (state.mode === 'fp') stopAutoWalk();
    }
    if (e.code === 'KeyF') setMode(state.mode === 'orbit' ? 'fp' : 'orbit');
    if (e.code === 'KeyN') setNight(!state.night);
    if (e.code === 'Escape') {
      el.searchResults.classList.remove('on');
      if (state.tour) endTour();
      else if (el.detail.classList.contains('on')) $('detailClose').click();
    }
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  window.addEventListener('blur', () => Object.keys(keys).forEach(k => keys[k] = false));

  function setupJoystick() {
    let pid = null, cx = 0, cy = 0;
    const R = 40;
    const start = e => {
      if (pid !== null) return;
      pid = e.pointerId;
      const r = el.joystick.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      el.joystick.setPointerCapture(e.pointerId);
      move(e);
      e.preventDefault();
    };
    const move = e => {
      if (e.pointerId !== pid) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      joy.x = dx / R; joy.y = dy / R; joy.active = true;
      el.joyKnob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      stopAutoWalk();
      e.preventDefault();
    };
    const end = e => {
      if (e.pointerId !== pid) return;
      pid = null; joy.x = joy.y = 0; joy.active = false;
      el.joyKnob.style.transform = '';
    };
    el.joystick.addEventListener('pointerdown', start);
    el.joystick.addEventListener('pointermove', move);
    el.joystick.addEventListener('pointerup', end);
    el.joystick.addEventListener('pointercancel', end);
  }

  /* =========================================================
     15. 行走 / 碰撞 / 自動沿線行走
     ========================================================= */
  let walkIdx = 0, walkSegT = 0;

  function startAutoWalk() {
    if (!state.route) return;
    state.walking = true;
    walkIdx = 0; walkSegT = 0;
    state.mode = 'fp'; syncModeUI();
    updateWalkBar();
  }
  function stopAutoWalk() {
    if (state.walking) { state.walking = false; updateWalkBar(); }
  }

  function walkableAt(x, z) {
    const px = toPx(x), py = toPy(z);
    const B = GF.bounds;
    if (px < B.x0 || px > B.x1 || py < B.y0 || py > B.y1) return false;
    for (const poly of navBlocked) {
      if (pip(px, py, poly)) return false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        if (distToSeg(px, py, poly[j][0], poly[j][1], poly[i][0], poly[i][1]) < 1.0 / S) return false;
      }
    }
    for (const b of (NET.blocked || [])) { if (pip(px, py, b.poly)) return false; }
    return true;
  }

  function moveFp(dx, dz) {
    const p = fp.pos;
    if (walkableAt(p.x + dx, p.z)) p.x += dx;
    if (walkableAt(p.x, p.z + dz)) p.z += dz;
  }

  function updateFp(dt) {
    let mx = 0, mz = 0;
    if (keys.KeyW || keys.ArrowUp) mz += 1;
    if (keys.KeyS || keys.ArrowDown) mz -= 1;
    if (keys.KeyA || keys.ArrowLeft) mx -= 1;
    if (keys.KeyD || keys.ArrowRight) mx += 1;
    if (joy.active) { mx += joy.x; mz += -joy.y; }
    const len = Math.hypot(mx, mz);
    if (len > 0.05) {
      mx /= Math.max(1, len); mz /= Math.max(1, len);
      const speed = 4.2;
      const fwd = new THREE.Vector3(Math.sin(fp.yaw), 0, Math.cos(fp.yaw));
      const right = new THREE.Vector3(Math.sin(fp.yaw - Math.PI / 2), 0, Math.cos(fp.yaw - Math.PI / 2));
      moveFp((fwd.x * mz + right.x * mx) * speed * dt, (fwd.z * mz + right.z * mx) * speed * dt);
    }
    fp.pos.y = 1.55;
  }

  function updateAutoWalk(dt) {
    const pts = state.route.pts;
    let budget = M.walkSpeed * 3.0 * dt;      // 導覽步行速度（略快於散步）
    let guard = 0;
    while (guard++ < 128) {
      if (walkIdx >= pts.length - 1) { arrive(); return; }
      const a = pts[walkIdx], b = pts[walkIdx + 1];
      const segLen = Math.hypot(toX(b.px) - toX(a.px), toZ(b.py) - toZ(a.py));
      if (segLen < 0.001) { walkIdx++; continue; }
      const remain = segLen - walkSegT;
      if (budget >= remain) { budget -= remain; walkSegT = 0; walkIdx++; continue; }
      walkSegT += budget; budget = 0;
      break;
    }
    if (walkIdx >= pts.length - 1) { arrive(); return; }
    const a = pts[walkIdx], b = pts[walkIdx + 1];
    const ax = toX(a.px), az = toZ(a.py), bx = toX(b.px), bz = toZ(b.py);
    const segLen = Math.hypot(bx - ax, bz - az) || 1;
    const t = clamp(walkSegT / segLen, 0, 1);
    fp.pos.set(ax + (bx - ax) * t, 1.55, az + (bz - az) * t);
    const want = Math.atan2(bx - ax, bz - az);
    let d = want - fp.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    fp.yaw += clamp(d, -3.2 * dt, 3.2 * dt);
    fp.pitch += (-0.05 - fp.pitch) * Math.min(1, dt * 3);
    updateRouteStepHighlight();
  }
  function arrive() {
    state.walking = false;
    updateWalkBar();
    toast('已抵達目的地');
  }

  function updateRouteStepHighlight() {
    if (!state.route) return;
    const info = state.route.info;
    /* 累積目前位置距離 */
    const pts = state.route.pts;
    let acc = 0, cur = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      acc += Math.hypot(toX(pts[i + 1].px) - toX(pts[i].px), toZ(pts[i + 1].py) - toZ(pts[i].py));
      if (acc >= walkSegTotal() ) { cur = acc; break; }
      cur = acc;
    }
    const kids = el.routeSteps.children;
    let active = 0;
    info.steps.forEach((s, i) => { if (s.at <= cur + 0.5) active = i; });
    for (let i = 0; i < kids.length; i++) kids[i].classList.toggle('cur', i === active);
  }
  function walkSegTotal() {
    const pts = state.route.pts;
    let acc = 0;
    for (let i = 0; i < walkIdx; i++) acc += Math.hypot(toX(pts[i + 1].px) - toX(pts[i].px), toZ(pts[i + 1].py) - toZ(pts[i].py));
    return acc + walkSegT;
  }

  /* =========================================================
     16. 小地圖
     ========================================================= */
  const mapImg = new Image();
  mapImg.src = window.CAMPUS_MAP_IMG;

  function drawMinimap() {
    const c = el.minimap;
    const w = c.clientWidth || 186, h = c.clientHeight || 248;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    const sc = Math.min(w / IMG_W, h / IMG_H);
    const ox = (w - IMG_W * sc) / 2, oy = (h - IMG_H * sc) / 2;
    ctx.save();
    ctx.translate(ox, oy); ctx.scale(sc, sc);
    if (mapImg.complete && mapImg.naturalWidth) ctx.drawImage(mapImg, 0, 0, IMG_W, IMG_H);
    else { ctx.fillStyle = '#eef2f6'; ctx.fillRect(0, 0, IMG_W, IMG_H); }

    BUILDINGS.forEach(b => {
      ctx.beginPath();
      b.poly.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      ctx.closePath();
      ctx.fillStyle = b.color;
      ctx.globalAlpha = (state.selectedBuilding === b.id) ? 0.95 : 0.6;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = state.selectedBuilding === b.id ? 3 : 1.2;
      ctx.strokeStyle = state.selectedBuilding === b.id ? '#123' : 'rgba(0,0,0,.45)';
      ctx.stroke();
    });

    if (state.route) {
      ctx.beginPath();
      state.route.pts.forEach((p, i) => i ? ctx.lineTo(p.px, p.py) : ctx.moveTo(p.px, p.py));
      ctx.lineWidth = 3.4; ctx.strokeStyle = '#1f6feb'; ctx.stroke();
    }
    if (state.tour) {
      const t = state.tour;
      ctx.beginPath();
      t.stops.forEach((s, i) => {
        const sp = NET.spots.find(x => x.id === s.spot); if (!sp) return;
        i ? ctx.lineTo(sp.px[0], sp.px[1]) : ctx.moveTo(sp.px[0], sp.px[1]);
      });
      ctx.setLineDash([7, 5]); ctx.lineWidth = 2.4; ctx.strokeStyle = t.color; ctx.stroke(); ctx.setLineDash([]);
      t.stops.forEach((s, i) => {
        const sp = NET.spots.find(x => x.id === s.spot); if (!sp) return;
        ctx.beginPath(); ctx.arc(sp.px[0], sp.px[1], i === state.tourIdx ? 7 : 4, 0, 6.3);
        ctx.fillStyle = i === state.tourIdx ? '#ff3b5c' : t.color; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
      });
    }

    /* 攝影機位置與視線 */
    const camPx = toPx(camera.position.x), camPy = toPy(camera.position.z);
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
    const ang = Math.atan2(dir.z, dir.x);
    ctx.save();
    ctx.translate(camPx, camPy); ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(14, 0); ctx.lineTo(-8, -8); ctx.lineTo(-4, 0); ctx.lineTo(-8, 8);
    ctx.closePath();
    ctx.fillStyle = '#ff3b5c'; ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.restore();

    /* 方位：右側為北 */
    ctx.save();
    ctx.translate(IMG_W - 46, 40);
    ctx.strokeStyle = 'rgba(20,40,70,.6)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(16, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(8, -6); ctx.moveTo(16, 0); ctx.lineTo(8, 6); ctx.stroke();
    ctx.fillStyle = '#c62828'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('N', 0, -10);
    ctx.restore();

    ctx.restore();
  }

  function onMinimapClick(e) {
    const r = el.minimap.getBoundingClientRect();
    const w = r.width, h = r.height;
    const sc = Math.min(w / IMG_W, h / IMG_H);
    const ox = (w - IMG_W * sc) / 2, oy = (h - IMG_H * sc) / 2;
    const px = (e.clientX - r.left - ox) / sc, py = (e.clientY - r.top - oy) / sc;
    if (px < 0 || py < 0 || px > IMG_W || py > IMG_H) return;
    const hit = BUILDINGS.find(b => pip(px, py, b.poly));
    if (hit) { selectBuilding(hit.id, true); return; }
    state.mode = 'orbit'; syncModeUI();
    orbit.target.set(toX(px), 2, toZ(py));
    orbit.dist = 110; orbit.elev = 0.85;
    flyTo({ pos: orbitCameraPosition(), look: orbit.target.clone() }, 0.9);
  }

  /* =========================================================
     17. 迴圈
     ========================================================= */
  let frame = 0, last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    frame++;

    if (fly) {
      fly.t += dt / fly.dur;
      const k = fly.t >= 1 ? 1 : 1 - Math.pow(1 - fly.t, 3);
      camera.position.lerpVectors(fly.from.pos, fly.to.pos, k);
      const look = new THREE.Vector3().lerpVectors(fly.from.look, fly.to.look, k);
      camera.lookAt(look);
      if (fly.t >= 1) { fly = null; if (state.mode === 'orbit') applyOrbitCamera(); }
    } else if (state.mode === 'fp') {
      if (state.walking && state.route) updateAutoWalk(dt);
      else updateFp(dt);
      applyFpCamera();
    } else {
      applyOrbitCamera();
    }

    if (markerGroup) {
      const t = now * 0.004;
      markerGroup.userData.ring.scale.setScalar(1 + Math.sin(t) * 0.08);
      markerGroup.userData.ring.material.opacity = 0.65 + Math.sin(t) * 0.25;
    }

    const labelEvery = state.powerSave ? 5 : 1;
    if (frame % labelEvery === 0) updateLabels();
    if (frame % (state.powerSave ? 8 : 3) === 0) drawMinimap();
    updateCompass();

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  function updateCompass() {
    const needle = el.compass.querySelector('.needle');
    if (!needle) return;
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
    const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
    const north = new THREE.Vector3(1, 0, 0);
    const a = Math.atan2(north.dot(right), north.dot(fwd));
    needle.setAttribute('transform', 'rotate(' + deg(a).toFixed(1) + ' 34 34)');
  }

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    if (!state.powerSave) renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    const mm = el.minimapWrap;
    if (mm) {
      const big = mm.classList.contains('big');
      mm.style.width = big ? Math.min(340, innerWidth * 0.8) + 'px' : '';
      mm.style.height = big ? Math.min(452, innerHeight * 0.62) + 'px' : '';
    }
  }
  window.addEventListener('resize', resize);

  /* =========================================================
     18. 初始化
     ========================================================= */
  function init(tex) {
    buildGround(tex);
    buildBuildings();
    buildTrees();
    buildNav();
    buildBuildingLabels();
    buildSearchIndex();
    buildChrome();
    setupJoystick();
    el.minimapWrap.addEventListener('click', onMinimapClick);

    renderer.shadowMap.enabled = !state.mobile;
    if (state.mobile) renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    applyOrbitCamera();
    updateLabels();
    drawMinimap();
    syncModeUI();

    setTimeout(() => {
      el.loading.classList.add('off');
      setTimeout(() => el.loading.remove(), 600);
      toast('歡迎使用礁溪國小 3D 校園導覽');
    }, 350);

    requestAnimationFrame(loop);
  }

  function loadMap() {
    if (el.loadPct) el.loadPct.textContent = '載入校園平面圖…';
    const tex = new THREE.TextureLoader().load(
      window.CAMPUS_MAP_IMG,
      () => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        tex.needsUpdate = true;
        init(tex);
      },
      undefined,
      () => {
        if (el.loadPct) el.loadPct.textContent = '平面圖載入失敗，改用純色地面';
        const fallback = new THREE.MeshStandardMaterial({ color: 0xdfe7ee });
        init(fallback);
      }
    );
  }

  resize();
  loadMap();
};

