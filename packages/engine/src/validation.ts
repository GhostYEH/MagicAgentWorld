/**
 * 参数 Schema 校验（简化 JSON Schema 子集）。
 * 工具执行前必须先通过参数校验。
 */

import type { JsonSchema } from './types';

export interface ValidationError {
  path: string;
  message: string;
}

export function validateArgs(
  schema: JsonSchema,
  args: Record<string, unknown>,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const props = schema.properties;
  if (schema.additionalProperties === false) {
    for (const key of Object.keys(args)) {
      if (!(key in props)) errors.push({ path: key, message: '不允许多余参数' });
    }
  }
  for (const [name, prop] of Object.entries(props)) {
    const value = args[name];
    if (value === undefined) {
      if (schema.required?.includes(name)) {
        errors.push({ path: name, message: '缺少必填参数' });
      }
      continue;
    }
    const actual = Array.isArray(value) ? 'array' : typeof value;
    const expected = prop.type === 'integer' ? 'number' : prop.type;
    if (expected === 'number' && actual === 'number') {
      if (prop.type === 'integer' && !Number.isInteger(value)) {
        errors.push({ path: name, message: '期望整数' });
      }
      continue;
    }
    if (actual !== expected) {
      errors.push({ path: name, message: `期望 ${prop.type}，实际 ${actual}` });
      continue;
    }
    if (prop.enum && !prop.enum.includes(String(value))) {
      errors.push({ path: name, message: `取值必须是 ${prop.enum.join(' | ')}` });
    }
  }
  return errors;
}
