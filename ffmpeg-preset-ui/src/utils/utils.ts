export function normalizeUnixPath(path: string): string {
  return path?.replaceAll?.(/([ ()&])/g, '\\$1');
}

const WindowsStylePathRegex = /^.*:\\/;

export function ensureUnixPath(path: string): string {
  if (!WindowsStylePathRegex.test(path)) {
    return path;
  }

  const [driver, tail] = path.split(':\\');
  return `/${driver.toLocaleLowerCase()}/${normalizeUnixPath(tail.replaceAll('\\', '/'))}`;
}
