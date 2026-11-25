/** Vite `?raw` imports: the SVG source as a string, inlined into the bundle (no extra requests inside Reddit). */
declare module '*.svg?raw' {
  const source: string;
  export default source;
}
