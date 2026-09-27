// Remembers the last two in-app routes, so a page can offer "← Rankings"
// when the user came from Rankings. document.referrer does not change on
// client-side navigation, so the app records routes itself.
//
// Module state lasts across client navigations and resets on a full load.

let current: string | null = null;
let previous: string | null = null;

export function recordRoute(route: string) {
  if (route === current) return;
  previous = current;
  current = route;
}

/**
 * The route the user was on before `route`. It works whether or not `route`
 * has been recorded yet, because effects can run in either order.
 */
export function routeBefore(route: string) {
  return current === route ? previous : current;
}
