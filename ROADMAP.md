# Roadmap

This roadmap describes possible development priorities. Items are not commitments or claims that a feature is already available.

## MVP — current focus

- [x] Multi-image selection in a browser session
- [x] Bounding-box drawing and selection
- [x] User-defined label classes
- [x] Basic COCO JSON export
- [x] Normalized YOLO bounding-box export
- [x] Local-first processing without an application backend
- [ ] Automated unit and browser interaction tests
- [x] Durable local project persistence (IndexedDB)

## Next: annotation quality

- [ ] Undo/redo for all editing operations
- [ ] Keyboard-first annotation workflow
- [ ] Polygon and semantic segmentation tools
- [ ] Annotation validation and class management
- [ ] Image navigation and zoom/pan controls

## Next: dataset interoperability

- [x] Export a downloadable ZIP with one YOLO label file per image and data.yaml
- [ ] Generate YOLO `data.yaml` and class manifests
- [ ] COCO import and round-trip validation
- [ ] Export validation reports and empty-label handling
- [ ] Dataset statistics and class distribution

## Later: collaboration and scale

- [ ] Optional project format with versioned schema
- [ ] Large-dataset performance improvements
- [ ] Video frame annotation
- [ ] Text and audio annotation exploration
- [ ] Optional self-hosted collaboration backend

## How priorities are chosen

Issues with clear user impact, reproducible examples, thoughtful discussion, and a feasible implementation path are considered first. Please open an issue before starting a large feature.
