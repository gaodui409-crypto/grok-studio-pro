// Scene tree: hierarchical scene → outfits + actions
// Persisted to localStorage. Users can edit/add/remove every node.

export type Scene = {
  id: string;
  name: string;
  outfits: string[];
  actions: string[];
};

export type SceneTreeData = {
  scenes: Scene[];
  styles: string[];
  lighting: string[];
};

const KEY = "grok-studio-scene-tree";

const uid = () => Math.random().toString(36).slice(2, 10);

export const DEFAULT_SCENE_TREE: SceneTreeData = {
  scenes: [
    {
      id: uid(),
      name: "战斗场景",
      outfits: ["铠甲", "战斗服", "校服+武器", "军装", "忍者装"],
      actions: [
        "举剑挥砍",
        "蓄力释放魔法",
        "格挡防御",
        "空中跳斩",
        "持枪瞄准",
        "双刀交叉",
        "背对爆炸",
        "受伤单膝跪地",
      ],
    },
    {
      id: uid(),
      name: "居家日常",
      outfits: ["睡衣", "围裙", "家居服", "浴袍", "oversized T恤"],
      actions: [
        "窝在沙发看书",
        "厨房做饭",
        "趴在床上玩手机",
        "窗边喝咖啡",
        "撸猫",
        "伸懒腰起床",
        "整理书架",
      ],
    },
    {
      id: uid(),
      name: "校园生活",
      outfits: ["校服", "体操服", "社团制服", "便服+书包"],
      actions: [
        "课桌前托腮",
        "走廊奔跑",
        "屋顶吃便当",
        "图书馆读书",
        "体育课跑步",
        "放学撑伞",
        "黑板前写字",
      ],
    },
    {
      id: uid(),
      name: "户外冒险",
      outfits: ["探险装", "斗篷", "旅行装", "运动装"],
      actions: ["悬崖边眺望", "森林中行走", "篝火旁取暖", "骑马奔驰", "攀岩", "河边钓鱼"],
    },
    {
      id: uid(),
      name: "古风/和风",
      outfits: ["汉服", "和服", "旗袍", "古装铠甲", "巫女服"],
      actions: ["抚琴", "舞剑", "撑油纸伞漫步", "品茶", "赏月", "执扇回眸"],
    },
    {
      id: uid(),
      name: "都市时尚",
      outfits: ["西装", "晚礼服", "休闲潮牌", "皮衣", "JK制服"],
      actions: ["街头漫步", "咖啡厅坐着", "天台俯瞰城市", "雨中打伞", "耳机听歌", "靠墙站立"],
    },
    {
      id: uid(),
      name: "舞台/表演",
      outfits: ["偶像演出服", "乐队装", "魔术师斗篷", "舞蹈服"],
      actions: ["舞台中央唱歌", "弹吉他", "钢琴演奏", "谢幕鞠躬", "跳舞旋转"],
    },
  ],
  styles: [
    "动漫赛璐璐",
    "水彩风",
    "油画风",
    "像素风",
    "浮世绘",
    "新海诚风",
    "宫崎骏风",
    "写实CG",
    "厚涂插画",
    "皮克斯3D",
  ],
  lighting: [
    "黄金时刻",
    "逆光剪影",
    "霓虹灯光",
    "月光柔照",
    "柔和晨光",
    "戏剧性明暗",
    "丁达尔光束",
    "幽蓝冷光",
  ],
};

export function loadSceneTree(): SceneTreeData {
  if (typeof window === "undefined") return DEFAULT_SCENE_TREE;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SCENE_TREE;
    const parsed = JSON.parse(raw) as SceneTreeData;
    if (!parsed.scenes?.length) return DEFAULT_SCENE_TREE;
    return parsed;
  } catch {
    return DEFAULT_SCENE_TREE;
  }
}

export function saveSceneTree(data: SceneTreeData) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function newScene(name = "新场景"): Scene {
  return { id: uid(), name, outfits: [], actions: [] };
}
