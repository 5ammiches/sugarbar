import { z } from "zod";

/**
 * Get a value from an object using dot notation
 */
export function getValueByPath(obj: any, path: string) {
  return path.split(".").reduce((acc, key) => {
    if (acc === undefined || acc === null) return undefined;
    if (/^\d+$/.test(key)) {
      return acc[Number(key)];
    }
    return acc[key];
  }, obj);
}

/**
 * Set a value in an object using dot notation
 */
export function setValueByPath(obj: any, path: string, value: any) {
  const keys = path.split(".");
  let current = obj;

  keys.forEach((key, index) => {
    const isLast = index === keys.length - 1;

    if (isLast) {
      current[key] = value;
    } else {
      if (!(key in current) || typeof current[key] !== "object") {
        current[key] = {};
      }
      current = current[key];
    }
  });
}

export type FieldMap<T> = Record<string, string>;

export function createMapper<T>(
  schema: z.ZodType<T>,
  fieldMap: FieldMap<T>,
  transforms?: Partial<Record<string, (val: any, raw?: any) => any>>
) {
  return (raw: Record<string, any>): T => {
    const mapped: any = {};

    for (const [externalPath, internalPath] of Object.entries(fieldMap)) {
      const rawValue = getValueByPath(raw, externalPath);
      const transformedValue = transforms?.[internalPath]
        ? transforms[internalPath]!(rawValue, raw)
        : rawValue;

      setValueByPath(mapped, internalPath, transformedValue);
    }

    if (transforms) {
      for (const [internalPath, transformFn] of Object.entries(transforms)) {
        if (typeof transformFn === "function") {
          const existingValue = getValueByPath(mapped, internalPath);
          const newValue = transformFn(existingValue, raw);

          if (Array.isArray(existingValue) && Array.isArray(newValue)) {
            setValueByPath(mapped, internalPath, [
              ...existingValue,
              ...newValue,
            ]);
          } else if (
            existingValue &&
            typeof existingValue === "object" &&
            typeof newValue === "object" &&
            !Array.isArray(existingValue) &&
            !Array.isArray(newValue)
          ) {
            setValueByPath(mapped, internalPath, {
              ...existingValue,
              ...newValue,
            });
          } else {
            setValueByPath(mapped, internalPath, newValue);
          }
        }
      }
    }

    return schema.parse(mapped);
  };
}
