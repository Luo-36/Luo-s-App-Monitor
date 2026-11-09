/**
 * Convert a local file path to the app's image URL scheme.
 *
 * Chromium blocks file:// images when the renderer is served from
 * http://localhost (dev mode), so all local images go through a privileged
 * custom scheme registered in the main process (`luo-file://`).
 *
 * - Windows paths: C:\path\to\file.png → luo-file://local/C:/path/to/file.png
 * - Unix paths: /home/user/file.png → luo-file://local/home/user/file.png
 * - Already URLs: data:, http://, https:// → returned as-is
 */
export function toFileUrl(filePath: string | null): string | null {
  if (!filePath) return null

  if (
    filePath.startsWith('data:') ||
    filePath.startsWith('http://') ||
    filePath.startsWith('https://') ||
    filePath.startsWith('luo-file://')
  ) {
    return filePath
  }

  // A fixed host keeps Chromium from interpreting a Windows drive letter
  // ("C:") as the URL authority/host.
  const pathPart = filePath.startsWith('file://')
    ? filePath.slice('file://'.length)
    : filePath
  const normalized = pathPart.replace(/\\/g, '/')
  return `luo-file://local/${normalized.startsWith('/') ? normalized.slice(1) : normalized}`
}
