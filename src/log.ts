/**
 * Worker のログの関数。ログ（console）はこの関数だけを通す。
 * 決めた項目だけを受けて出し、メールアドレスやコードなどの入力の値を出さない（docs/events.md、ADR 0004）。
 */

export type LogLevel = "info" | "warn" | "error";

/** ログに出してよい項目。入力の値（メールアドレス、コード、トークン）を入れる項目は置かない */
export type LogFields = {
  /** 出来事の種類（例：`code_verify`） */
  event: string;
  /** サービスの識別子 */
  service?: string;
  /** 結果 */
  result?: "success" | "failure";
  /** 失敗の理由などの区分（例：`expired`） */
  reason?: string;
  /** 要求の ID（`cf-ray` など） */
  requestId?: string;
};

const ALLOWED_KEYS = [
  "event",
  "service",
  "result",
  "reason",
  "requestId",
] as const satisfies readonly (keyof LogFields)[];

// 型をすり抜けて値に入ってしまった入力を伏せる（念のための守り）
const EMAIL_PATTERN = /[^\s@"]+@[^\s@"]+/g;
const CODE_PATTERN = /\b\d{6}\b/g;
const REDACTED = "[redacted]";

const redact = (value: string): string =>
  value.replace(EMAIL_PATTERN, REDACTED).replace(CODE_PATTERN, REDACTED);

/** 決めた項目以外の鍵を持つと、型の誤りになる */
type Exact<T> = T & Record<Exclude<keyof T, keyof LogFields>, never>;

type Sink = (line: string) => void;

const sinks: Record<LogLevel, Sink> = {
  info: (line) => console.log(line),
  warn: (line) => console.warn(line),
  error: (line) => console.error(line),
};

/** 1行の JSON を組み立てる（テストのために分けてある） */
export const formatLog = <T extends LogFields>(
  level: LogLevel,
  fields: Exact<T>,
): string => {
  const out: Record<string, string> = { level };
  for (const key of ALLOWED_KEYS) {
    const value = (fields as LogFields)[key];
    if (typeof value === "string") out[key] = redact(value);
  }
  return JSON.stringify(out);
};

export const log = <T extends LogFields>(
  level: LogLevel,
  fields: Exact<T>,
): void => {
  sinks[level](formatLog(level, fields));
};
