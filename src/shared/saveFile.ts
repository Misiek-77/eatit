/** How handing a file to the person ended. */
export type SaveResult = 'shared' | 'downloaded' | 'cancelled';

/**
 * Hands a file to the person. Where the system share sheet takes files (iPhone, Android) it opens it, so the
 * file can go straight to Files, iCloud Drive, a messenger or AirDrop; elsewhere the file is downloaded.
 */
export async function saveFile(blob: Blob, name: string, title: string): Promise<SaveResult> {
  const file = new File([blob], name, { type: blob.type });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (error) {
      // Closing the sheet is not a failure; anything else falls back to a plain download.
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked later: Firefox and Safari start reading the file after the click returns.
  setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
  return 'downloaded';
}
