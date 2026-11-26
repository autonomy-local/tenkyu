/**
 * identities の表（docs/schema.md の 1.）を読み書きする関数。
 * メール、Firebase、パスキーのどの手段でも、手段の識別子から主体の ID を引く・ひもづけるのはここを通す。
 */

export type LinkResult =
  | { ok: true; id: string }
  /** 同じ手段と識別子の組が、すでに（無効化した行も含めて）ひもづいている */
  | { ok: false; error: "already_linked" };

export type IdentityOptions = {
  /** 今の時刻（UNIX エポック秒）。テストで差し替える */
  now?: () => number;
  /** 行の ID の作り方。テストで差し替える */
  newId?: () => string;
};

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** 手段と識別子から主体の ID を引く。ない・無効化した行なら null。 */
export const findPrincipalId = async (
  db: D1Database,
  provider: string,
  identifier: string,
): Promise<string | null> => {
  const row = await db
    .prepare(
      "SELECT sub FROM identities WHERE provider = ? AND provider_subject = ? AND disabled_at IS NULL",
    )
    .bind(provider, identifier)
    .first<{ sub: string }>();
  return row?.sub ?? null;
};

/** 主体に手段と識別子をひもづける。同じ組がすでにあれば already_linked を返す。 */
export const link = async (
  db: D1Database,
  principalId: string,
  provider: string,
  identifier: string,
  options: IdentityOptions = {},
): Promise<LinkResult> => {
  const id = (options.newId ?? (() => crypto.randomUUID()))();
  const now = (options.now ?? nowSeconds)();
  // 一意制約（provider, provider_subject）に当たった行は入れず、入ったかどうかで見分ける
  const result = await db
    .prepare(
      "INSERT INTO identities (id, sub, provider, provider_subject, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (provider, provider_subject) DO NOTHING",
    )
    .bind(id, principalId, provider, identifier, now)
    .run();
  if (result.meta.changes === 0) return { ok: false, error: "already_linked" };
  return { ok: true, id };
};

/** 行を無効化する。無効化した行は findPrincipalId で見つからない。無効化した行があれば true。 */
export const disable = async (
  db: D1Database,
  id: string,
  options: Pick<IdentityOptions, "now"> = {},
): Promise<boolean> => {
  const now = (options.now ?? nowSeconds)();
  const result = await db
    .prepare(
      "UPDATE identities SET disabled_at = ? WHERE id = ? AND disabled_at IS NULL",
    )
    .bind(now, id)
    .run();
  return result.meta.changes > 0;
};
