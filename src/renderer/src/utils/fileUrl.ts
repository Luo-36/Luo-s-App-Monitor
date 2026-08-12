/**
 * Convert a file path to a proper URL for rendering in Electron.
 *
 * Handles:
 * - Windows paths: C:\path\to\file.png → file:///C:/path/to/file.png
 * - Unix paths: /home/user/file.png → file:///home/user/file.png
 * - Already URLs: data:, http://, https:// → returned as-is
 */
export function toFileUrl(filePath: string | null): string | null {
  if (!filePath) return null

  // Already a URL or data URI
  if (
    filePath.startsWith('data:') ||
    filePath.startsWith('http://') ||
    filePath.startsWith('https://') ||
    filePath.startsWith('file://')
  ) {
    return filePath
  }

  // Convert Windows backslashes to forward slashes
  const normalized = filePath.replace(/\\/g, '/')

  // Ensure leading slash for file:/// protocol
  return `file:///${normalized.startsWith('/') ? normalized.slice(1) : normalized}`
}
