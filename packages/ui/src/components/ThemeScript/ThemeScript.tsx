/**
 * Applies the stored theme before first paint.
 *
 * This has to be a blocking inline script in `<head>`. Anything that runs after
 * hydration — a `useEffect`, a client provider — paints the default theme
 * first, and a user who chose dark gets a white flash on every navigation. The
 * token sheet keys off `[data-theme]`, and its `:root:not([data-theme="light"])`
 * media block already handles the no-preference case, so this script only has
 * to write an explicit choice.
 *
 * `localStorage` rather than a cookie: this is a UI preference, it is never sent
 * to the server, and a cookie would drag it into the consent banner for no
 * reason.
 *
 * `storageKey` is passed rather than assumed because this script and
 * `ThemeToggle` are the two halves of one contract and never see each other —
 * this one runs before React exists. The app owns the key, and namespaces it,
 * since `localStorage` is per *origin* rather than per app.
 */
export function ThemeScript({ storageKey }: { storageKey: string }) {
  /*
   * `JSON.stringify` on the key, not interpolation. It ends up inside a script
   * body as a string literal, and a key containing a quote would otherwise
   * close it — the one place in this package where a prop reaches something
   * that is parsed as code.
   */
  const script = `try{var t=localStorage.getItem(${JSON.stringify(storageKey)});if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
