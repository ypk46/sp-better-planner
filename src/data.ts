import type { PluginAppState, Project, Tag, Task } from '@super-productivity/plugin-api';
import { msToMinutes, toDayKey } from './dateUtils';
import { reconcileOrder } from './persistence';

const TODAY_TAG_ID = 'TODAY';

export interface PlannerData {
  allTasks: Task[];
  projectsById: Map<string, Project>;
  tagsById: Map<string, Tag>;
  todayTagTaskIds: Set<string>;
  /** Live order of the TODAY tag's taskIds, as stored by the host (source of truth for today's manual order). */
  todayTagOrder: string[];
  /** Non-done tasks whose assigned day is strictly before today. */
  overdue: Task[];
  /** Non-done tasks with no dueDay, no dueWithTime, and not in the TODAY tag. */
  unplanned: Task[];
}

export interface DayBucket {
  dayKey: string;
  date: Date;
  /** Has dueWithTime falling on this day, sorted by time. */
  scheduled: Task[];
  /** Belongs to this day (dueDay match, or TODAY-tag membership for today) but has no time yet. */
  unscheduled: Task[];
}

const taskDayKey = (task: Task): string | null => {
  if (task.dueWithTime != null) return toDayKey(new Date(task.dueWithTime));
  if (task.dueDay) return task.dueDay;
  return null;
};

export const buildPlannerData = (appState: PluginAppState, todayKey: string): PlannerData => {
  const allTasks = Object.values(appState.tasks);
  const projectsById = new Map(Object.values(appState.projects).map((p) => [p.id, p]));
  const tagsById = new Map(Object.values(appState.tags).map((t) => [t.id, t]));
  const todayTag = tagsById.get(TODAY_TAG_ID);
  const todayTagOrder = todayTag?.taskIds ?? [];
  const todayTagTaskIds = new Set(todayTagOrder);

  const overdue: Task[] = [];
  const unplanned: Task[] = [];

  for (const task of allTasks) {
    if (task.isDone) continue;
    const dayKey = taskDayKey(task);
    if (dayKey) {
      if (dayKey < todayKey) overdue.push(task);
      continue;
    }
    if (todayTagTaskIds.has(task.id)) continue;
    unplanned.push(task);
  }

  return { allTasks, projectsById, tagsById, todayTagTaskIds, todayTagOrder, overdue, unplanned };
};

export const getDayBucket = (
  data: PlannerData,
  date: Date,
  todayKey: string,
  persistedOrder: string[] | undefined,
): DayBucket => {
  const dayKey = toDayKey(date);
  const isToday = dayKey === todayKey;
  const scheduled: Task[] = [];
  const unscheduled: Task[] = [];

  for (const task of data.allTasks) {
    if (task.dueWithTime != null) {
      if (toDayKey(new Date(task.dueWithTime)) === dayKey) scheduled.push(task);
      continue;
    }
    if (task.dueDay === dayKey) {
      unscheduled.push(task);
      continue;
    }
    if (!task.dueDay && isToday && data.todayTagTaskIds.has(task.id)) {
      unscheduled.push(task);
    }
  }

  scheduled.sort((a, b) => (a.dueWithTime ?? 0) - (b.dueWithTime ?? 0));

  const order = reconcileOrder(
    persistedOrder,
    unscheduled.map((t) => t.id),
  );
  const orderIndex = new Map(order.map((id, i) => [id, i]));
  unscheduled.sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0));

  return { dayKey, date, scheduled, unscheduled };
};

export const WORKDAY_MINUTES = 8 * 60;

export const getPlannedMinutes = (bucket: DayBucket): number =>
  [...bucket.scheduled, ...bucket.unscheduled].reduce(
    (sum, t) => sum + msToMinutes(t.timeEstimate),
    0,
  );
