/**
 * E2E: only dedicated @vitrina.test accounts — never production logins.
 */
export function assertQaEmail(envKey) {
  const email = process.env[envKey]?.trim()
  if (!email) return
  if (!email.endsWith('@vitrina.test')) {
    throw new Error(
      `${envKey}=${email} — E2E only @vitrina.test accounts, production logins forbidden`,
    )
  }
}

export function assertQaCreds() {
  for (const key of [
    'QA_SANDBOX_EMAIL',
    'QA_BUYER_EMAIL',
    'QA_PLATFORM_EMAIL',
  ]) {
    assertQaEmail(key)
  }
}
