import { SignJWT, jwtVerify } from "jose";
import { getPositiveInteger, requireEnvironment } from "../config/runtime.js";

export const SESSION_COOKIE_NAME = "dl_session";

function readSecret(value) {
  const secret = value ?? requireEnvironment("SESSION_SECRET");
  if (new TextEncoder().encode(secret).byteLength < 32) {
    throw new Error("SESSION_SECRET debe contener al menos 32 bytes.");
  }
  return new TextEncoder().encode(secret);
}

export function createSessionService({
  secret,
  ttlSeconds = getPositiveInteger("SESSION_TTL_SECONDS", 28_800),
  secure = process.env.NODE_ENV === "production",
  basePath,
} = {}) {
  const key = readSecret(secret);
  const cookieOptions = Object.freeze({
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: basePath,
  });

  return {
    cookieOptions,

    async createToken(profile) {
      return new SignJWT({
        name: profile.name,
        countryCode: profile.countryCode,
        roleCode: profile.roleCode,
        branchCode: profile.branchCode,
        positionCode: profile.positionCode,
        mustResetPassword: profile.mustResetPassword,
      })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setSubject(String(profile.id))
        .setIssuedAt()
        .setExpirationTime(`${ttlSeconds}s`)
        .sign(key);
    },

    async verifyToken(token) {
      const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
      return {
        id: Number(payload.sub),
        name: payload.name,
        countryCode: payload.countryCode,
        roleCode: payload.roleCode,
        branchCode: payload.branchCode,
        positionCode: payload.positionCode,
        mustResetPassword: Boolean(payload.mustResetPassword),
      };
    },

    setCookie(res, token) {
      res.cookie(SESSION_COOKIE_NAME, token, cookieOptions);
    },

    clearCookie(res) {
      res.clearCookie(SESSION_COOKIE_NAME, cookieOptions);
    },
  };
}
