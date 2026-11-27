export type DatasetImage = { id: string; name: string; src: string; width: number; height: number }
export type LabelClass = { id: string; name: string; color: string }
export type Annotation = { id: string; imageId: string; labelId: string; x: number; y: number; width: number; height: number }
