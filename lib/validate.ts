import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { imageSize } from 'image-size';
import type { Image } from './types';
import { Issues } from './errors';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ASSET_RE = /^\/content\/[A-Za-z0-9/._-]+$/;
const ASSET_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function describeValue(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return '数组';
  return typeof value;
}

export function checkUnknownFields(
  obj: Record<string, unknown>,
  allowed: readonly string[],
  file: string,
  field: string,
  issues: Issues,
): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      const path = field ? `${field}.${key}` : key;
      issues.add(file, `未知字段 ${path}`, path);
    }
  }
}

export function validateObject(
  value: unknown,
  file: string,
  field: string,
  allowed: readonly string[],
  issues: Issues,
): Record<string, unknown> | undefined {
  if (value === undefined) {
    issues.add(file, '缺少必填字段', field);
    return undefined;
  }
  if (!isPlainObject(value)) {
    issues.add(file, `类型错误：应为对象，实际为 ${describeValue(value)}`, field);
    return undefined;
  }
  checkUnknownFields(value, allowed, file, field, issues);
  return value;
}

export function validateOptionalObject(
  value: unknown,
  file: string,
  field: string,
  allowed: readonly string[],
  issues: Issues,
): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  return validateObject(value, file, field, allowed, issues);
}

export function validateText(
  value: unknown,
  file: string,
  field: string,
  min: number,
  max: number,
  issues: Issues,
  required = true,
): string | undefined {
  if (value === undefined) {
    if (required) issues.add(file, '缺少必填字段', field);
    return undefined;
  }
  if (typeof value !== 'string') {
    issues.add(file, `类型错误：应为字符串，实际为 ${describeValue(value)}`, field);
    return undefined;
  }
  if (value !== value.normalize('NFC')) {
    issues.add(file, '必须是 NFC 规范化文本', field);
    return undefined;
  }
  if (value.trim() !== value) {
    issues.add(file, '不得包含首尾空白', field);
    return undefined;
  }
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    issues.add(file, '不得包含换行或控制字符', field);
    return undefined;
  }
  const length = [...value].length;
  if (length < min || length > max) {
    issues.add(file, `长度必须在 ${min}–${max} 个字符之间，实际 ${length}`, field);
    return undefined;
  }
  return value;
}

export function validateSlug(
  value: unknown,
  file: string,
  field: string,
  issues: Issues,
  required = true,
): string | undefined {
  const text = validateText(value, file, field, 1, 80, issues, required);
  if (text === undefined) return undefined;
  if (!SLUG_RE.test(text)) {
    issues.add(file, `必须是 1–80 个 ASCII 字符的小写 slug（${SLUG_RE.source}）`, field);
    return undefined;
  }
  return text;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1] ?? 0;
}

export function validateDate(
  value: unknown,
  file: string,
  field: string,
  issues: Issues,
  required = true,
): string | undefined {
  if (value === undefined) {
    if (required) issues.add(file, '缺少必填字段', field);
    return undefined;
  }
  if (typeof value !== 'string') {
    issues.add(file, '类型错误：日期必须是 YYYY-MM-DD 字符串（YAML 中需加引号）', field);
    return undefined;
  }
  const match = DATE_RE.exec(value);
  if (!match) {
    issues.add(file, '日期格式必须是 YYYY-MM-DD', field);
    return undefined;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || year > 9999) {
    issues.add(file, '年份必须在 0001–9999 之间', field);
    return undefined;
  }
  if (month < 1 || month > 12) {
    issues.add(file, '月份必须在 01–12 之间', field);
    return undefined;
  }
  if (day < 1 || day > daysInMonth(year, month)) {
    issues.add(file, `${value} 不是真实存在的 Gregorian 日期`, field);
    return undefined;
  }
  return value;
}

export function validateInteger(
  value: unknown,
  file: string,
  field: string,
  min: number,
  max: number,
  issues: Issues,
): number | undefined {
  if (value === undefined) {
    issues.add(file, '缺少必填字段', field);
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    issues.add(file, `类型错误：应为整数，实际为 ${describeValue(value)}`, field);
    return undefined;
  }
  if (value < min || value > max) {
    issues.add(file, `必须在 ${min}–${max} 之间，实际 ${value}`, field);
    return undefined;
  }
  return value;
}

