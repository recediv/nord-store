"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@modules/common/components/ui"
import { confirmEmailVerification } from "@lib/data/customer"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type VerificationState = "verifying" | "success" | "error"

const VerifyAccount = () => {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [state, setState] = useState<VerificationState>("verifying")
  // Share each token's request across Strict Mode effect restarts.
  const confirmations = useRef(
    new Map<string, ReturnType<typeof confirmEmailVerification>>(),
  )

  useEffect(() => {
    if (!token) {
      setState("error")
      return
    }

    let current = true
    setState("verifying")
    let confirmation = confirmations.current.get(token)
    if (!confirmation) {
      confirmation = confirmEmailVerification(token)
      confirmations.current.set(token, confirmation)
    }
    void confirmation.then(
      ({ success }) => {
        if (current) setState(success ? "success" : "error")
      },
      () => {
        if (current) setState("error")
      },
    )
    return () => {
      current = false
    }
  }, [token])

  return (
    <div
      className="max-w-sm w-full flex flex-col items-center text-center gap-y-4"
      data-testid="verify-account-page"
    >
      <h1 className="text-large-semi uppercase">Email verification</h1>

      {state === "verifying" && (
        <p className="text-base-regular text-ui-fg-base">
          Verifying your email...
        </p>
      )}

      {state === "success" && (
        <>
          <p className="text-base-regular text-ui-fg-base">
            Your email is verified. You can now sign in to your account.
          </p>
          <LocalizedClientLink href="/account">
            <Button variant="primary">Go to sign in</Button>
          </LocalizedClientLink>
        </>
      )}

      {state === "error" && (
        <>
          <p className="text-base-regular text-ui-fg-base">
            We could not confirm this link. Sign in to check your account or
            request a new verification email.
          </p>
          <LocalizedClientLink href="/account">
            <Button variant="secondary">Go to sign in</Button>
          </LocalizedClientLink>
        </>
      )}
    </div>
  )
}

export default VerifyAccount
