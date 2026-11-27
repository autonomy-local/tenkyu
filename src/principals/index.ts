import { D1PrincipalLedger } from "./d1";
import type { PrincipalLedger } from "./types";

/** 主体の台帳の中身の名前。Mizucho の中身（今-9c）はここに足す */
export const PRINCIPALS_BACKENDS = ["d1"] as const;
export type PrincipalsBackend = (typeof PRINCIPALS_BACKENDS)[number];

/** 台帳を選ぶのに使う設定（wrangler.toml の vars と、結び付け） */
export type PrincipalsEnv = {
  PRINCIPALS_BACKEND?: string;
  DB: D1Database;
};

/**
 * 設定の `PRINCIPALS_BACKEND` から主体の台帳の中身を選ぶ。
 * 知らない値や空のときは、黙って別の中身に倒さず、例外で止める。
 */
export const selectPrincipalLedger = (env: PrincipalsEnv): PrincipalLedger => {
  const backend = env.PRINCIPALS_BACKEND;
  switch (backend) {
    case "d1":
      return new D1PrincipalLedger(env.DB);
    default:
      throw new Error(
        `PRINCIPALS_BACKEND の値が知らないものです（使える値：${PRINCIPALS_BACKENDS.join("、")}）`,
      );
  }
};
