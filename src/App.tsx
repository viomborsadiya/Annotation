import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ChangeEvent, PointerEvent as ReactPointerEvent } from 'react'
import './App.css'
import { loadProject, saveProject } from './storage'
import type { Annotation, DatasetImage, LabelClass } from './types'

type Point = { x: number; y: number }

const starterLabels: LabelClass[] = [
  { id: 'object', name: 'Object', color: '#8b5cf6' },
  { id: 'person', name: 'Person', color: '#0ea5e9' },
  { id: 'vehicle', name: 'Vehicle', color: '#f59e0b' },
]
const uid = () => crypto.randomUUID()
const clamp = (value: number) => Math.max(0, Math.min(1, value))

function readImage(file: File): Promise<DatasetImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
    reader.onload = () => {
      const src = String(reader.result)
      const image = new Image()
      image.onload = () => resolve({ id: uid(), name: file.name, src, width: image.naturalWidth, height: image.naturalHeight })
      image.onerror = () => reject(new Error(`${file.name} is not a supported image`))
      image.src = src
    }
    reader.readAsDataURL(file)
  })
}

function downloadFile(name: string, contents: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

function App() {
  const [images, setImages] = useState<DatasetImage[]>([])
  const [activeImageId, setActiveImageId] = useState<string | null>(null)
  const [labels, setLabels] = useState<LabelClass[]>(starterLabels)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeLabelId, setActiveLabelId] = useState(starterLabels[0].id)
  const [draft, setDraft] = useState<{ start: Point; end: Point } | null>(null)
  const [history, setHistory] = useState<Annotation[][]>([])
  const [newLabel, setNewLabel] = useState('')
  const [notice, setNotice] = useState('')
  const [storageReady, setStorageReady] = useState(false)
  const [storageStatus, setStorageStatus] = useState<'loading' | 'saved' | 'saving' | 'error'>('loading')
  const stageRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    loadProject().then((saved) => {
      if (cancelled) return
      if (saved) {
        setImages(saved.images)
        setLabels(saved.labels)
        setAnnotations(saved.annotations)
        setActiveImageId(saved.activeImageId ?? saved.images[0]?.id ?? null)
        setActiveLabelId(saved.activeLabelId && saved.labels.some((label) => label.id === saved.activeLabelId)
          ? saved.activeLabelId
          : saved.labels[0]?.id ?? starterLabels[0].id)
      }
      setStorageStatus('saved')
      setStorageReady(true)
    }).catch(() => {
      if (cancelled) return
      setStorageStatus('error')
      setNotice('Browser storage is unavailable. Export your work regularly.')
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!storageReady) return
    const timeout = window.setTimeout(() => {
      setStorageStatus('saving')
      saveProject({ images, labels, annotations, activeImageId, activeLabelId })
        .then(() => setStorageStatus('saved'))
        .catch(() => {
          setStorageStatus('error')
          setNotice('Could not save locally. Export your dataset to keep a backup.')
        })
    }, 500)
    return () => window.clearTimeout(timeout)
  }, [storageReady, images, labels, annotations, activeImageId, activeLabelId])

  const activeImage = images.find((image) => image.id === activeImageId) ?? null
  const imageAnnotations = annotations.filter((item) => item.imageId === activeImageId)
  const selectedAnnotation = annotations.find((item) => item.id === selectedId) ?? null
  const activeLabel = labels.find((label) => label.id === activeLabelId) ?? labels[0]
  const labelCounts = useMemo(() => labels.map((label) => ({
    ...label,
    count: annotations.filter((item) => item.labelId === label.id).length,
  })), [annotations, labels])

  function commit(next: Annotation[]) {
    setHistory((current) => [...current.slice(-39), annotations])
    setAnnotations(next)
  }

  function undo() {
    const previous = history.at(-1)
    if (!previous) return
    setAnnotations(previous)
    setHistory((current) => current.slice(0, -1))
    setSelectedId(null)
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undo()
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedId) {
          commit(annotations.filter((item) => item.id !== selectedId))
          setSelectedId(null)
        }
      } else if (event.key === 'Escape') {
        setDraft(null)
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('image/'))
    if (!files.length) return
    try {
      const loaded = await Promise.all(files.map(readImage))
      setImages((current) => [...current, ...loaded])
      setActiveImageId((current) => current ?? loaded[0].id)
      setNotice(`Added ${loaded.length} image${loaded.length === 1 ? '' : 's'} to this session`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to load image')
    }
    event.target.value = ''
  }

  function pointFromEvent(event: ReactPointerEvent<HTMLDivElement>): Point {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: clamp((event.clientX - rect.left) / rect.width), y: clamp((event.clientY - rect.top) / rect.height) }
  }

  function startDrawing(event: ReactPointerEvent<HTMLDivElement>) {
    if (!activeImage || !activeLabel) return
    if ((event.target as HTMLElement).closest('[data-annotation]')) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = pointFromEvent(event)
    setSelectedId(null)
    setDraft({ start: point, end: point })
  }

  function moveDrawing(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draft) return
    setDraft((current) => current ? { ...current, end: pointFromEvent(event) } : null)
  }

  function finishDrawing() {
    if (!draft || !activeImage || !activeLabel) return
    const x = Math.min(draft.start.x, draft.end.x)
    const y = Math.min(draft.start.y, draft.end.y)
    const width = Math.abs(draft.end.x - draft.start.x)
    const height = Math.abs(draft.end.y - draft.start.y)
    setDraft(null)
    if (width < 0.006 || height < 0.006) return
    const next: Annotation = { id: uid(), imageId: activeImage.id, labelId: activeLabel.id, x, y, width, height }
    commit([...annotations, next])
    setSelectedId(next.id)
  }

  function addLabel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newLabel.trim()
    if (!name || labels.some((label) => label.name.toLowerCase() === name.toLowerCase())) return
    const palette = ['#10b981', '#ec4899', '#6366f1', '#f97316', '#14b8a6', '#a3e635']
    const label = { id: uid(), name, color: palette[labels.length % palette.length] }
    setLabels((current) => [...current, label])
    setActiveLabelId(label.id)
    setNewLabel('')
  }

  function removeSelected() {
    if (!selectedId) return
    commit(annotations.filter((item) => item.id !== selectedId))
    setSelectedId(null)
  }

  function exportCoco() {
    const categories = labels.map((label, index) => ({ id: index + 1, name: label.name, supercategory: 'object' }))
    const categoryIds = new Map(labels.map((label, index) => [label.id, index + 1]))
    const imageIds = new Map(images.map((image, index) => [image.id, index + 1]))
    const payload = {
      info: { description: 'Dataset exported from Annotation', version: '1.0.0', year: new Date().getFullYear() },
      licenses: [],
      images: images.map((image) => ({ id: imageIds.get(image.id), file_name: image.name, width: image.width, height: image.height })),
      annotations: annotations.map((item, index) => {
        const image = images.find((entry) => entry.id === item.imageId)
        return {
          id: index + 1,
          image_id: imageIds.get(item.imageId),
          category_id: categoryIds.get(item.labelId),
          bbox: image ? [item.x * image.width, item.y * image.height, item.width * image.width, item.height * image.height] : [],
          area: image ? item.width * image.height * image.width * image.height : 0,
          segmentation: [],
          iscrowd: 0,
        }
      }),
      categories,
    }
    downloadFile('annotation-coco.json', JSON.stringify(payload, null, 2))
    setNotice('COCO JSON export downloaded')
  }

  function exportYolo() {
    const lines = images.map((image) => {
      const rows = annotations.filter((item) => item.imageId === image.id).map((item) => {
        const classIndex = labels.findIndex((label) => label.id === item.labelId)
        const centerX = item.x + item.width / 2
        const centerY = item.y + item.height / 2
        return `${classIndex} ${centerX.toFixed(6)} ${centerY.toFixed(6)} ${item.width.toFixed(6)} ${item.height.toFixed(6)}`
      })
      return `# ${image.name}\n${rows.join('\n')}`
    }).join('\n\n')
    const names = labels.map((label) => `  ${labels.indexOf(label)}: ${JSON.stringify(label.name)}`).join('\n')
    downloadFile('annotation-yolo.txt', `# YOLO normalized xywh labels\n# Classes:\n${names}\n\n${lines}\n`, 'text/plain')
    setNotice('YOLO labels downloaded. Each image section is identified by its filename.')
  }

  const draftBox = draft ? {
    left: Math.min(draft.start.x, draft.end.x) * 100,
    top: Math.min(draft.start.y, draft.end.y) * 100,
    width: Math.abs(draft.end.x - draft.start.x) * 100,
    height: Math.abs(draft.end.y - draft.start.y) * 100,
  } : null

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Annotation home"><span className="brand-mark">A</span><span>annotation<span className="brand-dot">.</span></span></a>
        <div className="topbar-center"><span className="status-dot" /> {storageStatus === 'loading' ? 'Restoring workspace' : storageStatus === 'saving' ? 'Saving locally' : storageStatus === 'error' ? 'Local save unavailable' : 'Saved locally'} <span className="topbar-divider">/</span> <span>{images.length} images</span></div>
        <div className="topbar-actions">
          <button className="button button-quiet" onClick={undo} disabled={!history.length} title="Undo (Ctrl+Z)">↶ <span>Undo</span></button>
          <button className="button button-primary" onClick={exportCoco} disabled={!images.length}>Export dataset <span aria-hidden="true">↗</span></button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-section">
            <div className="section-heading"><span>DATASET</span><span className="count-pill">{images.length}</span></div>
            <button className="upload-card" onClick={() => fileInputRef.current?.click()}>
              <span className="upload-icon">＋</span><span><strong>Add images</strong><small>JPG, PNG, WEBP · multiple files</small></span>
            </button>
            <input ref={fileInputRef} className="visually-hidden" type="file" accept="image/*" multiple onChange={handleFiles} />
            <div className="image-list">
              {images.map((image) => (
                <button key={image.id} className={`image-row ${activeImageId === image.id ? 'active' : ''}`} onClick={() => { setActiveImageId(image.id); setSelectedId(null) }}>
                  <img src={image.src} alt="" /><span className="image-row-copy"><strong>{image.name}</strong><small>{annotations.filter((item) => item.imageId === image.id).length} annotations</small></span>
                  {activeImageId === image.id && <span className="active-indicator" />}
                </button>
              ))}
              {!images.length && <p className="empty-list">Your images will appear here.</p>}
            </div>
          </div>

          <div className="sidebar-section labels-section">
            <div className="section-heading"><span>LABEL CLASSES</span><span className="count-pill">{labels.length}</span></div>
            <div className="label-list">
              {labelCounts.map((label) => (
                <button key={label.id} className={`label-row ${activeLabelId === label.id ? 'active' : ''}`} onClick={() => setActiveLabelId(label.id)}>
                  <span className="label-swatch" style={{ background: label.color }} /><span>{label.name}</span><span className="label-count">{label.count}</span>
                </button>
              ))}
            </div>
            <form className="new-label-form" onSubmit={addLabel}>
              <input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder="Create a label…" aria-label="New label name" maxLength={40} />
              <button type="submit" disabled={!newLabel.trim()} aria-label="Add label">＋</button>
            </form>
          </div>
          <div className="sidebar-footer"><span className="privacy-icon">◈</span><span><strong>Your data stays local</strong><small>Saved in this browser on this device.</small></span></div>
        </aside>

        <section className="main-panel">
          <div className="canvas-toolbar">
            <div><span className="eyebrow">ANNOTATION WORKSPACE</span><h1>{activeImage ? activeImage.name : 'Start a new dataset'}</h1></div>
            <div className="toolbar-meta"><span className="mode-pill"><span className="mode-dot" /> Bounding box</span><span>{imageAnnotations.length} boxes</span></div>
          </div>

          {!activeImage ? (
            <div className="welcome-state">
              <div className="welcome-art"><div className="art-frame"><span className="art-box art-box-one" /><span className="art-box art-box-two" /><span className="art-cross">＋</span></div></div>
              <p className="eyebrow">OPEN-SOURCE IMAGE LABELING</p>
              <h2>Turn images into<br /><em>structured datasets.</em></h2>
              <p className="welcome-copy">Add images, draw bounding boxes, organize labels, and export annotations in formats used by machine-learning workflows.</p>
              <button className="button button-primary welcome-button" onClick={() => fileInputRef.current?.click()}>＋ Add your first images</button>
              <span className="welcome-footnote">No account · No upload · No tracking</span>
            </div>
          ) : (
            <div className="canvas-area">
              <div className="canvas-instructions"><span><kbd>Click + drag</kbd> to draw a box</span><span>Selected class: <strong style={{ color: activeLabel.color }}>{activeLabel.name}</strong></span></div>
              <div
                ref={stageRef}
                className="image-stage"
                style={{ '--image-ratio': activeImage.width / activeImage.height } as CSSProperties}
                onPointerDown={startDrawing}
                onPointerMove={moveDrawing}
                onPointerUp={finishDrawing}
                onPointerCancel={() => setDraft(null)}
              >
                <img src={activeImage.src} alt={activeImage.name} draggable={false} />
                {imageAnnotations.map((item) => {
                  const label = labels.find((entry) => entry.id === item.labelId)
                  if (!label) return null
                  const style: CSSProperties = { left: `${item.x * 100}%`, top: `${item.y * 100}%`, width: `${item.width * 100}%`, height: `${item.height * 100}%`, borderColor: label.color, '--box-color': label.color } as CSSProperties
                  return <button type="button" data-annotation="true" key={item.id} className={`annotation-box ${selectedId === item.id ? 'selected' : ''}`} style={style} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setSelectedId(item.id) }} aria-label={`${label.name} annotation`}><span className="annotation-tag" style={{ background: label.color }}>{label.name}</span></button>
                })}
                {draftBox && <div className="annotation-box draft-box" style={{ left: `${draftBox.left}%`, top: `${draftBox.top}%`, width: `${draftBox.width}%`, height: `${draftBox.height}%`, borderColor: activeLabel.color }} />}
              </div>
              <div className="canvas-bottom">
                <span>{activeImage.width} × {activeImage.height} px</span>
                <span>Draw with <strong>{activeLabel.name}</strong></span>
                <span>{selectedAnnotation ? '1 selected · Delete to remove' : 'Nothing selected'}</span>
              </div>
            </div>
          )}
        </section>

        <aside className="inspector">
          <div className="inspector-heading"><span>INSPECTOR</span><span className="inspector-menu">···</span></div>
          {selectedAnnotation ? (
            <div className="inspector-content">
              <p className="eyebrow">SELECTED ANNOTATION</p>
              <h2>Bounding box</h2>
              <label className="field-label" htmlFor="annotation-class">Label class</label>
              <select id="annotation-class" value={selectedAnnotation.labelId} onChange={(event) => commit(annotations.map((item) => item.id === selectedId ? { ...item, labelId: event.target.value } : item))}>
                {labels.map((label) => <option key={label.id} value={label.id}>{label.name}</option>)}
              </select>
              <div className="coordinate-grid">
                <div><small>X</small><strong>{(selectedAnnotation.x * 100).toFixed(1)}%</strong></div>
                <div><small>Y</small><strong>{(selectedAnnotation.y * 100).toFixed(1)}%</strong></div>
                <div><small>WIDTH</small><strong>{(selectedAnnotation.width * 100).toFixed(1)}%</strong></div>
                <div><small>HEIGHT</small><strong>{(selectedAnnotation.height * 100).toFixed(1)}%</strong></div>
              </div>
              <button className="button button-danger" onClick={removeSelected}>Delete annotation</button>
            </div>
          ) : (
            <div className="inspector-empty"><div className="inspector-empty-icon">⌗</div><strong>No selection</strong><p>Select a box on the canvas to inspect its label and coordinates.</p></div>
          )}
          <div className="inspector-section">
            <p className="eyebrow">DATASET SUMMARY</p>
            <div className="summary-row"><span>Images</span><strong>{images.length}</strong></div>
            <div className="summary-row"><span>Annotations</span><strong>{annotations.length}</strong></div>
            <div className="summary-row"><span>Label classes</span><strong>{labels.length}</strong></div>
          </div>
          <div className="inspector-section export-section">
            <p className="eyebrow">EXPORT FORMATS</p>
            <button className="export-row" onClick={exportCoco} disabled={!images.length}><span className="format-icon">JSON</span><span><strong>COCO JSON</strong><small>Images, categories & bounding boxes</small></span><span>↗</span></button>
            <button className="export-row" onClick={exportYolo} disabled={!images.length}><span className="format-icon yolo">TXT</span><span><strong>YOLO labels</strong><small>Normalized center x, y, width, height</small></span><span>↗</span></button>
          </div>
          <div className="keyboard-hint"><span>SHORTCUTS</span><p><kbd>Ctrl</kbd> + <kbd>Z</kbd> <span>Undo</span></p><p><kbd>Del</kbd> <span>Delete selected box</span></p><p><kbd>Esc</kbd> <span>Clear selection</span></p></div>
        </aside>
      </div>
      {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></div>}
      <footer className="app-footer"><span>ANNOTATION <span className="footer-dot">●</span> OPEN SOURCE</span><span>Built for dataset creators · MIT License</span><a href="https://github.com/viomborsadiya/Annotation" target="_blank" rel="noreferrer">View on GitHub ↗</a></footer>
    </main>
  )
}

export default App
