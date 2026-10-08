import { expect, test, type Page } from '@playwright/test'

// The core athlete flow in a real browser against the production build,
// local Supabase (reset to supabase/seed.sql), and a mock Anthropic API.
// Discovery (Tavily + Inngest) is covered by unit tests and eval:discovery.

const MAILPIT = 'http://127.0.0.1:54324'
const SEED_PASSWORD = 'nilcopilot-local'

// Fail any test whose pages trip the Content-Security-Policy.
function watchCsp(page: Page): string[] {
  const violations: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /Content Security Policy/i.test(msg.text())) {
      violations.push(msg.text())
    }
  })
  return violations
}

async function logIn(page: Page, email: string, password = SEED_PASSWORD) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await page.waitForURL('**/dashboard')
}

async function confirmationLink(email: string, atLeast = 1): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)
    const { messages } = (await res.json()) as { messages: { ID: string }[] }
    // Newest first; wait until the expected number of emails has arrived.
    if (messages.length >= atLeast) {
      const message = await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()
      const href = (message.HTML as string).match(/href="([^"]+)"/)?.[1]
      if (href) return href.replace(/&amp;/g, '&')
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`No confirmation email for ${email}`)
}

test('new athlete: invite-gated signup, confirmation, visa step, interview with consent', async ({ page }) => {
  const csp = watchCsp(page)
  const email = `e2e-${Date.now()}@example.test`

  await page.goto('/signup')
  await page.getByLabel('Invite code').fill('NOT-A-CODE')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('e2e-password-123')
  await page.getByRole('checkbox', { name: /agree to the Terms/ }).check()
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page.getByText("That invite code isn't valid")).toBeVisible()

  await page.getByLabel('Invite code').fill('localdev1')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  await confirmationLink(email)

  // Before confirming: logging in says to confirm, and a fresh email can be
  // requested (no invite code needed — the account exists).
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('e2e-password-123')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByText('Confirm your email first')).toBeVisible()
  // Supabase allows one email per address per max_frequency (1s locally).
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: 'Resend confirmation email' }).click()
  await expect(page.getByText(/Sent a new confirmation link/)).toBeVisible()

  await page.goto(await confirmationLink(email, 2))
  await page.waitForURL('**/onboarding')

  // Onboarding is one 4-step flow: about you, citizenship/visa, interests,
  // deal preferences.
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('Name is required')).toBeVisible()
  await page.getByLabel('Full name').fill('Riley Test')
  await page.getByLabel('School').fill('Test State University')
  await page.getByLabel('Sport', { exact: true }).fill('Swimming')
  await page.getByLabel('Instagram').fill('1.2k')
  await page.getByRole('button', { name: 'Continue' }).click()

  // The visa step can't be skipped and shows real guidance.
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
  await page.getByRole('radio', { name: 'International student (F-1 visa)' }).check()
  await expect(page.getByText('NIL income on an F-1 visa needs real care')).toBeVisible()
  await expect(page.getByText('not legal or immigration advice')).toBeVisible()
  await expect(page.getByText('Anonymous brand-response outcomes')).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  await page.getByLabel('What are you genuinely into?').fill('open water swimming, reef-safe sunscreen')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('How your answers are used')).toBeVisible()
  await page.getByRole('button', { name: 'Finish and find brands' }).click()
  await page.waitForURL('**/brands')
  await expect(page.getByRole('button', { name: 'Find more brands' })).toBeVisible()

  // Values pre-filled from the interview; editable in the Tune search drawer.
  await page.getByRole('button', { name: 'Tune search' }).click()
  const lookingFor = page.locator('section').filter({ hasText: "What you're looking for" })
  await expect(lookingFor.getByText('(from your interview)')).toBeVisible()
  await expect(lookingFor.getByText('ocean conservation')).toBeVisible()
  await lookingFor.getByRole('button', { name: 'Edit' }).click()
  await lookingFor.getByLabel(/Values brands should share/).fill('ocean conservation\nwomen-owned')
  await lookingFor.getByLabel(/Industries you'd like to work in/).fill('specialty coffee')
  await lookingFor.getByRole('button', { name: 'Save' }).click()
  await expect(lookingFor.getByText('women-owned')).toBeVisible()
  await expect(lookingFor.getByText('specialty coffee')).toBeVisible()
  await expect(lookingFor.getByText('(from your interview)')).toBeHidden()

  expect(csp).toEqual([])
})

