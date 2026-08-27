import type { Task } from '@super-productivity/plugin-api';
import './styles.css';
import { el, clear } from './dom';
import { dayKeyToDate, toDayKey } from './dateUtils';
import { buildPlannerData, getDayBucket, type PlannerData } from './data';
import { loadState, saveState, type BetterPlannerLocalState } from './persistence';
import type { ViewState } from './state';
import type { ChipInputValue } from './views/chipInput';
import { renderToolbar } from './views/toolbar';
import { renderUnscheduledRail } from './views/unscheduledRail';
import { renderThreeDayView } from './views/threeDay';
import { renderContextMenu } from './views/contextMenu';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root not found');
const root: HTMLElement = rootEl;

let localState: BetterPlannerLocalState = { version: 1, dayOrder: {} };
let plannerData: PlannerData | null = null;
let currentTaskId: string | null = null;
let editingTaskId: string | null = null;
let contextMenuTask: Task | null = null;
let contextMenuPos: { x: number; y: number } | null = null;
let teardownContextMenu: (() => void) | null = null;
const view: ViewState = { mode: '3-day', anchorDate: new Date() };

const refetch = async (): Promise<void> => {
  const appState = await PluginAPI.getAppState();
  plannerData = buildPlannerData(appState, toDayKey(new Date()));
};

const onToggleDone = (task: Task): void => {
  void PluginAPI.updateTask(task.id, { isDone: !task.isDone }).then(render);
};

const onAddTaskForDay = (dayKey: string, input: ChipInputValue): void => {
  void PluginAPI.addTask({
    title: input.title,
    dueDay: dayKey,
    projectId: input.projectId,
    tagIds: input.tagIds,
  }).then(render);
};

const onAddUnplannedTask = (input: ChipInputValue): void => {
  void PluginAPI.addTask({
    title: input.title,
    projectId: input.projectId,
    tagIds: input.tagIds,
  }).then(render);
};

const onDropOnDay = (taskId: string, dayKey: string, beforeTaskId: string | null): void => {
  if (!plannerData) return;
  const data = plannerData;
  const task = data.allTasks.find((t) => t.id === taskId);
  if (!task) return;

  const todayKey = toDayKey(new Date());
  const isToday = dayKey === todayKey;
  const persistedOrder = isToday ? data.todayTagOrder : localState.dayOrder[dayKey];
  const bucket = getDayBucket(data, dayKeyToDate(dayKey), todayKey, persistedOrder);
  const others = bucket.unscheduled.map((t) => t.id).filter((id) => id !== taskId);
  const insertAt = beforeTaskId ? others.indexOf(beforeTaskId) : -1;
  const newOrder =
    insertAt === -1
      ? [...others, taskId]
      : [...others.slice(0, insertAt), taskId, ...others.slice(insertAt)];

  const needsTaskUpdate = task.dueDay !== dayKey || task.dueWithTime != null;
  const todayOrderChanged =
    isToday &&
    (bucket.unscheduled.length !== newOrder.length ||
      bucket.unscheduled.some((t, i) => t.id !== newOrder[i]));

  const localWrites: Promise<unknown>[] = [];
  if (!isToday) {
    localState.dayOrder[dayKey] = newOrder;
    localWrites.push(saveState(localState));
  }

  const hostWrites = (async (): Promise<void> => {
    if (needsTaskUpdate) {
      await PluginAPI.updateTask(taskId, { dueDay: dayKey, dueWithTime: null });
    }
    if (todayOrderChanged) {
      await PluginAPI.updateTag('TODAY', { taskIds: newOrder });
    }
  })();

  void Promise.all([...localWrites, hostWrites]).then(refreshAndRender);
};

const onDropToUnplan = (taskId: string): void => {
  void PluginAPI.updateTask(taskId, { dueDay: null, dueWithTime: null }).then(refreshAndRender);
};

const closeContextMenu = (): void => {
  contextMenuTask = null;
  contextMenuPos = null;
  render();
};

const onContextMenu = (task: Task, event: MouseEvent): void => {
  contextMenuTask = task;
  contextMenuPos = { x: event.clientX, y: event.clientY };
  render();
};

