# Annotation

**A local-first, open-source image annotation workspace for machine-learning datasets.**

Annotation is a browser-based tool for organizing image datasets, drawing bounding boxes, assigning label classes, and exporting annotations for common computer-vision workflows. Images are read locally in your browser; this starter application does not upload them to a server.

> Status: early development / MVP. The current release focuses on image-level bounding-box annotation. Review the roadmap before relying on it for production dataset pipelines.

## Features

- Add multiple JPG, PNG, and WEBP images.
- Draw and select bounding boxes on an image.
- Create and switch between label classes.
- Inspect normalized box coordinates and delete selected annotations.
- Undo the most recent annotation changes with `Ctrl/⌘ + Z`.
- Export a COCO-style JSON document or YOLO normalized bounding-box labels.
- Responsive workspace with dataset summary and keyboard shortcuts.
- Local-first processing: image data remains in the current browser session.

## Quick start

Requirements: Node.js 20.19+ or 22.12+, and npm.

```bash
git clone https://github.com/viomborsadiya/Annotation.git
cd Annotation
npm ci
npm run dev
```

Open the local URL printed by Vite. To create a production build:

```bash
npm run lint
npm run build
npm run preview
```

## How to use

1. Select **Add images** and choose one or more images.
2. Choose a label class in the left sidebar.
3. Click and drag on the image to create a bounding box.
4. Select a box to inspect or change its label; press **Delete** to remove it.
5. Export the dataset as COCO JSON or YOLO text labels.

### Export notes

- **COCO JSON** contains image metadata, category definitions, and bounding boxes in pixel coordinates `[x, y, width, height]`.
- **YOLO** contains normalized `class_id center_x center_y width height` values. The current MVP downloads one text document with image-name separators; a future dataset packaging workflow will emit one label file per image and a `data.yaml` manifest.

See [docs/annotation-formats.md](docs/annotation-formats.md) for details and limitations.

## Privacy and data handling

The application uses the browser File API and in-memory data URLs. It does not currently include a backend, account system, analytics, or remote image storage. Refreshing or closing the tab clears the current working session. Do not use this MVP as the only copy of important annotation work; export your dataset regularly.

## Project principles

- **Useful before flashy:** prioritize reliable annotation workflows and interoperable exports.
- **Local-first by default:** keep dataset content on the user's device unless an explicit sync feature is introduced.
- **Transparent limitations:** document what is implemented, what is experimental, and what is planned.
- **Open collaboration:** welcome bug reports, reproducible examples, tests, and focused pull requests.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request. Please include reproduction steps for bugs and tests for behavior changes where practical.

## Security

Please see [SECURITY.md](SECURITY.md) for responsible vulnerability reporting.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned work. Roadmap items are intentions, not shipped features.

## License

Distributed under the [MIT License](LICENSE).