test('seeded athlete: follow-up prompt, draft, regenerate, edit, reply, counter, done', async ({ page }) => {
  const csp = watchCsp(page)
  await logIn(page, 'maya@example.test')

  // A deal sent a week ago with no reply logged gets the prompt.
  const prompt = page.getByRole('listitem').filter({ hasText: 'since you emailed Tidewater Sun' })
  await expect(prompt).toBeVisible()

  // Draft outreach for a match with an email: the editor must fill at once
  // (regression: it used to stay empty until a reload).
  await page.goto('/brands')
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Glass Reef' })
    .getByRole('button', { name: 'Draft outreach' })
    .click()
  await page.waitForURL('**/deals/**')
  await page.getByRole('button', { name: 'Draft outreach email' }).click()
  const body = page.getByLabel('Body')
  await expect(body).toHaveValue(/E2E OUTREACH DRAFT/)
  await expect(page.getByText('Optional: if they write back')).toBeVisible()
  await expect(page.getByText('Visa check')).toBeHidden()
  const mailto = page.getByRole('link', { name: 'Open in my email' })
  await expect(mailto).toHaveAttribute('href', /^mailto:press@glassreef\.test\?subject=E2E%20outreach%20subject/)

  // Try another version replaces the draft in place.
  await page.getByRole('button', { name: 'Try another version' }).click()
  await expect(body).toHaveValue(/E2E ALTERNATE DRAFT/)

  // Edit and save: the draft is marked as edited by the athlete.
  await body.fill('My own words for Glass Reef.')
  await page.getByRole('button', { name: 'Save edits' }).click()
  await expect(page.getByText(/edited by you/)).toBeVisible()
  await expect(mailto).toHaveAttribute('href', /My%20own%20words/)

  // Sent -> reply pasted -> counter drafted.
  // Only the athlete's own "I sent it" marks it sent; then the peak moment.
  await page.getByRole('button', { name: 'I sent it' }).click()
  await expect(page.getByRole('heading', { name: 'Sent. Nice work.' })).toBeVisible()
  await expect(page.getByText('Waiting', { exact: true })).toBeVisible()
  // After a reload the sent draft is history, not an editable draft.
  await page.reload()
  await expect(page.getByRole('heading', { name: /^Sent\. Waiting on / })).toBeVisible()
  await expect(page.getByLabel('Body')).toHaveCount(0)
  await expect(page.getByText(/^Sent [A-Z][a-z]{2} \d+$/)).toBeVisible()
  await page.locator('#reply textarea').fill('Hi Maya, we can send a mask and fins for two posts.')
  await page.getByRole('button', { name: 'Save reply' }).click()
  // The sent moment clears once a newer message lands.
  await expect(page.getByRole('heading', { name: 'Sent. Nice work.' })).toBeHidden()
  await expect(page.getByText('Reply received', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Draft my reply' }).click()
  await expect(page.getByLabel('Body')).toHaveValue(/E2E COUNTER DRAFT/)
  await expect(page.getByText('Negotiating', { exact: true })).toBeVisible()
  // A counter sent mid-negotiation (status stays negotiating) also leaves
  // the editor for good — the original bug.
  await page.getByRole('button', { name: 'I sent it' }).click()
  await expect(page.getByRole('heading', { name: 'Sent. Nice work.' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: /^Sent\. Waiting on / })).toBeVisible()
  await expect(page.getByLabel('Body')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'I sent it' })).toHaveCount(0)
  // Maya is on an F-1 visa: once a deal is live, the DSO reminder shows.
  await expect(page.getByText('Visa check')).toBeVisible()
  await expect(page.getByText(/check it with your Designated School Official/)).toBeVisible()

  // "I'm done with this one" from the dashboard prompt closes the deal.
  await page.goto('/dashboard')
  await prompt.getByRole('button', { name: "I'm done with this one" }).click()
  await expect(prompt).toBeHidden()
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Tidewater Sun' }).getByText('Dead'),
  ).toBeVisible()

  expect(csp).toEqual([])
})
