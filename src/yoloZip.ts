import type { Annotation, DatasetImage, LabelClass } from './types'

type ArchiveEntry = { name: string; data: Uint8Array }

const encoder = new TextEncoder()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((size, part) => size + part.length, 0))
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

function zipStore(entries: ArchiveEntry[]): Blob {
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let localOffset = 0

  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const checksum = crc32(entry.data)
    const local = new Uint8Array(30 + name.length)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true)
    localView.setUint16(6, 0x0800, true)
    localView.setUint16(8, 0, true)
    localView.setUint32(14, checksum, true)
    localView.setUint32(18, entry.data.length, true)
    localView.setUint32(22, entry.data.length, true)
    localView.setUint16(26, name.length, true)
    local.set(name, 30)
    localParts.push(local, entry.data)

    const central = new Uint8Array(46 + name.length)
    const centralView = new DataView(central.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint16(8, 0x0800, true)
    centralView.setUint16(10, 0, true)
    centralView.setUint32(16, checksum, true)
    centralView.setUint32(20, entry.data.length, true)
    centralView.setUint32(24, entry.data.length, true)
    centralView.setUint16(28, name.length, true)
    centralView.setUint32(42, localOffset, true)
    central.set(name, 46)
    centralParts.push(central)
    localOffset += local.length + entry.data.length
  }

  const centralDirectory = concatBytes(centralParts)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(8, entries.length, true)
  endView.setUint16(10, entries.length, true)
  endView.setUint32(12, centralDirectory.length, true)
  endView.setUint32(16, localOffset, true)
  return new Blob([concatBytes([...localParts, centralDirectory, end])], { type: 'application/zip' })
}

function safeStem(filename: string): string {
  const withoutExtension = filename.replace(/\\.[^.]*$/, '')
  const cleaned = withoutExtension.normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '')
  return cleaned || 'image'
}

function imageExtension(image: DatasetImage): string {
  const match = /^data:image\\/([a-zA-Z0-9.+-]+);base64,/.exec(image.src)
  const mimeExtension = match?.[1]?.toLowerCase().replace('jpeg', 'jpg')
  const filenameExtension = /\\.([a-zA-Z0-9]+)$/.exec(image.name)?.[1]?.toLowerCase()
  const allowed = new Set(['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tif', 'tiff'])
  return filenameExtension && allowed.has(filenameExtension) ? filenameExtension : mimeExtension || 'png'
}

async function imageBytes(src: string): Promise<Uint8Array> {
  const response = await fetch(src)
  if (!response.ok) throw new Error('Could not read an image for the YOLO archive')
  return new Uint8Array(await response.arrayBuffer())
}

function yamlString(value: string): string {
  return JSON.stringify(value)
}

export async function createYoloDatasetZip(
  images: DatasetImage[],
  labels: LabelClass[],
  annotations: Annotation[],
): Promise<Blob> {
  if (!images.length) throw new Error('Add at least one image before exporting a YOLO dataset')
  if (!labels.length) throw new Error('Add at least one label class before exporting a YOLO dataset')

  const validationIndexes = new Set<number>()
  if (images.length > 1) {
    for (let index = 4; index < images.length; index += 5) validationIndexes.add(index)
    if (validationIndexes.size === 0) validationIndexes.add(images.length - 1)
    if (validationIndexes.size === images.length) validationIndexes.delete(images.length - 1)
  }

  const entries: ArchiveEntry[] = []
  const usedNames = new Set<string>()
  const names: string[] = []
  const classIds = new Map(labels.map((label, index) => [label.id, index]))
  const imageById = new Map(images.map((image) => [image.id, image]))

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index]
    const stem = safeStem(image.name)
    const extension = imageExtension(image)
    let filename = `${stem}.${extension}`
    let suffix = 2
    while (usedNames.has(filename.toLowerCase())) {
      filename = `${stem}_${suffix}.${extension}`
      suffix += 1
    }
    usedNames.add(filename.toLowerCase())
    names.push(filename)

    const split = validationIndexes.has(index) ? 'val' : 'train'
    entries.push({ name: `images/${split}/${filename}`, data: await imageBytes(image.src) })

    const rows = annotations
      .filter((annotation) => annotation.imageId === image.id && classIds.has(annotation.labelId))
      .map((annotation) => {
        const classId = classIds.get(annotation.labelId)!
        const centerX = annotation.x + annotation.width / 2
        const centerY = annotation.y + annotation.height / 2
        return `${classId} ${centerX.toFixed(6)} ${centerY.toFixed(6)} ${annotation.width.toFixed(6)} ${annotation.height.toFixed(6)}`
      })
    entries.push({ name: `labels/${split}/${safeStem(filename)}.txt`, data: encoder.encode(rows.length ? `${rows.join('\\n')}\\n` : '') })
  }

  const yaml = [
    'path: .',
    'train: images/train',
    'val: images/val',
    'names:',
    ...labels.map((label, index) => `  ${index}: ${yamlString(label.name)}`),
    '',
  ].join('\\n')
  entries.push({ name: 'data.yaml', data: encoder.encode(yaml) })
  entries.push({ name: 'README.txt', data: encoder.encode([
    'YOLO object detection dataset exported by Annotation.',
    '',
    'Images are included under images/train and images/val.',
    'Matching normalized YOLO label files are under labels/train and labels/val.',
    'Class IDs in label files match the zero-based order in data.yaml.',
    images.length === 1
      ? 'Only one image was available; it is placed in the training split. Create a separate validation split before evaluating a model.'
      : 'A deterministic holdout split is used: approximately one image in five is assigned to validation (at least one when possible).',
    'Review the split and class distribution before training.',
    '',
  ].join('\\n')) })
  return zipStore(entries)
}
