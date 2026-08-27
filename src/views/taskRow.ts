import type { Task } from '@super-productivity/plugin-api';
import { el } from '../dom';
import { formatDuration, msToMinutes } from '../dateUtils';
import { resolveProjectColor } from '../colors';
import type { PlannerData } from '../data';
import { attachDragSource } from '../dnd';
import { createChipInput, type ChipInputValue } from './chipInput';

export interface TaskRowCallbacks {
  onToggleDone: (task: Task) => void;
  onContextMenu: (task: Task, event: MouseEvent) => void;
  onSaveEdit: (taskId: string, value: ChipInputValue) => void;
  onCancelEdit: () => void;
}

export const renderTaskRow = (
  task: Task,
  data: PlannerData,
  currentTaskId: string | null,
  editingTaskId: string | null,
  callbacks: TaskRowCallbacks,
  metaOverride?: string,
): HTMLElement => {
  const isEditing = task.id === editingTaskId;
  const classes = ['bp-row'];
  if (task.id === currentTaskId) classes.push('bp-row--active');
  if (task.isDone) classes.push('bp-row--done');
  if (isEditing) classes.push('bp-row--editing');

  const checkbox = el('button', {
    className: 'bp-checkbox',
    attrs: { 'aria-label': task.isDone ? 'Mark not done' : 'Mark done', type: 'button' },
    text: task.isDone ? '✓' : '',
  });
  checkbox.addEventListener('click', (event) => {
    event.stopPropagation();
    callbacks.onToggleDone(task);
  });

  if (isEditing) {
    const chipInput = createChipInput({
      data,
      initialTitle: task.title,
      initialProjectId: task.projectId,
      initialTagIds: task.tagIds.filter((id) => id !== 'TODAY'),
      onCommit: (value) => callbacks.onSaveEdit(task.id, value),
      onCancel: callbacks.onCancelEdit,
    });
    const body = el('div', { className: 'bp-row-body' }, [chipInput.element]);
    queueMicrotask(() => chipInput.focus());

    return el('div', { className: classes.join(' '), attrs: { 'data-task-id': task.id } }, [
      checkbox,
      body,
    ]);
  }

  const title = el('span', { className: 'bp-row-title', text: task.title });
  const minutes = msToMinutes(task.timeEstimate);
  const titleLineChildren: (HTMLElement | string)[] = [title];
  if (minutes > 0) {
    titleLineChildren.push(
      el('span', { className: 'bp-row-duration', text: formatDuration(minutes) }),
    );
  }
  const titleLine = el('div', { className: 'bp-row-title-line' }, titleLineChildren);

  let metaLine: HTMLElement | null = null;
  if (metaOverride) {
    metaLine = el('div', { className: 'bp-row-meta bp-row-meta--overdue', text: metaOverride });
  } else {
    const project = task.projectId ? data.projectsById.get(task.projectId) : undefined;
    const tagTitles = task.tagIds
      .map((id) => data.tagsById.get(id))
      .filter((t): t is NonNullable<typeof t> => !!t && t.id !== 'TODAY')
      .map((t) => t.title);
    if (project || tagTitles.length) {
      const parts: (HTMLElement | string)[] = [];
      if (project) {
        const dot = el('span', { className: 'bp-dot' });
        dot.style.backgroundColor = resolveProjectColor(project);
        parts.push(dot, project.title);
      }
      if (tagTitles.length) {
        if (parts.length) parts.push(' · ');
        parts.push(tagTitles.join(', '));
      }
      metaLine = el('div', { className: 'bp-row-meta' }, parts);
    }
  }

  const body = el(
    'div',
    { className: 'bp-row-body' },
    metaLine ? [titleLine, metaLine] : [titleLine],
  );

  const row = el('div', { className: classes.join(' '), attrs: { 'data-task-id': task.id } }, [
    el('span', { className: 'bp-grip', attrs: { 'aria-hidden': 'true' } }, ['⋮⋮']),
    checkbox,
    body,
  ]);
  attachDragSource(row, task.id);
  row.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    callbacks.onContextMenu(task, event);
  });
  return row;
};
