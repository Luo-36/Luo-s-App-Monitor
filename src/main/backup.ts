import { BrowserWindow, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { exportAllData, importAllData } from './database'
import { getImageDir } from './image-helper'

// Image fields that reference files on disk and must be included in the backup.
const IMAGE_FIELDS: Array<{ table: string; field: string }> = [
  { table: 'programs', field: 'icon_path' },
  { table: 'programs', field: 'card_image_path' },
  { table: 'goals', field: 'card_image_path' },
  { table: 'user_profile', field: 'avatar_path' },
  { table: 'user_profile', field: 'background_image_path' }
]

function rowsAsArray(rows: any): any[] {
  if (!rows) return []
  return Array.isArray(rows) ? rows : [rows]
}

/**
 * Converts an absolute (or relative) image path to a portable relative path
 * under images/. Returns null if the path is outside images/ (so we never
 * touch arbitrary user files).
 */
function toRelativeImagePath(p: string | null, imagesDir: string): string | null {
  if (!p) return null
  const abs = path.isAbsolute(p) ? p : path.join(imagesDir, p)
  if (abs !== imagesDir && !abs.startsWith(imagesDir + path.sep)) return null
  return path.relative(imagesDir, abs).split(path.sep).join('/')
}

/**
 * Exports all user data (tables + images) to a JSON file chosen by the user.
 * Returns the written file path, or null if cancelled.
 */
export async function exportDataToFile(win: BrowserWindow): Promise<string | null> {
  const imagesDir = getImageDir()
  const data = exportAllData()

  // Convert image paths to portable relative paths and collect base64 content.
  const images: Record<string, string> = {}
  for (const { table, field } of IMAGE_FIELDS) {
    for (const row of rowsAsArray(data[table])) {
      const rel = toRelativeImagePath(row[field], imagesDir)
      if (!rel) continue
      row[field] = rel
      if (!(rel in images)) {
        try {
          images[rel] = fs.readFileSync(path.join(imagesDir, rel)).toString('base64')
        } catch {
          // Missing file — skip silently; the path is still exported.
        }
      }
    }
  }

  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
    images
  }

  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: '导出数据',
    defaultPath: `luo-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (canceled || !filePath) return null

  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8')
  return filePath
}

/**
 * Imports user data from a JSON file chosen by the user.
 * Returns true on success, false if cancelled.
 * Throws on invalid/malformed backup files.
 */
export async function importDataFromFile(win: BrowserWindow): Promise<boolean> {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: '导入数据',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  })
  if (canceled || !filePaths.length) return false

  const payload = JSON.parse(fs.readFileSync(filePaths[0], 'utf-8'))
  if (!payload || !payload.data) {
    throw new Error('无效的备份文件：缺少 data 字段')
  }

  const imagesDir = getImageDir()

  // Restore images to disk first.
  if (payload.images) {
    for (const [rel, base64] of Object.entries<string>(payload.images)) {
      const dest = path.join(imagesDir, rel)
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.writeFileSync(dest, Buffer.from(base64, 'base64'))
    }
  }

  // Re-map image paths from portable relative → this machine's absolute.
  for (const { table, field } of IMAGE_FIELDS) {
    for (const row of rowsAsArray(payload.data[table])) {
      if (row[field]) {
        row[field] = path.join(imagesDir, row[field].split('/').join(path.sep))
      }
    }
  }

  importAllData(payload.data)
  return true
}
