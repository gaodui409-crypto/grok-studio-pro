// Character presets for fanart batch generation.
// Built-in presets are defined in code; users can add custom ones (saved to localStorage).

export type ScenePreset = {
  /** matched against scene name (substring match, case-insensitive) */
  sceneName: string;
  outfits: string[];
  actions: string[];
};

export type CharacterPreset = {
  id: string;
  name: string;
  description: string;
  /** "动漫赛璐璐" etc. - must match scene-tree.styles entry, or "" for none */
  defaultStyle?: string;
  /** must match scene-tree.lighting entry, or "" for none */
  defaultLighting?: string;
  scenes: ScenePreset[];
  builtin?: boolean;
};

export const BUILTIN_PRESETS: CharacterPreset[] = [
  {
    id: "builtin-hutao",
    name: "原神 · 胡桃 (Hu Tao)",
    description:
      "Hu Tao from Genshin Impact, young girl with long dark brown twin-tails tied with flower accessories, bright amber eyes with flower-shaped pupils, wearing a dark brown tailcoat with red accents and plum blossom patterns, black shorts, red and white striped legwear, a black top hat with a red flower",
    defaultStyle: "动漫赛璐璐",
    defaultLighting: "戏剧性明暗",
    scenes: [
      {
        sceneName: "战斗",
        outfits: [
          "default dark brown tailcoat with plum blossom patterns",
          "funeral parlor work outfit with ghost motifs",
        ],
        actions: [
          "wielding a polearm engulfed in flames",
          "surrounded by floating spirit butterflies",
          "performing a spinning polearm attack with fire trail",
          "charging forward with blazing eyes",
          "summoning a giant ghost behind her",
        ],
      },
      {
        sceneName: "居家",
        outfits: [
          "default dark brown tailcoat",
          "casual black hooded sweatshirt",
        ],
        actions: [
          "making silly faces and pranking",
          "sitting on a rooftop eating spicy noodles",
          "writing poetry under a tree",
          "playing with Boo Tao ghost",
          "sneaking up behind someone",
        ],
      },
      {
        sceneName: "古风",
        outfits: ["red and black modified hanfu"],
        actions: [
          "performing a ritual dance with paper charms",
          "walking through a field of spider lilies at dusk",
          "holding a glowing lantern in a misty graveyard",
          "sitting cross-legged reading ancient scrolls",
        ],
      },
    ],
  },
  {
    id: "builtin-raiden",
    name: "原神 · 雷电将军 (Raiden Shogun)",
    description:
      "Raiden Shogun from Genshin Impact, tall elegant woman with long braided violet-purple hair, purple eyes with a cold dignified gaze, wearing a purple and white kimono-style outfit with an electro vision, exposed back design, purple gradient chest armor piece",
    defaultStyle: "动漫赛璐璐",
    defaultLighting: "幽蓝冷光",
    scenes: [
      {
        sceneName: "战斗",
        outfits: [
          "default purple kimono armor",
          "full samurai armor with electro energy",
        ],
        actions: [
          "drawing a glowing sword from her chest",
          "standing in a thunderstorm with lightning crackling around",
          "slashing with the Musou no Hitotachi",
          "floating mid-air surrounded by purple electro rings",
          "standing on a cliff overlooking Inazuma",
        ],
      },
      {
        sceneName: "居家",
        outfits: ["light purple yukata with flower patterns"],
        actions: [
          "struggling to use a smartphone with confused expression",
          "tasting dango milk with a subtle smile",
          "meditating in a serene garden",
          "cooking in a kitchen looking flustered",
        ],
      },
      {
        sceneName: "古风",
        outfits: ["ornate purple court kimono"],
        actions: [
          "sitting on the Shogun throne with commanding presence",
          "standing at the balcony of Tenshukaku at sunset",
          "walking through the Sakura tree corridor",
        ],
      },
    ],
  },
  {
    id: "builtin-ganyu",
    name: "原神 · 甘雨 (Ganyu)",
    description:
      "Ganyu from Genshin Impact, graceful young woman with long light-blue hair and red horns on her head, gentle purple eyes, wearing a black and white bodysuit with a purple-blue gradient cape, cryo vision, detached sleeves with gold accents",
    defaultStyle: "动漫赛璐璐",
    defaultLighting: "黄金时刻",
    scenes: [
      {
        sceneName: "战斗",
        outfits: [
          "default black and white bodysuit with cape",
          "crystalline cryo armor with ice wings",
        ],
        actions: [
          "drawing a glowing ice bow aiming at the sky",
          "charging a cryo arrow with ice crystals forming",
          "standing on a frozen lake with ice shards orbiting",
          "shooting a massive ice bloom that shatters",
        ],
      },
      {
        sceneName: "居家",
        outfits: ["Liyue-style formal secretary outfit"],
        actions: [
          "buried in stacks of paperwork looking exhausted",
          "adjusting glasses while reading documents",
          "fallen asleep at her desk with papers as pillow",
        ],
      },
      {
        sceneName: "户外",
        outfits: ["white pastoral long dress"],
        actions: [
          "lying in a flower meadow on Qingyun Peak",
          "sitting by a waterfall eating flowers peacefully",
          "gazing at the moon from a mountain top",
          "playing with small Cryo Slimes",
        ],
      },
    ],
  },
  {
    id: "builtin-nahida",
    name: "原神 · 纳西妲 (Nahida)",
    description:
      "Nahida from Genshin Impact, small young girl with very long white hair with green gradient tips, bright green eyes, pointed elf-like ears, wearing a white and green dress with leaf and vine motifs, barefoot, a large green clover-like hair accessory, Dendro Archon",
    defaultStyle: "动漫赛璐璐",
    defaultLighting: "丁达尔光束",
    scenes: [
      {
        sceneName: "古风",
        outfits: [
          "default white and green dress with vine motifs",
          "pure white ethereal dream dress with glowing vines",
        ],
        actions: [
          "floating in a dreamy space surrounded by glowing data streams",
          "sitting in the center of a giant glowing flower",
          "connecting to the Irminsul tree with green light tendrils",
          "reading a holographic storybook mid-air",
        ],
      },
      {
        sceneName: "户外",
        outfits: ["forest sprite green short dress"],
        actions: [
          "walking barefoot through a mushroom forest",
          "playing with small woodland creatures",
          "growing flowers from her palms",
          "swinging on a giant vine in the rainforest",
        ],
      },
      {
        sceneName: "居家",
        outfits: ["cute white and green dress"],
        actions: [
          "excitedly tasting sweets for the first time",
          "playing a video game with intense focus",
          "stacking books to reach a high shelf",
          "riding on a giant Dendro mushroom",
        ],
      },
    ],
  },
  {
    id: "builtin-kurumi",
    name: "七濑胡桃 (Nanase Kurumi)",
    description:
      "Nanase Kurumi, cute 16-year-old high school girl with shoulder-length brown hair, soft brown eyes, petite figure 151cm tall, wearing a black long-sleeve hoodie, gentle and slightly airheaded personality",
    defaultStyle: "动漫赛璐璐",
    defaultLighting: "柔和晨光",
    scenes: [
      {
        sceneName: "居家",
        outfits: [
          "default black hoodie",
          "white pajamas",
          "apron over casual clothes",
        ],
        actions: [
          "curled up on the sofa watching anime",
          "lying in bed hugging a pillow half-asleep",
          "cooking in the kitchen with a slight mess",
          "taking a long relaxing bath surrounded by steam",
          "stretching and yawning by the window in morning light",
        ],
      },
      {
        sceneName: "校园",
        outfits: ["Japanese sailor school uniform", "PE gym uniform"],
        actions: [
          "dozing off in class with head on desk",
          "eating a bento box on the rooftop",
          "walking to school with earphones listening to music",
          "studying in the library looking confused",
          "standing at the school gate in the rain",
        ],
      },
      {
        sceneName: "户外",
        outfits: [
          "casual hoodie and skirt",
          "winter coat with scarf",
        ],
        actions: [
          "browsing in a convenience store choosing snacks",
          "sitting alone in a quiet cafe",
          "walking through autumn leaves with headphones",
          "huddling in a scarf on a cold winter day",
        ],
      },
    ],
  },
];

const KEY = "grok-studio-character-presets";

export function loadCustomPresets(): CharacterPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as CharacterPreset[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveCustomPresets(list: CharacterPreset[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("grok-presets-changed"));
}

export function getAllPresets(): CharacterPreset[] {
  return [...BUILTIN_PRESETS, ...loadCustomPresets()];
}

export const newCustomPreset = (): CharacterPreset => ({
  id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
  name: "新角色",
  description: "",
  defaultStyle: "动漫赛璐璐",
  defaultLighting: "",
  scenes: [],
});
