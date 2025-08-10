import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { convexToZodFields } from "convex-helpers/server/zod";
import { zid } from "convex-helpers/server/zod";
import type { PropertyValidators } from "convex/values";
import { ZodRawShape, ZodTypeAny } from "zod";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export class Logger {
  constructor(private readonly name: string) {}

  info(message: string, data?: unknown) {
    console.log(`[${this.name}] ${message}`, data);
  }

  error(message: string, data?: unknown) {
    console.error(`[${this.name}] ${message}`, data);
  }

  warn(message: string, data?: unknown) {
    console.warn(`[${this.name}] ${message}`, data);
  }
}

export const logger = new Logger("DailyBar");
