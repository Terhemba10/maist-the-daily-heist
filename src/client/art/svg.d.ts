/** Vite `?raw` imports: the SVG source as a string, inlined into the bundle (no extra requests inside Reddit). */
declare module '*.svg?raw' {
  const source: string;
  export default source;
}

/** Vite image imports: the URL of the bundled file. */
declare module '*.webp' {
  const url: string;
  export default url;
}
