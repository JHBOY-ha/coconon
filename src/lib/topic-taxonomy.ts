import { sanitizeContentLabel, unique } from "@/lib/utils";

function includesAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

export function normalizeTopicLabel(label: unknown) {
  const normalized = sanitizeContentLabel(label);
  if (!normalized) {
    return null;
  }

  const text = normalized.toLowerCase();

  if (includesAny(text, ["单机", "steam", "switch", "主机"])) return "游戏·单机";
  if (includesAny(text, ["网络游戏", "网游", "moba", "英雄联盟", "lol", "dota"])) return "游戏·网游";
  if (includesAny(text, ["手机游戏", "手游"])) return "游戏·手游";
  if (includesAny(text, ["游戏", "电竞", "实况", "攻略"])) return "游戏·综合";

  if (includesAny(text, ["ai", "人工智能", "大模型", "提示词"])) return "科技·AI";
  if (includesAny(text, ["编程", "代码", "前端", "后端", "开发", "开源"])) return "科技·开发";
  if (includesAny(text, ["数码", "芯片", "手机", "电脑", "硬件"])) return "科技·数码";
  if (includesAny(text, ["科技"])) return "科技·综合";

  if (includesAny(text, ["科普", "科学"])) return "知识·科普";
  if (includesAny(text, ["历史", "哲学", "心理", "经济", "商业"])) return "知识·人文";
  if (includesAny(text, ["知识", "学习", "课程"])) return "知识·综合";

  if (includesAny(text, ["搞笑", "整活", "沙雕"])) return "娱乐·搞笑";
  if (includesAny(text, ["鬼畜"])) return "娱乐·鬼畜";
  if (includesAny(text, ["综艺", "reaction"])) return "娱乐·综艺";
  if (includesAny(text, ["娱乐"])) return "娱乐·综合";

  if (includesAny(text, ["vlog", "日常", "生活记录"])) return "生活·日常";
  if (includesAny(text, ["穿搭", "美妆", "护肤", "时尚"])) return "生活·时尚";
  if (includesAny(text, ["旅行", "出行", "探店"])) return "生活·出行";
  if (includesAny(text, ["生活"])) return "生活·综合";

  if (includesAny(text, ["做饭", "料理", "烘焙"])) return "美食·烹饪";
  if (includesAny(text, ["美食", "探店", "吃播"])) return "美食·探店";

  if (includesAny(text, ["电影"])) return "影视·电影";
  if (includesAny(text, ["电视剧", "剧集"])) return "影视·剧集";
  if (includesAny(text, ["纪录片"])) return "影视·纪录片";
  if (includesAny(text, ["影视", "解说", "剪辑"])) return "影视·综合";

  if (includesAny(text, ["番剧", "动画", "国创"])) return "动漫·番剧";
  if (includesAny(text, ["二次元", "vtuber"])) return "动漫·二次元";
  if (includesAny(text, ["动漫"])) return "动漫·综合";

  if (includesAny(text, ["翻唱", "演奏", "乐评"])) return "音乐·演奏";
  if (includesAny(text, ["音乐", "mv", "live"])) return "音乐·综合";

  if (includesAny(text, ["舞蹈", "跳舞"])) return "舞蹈·表演";
  if (includesAny(text, ["汽车", "用车", "试驾"])) return "汽车·用车";
  if (includesAny(text, ["运动", "体育", "健身"])) return "运动·体育";
  if (includesAny(text, ["动物", "萌宠"])) return "动物·萌宠";
  if (includesAny(text, ["时政", "新闻"])) return "时事·新闻";

  return normalized;
}

export function deriveCanonicalTopics(input: {
  title?: string | null;
  tagName?: string | null;
  subTagName?: string | null;
}) {
  const title = input.title?.toLowerCase() ?? "";
  const direct = [
    normalizeTopicLabel(input.subTagName),
    normalizeTopicLabel(input.tagName),
    normalizeTopicLabel(title),
  ].filter((value): value is string => Boolean(value));

  const refined: string[] = [];

  if (includesAny(title, ["单机", "steam", "switch", "主机"])) refined.push("游戏·单机");
  if (includesAny(title, ["网游", "moba", "英雄联盟", "lol", "dota"])) refined.push("游戏·网游");
  if (includesAny(title, ["手游", "手机游戏"])) refined.push("游戏·手游");
  if (includesAny(title, ["ai", "大模型", "提示词", "agent", "智能体"])) refined.push("科技·AI");
  if (includesAny(title, ["编程", "代码", "react", "next.js", "python", "javascript"])) refined.push("科技·开发");
  if (includesAny(title, ["数码", "显卡", "芯片", "macbook", "iphone", "安卓"])) refined.push("科技·数码");
  if (includesAny(title, ["科普", "科学"])) refined.push("知识·科普");
  if (includesAny(title, ["历史", "哲学", "经济", "心理"])) refined.push("知识·人文");
  if (includesAny(title, ["搞笑", "整活", "抽象"])) refined.push("娱乐·搞笑");
  if (includesAny(title, ["vlog", "日常"])) refined.push("生活·日常");
  if (includesAny(title, ["探店", "旅行"])) refined.push("生活·出行");
  if (includesAny(title, ["做饭", "料理", "烘焙"])) refined.push("美食·烹饪");
  if (includesAny(title, ["电影"])) refined.push("影视·电影");
  if (includesAny(title, ["电视剧"])) refined.push("影视·剧集");
  if (includesAny(title, ["纪录片"])) refined.push("影视·纪录片");
  if (includesAny(title, ["番剧", "动画", "国创"])) refined.push("动漫·番剧");
  if (includesAny(title, ["翻唱", "演奏", "乐评"])) refined.push("音乐·演奏");

  return unique([...direct, ...refined]).slice(0, 4);
}