export function validateEnum<T extends string>(
  value: unknown,
  file: string,
  field: string,
  allowed: readonly T[],
  issues: Issues,
): T | undefined {
  if (value === undefined) {
    issues.add(file, '缺少必填字段', field);
    return undefined;
  }
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    issues.add(file, `必须是 ${allowed.join(' | ')} 之一`, field);
    return undefined;
  }
  return value as T;
}

export function validateAssetPath(
  value: unknown,
  file: string,
  field: string,
  publicDir: string,
  issues: Issues,
): string | undefined {
  if (typeof value !== 'string') {
    issues.add(file, `类型错误：资源路径应为字符串，实际为 ${describeValue(value)}`, field);
    return undefined;
  }
  if (!ASSET_RE.test(value)) {
    issues.add(file, '资源路径必须以 /content/ 开始，且只含 ASCII 字母、数字、/、-、_、.', field);
    return undefined;
  }
  const segments = value.slice(1).split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    issues.add(file, '资源路径不得包含空段、. 或 ..', field);
    return undefined;
  }
  if (!ASSET_EXTENSIONS.has(extname(value).toLowerCase())) {
    issues.add(file, '资源只允许 PNG/JPEG/WebP/AVIF', field);
    return undefined;
  }
  const diskPath = join(publicDir, value.slice(1));
  if (!existsSync(diskPath) || !statSync(diskPath).isFile()) {
    issues.add(file, `资源文件不存在：public${value}`, field);
    return undefined;
  }
  return value;
}

export function readImageDimensions(
  src: string,
  publicDir: string,
): { width: number; height: number } | undefined {
  try {
    const size = imageSize(readFileSync(join(publicDir, src.slice(1))));
    if (typeof size.width !== 'number' || typeof size.height !== 'number') return undefined;
    return { width: size.width, height: size.height };
  } catch {
    return undefined;
  }
}

export function validateImage(
  value: unknown,
  file: string,
  field: string,
  publicDir: string,
  issues: Issues,
): Image | undefined {
  const obj = validateObject(value, file, field, ['src', 'alt', 'width', 'height'], issues);
  if (!obj) return undefined;
  const src = validateAssetPath(obj.src, file, `${field}.src`, publicDir, issues);
  const alt = validateText(obj.alt, file, `${field}.alt`, 1, 200, issues);
  const width = validateInteger(obj.width, file, `${field}.width`, 1, 10000, issues);
  const height = validateInteger(obj.height, file, `${field}.height`, 1, 10000, issues);
  if (src === undefined || alt === undefined || width === undefined || height === undefined) {
    return undefined;
  }
  const actual = readImageDimensions(src, publicDir);
  if (!actual) {
    issues.add(file, `资源无法解码为图片：public${src}`, `${field}.src`);
    return undefined;
  }
  if (actual.width !== width || actual.height !== height) {
    issues.add(
      file,
      `声明的图片尺寸 ${width}×${height} 与实际 ${actual.width}×${actual.height} 不一致`,
      `${field}.width`,
    );
    return undefined;
  }
  return { src, alt, width, height };
}

export function validateSeo(
  value: unknown,
  file: string,
  field: string,
  publicDir: string,
  issues: Issues,
): { title?: string; description?: string; ogImage?: Image } | undefined {
  const obj = validateOptionalObject(value, file, field, ['title', 'description', 'ogImage'], issues);
  if (!obj) return undefined;
  if (Object.keys(obj).length === 0) {
    issues.add(file, 'seo 对象至少需要覆盖一个字段', field);
    return undefined;
  }
  const title = validateText(obj.title, file, `${field}.title`, 1, 100, issues, false);
  const description = validateText(obj.description, file, `${field}.description`, 1, 200, issues, false);
  const ogImage =
    obj.ogImage === undefined ? undefined : validateImage(obj.ogImage, file, `${field}.ogImage`, publicDir, issues);
  return {
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(ogImage !== undefined ? { ogImage } : {}),
  };
}
