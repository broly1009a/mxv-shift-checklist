export const jsonSerialize = <T = any>(obj: T): string => {
  try {
    return JSON.stringify(obj);
  } catch (err) {
    return "";
  }
};

export const jsonDeserialize = <T = any>(str: string): T | null => {
  try {
    return JSON.parse(str) as T;
  } catch (err) {
    return null;
  }
};
