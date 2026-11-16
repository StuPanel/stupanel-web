type Classify = (r: number, c: number, s: number, pixels: Uint8Array, ldim: number) => number;
declare const pico: {
  unpack_cascade(bytes: Int8Array): Classify;
  run_cascade(image: { pixels: Uint8Array; nrows: number; ncols: number; ldim: number }, classify: Classify, params: { shiftfactor: number; minsize: number; maxsize: number; scalefactor: number }): number[][];
  cluster_detections(dets: number[][], iou: number): number[][];
  instantiate_detection_memory(size: number): (dets: number[][]) => number[][];
};
export default pico;