const onEditTask = (task: Task): void => {
  editingTaskId = task.id;
  render();
};

const onCancelEdit = (): void => {
  editingTaskId = null;
  render();
};

const onSaveEdit = (taskId: string, value: ChipInputValue): void => {
  const original = plannerData?.allTasks.find((t) => t.id === taskId);
  const tagIds =
    original?.tagIds.includes('TODAY') && !value.tagIds.includes('TODAY')
      ? [...value.tagIds, 'TODAY']
      : value.tagIds;
  editingTaskId = null;
  void PluginAPI.updateTask(taskId, {
    title: value.title,
    projectId: value.projectId,
    tagIds,
  }).then(render);
};

const onDeleteTask = (task: Task): void => {
  void PluginAPI.openDialog({
    title: 'Delete task',
    content: `Delete "${task.title}"? This can't be undone.`,
    buttons: [
      { label: 'Cancel' },
      {
        label: 'Delete',
        color: 'warn',
        raised: true,
        onClick: () => PluginAPI.deleteTask(task.id),
      },
    ],
  });
};

const renderComingSoon = (): HTMLElement =>
  el('div', { className: 'bp-coming-soon' }, [
    el('p', { text: '1-Day timeline view is coming soon.' }),
  ]);

const render = (): void => {
  if (!plannerData) return;
  teardownContextMenu?.();
  teardownContextMenu = null;
  clear(root);

  const todayKey = toDayKey(new Date());

  const toolbar = renderToolbar(view, {
    onModeChange: (mode) => {
      view.mode = mode;
      render();
    },
    onNavigate: (deltaDays) => {
      const next = new Date(view.anchorDate);
      next.setDate(next.getDate() + deltaDays);
      view.anchorDate = next;
      render();
    },
    onToday: () => {
      view.anchorDate = new Date();
      render();
    },
  });

  const rail = renderUnscheduledRail(plannerData, currentTaskId, editingTaskId, {
    onToggleDone,
    onContextMenu,
    onSaveEdit,
    onCancelEdit,
    onAddTask: onAddUnplannedTask,
    onDropToUnplan,
  });

  const main =
    view.mode === '3-day'
      ? renderThreeDayView(
          view.anchorDate,
          todayKey,
          plannerData,
          localState,
          currentTaskId,
          editingTaskId,
          {
            onToggleDone,
            onContextMenu,
            onSaveEdit,
            onCancelEdit,
            onAddTask: onAddTaskForDay,
            onDropOnDay,
          },
        )
      : renderComingSoon();

  const contentRow = el('div', { className: 'bp-content-row' }, [rail, main]);
  root.append(el('div', { className: 'bp-app' }, [toolbar, contentRow]));

  if (contextMenuTask && contextMenuPos) {
    const task = contextMenuTask;
    const { element, destroy } = renderContextMenu(
      contextMenuPos.x,
      contextMenuPos.y,
      [
        { label: 'Edit', onClick: () => onEditTask(task) },
        { label: 'Delete task', danger: true, onClick: () => onDeleteTask(task) },
      ],
      closeContextMenu,
    );
    teardownContextMenu = destroy;
    root.append(element);
  }
};

const refreshAndRender = (): void => {
  void refetch().then(() => {
    if (!editingTaskId) render();
  });
};

PluginAPI.onReady?.(async () => {
  localState = await loadState();
  await refetch();
  render();

  PluginAPI.registerHook(PluginAPI.Hooks.ANY_TASK_UPDATE, refreshAndRender);
  PluginAPI.registerHook(PluginAPI.Hooks.TASK_CREATED, refreshAndRender);
  PluginAPI.registerHook(PluginAPI.Hooks.TASK_DELETE, refreshAndRender);
  PluginAPI.registerHook(PluginAPI.Hooks.TASK_COMPLETE, refreshAndRender);
  PluginAPI.registerHook(PluginAPI.Hooks.PROJECT_LIST_UPDATE, refreshAndRender);
  PluginAPI.registerHook(PluginAPI.Hooks.CURRENT_TASK_CHANGE, (payload) => {
    currentTaskId = payload.current?.id ?? null;
    if (!editingTaskId) render();
  });
});
