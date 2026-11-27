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

All four geometric values are normalized to the range 0–1. Class IDs follow the current label order in the UI. The current MVP writes all image sections into one text download with filename comment separators; this is a convenience export, not yet a complete Ultralytics dataset directory.

## Important limitations

- The current session is held in memory and is cleared when the page reloads.
- The YOLO download is not yet a ZIP archive with one `.txt` file per image.
- There is no import workflow or round-trip guarantee yet.
- There are no polygon, mask, keypoint, or rotated-box exports.
- Validate exported files against the exact training tool and dataset schema you intend to use.

Please report format incompatibilities with a small, non-sensitive fixture and the expected output.
