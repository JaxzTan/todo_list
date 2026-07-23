"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Locale = "en" | "zh";

const DICT = {
  en: {
    appName: "Exec Board",
    loginTitle: "Sign in",
    loginSub: "Paste your personal access token to continue.",
    loginPlaceholder: "ebpat_...",
    signIn: "Sign in",
    signOut: "Sign out",
    loginError: "That token wasn't accepted.",
    boardsTitle: "Boards",
    newBoard: "New board",
    noBoards: "No boards yet — create one to get started.",
    tabBoard: "3-layer board",
    tabMatrix: "4-quadrant plan",
    goal: "Goal",
    sessions: "Sessions",
    nextAction: "Next action",
    boardComplete: "board complete",
    blockers: "Blockers",
    waitingOn: "Waiting on",
    notes: "Notes",
    scopeChanges: "Scope changes",
    addStep: "Add step",
    addGroup: "Add phase",
    reason: "Reason",
    reasonPlaceholder: "why? (required)",
    cancel: "Cancel",
    save: "Save",
    due: "Due",
    prio: "Priority",
    owner: "Owner",
    status_todo: "Todo",
    status_doing: "Doing",
    status_stuck: "Stuck",
    status_done: "Done",
    status_skipped: "Skipped",
    matrixTitle: "4-quadrant plan",
    matrixDesc: "The Eisenhower matrix — categorize each task by importance and urgency, then act by quadrant. Click a task to move it to the next quadrant.",
    quadrant_do_now: "Do now",
    quadrant_do_now_hint: "urgent + important",
    quadrant_schedule: "Schedule",
    quadrant_schedule_hint: "important, not urgent",
    quadrant_delegate: "Delegate",
    quadrant_delegate_hint: "urgent, not important",
    quadrant_drop: "Drop",
    quadrant_drop_hint: "neither — eliminate",
    unplaced: "Unplaced",
    downloadReport: "Download report",
    downloadMarkdown: "Download markdown",
    theme: "Theme",
  },
  zh: {
    appName: "Exec Board",
    loginTitle: "登录",
    loginSub: "粘贴你的个人访问令牌以继续。",
    loginPlaceholder: "ebpat_...",
    signIn: "登录",
    signOut: "退出登录",
    loginError: "该令牌无效。",
    boardsTitle: "看板",
    newBoard: "新建看板",
    noBoards: "还没有看板 — 创建一个开始吧。",
    tabBoard: "三层看板",
    tabMatrix: "四象限计划",
    goal: "目标",
    sessions: "会话数",
    nextAction: "下一步",
    boardComplete: "看板已完成",
    blockers: "阻塞项",
    waitingOn: "等待中",
    notes: "笔记",
    scopeChanges: "范围变更",
    addStep: "添加步骤",
    addGroup: "添加阶段",
    reason: "原因",
    reasonPlaceholder: "为什么？（必填）",
    cancel: "取消",
    save: "保存",
    due: "截止日期",
    prio: "优先级",
    owner: "负责人",
    status_todo: "待办",
    status_doing: "进行中",
    status_stuck: "受阻",
    status_done: "已完成",
    status_skipped: "已跳过",
    matrixTitle: "四象限计划",
    matrixDesc: "艾森豪威尔矩阵 —— 把每个任务按重要性与紧急程度分类，再按象限行动。点击任务可移到下一象限。",
    quadrant_do_now: "立即做",
    quadrant_do_now_hint: "紧急 + 重要",
    quadrant_schedule: "计划做",
    quadrant_schedule_hint: "重要，不紧急",
    quadrant_delegate: "委托",
    quadrant_delegate_hint: "紧急，不重要",
    quadrant_drop: "放弃",
    quadrant_drop_hint: "都不是 —— 消除",
    unplaced: "未分类",
    downloadReport: "下载报告",
    downloadMarkdown: "下载 Markdown",
    theme: "主题",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export type DictKey = keyof (typeof DICT)["en"];

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: DictKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);
const STORAGE_KEY = "exec-board:locale";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    // localStorage doesn't exist during SSR — "en" is the correct default
    // for that render, and this brings the real stored preference in once
    // mounted client-side. See the matching comment in theme.tsx.
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === "en" || stored === "zh") setLocaleState(stored);
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    window.localStorage.setItem(STORAGE_KEY, l);
  };

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t: (key) => DICT[locale][key] }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
