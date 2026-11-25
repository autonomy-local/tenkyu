/** 認証の手段の種類。検証の口の `amr` と、identities の `provider` に使う。 */
export type VerifierKind = "email_code" | "passkey" | "firebase";

/** 手段で確かめられた、手段ごとの識別子（identities の1行に当たる）。 */
export type VerifiedIdentity = {
  provider: VerifierKind;
  /** 手段ごとの識別子（メールアドレスのハッシュ、パスキーの ID、Firebase の uid など）。 */
  subject: string;
};

/** 確かめの結果。失敗の理由は手段ごとに決める。 */
export type VerifyResult<Reason extends string = string> =
  | { ok: true; identity: VerifiedIdentity }
  | { ok: false; reason: Reason };

/** 認証の手段（Verifier）。手段を足すときは、この型を満たす中身を足す。 */
export interface Verifier<Input, Reason extends string = string> {
  readonly kind: VerifierKind;
  verify(input: Input): Promise<VerifyResult<Reason>>;
}
