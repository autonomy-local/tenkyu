import { describe, expect, it } from "vitest";
import {
  FIREBASE_JWKS_URL,
  FirebaseKeys,
  parseMaxAge,
} from "../src/verifiers/firebase/keys";

const JWKS = {
  keys: [
    {
      kty: "RSA",
      alg: "RS256",
      use: "sig",
      kid: "key-1",
      n: "sXchDaQebHnPiGvyDOAT4saGEUetSyo9MKLOoWFsueri23bOdgWp4Dy1WlUzewbgBHod5pcM9H95GQRV3JDXboIRROSBigeC5yjU1hGzHHyXss8UDprecbAYxknTcQkhslANGRUZmdTOQ5qTRsLAt6BTYuyvVRdhS8exSZEy_c4gs_7svlJJQ4H9_NxsiIoLwAEk7-Q3UXERGYw_75IDrGA84-lA_-Ct4eTlXHBIY2EaV7t7LjJaynVJCpkv4LKjTTAumiGUIuQhrNhZLuF_RJLqHpM2kgWFLU7-VTdL1VbC2tejvcI2BlMkEpk1BzBZI0KQB0GaDWFLN-aEAw3vRw",
      e: "AQAB",
    },
  ],
};

const makeFetch = (cacheControl: string | null) => {
  const calls: string[] = [];
  const fetchStub = async (input: string) => {
    calls.push(input);
    return new Response(JSON.stringify(JWKS), {
      headers: cacheControl ? { "Cache-Control": cacheControl } : {},
    });
  };
  return { calls, fetchStub };
};

describe("FirebaseKeys", () => {
  it("期間内の2回目は取りに行かない", async () => {
    let now = 1_000_000;
    const { calls, fetchStub } = makeFetch(
      "public, max-age=3600, must-revalidate",
    );
    const keys = new FirebaseKeys({ fetch: fetchStub, now: () => now });

    expect(await keys.jwks()).toEqual(JWKS);
    now += 3599 * 1000;
    expect(await keys.jwks()).toEqual(JWKS);

    expect(calls).toEqual([FIREBASE_JWKS_URL]);
  });

  it("期間を過ぎると取り直す", async () => {
    let now = 1_000_000;
    const { calls, fetchStub } = makeFetch("max-age=60");
    const keys = new FirebaseKeys({ fetch: fetchStub, now: () => now });

    await keys.jwks();
    now += 60 * 1000;
    await keys.jwks();

    expect(calls).toHaveLength(2);
  });

  it("Cache-Control がなければ毎回取りに行く", async () => {
    const { calls, fetchStub } = makeFetch(null);
    const keys = new FirebaseKeys({ fetch: fetchStub, now: () => 0 });
    await keys.jwks();
    await keys.jwks();
    expect(calls).toHaveLength(2);
  });

  it("同時の要求では1回だけ取りに行く", async () => {
    const { calls, fetchStub } = makeFetch("max-age=60");
    const keys = new FirebaseKeys({ fetch: fetchStub, now: () => 0 });
    await Promise.all([keys.jwks(), keys.jwks(), keys.jwks()]);
    expect(calls).toHaveLength(1);
  });

  it("取得に失敗したら例外にし、覚えない", async () => {
    let fail = true;
    const keys = new FirebaseKeys({
      fetch: async () =>
        fail
          ? new Response("error", { status: 500 })
          : new Response(JSON.stringify(JWKS), {
              headers: { "Cache-Control": "max-age=60" },
            }),
      now: () => 0,
    });
    await expect(keys.jwks()).rejects.toThrow();
    fail = false;
    expect(await keys.jwks()).toEqual(JWKS);
  });

  it("jose に渡せる鍵の引き当てを返す", async () => {
    const { fetchStub } = makeFetch("max-age=60");
    const keys = new FirebaseKeys({ fetch: fetchStub, now: () => 0 });
    expect(typeof (await keys.getKey())).toBe("function");
  });
});

describe("parseMaxAge", () => {
  it.each([
    ["public, max-age=19523, must-revalidate, no-transform", 19523],
    ["max-age=0", 0],
    ["s-maxage=100", null],
    ["no-store", null],
    [null, null],
  ])("%j → %j", (header, expected) => {
    expect(parseMaxAge(header)).toBe(expected);
  });
});
