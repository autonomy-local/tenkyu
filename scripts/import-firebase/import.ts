/**
 * 読んだ利用者の一覧（parse.ts）から主体を作り、identities に `firebase` と `email_code` の行を作る（docs/migration.md の2）。
 * すでに取り込んだ利用者（Firebase の uid の行がある）は作り直さないので、何度流しても行は増えない。
 * 各サービスに渡す「uid → 主体の ID」の対応表（CSV）を返す。対応表にメールアドレスは入れない。
 */

import { disable, link } from "../../src/identities/index";
import type { PrincipalLedger } from "../../src/principals/types";
import { hashCode } from "../../src/verifiers/email-code/code";
import type { ImportCandidate } from "./parse";

export type ImportOptions = {
  db: D1Database;
  ledger: PrincipalLedger;
  /**
   * メールアドレスの鍵つきハッシュの鍵。identities の `email_code` の行には、平文ではなくこのハッシュを入れる。
   * 確認コードの宛先のハッシュ（email_codes.destination_hash）と同じ鍵を使う
   */
  hashKey: string;
  now?: () => number;
};

export type MappingRow = { firebase_uid: string; sub: string };

export type ImportReport = {
  /** 対応表の行（今回作ったものと、前に作ってあったものの両方） */
  mapping: MappingRow[];
  /** 今回新しく作った主体の数 */
  created: number;
  /** 前の取り込みで作ってあったので飛ばした数 */
  skipped: number;
  /** メールアドレスが別の主体にひもづいていて、取り込めなかった uid */
  emailConflicts: string[];
  /** 台帳での主体の作成に失敗した uid */
  failed: string[];
};

/** Firebase の uid の行を、無効化したものも含めて引く（無効の利用者も2回目に作り直さないため） */
const findByFirebaseUid = async (
  db: D1Database,
  uid: string,
): Promise<string | null> => {
  const row = await db
    .prepare(
      "SELECT sub FROM identities WHERE provider = 'firebase' AND provider_subject = ?",
    )
    .bind(uid)
    .first<{ sub: string }>();
  return row?.sub ?? null;
};

const emailLinked = async (
  db: D1Database,
  emailHash: string,
): Promise<boolean> =>
  (await db
    .prepare(
      "SELECT 1 FROM identities WHERE provider = 'email_code' AND provider_subject = ?",
    )
    .bind(emailHash)
    .first()) !== null;

export const importUsers = async (
  users: ImportCandidate[],
  options: ImportOptions,
): Promise<ImportReport> => {
  const { db, ledger } = options;
  const identityOptions = options.now ? { now: options.now } : {};
  const report: ImportReport = {
    mapping: [],
    created: 0,
    skipped: 0,
    emailConflicts: [],
    failed: [],
  };

  for (const user of users) {
    const existing = await findByFirebaseUid(db, user.uid);
    if (existing !== null) {
      report.mapping.push({ firebase_uid: user.uid, sub: existing });
      report.skipped++;
      continue;
    }

    // parse.ts でメールアドレスは正規化済み（前後の空白を除き、小文字）
    const emailHash = await hashCode(user.email, options.hashKey);
    if (await emailLinked(db, emailHash)) {
      report.emailConflicts.push(user.uid);
      continue;
    }

    const created = await ledger.createPrincipal();
    if (!created.ok) {
      report.failed.push(user.uid);
      continue;
    }
    const sub = created.value.principal_id;

    for (const [provider, subject] of [
      ["firebase", user.uid],
      ["email_code", emailHash],
    ] as const) {
      const linked = await link(db, sub, provider, subject, identityOptions);
      if (linked.ok && user.disabled) {
        await disable(db, linked.id, identityOptions);
      }
    }
    report.mapping.push({ firebase_uid: user.uid, sub });
    report.created++;
  }
  return report;
};

const csvField = (value: string): string =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/** 対応表を CSV（ヘッダー行あり、列は firebase_uid と sub だけ）にする */
export const toMappingCsv = (mapping: MappingRow[]): string =>
  `${[
    "firebase_uid,sub",
    ...mapping.map(
      (row) => `${csvField(row.firebase_uid)},${csvField(row.sub)}`,
    ),
  ].join("\n")}\n`;
