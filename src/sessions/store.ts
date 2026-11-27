import {
  type AuthMethod,
  CONTRACT_VERSION,
  type LogoutResponse,
  type VerifySessionResponse,
} from "../contract";
import { generateSessionId, hashSessionId } from "./token";

/** 今の時刻（UNIX エポック秒）を返す関数。テストで差し替える */
type Clock = () => number;
const systemClock: Clock = () => Math.floor(Date.now() / 1000);

export type CreateSessionInput = {
  sub: string;
  service: string;
  amr: AuthMethod;
  /** 認証が成功した時刻（UNIX エポック秒） */
  authTime: number;
  /** 作成からの絶対の有効期限（秒） */
  ttlSeconds: number;
};

export type CreatedSession = {
  /** クライアントに渡す平文のトークン。D1 にはハッシュだけを置く */
  token: string;
  /** 保存した行の ID（トークンのハッシュ）。失効の操作に使う */
  id: string;
  expiresAt: number;
};

type SessionRow = {
  sub: string;
  service: string;
  amr: AuthMethod;
  auth_time: number;
  expires_at: number;
  revoked_at: number | null;
};

const fail = (
  reason: "expired" | "revoked" | "unknown",
): VerifySessionResponse => ({
  valid: false,
  reason,
  version: CONTRACT_VERSION,
});

/**
 * セッションの作成・検証・ログアウト・失効（docs/contract.md の 1.1、1.2、2.）。
 * トークンは平文で持たず、`sessions.id` にはハッシュ（hashSessionId）を入れる。
 * 上限（limit_exceeded）と無操作（idle_timeout）の判定は、ここではしない（今-12a、今-12b）。
 */
export class SessionStore {
  private readonly now: Clock;

  constructor(
    private readonly db: D1Database,
    options: { now?: Clock } = {},
  ) {
    this.now = options.now ?? systemClock;
  }

  async create(input: CreateSessionInput): Promise<CreatedSession> {
    const token = generateSessionId();
    const id = await hashSessionId(token);
    const now = this.now();
    const expiresAt = now + input.ttlSeconds;
    await this.db
      .prepare(
        "INSERT INTO sessions (id, sub, service, amr, auth_time, created_at, last_active_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        id,
        input.sub,
        input.service,
        input.amr,
        input.authTime,
        now,
        now,
        expiresAt,
      )
      .run();
    return { token, id, expiresAt };
  }

  /** トークンを確かめる。別のサービスのセッションは、ないものとして `unknown` を返す */
  async verify(token: string, service: string): Promise<VerifySessionResponse> {
    if (token === "") return fail("unknown");
    let row: SessionRow | null;
    try {
      row = await this.db
        .prepare(
          "SELECT sub, service, amr, auth_time, expires_at, revoked_at FROM sessions WHERE id = ?",
        )
        .bind(await hashSessionId(token))
        .first<SessionRow>();
    } catch {
      return fail("unknown");
    }
    if (!row || row.service !== service) return fail("unknown");
    if (row.revoked_at !== null) return fail("revoked");
    if (row.expires_at <= this.now()) return fail("expired");
    return {
      valid: true,
      sub: row.sub,
      service: row.service,
      amr: row.amr,
      auth_time: row.auth_time,
      expires_at: row.expires_at,
      version: CONTRACT_VERSION,
    };
  }

  /** 利用者のログアウト。まだ有効だったセッションを失効させたときだけ `revoked: true` */
  async logout(token: string, service: string): Promise<LogoutResponse> {
    if (token === "") return { revoked: false, version: CONTRACT_VERSION };
    const now = this.now();
    const result = await this.db
      .prepare(
        "UPDATE sessions SET revoked_at = ? WHERE id = ? AND service = ? AND revoked_at IS NULL AND expires_at > ?",
      )
      .bind(now, await hashSessionId(token), service, now)
      .run();
    return { revoked: result.meta.changes > 0, version: CONTRACT_VERSION };
  }

  /** 行の ID（トークンのハッシュ）でセッションを失効させる。運営者の操作などから使う */
  async revoke(id: string): Promise<boolean> {
    const result = await this.db
      .prepare(
        "UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
      )
      .bind(this.now(), id)
      .run();
    return result.meta.changes > 0;
  }
}
