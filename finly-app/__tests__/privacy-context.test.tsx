import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { PrivacyProvider, usePrivacy } from "@/components/privacy-context"

function TestPrivacyConsumer() {
  const { isPrivate, togglePrivacy, formatAmount } = usePrivacy()

  return (
    <div>
      <span data-testid="privacy-status">{isPrivate ? "hidden" : "visible"}</span>
      <span data-testid="formatted-value">{formatAmount(1250.5)}</span>
      <button data-testid="toggle-btn" onClick={togglePrivacy}>
        Toggle
      </button>
    </div>
  )
}

describe("PrivacyContext & usePrivacy Hook", () => {
  it("formats amount normally when privacy is disabled (default)", () => {
    render(
      <PrivacyProvider>
        <TestPrivacyConsumer />
      </PrivacyProvider>
    )

    expect(screen.getByTestId("privacy-status").textContent).toBe("visible")
    const formatted = screen.getByTestId("formatted-value").textContent
    expect(formatted).toContain("1")
    expect(formatted).toContain("250")
    expect(formatted).toContain("€")
  })

  it("masks amount when privacy is toggled to active", () => {
    render(
      <PrivacyProvider>
        <TestPrivacyConsumer />
      </PrivacyProvider>
    )

    const toggleBtn = screen.getByTestId("toggle-btn")
    fireEvent.click(toggleBtn)

    expect(screen.getByTestId("privacy-status").textContent).toBe("hidden")
    expect(screen.getByTestId("formatted-value").textContent).toBe("•••• €")

    // Toggle back
    fireEvent.click(toggleBtn)
    expect(screen.getByTestId("privacy-status").textContent).toBe("visible")
    expect(screen.getByTestId("formatted-value").textContent).not.toBe("•••• €")
  })
})
