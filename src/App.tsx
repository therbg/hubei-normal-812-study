"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  memorizationCards,
  practiceQuestions,
  syllabus,
  totalTopicCount,
  type MemorizationCard,
} from "./data";
import { buildFrameworkStudyCard } from "./study-profiles";
import { peerQuestions } from "./peer-questions";

type Theme = "academy" | "sprint" | "calm";
type View = "overview" | "outline" | "cards" | "bank" | "practice" | "mock";
type AnswerMode = "outline" | "standard" | "high";
type BankSource = "all" | "past" | "peer" | "chapter" | "practice" | "mock";
type BankType = "all" | "名词解释" | "简答题" | "论述题" | "写作题";
type BankSubject = "all" | "ancient" | "modern" | "comprehensive";

const views: { id: View; label: string; mark: string }[] = [
  { id: "overview", label: "今日总览", mark: "今" },
  { id: "outline", label: "知识框架", mark: "纲" },
  { id: "cards", label: "挖空背诵", mark: "背" },
  { id: "bank", label: "全部题库", mark: "题" },
  { id: "practice", label: "专项训练", mark: "练" },
  { id: "mock", label: "模拟考试", mark: "考" },
];

const themes: { id: Theme; label: string; dot: string }[] = [
  { id: "academy", label: "东方书院", dot: "朱" },
  { id: "sprint", label: "冲刺仪表盘", dot: "冲" },
  { id: "calm", label: "安静陪伴", dot: "静" },
];

