import { app } from 'electron'
import path from 'path'
import fs from 'fs'

/**
 * Returns the base image directory path inside userData.
 * @param folder Optional subfolder name (e.g., 'icons', 'cards', 'avatars')
 * @returns Absolute path to the image directory
 */
export function getImageDir(folder?: string): string {
  const baseDir = path.join(app.getPath('userData'), 'images')
  if (folder) {
    return path.join(baseDir, folder)
  }
  return baseDir
}

/**
 * Ensures that the image directory (and optional subfolder) exists.
 */
export function ensureImageDir(folder?: string): void {
  const dir = getImageDir(folder)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

/**
 * Saves a base64-encoded image to disk in the userData/images directory.
 * @param base64Data Base64-encoded image data (with or without data:image prefix)
 * @param folder Subfolder name (e.g., 'icons', 'cards', 'avatars')
 * @param fileName Desired file name (e.g., 'my-icon.png')
 * @returns The full path to the saved file
 */
export async function saveImageFromBase64(base64Data: string, folder: string, fileName: string): Promise<string> {
  ensureImageDir(folder)

  // Strip data URL prefix if present
  let cleanData = base64Data
  if (base64Data.includes(',')) {
    cleanData = base64Data.split(',')[1]
  }

  const buffer = Buffer.from(cleanData, 'base64')
  const filePath = path.join(getImageDir(folder), fileName)

  return new Promise<string>((resolve, reject) => {
    fs.writeFile(filePath, buffer, (err) => {
      if (err) {
        reject(err)
      } else {
        resolve(filePath)
      }
    })
  })
}

/**
 * Deletes an image file from the userData/images directory.
 * Searches through all subdirectories for the given filename.
 * @param fileName The file name to delete (can include relative path)
 */
export async function deleteImageFile(fileName: string): Promise<void> {
  // Try direct path first
  const fullPath = path.isAbsolute(fileName)
    ? fileName
    : path.join(getImageDir(), fileName)

  return new Promise<void>((resolve, reject) => {
    fs.unlink(fullPath, (err) => {
      if (err && err.code !== 'ENOENT') {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

/**
 * Gets the full path for an image file stored in userData/images.
 * @param fileName File name or relative path under images/
 * @returns The absolute path
 */
export function getImagePath(fileName: string): string {
  if (path.isAbsolute(fileName)) {
    return fileName
  }
  return path.join(getImageDir(), fileName)
}
