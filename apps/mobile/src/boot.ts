export const marks: { name: string; at: number }[] = [];

export function bootMark(name: string) {
  marks.push({ name, at: Date.now() });
}

bootMark("js-start");
