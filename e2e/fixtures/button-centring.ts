import type { Locator, Page } from '@playwright/test';

/** What `measureButtonCentring` reports for one button. Lengths are CSS pixels. */
export type ButtonCentring = {
  /** The accessible name, or the text, cut to 24 characters. */
  readonly name: string;
  /** The label of the nearest `role="group"` around it, for a sample page that groups its states. */
  readonly group: string;
  readonly width: number;
  /**
   * How far the centre of what the button shows (its text and its drawn icons, never an element that takes no room or
   * is invisible) sits to the right of the centre of the button. Zero is exactly centred.
   */
  readonly offset: number;
  /** The shown content's own box, for comparing a label's place from one state to another. */
  readonly contentLeft: number;
  readonly contentRight: number;
  /** The clear space between the shown content and the pending spinner, when the spinner is showing; otherwise null. */
  readonly spinnerGap: number | null;
};

/**
 * Runs in the page. Measures how well each control's label sits in the middle of it (owner's feedback of 2026-10-04:
 * «بفهم» leaned to the right because the pending indicator kept a slot beside the label). The shown content is every
 * text node and every drawn icon in the flow of the control; an element that is out of the flow (the spinner, which
 * overlays the padding) or has opacity 0 takes no part, so a slot that is merely reserved cannot hide behind the
 * measurement. With `onlyCentred`, a control counts only when it centres its content along its row and is at least
 * 44 px high: the shared action buttons (`actionClasses`) and the round icon buttons, and nothing that is start-aligned
 * by design (a chip, a menu row, a link-like action) or laid out as a column (a card).
 */
function measureElements(elements: Element[], onlyCentred: boolean): ButtonCentring[] {
  const measured: ButtonCentring[] = [];
  for (const element of elements) {
    if (!(element instanceof HTMLElement) || !element.checkVisibility()) continue;
    if (onlyCentred) {
      // centred along the row: a card whose column of text is centred from top to bottom is not what is measured
      const style = getComputedStyle(element);
      const inRow = style.display.includes('flex') && style.flexDirection.startsWith('row');
      if (!inRow || style.justifyContent !== 'center' || parseFloat(style.minHeight) < 44) continue;
    }
    const box = element.getBoundingClientRect();
    let left = Infinity;
    let right = -Infinity;
    const add = (rect: DOMRect) => {
      if (rect.width === 0) return;
      left = Math.min(left, rect.left);
      right = Math.max(right, rect.right);
    };
    const walk = (node: Node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          if ((child.textContent ?? '').trim() === '') continue;
          const range = document.createRange();
          range.selectNodeContents(child);
          add(range.getBoundingClientRect());
        } else if (child instanceof HTMLElement || child instanceof SVGElement) {
          const style = getComputedStyle(child);
          if (style.position === 'absolute' || style.opacity === '0' || style.display === 'none') continue;
          if (child instanceof SVGSVGElement) add(child.getBoundingClientRect());
          else walk(child);
        }
      }
    };
    walk(element);
    if (left === Infinity) continue;
    const spinner = element.querySelector<HTMLElement>('[data-spinner]');
    const showing = spinner !== null && getComputedStyle(spinner).opacity !== '0';
    const round = (value: number) => Math.round(value * 100) / 100;
    measured.push({
      name: (element.getAttribute('aria-label') ?? element.textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 24),
      group: element.closest('[role="group"]')?.getAttribute('aria-label') ?? '',
      width: round(box.width),
      offset: round((left + right) / 2 - (box.left + box.width / 2)),
      contentLeft: round(left),
      contentRight: round(right),
      // the page is right to left: the spinner sits at the left end, so the content starts to its right
      spinnerGap: showing ? round(left - spinner.getBoundingClientRect().right) : null,
    });
  }
  return measured;
}

type Options = {
  /** Only inside this selector; the whole body by default. */
  readonly scope?: string;
  /** Which controls to measure instead of the centred ones: every match of this selector. */
  readonly selector?: string;
};

/** The centring of every centred action in the page (or of every match of `selector`). */
export async function measureButtonCentring(page: Page, options: Options = {}): Promise<ButtonCentring[]> {
  const { scope = 'body', selector } = options;
  return page
    .locator(`${scope} :is(${selector ?? 'button, a[href]'})`)
    .evaluateAll(measureElements, selector === undefined);
}

/** The centring of one control, whatever it is. */
export async function measureControlCentring(control: Locator): Promise<ButtonCentring> {
  const [measured] = await control.evaluateAll(measureElements, false);
  if (measured === undefined) throw new Error('The control is not visible or shows nothing to measure.');
  return measured;
}
