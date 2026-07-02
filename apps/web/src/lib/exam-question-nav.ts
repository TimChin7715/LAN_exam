export function examQuestionAnchorId(key: string): string {
  return `exam-q-${key}`;
}

export function scrollToExamQuestion(
  key: string,
  scrollRoot?: HTMLElement | null,
): void {
  const el = document.getElementById(examQuestionAnchorId(key));
  if (!el) return;

  if (scrollRoot) {
    const rootRect = scrollRoot.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    scrollRoot.scrollTo({
      top: scrollRoot.scrollTop + elRect.top - rootRect.top - 16,
      behavior: 'smooth',
    });
  } else {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.focus({ preventScroll: true });
  }
}
