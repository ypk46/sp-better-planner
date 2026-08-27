import { el } from '../dom';
import { addDays, formatDuration, formatMonthDay, formatWeekday, toDayKey } from '../dateUtils';
import {
  getDayBucket,
  getPlannedMinutes,
  WORKDAY_MINUTES,
  type DayBucket,
  type PlannerData,
} from '../data';
import type { BetterPlannerLocalState } from '../persistence';
import { attachDayDropZone } from '../dnd';
import { renderAddTaskRow } from './addTaskInput';
import type { ChipInputValue } from './chipInput';
import { renderTaskRow, type TaskRowCallbacks } from './taskRow';

export interface DayColumnCallbacks extends TaskRowCallbacks {
  onAddTask: (dayKey: string, input: ChipInputValue) => void;
  onDropOnDay: (taskId: string, dayKey: string, beforeTaskId: string | null) => void;
}

const renderDayHeader = (bucket: DayBucket, todayKey: string): HTMLElement => {
  const titleParts: (HTMLElement | string)[] = [
    el('span', { className: 'bp-day-weekday', text: formatWeekday(bucket.date) }),
    el('span', { className: 'bp-day-date', text: formatMonthDay(bucket.date) }),
  ];
  if (bucket.dayKey === todayKey) {
    titleParts.push(el('span', { className: 'bp-today-pill', text: 'Today' }));
  }

  const planned = getPlannedMinutes(bucket);
  const summary = el('div', { className: 'bp-day-summary' }, [
    el('span', { text: `${formatDuration(planned)} planned` }),
    el('span', {
      className: 'bp-day-summary-muted',
      text: `/ ${formatDuration(WORKDAY_MINUTES)} available`,
    }),
  ]);

  return el('div', { className: 'bp-day-header' }, [
    el('div', { className: 'bp-day-title-row' }, titleParts),
    summary,
  ]);
};

export const renderDayColumn = (
  bucket: DayBucket,
  todayKey: string,
  data: PlannerData,
  currentTaskId: string | null,
  editingTaskId: string | null,
  callbacks: DayColumnCallbacks,
): HTMLElement => {
  const tasks = [...bucket.scheduled, ...bucket.unscheduled];
  const rows = tasks.map((task) =>
    renderTaskRow(task, data, currentTaskId, editingTaskId, callbacks),
  );
  const listChildren: HTMLElement[] = rows.length
    ? rows
    : [el('div', { className: 'bp-empty-drop', text: 'Drop a task here' })];
  listChildren.push(
    renderAddTaskRow('Add task', data, (input) => callbacks.onAddTask(bucket.dayKey, input)),
  );

  const listEl = el('div', { className: 'bp-day-task-list' }, listChildren);
  attachDayDropZone(listEl, bucket.dayKey, callbacks.onDropOnDay);

  return el('div', { className: 'bp-day-column' }, [renderDayHeader(bucket, todayKey), listEl]);
};

export const renderThreeDayView = (
  anchorDate: Date,
  todayKey: string,
  data: PlannerData,
  localState: BetterPlannerLocalState,
  currentTaskId: string | null,
  editingTaskId: string | null,
  callbacks: DayColumnCallbacks,
): HTMLElement => {
  const columns = [0, 1, 2].map((offset) => {
    const date = addDays(anchorDate, offset);
    const dayKey = toDayKey(date);
    const persistedOrder = dayKey === todayKey ? data.todayTagOrder : localState.dayOrder[dayKey];
    const bucket = getDayBucket(data, date, todayKey, persistedOrder);
    return renderDayColumn(bucket, todayKey, data, currentTaskId, editingTaskId, callbacks);
  });
  return el('div', { className: 'bp-day-columns' }, columns);
};
