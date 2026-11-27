import { Hono } from "hono";
import { hashCode } from "../verifiers/email-code/code";

type Bindings = { DB: D1Database };

export type PrincipalSearchOptions = {
  /**
   * メールアドレスの鍵つきハッシュの鍵。identities の `email_code` の行は、平文でなくこのハッシュを識別子に持つ
   * （確認コードの宛先のハッシュと、Firebase からの取り込みと同じ鍵）
   */
  hashKey: string;
};

/** 見つかった主体。識別子（メールアドレスのハッシュ、uid など）は返さず、手段の種類と日時だけを返す */
export type FoundPrincipal = {
  id: string;
  identities: {
    provider: string;
    created_at: number;
    disabled_at: number | null;
  }[];
};

const findById = async (
  db: D1Database,
  id: string,
): Promise<FoundPrincipal[]> => {
  const { results } = await db
    .prepare(
      "SELECT provider, created_at, disabled_at FROM identities WHERE sub = ? ORDER BY created_at, provider",
    )
    .bind(id)
    .all<FoundPrincipal["identities"][number]>();
  return results.length === 0 ? [] : [{ id, identities: results }];
};

/**
 * 管理の口：主体の検索（次-4a）。`GET /principals?id=` か `?email=` で、当たる主体を配列で返す。見つからなければ空の配列。
 * Access の JWT（accessAuth）と管理用のホスト名（adminHostOnly）は、これを載せる側で前に付ける。
 */
export const principalSearchRoutes = (options: PrincipalSearchOptions) => {
  const routes = new Hono<{ Bindings: Bindings }>();
  routes.get("/principals", async (c) => {
    const id = c.req.query("id")?.trim();
    const email = c.req.query("email")?.trim().toLowerCase();
    if ((!id && !email) || (id && email)) {
      return c.json(
        { error: "id か email のどちらか1つを指定してください" },
        400,
      );
    }
    let subId: string | undefined = id;
    if (email) {
      const row = await c.env.DB.prepare(
        "SELECT sub FROM identities WHERE provider = 'email_code' AND provider_subject = ?",
      )
        .bind(await hashCode(email, options.hashKey))
        .first<{ sub: string }>();
      subId = row?.sub;
    }
    const principals = subId ? await findById(c.env.DB, subId) : [];
    return c.json({ principals });
  });
  return routes;
};
