import type { Task } from '@super-productivity/plugin-api';
import { el } from '../dom';
import { formatMonthDay } from '../dateUtils';
import type { PlannerData } from '../data';
import { attachUnplanDropZone } from '../dnd';
import { renderAddTaskRow, renderTaskRow, type TaskRowCallbacks } from './taskRow';

export interface RailCallbacks extends TaskRowCallbacks {
  onAddTask: (title: string) => void;
  onDropToUnplan: (taskId: string) => void;
}

const overdueSinceLabel = (task: Task): string => {
  if (task.dueWithTime != null) return `was due ${formatMonthDay(new Date(task.dueWithTime))}`;
  if (task.dueDay) {
    const [y, m, d] = task.dueDay.split('-').map(Number);
    return `was due ${formatMonthDay(new Date(y, m - 1, d))}`;
  }
  return 'overdue';
};

const countBadge = (count: number): HTMLElement =>
  el('span', { className: 'bp-count-badge', text: String(count) });

const section = (
  title: string,
  tasks: Task[],
  data: PlannerData,
  currentTaskId: string | null,
  callbacks: RailCallbacks,
  metaFor?: (task: Task) => string,
): HTMLElement => {
  const header = el('div', { className: 'bp-rail-section-header' }, [
    el('span', { text: title }),
    countBadge(tasks.length),
  ]);
  const rows = tasks.map((task) =>
    renderTaskRow(task, data, currentTaskId, callbacks, metaFor?.(task)),
  );
  return el('div', { className: 'bp-rail-section' }, [header, ...rows]);
};

export const renderUnscheduledRail = (
  data: PlannerData,
  currentTaskId: string | null,
  callbacks: RailCallbacks,
): HTMLElement => {
  const header = el('div', { className: 'bp-rail-header' }, [
    el('span', { text: 'Unscheduled & Overdue' }),
  ]);

  const children: HTMLElement[] = [header];

  if (data.overdue.length) {
    children.push(
      section('Overdue', data.overdue, data, currentTaskId, callbacks, overdueSinceLabel),
    );
  }

  children.push(section('Unscheduled', data.unplanned, data, currentTaskId, callbacks));
  children.push(renderAddTaskRow('Add task', callbacks.onAddTask));

  const rail = el('aside', { className: 'bp-rail' }, children);
  attachUnplanDropZone(rail, callbacks.onDropToUnplan);
  return rail;
};
