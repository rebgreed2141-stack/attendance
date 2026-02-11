// data.js
// クラス・園児の固定データ（ここだけ編集すればOK）

// 【クラス】
window.CLASSES = [
  { id: "momiji",    name: "もみじ" },
  { id: "donguri",   name: "どんぐり" },
  { id: "koguma",    name: "こぐま" },
  { id: "risu",      name: "りす" },
  { id: "nousagi",   name: "のうさぎ" },
  { id: "kamoshika", name: "かもしか" },
];

// 【園児】
// 追加方法：{ classId:"momiji", name:"◯◯" } を増やすだけ
// IDは自動で "classId:name" になります（保存キー）
window.CHILDREN = [
  // もみじ
  { classId: "momiji",  name: "あさひ" },
  { classId: "momiji",  name: "たいせい" },
  { classId: "momiji",  name: "そら" },
  { classId: "momiji",  name: "せな" },
  { classId: "momiji",  name: "あんり" },

  // どんぐり
  { classId: "donguri", name: "がく" },
  { classId: "donguri", name: "かいと" },
  { classId: "donguri", name: "あき" },
  { classId: "donguri", name: "てん" },
].map(c => ({
  ...c,
  id: `${c.classId}:${c.name}` // 園児ID（保存キー）
}));
