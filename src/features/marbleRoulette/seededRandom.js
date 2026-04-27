export const createSeededRandom = (seedValue = 1) => {
  let value = Number(seedValue) >>> 0;
  if (!value) value = 1;

  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
};

export const seededShuffle = (items, seedValue = 1) => {
  const random = createSeededRandom(seedValue);
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(random() * (index + 1));
    [result[index], result[nextIndex]] = [result[nextIndex], result[index]];
  }
  return result;
};
