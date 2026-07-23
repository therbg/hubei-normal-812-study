"use client";

import { useEffect, useMemo, useState } from "react";
import {
  memorizationCards,
  practiceQuestions,
  syllabus,
  totalTopicCount,
  type MemorizationCard,
} from "./data";
import { buildFrameworkStudyCard } from "./study-profiles";

type Theme = "academy" | "sprint" | "calm";
type View = "overview" | "outline" | "cards" | "practice" | "mock";
type AnswerMode = "outline" | "standard" | "high";

const views: { id: View; label: string; mark: string }[] = [
  { id: "overview", label: "今日总览", mark: "今" },
  { id: "outline", label: "知识框架", mark: "纲" },
  { id: "cards", label: "挖空背诵", mark: "背" },
  { id: "practice", label: "专项训练", mark: "练" },
  { id: "mock", label: "模拟考试", mark: "考" },
];

const themes: { id: Theme; label: string; dot: string }[] = [
  { id: "academy", label: "东方书院", dot: "朱" },
  { id: "sprint", label: "冲刺仪表盘", dot: "冲" },
  { id: "calm", label: "安静陪伴", dot: "静" },
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
    placement.topic,
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
            已掌握 {completed.size} / {totalTopicCount} 个大纲知识点
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
                <button className="primary-button" onClick={() => setView("cards")}>
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
                  <p className="section-kicker">今日任务</p>
                  <h3>从输入到输出</h3>
                </div>
                <span className="soft-pill">1 / 3</span>
              </div>
              <label className="daily-task done">
                <input type="checkbox" defaultChecked />
                <span>
                  <strong>框架定位</strong>
                  先秦文学 · 《诗经》
                </span>
              </label>
              <label className="daily-task">
                <input type="checkbox" />
                <span>
                  <strong>挖空背诵</strong>
                  《诗经》的艺术成就
                </span>
              </label>
              <label className="daily-task">
                <input type="checkbox" />
                <span>
                  <strong>限时输出</strong>
                  10分钟完成一道简答
                </span>
              </label>
            </section>

            <section className="featured-card">
              <div className="section-header">
                <div>
                  <p className="section-kicker">今日背诵卡</p>
                  <h3>{allStudyCards[0].title}</h3>
                </div>
                <span className="score-stamp">10分</span>
              </div>
              <p className="featured-question">{allStudyCards[0].question}</p>
              <div className="keyword-preview">
                {allStudyCards[0].keywords.slice(0, 4).map((keyword) => (
                  <span key={keyword}>{keyword}</span>
                ))}
              </div>
              <button className="text-button" onClick={() => setView("cards")}>
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
                <p className="section-kicker">官方对口书目</p>
                <h3>{selectedSubject.title}</h3>
                <p>{selectedSubject.book}</p>
              </div>
            </section>

            <section className="content-guide">
              <span>怎么看内容</span>
              <p>
                点击下面任一章节即可展开知识点与复习提要；标有“完整背诵卡”的知识点可以直接进入挖空背诵。这里提供的是依据考纲整理的原创备考内容，不复制整本教材原文。
              </p>
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
                              : `查看 ${chapter.topics.length} 个大纲知识点`}
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
                <span className="paper-label">题目</span>
                <h4>{selectedCard.question}</h4>
                <div className="answer-metrics">
                  <span>{selectedCard.score ?? 10}分</span>
                  <span>约{selectedCard.estimatedWords ?? "—"}字</span>
                  <span>建议{selectedCard.writingMinutes ?? "—"}分钟</span>
                  <span>{selectedCard.points.length}个分论点</span>
                </div>
              </div>

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
              {[
                {
                  title: "一、名词解释（4×5分，共20分）",
                  items: ["建安风骨", "花间派", "问题小说", "九叶诗派"],
                },
                {
                  title: "二、简答题（4×10分，共40分）",
                  items: [
                    "简述《史记》人物传记的文学价值。",
                    "简述辛词的艺术成就。",
                    "简述老舍小说“京味”的构成。",
                    "简述艾青诗歌的土地与太阳意象。",
                  ],
                },
                {
                  title: "三、论述题（2×15分，共30分）",
                  items: [
                    "论述李白诗歌的主要艺术成就，并结合具体作品说明。",
                    "结合《呐喊》《彷徨》论述鲁迅小说的启蒙主题与形式创造。",
                  ],
                },
                {
                  title: "四、写作题（2×30分，共60分）",
                  items: [
                    "围绕“传统与现代的冲突”，写一篇不少于800字的文学评论。",
                    "以“文学如何保存一个时代的情感经验”为题，写一篇不少于800字的文章。",
                  ],
                },
              ].map((section) => (
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
