type FullscreenElementLike = {
  requestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocumentLike = {
  fullscreenEnabled?: boolean;
  fullscreenElement?: Element | null;
  exitFullscreen?: () => Promise<void> | void;
};

export function canUseFullscreenApi(documentLike?: FullscreenDocumentLike | null) {
  return Boolean(documentLike?.fullscreenEnabled);
}

export async function requestFullscreenForElement(
  element: FullscreenElementLike | null | undefined,
) {
  if (!element?.requestFullscreen) {
    return false;
  }

  await element.requestFullscreen();
  return true;
}

export async function exitFullscreenIfActive(documentLike?: FullscreenDocumentLike | null) {
  if (!documentLike?.fullscreenElement || !documentLike.exitFullscreen) {
    return false;
  }

  await documentLike.exitFullscreen();
  return true;
}

export function isFullscreenElementActive(
  documentLike: FullscreenDocumentLike | null | undefined,
  element: Element | null | undefined,
) {
  return Boolean(element && documentLike?.fullscreenElement === element);
}
