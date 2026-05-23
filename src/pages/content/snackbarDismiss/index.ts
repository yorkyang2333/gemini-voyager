import { StorageKeys } from '@/core/types/common';
import { isExtensionContextInvalidatedError } from '@/core/utils/extensionContext';

const DISMISS_BTN_CLASS = 'gv-snackbar-dismiss';
const SNACKBAR_SELECTOR =
  'mat-snack-bar-container, .mat-mdc-snack-bar-container, .mat-snack-bar-container';

let observer: MutationObserver | null = null;
let enabled = true;

function injectDismissButton(snackbar: HTMLElement): void {
  if (snackbar.querySelector(`.${DISMISS_BTN_CLASS}`)) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = DISMISS_BTN_CLASS;
  btn.textContent = '×';
  btn.setAttribute('aria-label', 'Dismiss');
  btn.addEventListener('click', () => {
    const pane = snackbar.closest('.cdk-overlay-pane');
    if (pane) pane.remove();
    else snackbar.remove();
  });
  snackbar.appendChild(btn);
}

function removeAllDismissButtons(): void {
  document.querySelectorAll(`.${DISMISS_BTN_CLASS}`).forEach((btn) => btn.remove());
}

function processAddedNodes(mutations: MutationRecord[]): void {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.matches(SNACKBAR_SELECTOR)) {
        injectDismissButton(node);
      }
      node.querySelectorAll<HTMLElement>(SNACKBAR_SELECTOR).forEach(injectDismissButton);
    }
  }
}

function startObserving(): void {
  if (observer) return;
  const target = document.querySelector('.cdk-overlay-container') ?? document.body;
  observer = new MutationObserver(processAddedNodes);
  observer.observe(target, { childList: true, subtree: true });

  // Handle snackbars already present
  target.querySelectorAll<HTMLElement>(SNACKBAR_SELECTOR).forEach(injectDismissButton);
}

function stopObserving(): void {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  removeAllDismissButtons();
}

function applyState(isEnabled: boolean): void {
  enabled = isEnabled;
  if (enabled) startObserving();
  else stopObserving();
}

async function readInitialState(): Promise<boolean> {
  try {
    const res = await chrome.storage?.sync?.get({ [StorageKeys.SNACKBAR_DISMISS_ENABLED]: true });
    return res?.[StorageKeys.SNACKBAR_DISMISS_ENABLED] !== false;
  } catch {
    return true;
  }
}

export function startSnackbarDismiss(): void {
  if (location.hostname !== 'gemini.google.com') return;

  void readInitialState().then(applyState);

  try {
    chrome.storage?.onChanged?.addListener((changes, area) => {
      if (area !== 'sync') return;
      const change = changes[StorageKeys.SNACKBAR_DISMISS_ENABLED];
      if (!change) return;
      applyState(change.newValue !== false);
    });
  } catch (error) {
    if (isExtensionContextInvalidatedError(error)) return;
    throw error;
  }
}
