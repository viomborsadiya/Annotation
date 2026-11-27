# Annotation export formats

The MVP currently supports two export actions. This page documents their intended structure and known limitations.

## COCO-style JSON

The COCO export contains:

- `images`: sequential numeric ID, original filename, width, and height.
- `categories`: sequential numeric ID and label name.
- `annotations`: image ID, category ID, pixel-space `[x, y, width, height]` bounding box, area, empty segmentation, and `iscrowd: 0`.

Coordinates are derived from normalized box values and the source image dimensions. The current exporter does not include image binaries, licenses, or segmentation polygons.

## YOLO normalized bounding boxes

Each annotation is represented as:

```text
class_id center_x center_y width height
```

All four geometric values are normalized to the range 0–1. Class IDs follow the current label order in the UI. The YOLO dataset ZIP includes source images and a matching label file for every image, including empty label files for images without boxes. Files are arranged under `images/train`, `images/val`, `labels/train`, and `labels/val`, with a root `data.yaml` containing class names and split paths. A deterministic holdout assigns approximately one in five images to validation when there are multiple images. With a single image, all data remains in training; create a separate validation set before evaluating a model.

## Important limitations

- Projects are saved in IndexedDB in the current browser profile. Clearing site data or switching browsers/devices removes access to that local copy.
- The ZIP uses uncompressed entries to keep the implementation dependency-free; very large datasets may require substantial browser memory while exporting.
- There is no import workflow or round-trip guarantee yet.
- There are no polygon, mask, keypoint, or rotated-box exports.
- Validate exported files against the exact training tool and dataset schema you intend to use.

Please report format incompatibilities with a small, non-sensitive fixture and the expected output.
