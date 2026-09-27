import { getGame, swallowNextClick } from "../utils";

// where a dragged portrait was released
export interface PortraitDrop {
  actorId: string;
  fromGroupId: string;
  // null means empty canvas; spawns a new group
  toGroupId: string | null;
  // target group's visible order after the drop; absent when appended to a minimized window
  order?: string[];
  // ghost top-left in viewport px
  point: { left: number; top: number };
}

interface PortraitDragOptions {
  // app element; flagged while a drag is live
  root: HTMLElement;
  container: HTMLElement;
  groupId: string;
  deadZone: number;
  canDrag: () => boolean;
  // canvas drops keep the ghost up until this settles
  onDrop: (drop: PortraitDrop) => void | Promise<void>;
}

// set on body so every window knows a portrait is being carried
export const DRAGGING_CLASS = 'emotive-hud-portrait-dragging';

const portraitsIn = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(':scope > .portrait'));

const orderOf = (container: HTMLElement): string[] =>
  portraitsIn(container).map(portrait => portrait.dataset.actorId ?? '');

const isInside = (rect: DOMRect, x: number, y: number): boolean =>
  x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

// elementsfrompoint skips pointer-events: none, so the ghost never blocks it
const hudAt = (x: number, y: number): HTMLElement | null => {
  for (const element of document.elementsFromPoint(x, y)) {
    const hud = element.closest<HTMLElement>('.emotive-hud-widget .emotive-hud');
    if (hud) return hud;
  }
  return null;
};

// fixed-position copy that follows the pointer
const createGhost = (portrait: HTMLElement): HTMLElement => {
  const rect = portrait.getBoundingClientRect();
  const ghost = document.createElement('div');
  ghost.className = 'emotive-portrait-ghost';
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;

  const img = portrait.querySelector('img')?.cloneNode();
  if (img) ghost.append(img);

  document.body.append(ghost);
  return ghost;
};

export function setupPortraitDrag({ root, container, groupId, deadZone, canDrag, onDrop }: PortraitDragOptions): void {
  const startDrag = (event: PointerEvent, portrait: HTMLElement) => {
    if (event.button !== 0 || !canDrag()) return;
    // blocks native image drag and text selection
    event.preventDefault();

    const actorId = portrait.dataset.actorId ?? '';
    const start = { x: event.clientX, y: event.clientY };
    const before = orderOf(container);
    const home = portrait.nextSibling;
    let ghost: HTMLElement | null = null;
    let grab = { x: 0, y: 0 };
    // hud under the pointer; null over empty canvas
    let targetHud: HTMLElement | null = null;
    let highlighted: HTMLElement | null = null;

    portrait.classList.add('held');

    const goHome = () => {
      if (portrait.parentElement !== container || portrait.nextSibling !== home) container.insertBefore(portrait, home);
    };

    const highlight = (hud: HTMLElement | null) => {
      if (highlighted === hud) return;
      highlighted?.classList.remove('drop-target');
      hud?.classList.add('drop-target');
      highlighted = hud;
    };

    // swap the source into whichever cell the pointer is over
    const reflow = (target: HTMLElement, x: number, y: number) => {
      if (portrait.parentElement !== target) {
        // resize grips trail the portraits in the grid
        target.insertBefore(portrait, target.querySelector(':scope > .resize-handle'));
      }
      const cell = portraitsIn(target).find(p => p !== portrait && isInside(p.getBoundingClientRect(), x, y));
      if (!cell) return;
      const followsSource = portrait.compareDocumentPosition(cell) & Node.DOCUMENT_POSITION_FOLLOWING;
      target.insertBefore(portrait, followsSource ? cell.nextSibling : cell);
    };

    const track = (x: number, y: number) => {
      targetHud = hudAt(x, y);
      ghost!.classList.toggle('new-group', !targetHud);

      if (!targetHud) {
        highlight(null);
        goHome();
        return;
      }

      // minimized windows take the portrait at the end without a live preview
      const targetContainer = targetHud.querySelector<HTMLElement>('.portrait-container');
      if (targetHud.classList.contains('minimized') || !targetContainer) {
        highlight(targetHud);
        goHome();
        return;
      }

      highlight(targetHud === root.querySelector('.emotive-hud') ? null : targetHud);
      reflow(targetContainer, x, y);
    };

    const onMove = (e: PointerEvent) => {
      if (!ghost) {
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < deadZone) return;
        const rect = portrait.getBoundingClientRect();
        grab = { x: start.x - rect.left, y: start.y - rect.top };
        ghost = createGhost(portrait);
        portrait.classList.add('drag-source');
        root.classList.add('reordering');
        document.body.classList.add(DRAGGING_CLASS);
        getGame().tooltip?.deactivate();
      }

      ghost.style.left = `${e.clientX - grab.x}px`;
      ghost.style.top = `${e.clientY - grab.y}px`;
      track(e.clientX, e.clientY);
    };

    const buildDrop = (point: PortraitDrop['point']): PortraitDrop | null => {
      if (!targetHud) return { actorId, fromGroupId: groupId, toGroupId: null, point };

      const toGroupId = targetHud.dataset.groupId ?? '';
      if (portrait.parentElement === container && toGroupId !== groupId) {
        // minimized target; portrait never left home
        return { actorId, fromGroupId: groupId, toGroupId, point };
      }

      const order = orderOf(portrait.parentElement as HTMLElement);
      const unchanged = toGroupId === groupId && order.every((id, i) => id === before[i]);
      return unchanged ? null : { actorId, fromGroupId: groupId, toGroupId, order, point };
    };

    const finish = (cancelled: boolean) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      document.removeEventListener('keydown', onKey);
      portrait.classList.remove('held', 'drag-source');
      root.classList.remove('reordering');
      document.body.classList.remove(DRAGGING_CLASS);
      highlight(null);

      if (!ghost) return;
      const carried = ghost;
      const rect = carried.getBoundingClientRect();
      swallowNextClick();

      const drop = cancelled ? null : buildDrop({ left: rect.left, top: rect.top });
      if (cancelled) goHome();

      if (drop && !drop.toGroupId) {
        // ghost stands in for the new window until it renders
        portrait.style.visibility = 'hidden';
        Promise.resolve(onDrop(drop)).finally(() => carried.remove());
        return;
      }

      carried.remove();
      if (drop) onDrop(drop);
    };

    const onUp = () => finish(false);
    const onCancel = () => finish(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(true);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
    document.addEventListener('keydown', onKey);
  };

  portraitsIn(container).forEach(portrait => {
    portrait.addEventListener('pointerdown', event => startDrag(event, portrait));
  });
}
