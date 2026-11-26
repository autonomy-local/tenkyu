/**
 * `firebase auth:export --format=json` の書き出しを読み、uid とメールアドレスの組の配列にする（docs/migration.md の1）。
 * メールアドレスのない利用者と、重複したメールアドレスは、取り込みに回さずに報告する。
 */

/** 書き出しの1件（使う項目だけ） */
type ExportedUser = {
  localId?: unknown;
  email?: unknown;
  disabled?: unknown;
};

export type ImportCandidate = {
  uid: string;
  email: string;
  disabled: boolean;
};

export type DuplicateEmail = {
  /** 比べるために正規化した（前後の空白を除き、小文字にした）メールアドレス */
  email: string;
  uids: string[];
};

export type ParseReport = {
  /** 取り込みに回す利用者（メールアドレスがあり、重複していない） */
  users: ImportCandidate[];
  /** メールアドレスのない利用者の uid */
  missingEmail: string[];
  /** 同じメールアドレスを持つ利用者の組（取り込みに回さない） */
  duplicates: DuplicateEmail[];
  /** 書き出しにあった利用者の数 */
  total: number;
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/** 書き出しの JSON（文字列か、読み込み済みの値）を読む。 */
export const parseFirebaseExport = (input: string | unknown): ParseReport => {
  const data = typeof input === "string" ? JSON.parse(input) : input;
  const users = (data as { users?: unknown })?.users;
  if (!Array.isArray(users)) {
    throw new Error("Firebase の書き出しに users の配列がありません");
  }

  const missingEmail: string[] = [];
  const byEmail = new Map<string, ImportCandidate[]>();

  for (const [index, raw] of (users as ExportedUser[]).entries()) {
    if (typeof raw?.localId !== "string" || raw.localId === "") {
      throw new Error(
        `Firebase の書き出しの ${index} 件目に localId がありません`,
      );
    }
    const uid = raw.localId;
    const email =
      typeof raw.email === "string" && raw.email.trim() !== ""
        ? normalizeEmail(raw.email)
        : null;
    if (email === null) {
      missingEmail.push(uid);
      continue;
    }
    const candidate: ImportCandidate = {
      uid,
      email,
      disabled: raw.disabled === true,
    };
    const list = byEmail.get(email);
    if (list) list.push(candidate);
    else byEmail.set(email, [candidate]);
  }

  const result: ImportCandidate[] = [];
  const duplicates: DuplicateEmail[] = [];
  for (const [email, list] of byEmail) {
    if (list.length === 1) result.push(list[0]);
    else duplicates.push({ email, uids: list.map((u) => u.uid) });
  }

  return { users: result, missingEmail, duplicates, total: users.length };
};