const mockExamSections = [
  {
    type: "名词解释" as const,
    title: "一、名词解释（4×5分，共20分）",
    score: 5,
    items: ["建安风骨", "花间派", "问题小说", "九叶诗派"],
  },
  {
    type: "简答题" as const,
    title: "二、简答题（4×10分，共40分）",
    score: 10,
    items: [
      "简述《史记》人物传记的文学价值。",
      "简述辛词的艺术成就。",
      "简述老舍小说“京味”的构成。",
      "简述艾青诗歌的土地与太阳意象。",
    ],
  },
  {
    type: "论述题" as const,
    title: "三、论述题（2×15分，共30分）",
    score: 15,
    items: [
      "论述李白诗歌的主要艺术成就，并结合具体作品说明。",
      "结合《呐喊》《彷徨》论述鲁迅小说的启蒙主题与形式创造。",
    ],
  },
  {
    type: "写作题" as const,
    title: "四、写作题（2×30分，共60分）",
    score: 30,
    items: [
      "围绕“传统与现代的冲突”，写一篇不少于800字的文学评论。",
      "以“文学如何保存一个时代的情感经验”为题，写一篇不少于800字的文章。",
    ],
  },
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ClozeAnswer({
  card,
  hidden,
  revealed,
  onReveal,
}: {
  card: MemorizationCard;
  hidden: boolean;
  revealed: Set<string>;
  onReveal: (keyword: string) => void;
}) {
  const keywords = [...card.keywords].sort((a, b) => b.length - a.length);
  if (keywords.length === 0) {
    return <p className="answer-copy">{card.answer}</p>;
  }
  const pattern = new RegExp(`(${keywords.map(escapeRegExp).join("|")})`, "g");
  const parts = card.answer.split(pattern);

  return (
    <p className="answer-copy">
      {parts.map((part, index) => {
        const isKeyword = card.keywords.includes(part);
        if (!isKeyword) return <span key={`${part}-${index}`}>{part}</span>;
        const shouldHide = hidden && !revealed.has(part);
        return shouldHide ? (
          <button
            className="cloze-blank"
            key={`${part}-${index}`}
            onClick={() => onReveal(part)}
            aria-label={`显示关键词：${part}`}
            title="点击显示关键词"
          >
            {"＿".repeat(Math.min(6, Math.max(3, part.length)))}
          </button>
        ) : (
          <strong className="revealed-keyword" key={`${part}-${index}`}>
            {part}
          </strong>
        );
      })}
    </p>
  );
}

function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${secs}`;
}

function getTopicSummary(topic: string, chapterTitle: string) {
  if (/思想内容/.test(topic)) {
    return `从时代语境、核心主题、人物或意象三个层次概括，并用${topic.replace(
      /的思想内容/,
      "",
    )}中的具体情节或作品作证。`;
  }
  if (/艺术成就|艺术特色|艺术性|文学价值/.test(topic)) {
    return `重点整理结构与体式、人物或意象、语言风格、表现手法及文学史影响，答题时至少落下三个层次。`;
  }
  if (/生平|时代/.test(topic)) {
    return `只记与创作分期、思想转变和代表作品直接相关的生平节点，避免把一般人物履历当作文学史答案。`;
  }
  if (/诗派|词人|七子|四杰|左联|京派|海派|九叶|新月派|问题小说|人生派/.test(topic)) {
    return `按“形成时间与背景—代表作家—共同主张或风格—文学史意义”四格整理，并能举出至少一部代表作。`;
  }
  if (/《|》/.test(topic)) {
    return `围绕作品的写作背景、主题意蕴、核心人物或意象、结构语言和文学史地位建立一页式提要。`;
  }
  if (/诗歌|小说|散文|杂文|话剧|乐府|骈文|古文|词$/.test(topic)) {
    return `掌握代表作品、主要题材、核心审美特征和两种以上艺术手法，形成可以直接用于简答题的分点表达。`;
  }
  return `本知识点属于“${chapterTitle}”。复习时依次掌握概念或对象、代表材料、核心特征和文学史意义。`;
}

type CardPlacement = {
  subjectId: "ancient" | "modern";
  partTitle: string;
  chapterTitle: string;
  topic?: string;
  order: number;
};

const legacyCardPlacements: Record<string, CardPlacement> = {
  "shiji-value": {
    subjectId: "ancient",
    partTitle: "第一编 先秦两汉魏晋南北朝文学",
    chapterTitle: "第五章 汉代文学",
    topic: "《史记》人物传记的文学价值",
    order: 2,
  },
  "tao-poetry": {
    subjectId: "ancient",
    partTitle: "第一编 先秦两汉魏晋南北朝文学",
    chapterTitle: "第七章 陶渊明",
    topic: "陶渊明田园诗的思想内容与艺术特色",
    order: 2,
  },
  "libai-art": {
    subjectId: "ancient",
    partTitle: "第二编 唐五代、宋代文学",
    chapterTitle: "第三章 李白",
    topic: "李白诗歌的艺术成就",
    order: 3,
  },
  "dufu-art": {
    subjectId: "ancient",
    partTitle: "第二编 唐五代、宋代文学",
    chapterTitle: "第四章 杜甫",
    topic: "杜甫诗歌的艺术性",
    order: 3,
  },
  "ancient-prose": {
    subjectId: "ancient",
    partTitle: "第二编 唐五代、宋代文学",
    chapterTitle: "第七章 古文运动与韩柳散文",
    topic: "古文运动",
    order: 1,
  },
  "su-shi": {
    subjectId: "ancient",
    partTitle: "第二编 唐五代、宋代文学",
    chapterTitle: "第十一章 苏轼",
    topic: "苏轼的诗和词",
    order: 3,
  },
  hongloumeng: {
    subjectId: "ancient",
    partTitle: "第三编 元明清文学",
    chapterTitle: "第九章 《红楼梦》",
    topic: "《红楼梦》的艺术成就",
    order: 2,
  },
  "literary-revolution": {
    subjectId: "modern",
    partTitle: "第一编 第一个十年（1917—1927）",
    chapterTitle: "第一章 文学思潮与运动（一）",
    topic: "文学革命的发生与发展过程",
    order: 1,
  },
  "nahan-panghuang": {
    subjectId: "modern",
    partTitle: "第一编 第一个十年（1917—1927）",
    chapterTitle: "第二章 鲁迅（一）",
    topic: "小说集《呐喊》与《彷徨》",
    order: 1,
  },
  nvshen: {
    subjectId: "modern",
    partTitle: "第一编 第一个十年（1917—1927）",
    chapterTitle: "第五章 郭沫若",
    topic: "诗集《女神》",
    order: 1,
  },
  "laoshe-jingwei": {
    subjectId: "modern",
    partTitle: "第二编 第二个十年（1928—1937年6月）",
    chapterTitle: "第十一章 老舍",
    topic: "老舍小说中的“京味”",
    order: 3,
  },
  shencongwen: {
    subjectId: "modern",
    partTitle: "第二编 第二个十年（1928—1937年6月）",
    chapterTitle: "第十三章 沈从文",
    topic: "沈从文的湘西小说与都市小说",
    order: 1,
  },
  caoyu: {
    subjectId: "modern",
    partTitle: "第二编 第二个十年（1928—1937年6月）",
    chapterTitle: "第十九章 曹禺",
    topic: "曹禺的四大名剧：《雷雨》《日出》《原野》《北京人》",
    order: 1,
  },
  aiqing: {
    subjectId: "modern",
    partTitle: "第三编 第三个十年（1937年7月—1949年9月）",
    chapterTitle: "第二十五章 艾青",
    topic: "艾青诗歌的两大意象",
    order: 1,
  },
};

function normalizeCardText(value: string) {
  return value.replace(/[《》“”（）()、·：:，,\s]/g, "").toLowerCase();
}

function inferQuestionType(topic: string): MemorizationCard["type"] {
  if (/思想内容与艺术|艺术成就|文学理想|比较|意义|特质/.test(topic)) {
    return "论述题";
  }
  if (/运动|诗派|小说派|名称|体|左联|京派|海派/.test(topic)) {
    return "名词解释";
  }
  return "简答题";
}

function createFrameworkCard(
  subjectId: "ancient" | "modern",
  partTitle: string,
  chapterTitle: string,
  topic: string,
  chapterIndex: number,
  topicIndex: number,
): MemorizationCard {
  const type = inferQuestionType(topic);
  const isEssay = type === "论述题";
  const studyContent = buildFrameworkStudyCard(
    subjectId,
    partTitle,
    chapterTitle,
    topic,
    type,
  );
  return {
    id: `framework-${subjectId}-${chapterIndex}-${topicIndex}`,
    area: subjectId === "ancient" ? "古代文学" : "现代文学",
    subjectId,
    partTitle,
    chapterTitle,
    topic,
    order: topicIndex + 1,
    title: topic,
    type,
    ...studyContent,
    question:
      type === "名词解释"
        ? `名词解释：${topic}。`
        : `${isEssay ? "结合代表作品，论述" : "结合代表材料，简述"}${topic}。`,
  };
}

const placedCuratedCards = memorizationCards.map((card) => {
  const placement = legacyCardPlacements[card.id];
  if (!placement || card.id.startsWith("shijing-")) {
    return {
      ...placement,
      ...card,
    };
  }
  const enriched = buildFrameworkStudyCard(
    placement.subjectId,
    placement.partTitle,
    placement.chapterTitle,
    placement.topic!,
    card.type,
  );
  return {
    ...placement,
    ...card,
    ...enriched,
    title: card.title,
    question: card.question,
  };
});

const chapterCardGroups = syllabus.flatMap((subject) =>
  subject.parts.flatMap((part, partIndex) =>
    part.chapters.map((chapter, chapterIndex) => {
      const curated = placedCuratedCards
        .filter(
          (card) =>
            card.subjectId === subject.id &&
            card.partTitle === part.title &&
            card.chapterTitle === chapter.title,
        )
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      const generated = chapter.topics
        .map((topic, topicIndex) => {
          const normalizedTopic = normalizeCardText(topic);
          const alreadyCovered = curated.some((card) => {
            const normalizedCardTopic = normalizeCardText(card.topic ?? card.title);
            return (
              normalizedCardTopic.includes(normalizedTopic) ||
              normalizedTopic.includes(normalizedCardTopic)
            );
          });
          return alreadyCovered
            ? null
            : createFrameworkCard(
                subject.id,
                part.title,
                chapter.title,
                topic,
                partIndex * 100 + chapterIndex,
                topicIndex,
              );
        })
        .filter((card): card is MemorizationCard => card !== null);

      const cards = [...curated, ...generated].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0),
      );
      return {
        key: `${subject.id}|${part.title}|${chapter.title}`,
        subjectId: subject.id,
        subjectTitle: subject.title,
        partTitle: part.title,
        chapterTitle: chapter.title,
        cards,
      };
    }),
  ),
);

const allStudyCards = chapterCardGroups.flatMap((group) => group.cards);

type QuestionBankItem = {
  id: string;
  source: Exclude<BankSource, "all" | "past">;
  sourceLabel: string;
  subject: Exclude<BankSubject, "all">;
  type: Exclude<BankType, "all">;
  prompt: string;
  score: number;
  chapterTitle?: string;
  partTitle?: string;
  answer?: string;
  points?: string[];
  chapterKey?: string;
  cardId?: string;
  practiceIndex?: number;
  sourceUrl?: string;
  sourceKind?: string;
  sourceSchool?: string;
  sourceYear?: string;
};

const chapterQuestionBank: QuestionBankItem[] = chapterCardGroups.flatMap(
  (group) =>
    group.cards.map((card) => ({
      id: `bank-card-${card.id}`,
      source: "chapter",
      sourceLabel: "教材章节题",
      subject: group.subjectId,
      type: card.type,
      prompt: card.question,
      score: card.score ?? (card.type === "论述题" ? 15 : card.type === "名词解释" ? 5 : 10),
      chapterTitle: group.chapterTitle,
      partTitle: group.partTitle,
      answer: card.answer,
      points: card.points,
      chapterKey: group.key,
      cardId: card.id,
    })),
);

const practiceQuestionBank: QuestionBankItem[] = practiceQuestions.map(
  (question, index) => ({
    id: `bank-practice-${question.id}`,
    source: "practice",
    sourceLabel: "专项训练",
    subject: "comprehensive",
    type: question.type as QuestionBankItem["type"],
    prompt: question.prompt,
    score: question.score,
    points: question.points,
    practiceIndex: index,
  }),
);

const mockQuestionBank: QuestionBankItem[] = mockExamSections.flatMap(
  (section, sectionIndex) =>
    section.items.map((prompt, itemIndex) => ({
      id: `bank-mock-${sectionIndex}-${itemIndex}`,
      source: "mock",
      sourceLabel: "模拟卷（一）",
      subject: "comprehensive",
      type: section.type,
      prompt,
      score: section.score,
    })),
);

const peerQuestionBank: QuestionBankItem[] = peerQuestions.map((question) => ({
  id: `bank-peer-${question.id}`,
  source: "peer",
  sourceLabel: `${question.school}·${question.year}`,
  subject: question.subject,
  type: question.type,
  prompt: question.prompt,
  score: question.score,
  chapterTitle: question.chapterTitle,
  answer: question.answer,
  points: question.points,
  sourceUrl: question.sourceUrl,
  sourceKind: question.sourceKind,
  sourceSchool: question.school,
  sourceYear: question.year,
}));

const completeQuestionBank = [
  ...peerQuestionBank,
  ...chapterQuestionBank,
  ...practiceQuestionBank,
  ...mockQuestionBank,
];

const verifiedPastPaperRecords = [
  {
    year: "2016",
    title: "2016年湖北师范大学812文学综合考研真题",
    status: "已核到原卷档案，题面待核",
    source: "第三方真题档案",
    url: "https://www.kaoyany.top/tags-2590.html",
    note: "公开检索页能够确认该原卷档案存在，但完整题面需会员查看。为避免把模拟题冒充真题，本版暂不转写未核对题目。",
  },
];

const dailyChapterPool = (() => {
  const ancient = chapterCardGroups.filter((group) => group.subjectId === "ancient");
  const modern = chapterCardGroups.filter((group) => group.subjectId === "modern");
  return Array.from({ length: Math.max(ancient.length, modern.length) }).flatMap(
    (_, index) =>
      [ancient[index], modern[index]].filter(
        (group): group is (typeof chapterCardGroups)[number] => Boolean(group),
      ),
  );
})();

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDayOrdinal(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function formatDailyDate(dateKey: string) {
  const [, month, day] = dateKey.split("-").map(Number);
  return `${month}月${day}日`;
}

function buildDailyPlan(dateKey: string) {
  const ordinal = getDayOrdinal(dateKey);
  const group = dailyChapterPool[ordinal % dailyChapterPool.length];
  const card = group.cards[(ordinal * 7 + 3) % group.cards.length];
  return { group, card };
}

type CustomDailyTask = {
  id: string;
  text: string;
};

export default function Home() {
  const [theme, setTheme] = useState<Theme>("academy");
  const [view, setView] = useState<View>("overview");
  const [subjectId, setSubjectId] = useState<"ancient" | "modern">("ancient");
  const [search, setSearch] = useState("");
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [selectedChapterKey, setSelectedChapterKey] = useState(
    chapterCardGroups[0].key,
  );
  const [selectedCardId, setSelectedCardId] = useState(
    chapterCardGroups[0].cards[0].id,
  );
  const [answerMode, setAnswerMode] = useState<AnswerMode>("standard");
  const [clozeHidden, setClozeHidden] = useState(true);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [showPoints, setShowPoints] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [mockSeconds, setMockSeconds] = useState(180 * 60);
  const [mockRunning, setMockRunning] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(
    new Set(["ancient-0-0"]),
  );
  const [todayKey, setTodayKey] = useState(() => getLocalDateKey());
  const [dailyDone, setDailyDone] = useState<Record<string, boolean>>({});
  const [customDailyTasks, setCustomDailyTasks] = useState<CustomDailyTask[]>([]);
  const [hiddenDailyTaskIds, setHiddenDailyTaskIds] = useState<string[]>([]);
  const [newDailyTask, setNewDailyTask] = useState("");
  const [dailyReady, setDailyReady] = useState(false);
  const [bankSource, setBankSource] = useState<BankSource>("all");
  const [bankType, setBankType] = useState<BankType>("all");
  const [bankSubject, setBankSubject] = useState<BankSubject>("all");
  const [bankSearch, setBankSearch] = useState("");
  const [expandedBankItemId, setExpandedBankItemId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const savedTheme = localStorage.getItem("hs812-theme") as Theme | null;
    const savedCompleted = localStorage.getItem("hs812-completed");
    const savedDrafts = localStorage.getItem("hs812-drafts");
    if (savedTheme && themes.some((item) => item.id === savedTheme)) {
      setTheme(savedTheme);
    }
    if (savedCompleted) {
      try {
        setCompleted(new Set(JSON.parse(savedCompleted)));
      } catch {}
    }
    if (savedDrafts) {
      try {
        setDrafts(JSON.parse(savedDrafts));
      } catch {}
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("hs812-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("hs812-completed", JSON.stringify([...completed]));
  }, [completed]);

  useEffect(() => {
    localStorage.setItem("hs812-drafts", JSON.stringify(drafts));
  }, [drafts]);

  useEffect(() => {
    const refreshDate = () => setTodayKey(getLocalDateKey());
    const timer = window.setInterval(refreshDate, 60_000);
    window.addEventListener("focus", refreshDate);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshDate);
    };
  }, []);

  useEffect(() => {
    setDailyReady(false);
    const saved = localStorage.getItem(`hs812-daily-${todayKey}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setDailyDone(
            Object.fromEntries(
              parsed.map((value, index) => [
                `default-${index}`,
                Boolean(value),
              ]),
            ),
          );
          setCustomDailyTasks([]);
          setHiddenDailyTaskIds([]);
        } else {
          setDailyDone(parsed.done ?? {});
          setCustomDailyTasks(parsed.custom ?? []);
          setHiddenDailyTaskIds(parsed.hidden ?? []);
        }
      } catch {
        setDailyDone({});
        setCustomDailyTasks([]);
        setHiddenDailyTaskIds([]);
      }
    } else {
      setDailyDone({});
      setCustomDailyTasks([]);
      setHiddenDailyTaskIds([]);
    }
    setNewDailyTask("");
    setDailyReady(true);
  }, [todayKey]);

  useEffect(() => {
    if (!dailyReady) return;
    localStorage.setItem(
      `hs812-daily-${todayKey}`,
      JSON.stringify({
        done: dailyDone,
        custom: customDailyTasks,
        hidden: hiddenDailyTaskIds,
      }),
    );
  }, [
    customDailyTasks,
    dailyDone,
    dailyReady,
    hiddenDailyTaskIds,
    todayKey,
  ]);

  useEffect(() => {
    if (!mockRunning || mockSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setMockSeconds((value) => {
        if (value <= 1) {
          setMockRunning(false);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [mockRunning, mockSeconds]);

  const selectedSubject = syllabus.find((item) => item.id === subjectId)!;
  const dailyPlan = useMemo(() => buildDailyPlan(todayKey), [todayKey]);
  const dailyTasks = [
    {
      id: "default-0",
      title: "框架定位",
      detail: `${dailyPlan.group.subjectTitle} · ${dailyPlan.group.chapterTitle}`,
      action: "framework" as const,
    },
    {
      id: "default-1",
      title: "挖空背诵",
      detail: dailyPlan.card.title,
      action: "card" as const,
    },
    {
      id: "default-2",
      title: "限时输出",
      detail: `${dailyPlan.card.writingMinutes ?? 10}分钟完成一道${dailyPlan.card.type}`,
      action: "card" as const,
    },
    ...customDailyTasks.map((task) => ({
      id: task.id,
      title: task.text,
      detail: "今日自定义任务",
      action: "custom" as const,
    })),
  ].filter((task) => !hiddenDailyTaskIds.includes(task.id));
  const dailyCompletedCount = dailyTasks.filter(
    (task) => dailyDone[task.id],
  ).length;
  const selectedSubjectChapterCount = selectedSubject.parts.reduce(
    (total, part) => total + part.chapters.length,
    0,
  );
  const selectedSubjectTopicCount = selectedSubject.parts.reduce(
    (total, part) =>
      total +
      part.chapters.reduce(
        (chapterTotal, chapter) => chapterTotal + chapter.topics.length,
        0,
      ),
    0,
  );
  const selectedChapterGroup =
    chapterCardGroups.find((group) => group.key === selectedChapterKey) ??
    chapterCardGroups[0];
  const selectedCard =
    allStudyCards.find((item) => item.id === selectedCardId) ??
    selectedChapterGroup.cards[0];
  const selectedCardIndex = selectedChapterGroup.cards.findIndex(
    (card) => card.id === selectedCard.id,
  );
  const outlineAnswer =
    selectedCard.outlineAnswer ??
    selectedCard.points
      .map((point, index) => `${index + 1}. ${point}`)
      .join("\n");
  const highScoreAnswer =
    selectedCard.highScoreAnswer ??
    `${selectedCard.answer}\n\n【高分加写】答题时从“${
      selectedCard.examples?.join("、") || selectedCard.title
    }”中选择两至三处材料，分别嵌入对应分论点，补出“文本现象—表达作用—文学史意义”的证据链；结尾再加入一处同类作家或作品的简短比较。`;
  const activeAnswer =
    answerMode === "outline"
      ? outlineAnswer
      : answerMode === "high"
        ? highScoreAnswer
        : selectedCard.answer;
  const activeCard = {
    ...selectedCard,
    answer: activeAnswer,
    keywords: selectedCard.keywords.filter((keyword) =>
      activeAnswer.includes(keyword),
    ),
  };
  const practice = practiceQuestions[practiceIndex];
  const progress = Math.round((completed.size / totalTopicCount) * 100);

  const filteredParts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return selectedSubject.parts;
    return selectedSubject.parts
      .map((part) => ({
        ...part,
        chapters: part.chapters
          .map((chapter) => ({
            ...chapter,
            topics: chapter.topics.filter(
              (topic) =>
                topic.toLowerCase().includes(keyword) ||
                chapter.title.toLowerCase().includes(keyword) ||
                part.title.toLowerCase().includes(keyword),
            ),
          }))
          .filter((chapter) => chapter.topics.length > 0),
      }))
      .filter((part) => part.chapters.length > 0);
  }, [search, selectedSubject]);

  const filteredQuestionBank = useMemo(() => {
    const keyword = bankSearch.trim().toLowerCase();
    return completeQuestionBank.filter((item) => {
      if (bankSource !== "all" && item.source !== bankSource) return false;
      if (bankType !== "all" && item.type !== bankType) return false;
      if (bankSubject !== "all" && item.subject !== bankSubject) return false;
      if (
        keyword &&
        ![
          item.prompt,
          item.chapterTitle,
          item.partTitle,
          item.sourceLabel,
          item.type,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(keyword))
      ) {
        return false;
      }
      return true;
    });
  }, [bankSearch, bankSource, bankSubject, bankType]);

  function toggleComplete(id: string) {
    setCompleted((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function chooseCard(id: string) {
    setSelectedCardId(id);
    setAnswerMode("standard");
    setClozeHidden(true);
    setRevealed(new Set());
  }

  function openChapterCards(chapterKey: string, preferredCardId?: string) {
    const group =
      chapterCardGroups.find((item) => item.key === chapterKey) ??
      chapterCardGroups[0];
    setSelectedChapterKey(group.key);
    chooseCard(preferredCardId ?? group.cards[0].id);
    setView("cards");
  }

  function moveCard(direction: -1 | 1) {
    const nextIndex = selectedCardIndex + direction;
    const next = selectedChapterGroup.cards[nextIndex];
    if (next) chooseCard(next.id);
  }

  function revealKeyword(keyword: string) {
    setRevealed((current) => new Set([...current, keyword]));
  }

  function toggleDailyTask(id: string) {
    setDailyDone((current) => ({
      ...current,
      [id]: !current[id],
    }));
  }

  function addDailyTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = newDailyTask.trim();
    if (!text) return;
    setCustomDailyTasks((current) => [
      ...current,
      {
        id: `custom-${Date.now()}-${current.length}`,
        text: text.slice(0, 40),
      },
    ]);
    setNewDailyTask("");
  }

  function removeDailyTask(id: string) {
    if (id.startsWith("custom-")) {
      setCustomDailyTasks((current) =>
        current.filter((task) => task.id !== id),
      );
    } else {
      setHiddenDailyTaskIds((current) =>
        current.includes(id) ? current : [...current, id],
      );
    }
    setDailyDone((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function openDailyFramework() {
    const { group } = dailyPlan;
    setSubjectId(group.subjectId);
    setSearch("");
    setExpandedChapters((current) => {
      const next = new Set(current);
      next.add(
        `${group.subjectId}-${group.partTitle}-${group.chapterTitle}`,
      );
      return next;
    });
    setView("outline");
  }

  function openDailyCard() {
    openChapterCards(dailyPlan.group.key, dailyPlan.card.id);
  }

  function toggleChapter(id: string) {
    setExpandedChapters((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const visibleChapterIds = filteredParts.flatMap((part) =>
    part.chapters.map(
      (chapter) => `${subjectId}-${part.title}-${chapter.title}`,
    ),
  );
  const allVisibleExpanded =
    visibleChapterIds.length > 0 &&
    visibleChapterIds.every((id) => expandedChapters.has(id));

  function toggleAllVisibleChapters() {
    setExpandedChapters((current) => {
      const next = new Set(current);
      if (allVisibleExpanded) {
        visibleChapterIds.forEach((id) => next.delete(id));
      } else {
        visibleChapterIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  return (
    <main className="app-shell" data-theme={theme}>
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-seal">812</div>
          <div>
            <p className="eyebrow">湖北师范大学</p>
            <h1>湖师812</h1>
          </div>
        </div>

        <div className="program-tag">
          <span>045103</span>
          <strong>学科教学（语文）· 专硕</strong>
        </div>

        <nav className="main-nav" aria-label="主导航">
          {views.map((item) => (
            <button
              className={view === item.id ? "nav-item active" : "nav-item"}
              key={item.id}
              onClick={() => setView(item.id)}
            >
              <span className="nav-mark">{item.mark}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-progress">
          <div className="progress-heading">
            <span>总进度</span>
            <strong>{progress}%</strong>
          </div>
          <div className="progress-track">
            <span style={{ width: `${progress}%` }} />
          </div>
          <p>
            已掌握 {completed.size} / {totalTopicCount} 个教材与考纲知识点
          </p>
        </div>

        <a
          className="source-link"
          href="https://grad.hbnu.edu.cn/2026/0508/c1083a194155/page.htm"
          target="_blank"
          rel="noreferrer"
        >
          <span>依据</span>
          2026年5月更新稿
        </a>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">2027考研 · 812文学综合</p>
            <h2>
              {views.find((item) => item.id === view)?.label}
              <span className="edition-badge">9月待复核</span>
            </h2>
          </div>
          <div className="theme-switcher" aria-label="界面主题">
            {themes.map((item) => (
              <button
                key={item.id}
                className={theme === item.id ? "theme-button active" : "theme-button"}
                onClick={() => setTheme(item.id)}
                aria-pressed={theme === item.id}
              >
                <span>{item.dot}</span>
                {item.label}
              </button>
            ))}
          </div>
        </header>

        {view === "overview" && (
          <div className="page-content overview-grid">
            <section className="hero-panel">
              <div className="hero-copy">
                <p className="section-kicker">今天只推进一个闭环</p>
                <h3>读一章，背一题，写一道。</h3>
                <p>
                  完整框架负责不漏考点，挖空背诵负责把“看懂”变成“能写出来”。
                </p>
                <button className="primary-button" onClick={openDailyCard}>
                  开始今日背诵
                </button>
              </div>
              <div className="hero-stats">
                <div>
                  <strong>3</strong>
                  <span>今日任务</span>
                </div>
                <div>
                  <strong>{allStudyCards.length}</strong>
                  <span>章节知识卡</span>
                </div>
                <div>
                  <strong>180</strong>
                  <span>模拟分钟</span>
                </div>
              </div>
            </section>

            <section className="task-card">
              <div className="section-header">
                <div>
                  <p className="section-kicker">
                    {formatDailyDate(todayKey)} · 每日自动更新
                  </p>
                  <h3>从输入到输出</h3>
                </div>
                <span className="soft-pill">
                  {dailyCompletedCount} / {dailyTasks.length}
                </span>
              </div>
              {dailyTasks.map((task) => (
                <div
                  className={dailyDone[task.id] ? "daily-task done" : "daily-task"}
                  key={task.id}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(dailyDone[task.id])}
                    onChange={() => toggleDailyTask(task.id)}
                    aria-label={`标记完成：${task.title}`}
                  />
                  <button
                    className="daily-task-content"
                    onClick={
                      task.action === "framework"
                        ? openDailyFramework
                        : task.action === "card"
                          ? openDailyCard
                          : () => toggleDailyTask(task.id)
                    }
                  >
                    <strong>{task.title}</strong>
                    <span>{task.detail}</span>
                  </button>
                  {task.action !== "custom" && (
                    <button
                      className="daily-task-go"
                      onClick={
                        task.action === "framework"
                          ? openDailyFramework
                          : openDailyCard
                      }
                    >
                      去完成
                    </button>
                  )}
                  <button
                    className="daily-task-delete"
                    onClick={() => removeDailyTask(task.id)}
                    aria-label={`删除任务：${task.title}`}
                    title="删除今天的任务"
                  >
                    ×
                  </button>
                </div>
              ))}
              {dailyTasks.length === 0 && (
                <p className="daily-empty">今天暂时没有任务，可以在下面添加。</p>
              )}
              <form className="daily-task-add" onSubmit={addDailyTask}>
                <input
                  value={newDailyTask}
                  onChange={(event) => setNewDailyTask(event.target.value)}
                  maxLength={40}
                  placeholder="添加今天的自定义任务"
                  aria-label="新任务内容"
                />
                <button type="submit">添加</button>
              </form>
            </section>

            <section className="featured-card">
              <div className="section-header">
                <div>
                  <p className="section-kicker">今日背诵卡</p>
                  <h3>{dailyPlan.card.title}</h3>
                </div>
                <span className="score-stamp">{dailyPlan.card.score ?? 10}分</span>
              </div>
              <p className="featured-question">{dailyPlan.card.question}</p>
              <div className="keyword-preview">
                {dailyPlan.card.keywords.slice(0, 4).map((keyword) => (
                  <span key={keyword}>{keyword}</span>
                ))}
              </div>
              <button className="text-button" onClick={openDailyCard}>
                进入挖空模式 →
              </button>
            </section>

            <section className="exam-structure">
              <div className="section-header">
                <div>
                  <p className="section-kicker">官方试卷结构</p>
                  <h3>150分 · 180分钟</h3>
                </div>
              </div>
              <div className="exam-bars">
                {[
                  ["名词解释", 20, "13%"],
                  ["简答题", 40, "27%"],
                  ["论述题", 30, "20%"],
                  ["写作题", 60, "40%"],
                ].map(([label, score, width]) => (
                  <div className="exam-row" key={label}>
                    <span>{label}</span>
                    <div className="exam-track">
                      <i style={{ width: width as string }} />
                    </div>
                    <strong>{score}分</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="version-note">
              <span className="note-mark">校</span>
              <div>
                <strong>版本校准提醒</strong>
                <p>
                  当前内容依据学校2026年5月发布的更新稿。学校说明2027正式目录及大纲以2026年9月发布版本为准。
                </p>
              </div>
            </section>
          </div>
        )}

        {view === "outline" && (
          <div className="page-content">
            <section className="outline-toolbar">
              <div className="subject-tabs">
                {syllabus.map((subject) => (
                  <button
                    key={subject.id}
                    className={subjectId === subject.id ? "active" : ""}
                    onClick={() => setSubjectId(subject.id)}
                  >
                    {subject.title}
                  </button>
                ))}
              </div>
              <div className="outline-actions">
                <label className="search-box">
                  <span>检索</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="作家、作品、流派或知识点"
                  />
                </label>
                <button
                  className="expand-all-button"
                  onClick={toggleAllVisibleChapters}
                >
                  {allVisibleExpanded ? "收起全部" : "展开全部内容"}
                </button>
              </div>
            </section>

            <section className="book-banner">
              <div className="book-spine">书</div>
              <div>
                <p className="section-kicker">学校指定参考书</p>
                <h3>{selectedSubject.title}</h3>
                <p>{selectedSubject.book}</p>
                <div className="coverage-badges">
                  <span>{selectedSubjectChapterCount}章</span>
                  <span>{selectedSubjectTopicCount}个章目知识点</span>
                  {subjectId === "modern" && <strong>29章目录已完整建档</strong>}
                </div>
                {selectedSubject.sources && (
                  <div className="book-source-links">
                    {selectedSubject.sources.map((source) => (
                      <a
                        key={source.url}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {source.label} ↗
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="content-guide">
              <span>内容依据</span>
              <div>
                <p>
                  点击章节可直接进入本章顺序卡，也可先展开查看章目知识点。现代文学已按《中国现代文学三十年（修订本）》三编29章建立完整目录层；答案依据指定教材框架、学校考纲与代表作品重新编写，不复制教材原文。
                </p>
                <p className="source-disclosure">
                  题目标签说明：“教材章目转化”表示按教材标题生成的原创训练题，不冒充湖北师范大学历年真题；学校真题只有取得可核验原卷后才会单独标注。
                </p>
              </div>
            </section>

            <section className="outline-list">
              {filteredParts.length === 0 && (
                <div className="empty-state">没有找到相关知识点，换个关键词试试。</div>
              )}
              {filteredParts.map((part) => (
                <details className="part-block" key={part.title} open>
                  <summary>
                    <span>{part.title}</span>
                    <small>{part.chapters.length}章</small>
                  </summary>
                  <div className="chapter-grid">
                    {part.chapters.map((chapter) => {
                      const chapterId = `${subjectId}-${part.title}-${chapter.title}`;
                      const chapterGroupKey = `${subjectId}|${part.title}|${chapter.title}`;
                      const chapterGroup = chapterCardGroups.find(
                        (group) => group.key === chapterGroupKey,
                      )!;
                      const isExpanded =
                        expandedChapters.has(chapterId) || search.trim().length > 0;
                      return (
                        <section
                          className={isExpanded ? "chapter-card open" : "chapter-card"}
                          key={chapter.title}
                        >
                          <button
                            className="chapter-toggle"
                            onClick={() => openChapterCards(chapterGroupKey)}
                          >
                            <span>{chapter.title}</span>
                            <small>
                              进入本章 · {chapterGroup.cards.length}张卡
                              <i aria-hidden="true">→</i>
                            </small>
                          </button>
                          <button
                            className="chapter-expand-button"
                            onClick={() => toggleChapter(chapterId)}
                            aria-expanded={isExpanded}
                          >
                            {isExpanded
                              ? "收起知识点"
                              : `查看 ${chapter.topics.length} 个章目知识点`}
                            <i aria-hidden="true">⌄</i>
                          </button>
                          {isExpanded && (
                            <div className="topic-list">
                              {chapter.topics.map((topic) => {
                                const id = `${subjectId}-${part.title}-${chapter.title}-${topic}`;
                                const normalizedTopic = normalizeCardText(topic);
                                const relatedCard =
                                  chapterGroup.cards.find((card) => {
                                    const normalizedCardTopic = normalizeCardText(
                                      card.topic ?? card.title,
                                    );
                                    return (
                                      normalizedCardTopic.includes(normalizedTopic) ||
                                      normalizedTopic.includes(normalizedCardTopic)
                                    );
                                  }) ?? chapterGroup.cards[0];
                                return (
                                  <div
                                    className={
                                      completed.has(id)
                                        ? "topic-item complete"
                                        : "topic-item"
                                    }
                                    key={id}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={completed.has(id)}
                                      onChange={() => toggleComplete(id)}
                                      aria-label={`标记已掌握：${topic}`}
                                    />
                                    <div className="topic-content">
                                      <strong>{topic}</strong>
                                      <p>{getTopicSummary(topic, chapter.title)}</p>
                                      <button
                                        className="topic-card-link"
                                        onClick={() =>
                                          openChapterCards(
                                            chapterGroupKey,
                                            relatedCard.id,
                                          )
                                        }
                                      >
                                        查看本知识卡 · 可挖空 →
                                      </button>
                                    </div>
                                    <em>
                                      {completed.has(id) ? "已掌握" : "待学习"}
                                    </em>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>
                </details>
              ))}
            </section>
          </div>
        )}

        {view === "cards" && (
          <div className="page-content study-layout">
            <aside className="card-library">
              <div className="section-header">
                <div>
                  <p className="section-kicker">按教材章节连续背诵</p>
                  <h3>{selectedChapterGroup.chapterTitle}</h3>
                </div>
              </div>
              <label className="chapter-select">
                <span>切换章节</span>
                <select
                  value={selectedChapterGroup.key}
                  onChange={(event) => openChapterCards(event.target.value)}
                >
                  {chapterCardGroups.map((group) => (
                    <option key={group.key} value={group.key}>
                      {group.subjectTitle} · {group.chapterTitle}（{group.cards.length}张）
                    </option>
                  ))}
                </select>
              </label>
              <div className="card-filter-row">
                <span>{selectedChapterGroup.subjectTitle}</span>
                <span>{selectedChapterGroup.cards.length}张顺序卡</span>
              </div>
              <p className="chapter-part-label">{selectedChapterGroup.partTitle}</p>
              <div className="card-list">
                {selectedChapterGroup.cards.map((card, index) => (
                  <button
                    key={card.id}
                    className={selectedCard.id === card.id ? "card-list-item active" : "card-list-item"}
                    onClick={() => chooseCard(card.id)}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{card.title}</strong>
                      <small>
                        {card.type} · {card.points.length}个评分点 · 约
                        {card.estimatedWords ?? "—"}字
                      </small>
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            <section className="memorize-stage">
              <div className="memorize-heading">
                <div>
                  <p className="section-kicker">
                    {selectedChapterGroup.chapterTitle} · 第
                    {selectedCardIndex + 1}/{selectedChapterGroup.cards.length}张
                  </p>
                  <h3>{selectedCard.title}</h3>
                </div>
                <div className="cloze-actions">
                  <button
                    className={clozeHidden ? "secondary-button active" : "secondary-button"}
                    onClick={() => {
                      setClozeHidden(true);
                      setRevealed(new Set());
                    }}
                  >
                    一键挖空
                  </button>
                  <button
                    className={!clozeHidden ? "secondary-button active" : "secondary-button"}
                    onClick={() => setClozeHidden(false)}
                  >
                    显示全部
                  </button>
                </div>
              </div>

              <div className="question-paper">
                <div className="question-source-row">
                  <span className="paper-label">题目</span>
                  <span className="question-source-badge">
                    {selectedCard.sourceStatus
                      ? `${selectedCard.sourceStatus} · 原创训练题`
                      : "框架版 · 待教材逐条核校"}
                  </span>
                </div>
                <h4>{selectedCard.question}</h4>
                <div className="answer-metrics">
                  <span>{selectedCard.score ?? 10}分</span>
                  <span>约{selectedCard.estimatedWords ?? "—"}字</span>
                  <span>建议{selectedCard.writingMinutes ?? "—"}分钟</span>
                  <span>{selectedCard.points.length}个分论点</span>
                </div>
              </div>

              {selectedCard.sourceStatus && (
                <section className="card-source-trace" aria-label="教材出处">
                  <div className="card-source-status">
                    <span>据</span>
                    <div>
                      <strong>{selectedCard.sourceStatus}</strong>
                      <small>不是通用模板生成</small>
                    </div>
                  </div>
                  <div className="card-source-detail">
                    <p>{selectedCard.sourceEdition}</p>
                    <strong>{selectedCard.sourceLocation}</strong>
                    {selectedCard.sourcePages &&
                      selectedCard.sourcePages.length > 0 && (
                        <div>
                          {selectedCard.sourcePages.map((page) => (
                            <span key={page}>{page}</span>
                          ))}
                        </div>
                      )}
                    {selectedCard.sourceNote && (
                      <small>{selectedCard.sourceNote}</small>
                    )}
                  </div>
                </section>
              )}

              <div className="answer-mode-switch" role="group" aria-label="答案版本">
                {[
                  { id: "outline", label: "提纲版", note: "先记分点" },
                  { id: "standard", label: "标准版", note: "可直接背" },
                  { id: "high", label: "高分版", note: "加比较与评价" },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    className={answerMode === mode.id ? "active" : ""}
                    onClick={() => {
                      setAnswerMode(mode.id as AnswerMode);
                      setClozeHidden(mode.id !== "outline");
                      setRevealed(new Set());
                    }}
                  >
                    <strong>{mode.label}</strong>
                    <span>{mode.note}</span>
                  </button>
                ))}
              </div>

              <article className="answer-paper">
                <div className="answer-instruction">
                  <span className="paper-label">
                    {answerMode === "outline"
                      ? "评分提纲"
                      : answerMode === "high"
                        ? "高分扩展"
                        : "可直接背诵"}
                  </span>
                  <p>
                    {answerMode === "outline"
                      ? "先按顺序复述分论点，再切换标准版补充解释和例证。"
                      : clozeHidden
                        ? "点击横线逐个显现；恢复后的关键词会标红加粗。"
                        : "答案已完整显示，关键词已标红加粗。"}
                  </p>
                </div>
                <ClozeAnswer
                  card={activeCard}
                  hidden={clozeHidden}
                  revealed={revealed}
                  onReveal={revealKeyword}
                />
              </article>

              {selectedCard.examples && selectedCard.examples.length > 0 && (
                <section className="example-bank">
                  <div>
                    <p className="section-kicker">作品例证</p>
                    <h4>每个分论点都要落到具体材料</h4>
                  </div>
                  <div className="example-list">
                    {selectedCard.examples.map((example) => (
                      <span key={example}>{example}</span>
                    ))}
                  </div>
                </section>
              )}

              <section className="scoring-points">
                <div className="section-header">
                  <div>
                    <p className="section-kicker">阅卷抓手</p>
                    <h4>答题时必须落下的评分词</h4>
                  </div>
                </div>
                <div className="point-grid">
                  {selectedCard.points.map((point, index) => (
                    <div key={point}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      {point}
                    </div>
                  ))}
                </div>
              </section>

              <nav className="card-sequence-nav" aria-label="章节卡片顺序">
                <button
                  className="secondary-button"
                  onClick={() => moveCard(-1)}
                  disabled={selectedCardIndex <= 0}
                >
                  ← 上一张
                </button>
                <span>
                  本章 {selectedCardIndex + 1} / {selectedChapterGroup.cards.length}
                </span>
                <button
                  className="primary-button"
                  onClick={() => moveCard(1)}
                  disabled={
                    selectedCardIndex >= selectedChapterGroup.cards.length - 1
                  }
                >
                  下一张 →
                </button>
              </nav>
            </section>
          </div>
        )}

        {view === "bank" && (
          <div className="page-content bank-layout">
            <section className="bank-hero">
              <div>
                <p className="section-kicker">真题档案 + 全章节训练</p>
                <h3>812文学综合全部题库</h3>
                <p>
                  一页查看湖师真题档案、近年同范围真题、教材章节题、专项训练和整卷模拟。
                  每道外校题都标明学校、年份及来源性质，不会冒充湖北师大真题。
                </p>
              </div>
              <div className="bank-stat-grid">
                <button onClick={() => setBankSource("past")}>
                  <strong>{verifiedPastPaperRecords.length}</strong>
                  <span>套真题档案</span>
                </button>
                <button onClick={() => setBankSource("peer")}>
                  <strong>{peerQuestionBank.length}</strong>
                  <span>道近年真题</span>
                </button>
                <button onClick={() => setBankSource("chapter")}>
                  <strong>{chapterQuestionBank.length}</strong>
                  <span>道章节题</span>
                </button>
                <button onClick={() => setBankSource("practice")}>
                  <strong>{practiceQuestionBank.length}</strong>
                  <span>道专项题</span>
                </button>
                <button onClick={() => setBankSource("mock")}>
                  <strong>{mockQuestionBank.length}</strong>
                  <span>道模拟题</span>
                </button>
              </div>
            </section>

            <section className="bank-source-note">
              <div>
                <span className="verified-dot">已核</span>
                <div>
                  <strong>官方题型结构</strong>
                  <p>
                    150分、180分钟：名词解释4题、简答4题、论述2题、写作2题。
                  </p>
                </div>
              </div>
              <div className="bank-source-links">
                <a
                  href="https://grad.hbnu.edu.cn/_upload/article/files/66/9f/bd17e5af403696eec61158738a78/d21181c7-40a1-49e6-bb44-a780336ac94c.pdf"
                  target="_blank"
                  rel="noreferrer"
                >
                  查看官方考试大纲
                </a>
                <a
                  href="https://grad.hbnu.edu.cn/2025/0322/c1082a175203/page.htm"
                  target="_blank"
                  rel="noreferrer"
                >
                  查看学校招生页面
                </a>
              </div>
            </section>

            <section className="bank-toolbar">
              <label className="bank-search">
                <span>检索</span>
                <input
                  value={bankSearch}
                  onChange={(event) => setBankSearch(event.target.value)}
                  placeholder="搜索作家、作品、流派、章节或题目"
                />
              </label>
              <div className="bank-filter-group">
                <span>来源</span>
                <div>
                  {[
                    ["all", "全部"],
                    ["past", "湖师真题"],
                    ["peer", "近年同范围真题"],
                    ["chapter", "教材章节题"],
                    ["practice", "专项训练"],
                    ["mock", "模拟题"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      className={bankSource === id ? "active" : ""}
                      onClick={() => setBankSource(id as BankSource)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bank-filter-group">
                <span>题型</span>
                <div>
                  {["all", "名词解释", "简答题", "论述题", "写作题"].map(
                    (type) => (
                      <button
                        key={type}
                        className={bankType === type ? "active" : ""}
                        onClick={() => setBankType(type as BankType)}
                      >
                        {type === "all" ? "全部题型" : type}
                      </button>
                    ),
                  )}
                </div>
              </div>
              <div className="bank-filter-group">
                <span>范围</span>
                <div>
                  {[
                    ["all", "全部范围"],
                    ["ancient", "中国古代文学"],
                    ["modern", "中国现代文学"],
                    ["comprehensive", "综合与写作"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      className={bankSubject === id ? "active" : ""}
                      onClick={() => setBankSubject(id as BankSubject)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {(bankSource === "all" || bankSource === "past") && (
              <section className="past-paper-panel">
                <div className="section-header">
                  <div>
                    <p className="section-kicker">湖师真题原卷档案</p>
                    <h3>已核来源，不编题面</h3>
                  </div>
                  <span className="soft-pill">
                    {verifiedPastPaperRecords.length}套
                  </span>
                </div>
                {verifiedPastPaperRecords.map((paper) => (
                  <article className="past-paper-card" key={paper.year}>
                    <div className="past-year">{paper.year}</div>
                    <div>
                      <div className="past-paper-meta">
                        <span>湖师812真题</span>
                        <em>{paper.status}</em>
                      </div>
                      <h4>{paper.title}</h4>
                      <p>{paper.note}</p>
                      <small>来源：{paper.source}</small>
                    </div>
                    <a href={paper.url} target="_blank" rel="noreferrer">
                      核对原卷档案
                    </a>
                  </article>
                ))}
                <p className="past-paper-tip">
                  客户如有购买的原卷、截图或回忆版，请发给我；核对后会按年份、题型逐题录入，
                  并给每题补上对应教材章节和详细答案。
                </p>
              </section>
            )}

            {bankSource !== "past" && (
              <section className="bank-results">
                <div className="section-header">
                  <div>
                    <p className="section-kicker">可直接练习</p>
                    <h3>当前筛选共 {filteredQuestionBank.length} 道</h3>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setBankSearch("");
                      setBankSource("all");
                      setBankType("all");
                      setBankSubject("all");
                    }}
                  >
                    清除筛选
                  </button>
                </div>
                <div className="bank-question-list">
                  {filteredQuestionBank.map((item, index) => {
                    const expanded = expandedBankItemId === item.id;
                    return (
                      <article className="bank-question-card" key={item.id}>
                        <div className="bank-question-number">
                          {String(index + 1).padStart(3, "0")}
                        </div>
                        <div className="bank-question-main">
                          <div className="bank-question-tags">
                            <span>{item.sourceLabel}</span>
                            {item.sourceKind && (
                              <span className="source-kind-tag">{item.sourceKind}</span>
                            )}
                            <span>{item.type}</span>
                            <span>{item.score}分</span>
                            {item.subject !== "comprehensive" && (
                              <span>
                                {item.subject === "ancient"
                                  ? "中国古代文学"
                                  : "中国现代文学"}
                              </span>
                            )}
                          </div>
                          <h4>{item.prompt}</h4>
                          {item.chapterTitle && (
                            <p className="bank-question-location">
                              {item.chapterTitle}
                              {item.partTitle ? ` · ${item.partTitle}` : ""}
                            </p>
                          )}
                          {expanded && (
                            <div className="bank-answer-preview">
                              {item.answer && <p>{item.answer}</p>}
                              {item.points && item.points.length > 0 && (
                                <ol>
                                  {item.points.map((point) => (
                                    <li key={point}>{point}</li>
                                  ))}
                                </ol>
                              )}
                              {item.sourceUrl && (
                                <p className="bank-source-trace">
                                  来源说明：本题选自
                                  {item.sourceYear}年{item.sourceSchool}
                                  {item.sourceKind === "官方原卷"
                                    ? "公开发布的官方试卷"
                                    : "公开发布的考后回忆版"}
                                  ，仅用于按湖师812范围训练。
                                  <a
                                    href={item.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    核对来源
                                  </a>
                                </p>
                              )}
                              {!item.answer && !item.points && (
                                <p>本题请进入模拟卷，在180分钟计时下独立完成。</p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="bank-question-actions">
                          <button
                            className="secondary-button"
                            onClick={() =>
                              setExpandedBankItemId(expanded ? null : item.id)
                            }
                          >
                            {expanded ? "收起" : "看答案"}
                          </button>
                          {item.source === "chapter" && (
                            <button
                              className="primary-button"
                              onClick={() =>
                                openChapterCards(item.chapterKey!, item.cardId)
                              }
                            >
                              进入背诵卡
                            </button>
                          )}
                          {item.source === "practice" && (
                            <button
                              className="primary-button"
                              onClick={() => {
                                setPracticeIndex(item.practiceIndex ?? 0);
                                setShowPoints(false);
                                setView("practice");
                              }}
                            >
                              去作答
                            </button>
                          )}
                          {item.source === "mock" && (
                            <button
                              className="primary-button"
                              onClick={() => setView("mock")}
                            >
                              去模拟卷
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
                {filteredQuestionBank.length === 0 && (
                  <p className="empty-state">没有符合当前筛选条件的题目。</p>
                )}
              </section>
            )}
          </div>
        )}

        {view === "practice" && (
          <div className="page-content practice-layout">
            <section className="question-rail">
              <p className="section-kicker">题型专项</p>
              <h3>先写，再对照评分点</h3>
              <div className="question-index">
                {practiceQuestions.map((question, index) => (
                  <button
                    key={question.id}
                    className={practiceIndex === index ? "active" : ""}
                    onClick={() => {
                      setPracticeIndex(index);
                      setShowPoints(false);
                    }}
                  >
                    <span>{index + 1}</span>
                    <div>
                      <strong>{question.type}</strong>
                      <small>{question.score}分</small>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="writing-desk">
              <div className="writing-meta">
                <span>{practice.type}</span>
                <strong>{practice.score}分</strong>
              </div>
              <h3>{practice.prompt}</h3>
              <label className="answer-editor">
                <span>你的答案</span>
                <textarea
                  value={drafts[practice.id] ?? ""}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [practice.id]: event.target.value,
                    }))
                  }
                  placeholder="按“总—分—总”组织答案，先写结论句，再展开要点……"
                />
                <small>
                  {(drafts[practice.id] ?? "").length} 字 · 草稿自动保存在本设备
                </small>
              </label>
              <div className="writing-actions">
                <button
                  className="primary-button"
                  onClick={() => setShowPoints((value) => !value)}
                >
                  {showPoints ? "收起评分点" : "完成并对照评分点"}
                </button>
                <button
                  className="secondary-button"
                  onClick={() =>
                    setDrafts((current) => ({ ...current, [practice.id]: "" }))
                  }
                >
                  清空重写
                </button>
              </div>

              {showPoints && (
                <div className="rubric-panel">
                  <p className="section-kicker">自评清单</p>
                  <h4>命中一个，再给自己打一勾</h4>
                  {practice.points.map((point) => (
                    <label key={point}>
                      <input type="checkbox" />
                      <span>{point}</span>
                    </label>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {view === "mock" && (
          <div className="page-content mock-layout">
            <section className="mock-header">
              <div>
                <p className="section-kicker">整卷模拟 · 150分</p>
                <h3>812文学综合模拟训练（一）</h3>
                <p>严格按官方题型结构组卷。写作题只给题面，不用选择题稀释训练。</p>
              </div>
              <div className="timer-box">
                <span>剩余时间</span>
                <strong>{formatTime(mockSeconds)}</strong>
                <div>
                  <button
                    className="primary-button"
                    onClick={() => setMockRunning((value) => !value)}
                  >
                    {mockRunning ? "暂停" : mockSeconds === 180 * 60 ? "开始计时" : "继续"}
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setMockRunning(false);
                      setMockSeconds(180 * 60);
                    }}
                  >
                    重置
                  </button>
                </div>
              </div>
            </section>

            <section className="mock-paper">
              {mockExamSections.map((section) => (
                <div className="mock-section" key={section.title}>
                  <h4>{section.title}</h4>
                  <ol>
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
