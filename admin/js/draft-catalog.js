/** Draft entries override published masters, retaining stable list order. */
export function mergeCatalog(published, pending) {
  return [...new Map([...published, ...pending].map(entry => [String(entry.id), entry])).values()];
}
