import { getGame, swallowNextClick } from "../utils";

interface PortraitDragOptions {
  // app element; flagged while a drag is live
  root: HTMLElement;
  container: HTMLElement;
  deadZone: number;
  canDrag: () => boolean;
  onReorder: (actorIds: string[]) => void;
}

const portraitsIn = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(':scope > .portrait'));

const orderOf = (container: HTMLElement): string[] =>
  portraitsIn(container).map(portrait => portrait.dataset.actorId ?? '');

const isInside = (rect: DOMRect, x: number, y: number): boolean =>
  x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

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

export function setupPortraitDrag({ root, container, deadZone, canDrag, onReorder }: PortraitDragOptions): void {
  const startDrag = (event: PointerEvent, portrait: HTMLElement) => {
    if (event.button !== 0 || !canDrag()) return;
    // blocks native image drag and text selection
    event.preventDefault();

    const start = { x: event.clientX, y: event.clientY };
    const before = orderOf(container);
    const home = portrait.nextSibling;
    let ghost: HTMLElement | null = null;
    let grab = { x: 0, y: 0 };

    portrait.classList.add('held');

    // swap the source into whichever cell the pointer is over
    const reflow = (x: number, y: number) => {
      const target = portraitsIn(container).find(p => p !== portrait && isInside(p.getBoundingClientRect(), x, y));
      if (!target) return;
      const followsSource = portrait.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING;
      container.insertBefore(portrait, followsSource ? target.nextSibling : target);
    };

    const onMove = (e: PointerEvent) => {
      if (!ghost) {
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < deadZone) return;
        const rect = portrait.getBoundingClientRect();
        grab = { x: start.x - rect.left, y: start.y - rect.top };
        ghost = createGhost(portrait);
        portrait.classList.add('drag-source');
        root.classList.add('reordering');
        getGame().tooltip?.deactivate();
      }

      ghost.style.left = `${e.clientX - grab.x}px`;
      ghost.style.top = `${e.clientY - grab.y}px`;
      reflow(e.clientX, e.clientY);
    };

    const finish = (cancelled: boolean) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      document.removeEventListener('keydown', onKey);
      portrait.classList.remove('held', 'drag-source');
      root.classList.remove('reordering');

      if (!ghost) return;
      ghost.remove();
      swallowNextClick();

      if (cancelled) {
        container.insertBefore(portrait, home);
        return;
      }

      const after = orderOf(container);
      if (after.some((id, i) => id !== before[i])) onReorder(after);
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
