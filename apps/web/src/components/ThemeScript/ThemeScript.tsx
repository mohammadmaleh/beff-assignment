export const THEME_STORAGE_KEY = 'beff-theme';

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
 */
export function ThemeScript() {
  const script = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
