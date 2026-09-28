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

async function confirmationLink(email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)
    const { messages } = (await res.json()) as { messages: { ID: string }[] }
    if (messages.length > 0) {
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
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page.getByText("That invite code isn't valid")).toBeVisible()

  await page.getByLabel('Invite code').fill('localdev1')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()

  await page.goto(await confirmationLink(email))
  await page.waitForURL('**/onboarding')

  await page.getByLabel('Full name').fill('Riley Test')
  await page.getByLabel('Citizenship / visa status').selectOption('f1_visa')
  await expect(page.getByText('NIL income on an F-1 visa needs real care')).toBeVisible()
  await expect(page.getByText('not legal or immigration advice')).toBeVisible()
  await expect(page.getByText('Anonymous brand-response outcomes')).toBeVisible()
  await page.getByLabel('School').fill('Test State University')
  await page.getByLabel('Sport', { exact: true }).fill('Swimming')
  await page.getByRole('button', { name: 'Continue to interview' }).click()
  await page.waitForURL('**/interview')

  await expect(page.getByText('How your answers are used')).toBeVisible()
  await page.getByLabel('What are you genuinely into?').fill('open water swimming\nreef-safe sunscreen')
  await page.getByRole('button', { name: 'Save and find brands' }).click()
  await page.waitForURL('**/brands')
  await expect(page.getByRole('button', { name: 'Find new brands' })).toBeVisible()

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
  const mailto = page.getByRole('link', { name: 'Open in your email app' })
  await expect(mailto).toHaveAttribute('href', /^mailto:press@glassreef\.test\?subject=E2E%20outreach%20subject/)

  // Try another version replaces the draft in place.
  await page.getByRole('button', { name: 'Try another version' }).click()
  await expect(body).toHaveValue(/E2E ALTERNATE DRAFT/)

  // Edit and save: the draft is marked as edited by the athlete.
  await body.fill('My own words for Glass Reef.')
  await page.getByRole('button', { name: 'Save edits' }).click()
  await expect(page.getByText('(edited by you)')).toBeVisible()
  await expect(mailto).toHaveAttribute('href', /My%20own%20words/)

  // Sent -> reply pasted -> counter drafted.
  await page.getByRole('button', { name: 'I sent it ✓' }).click()
  await expect(page.getByText('sent', { exact: true })).toBeVisible()
  await page.locator('#reply textarea').fill('Hi Maya, we can send a mask and fins for two posts.')
  await page.getByRole('button', { name: 'Save reply' }).click()
  await expect(page.getByText('reply received', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Draft my reply' }).click()
  await expect(page.getByLabel('Body')).toHaveValue(/E2E COUNTER DRAFT/)
  await expect(page.getByText('negotiating', { exact: true })).toBeVisible()

  // "I'm done with this one" from the dashboard prompt closes the deal.
  await page.goto('/dashboard')
  await prompt.getByRole('button', { name: "I'm done with this one" }).click()
  await expect(prompt).toBeHidden()
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Tidewater Sun' }).getByText('Dead'),
  ).toBeVisible()

  expect(csp).toEqual([])
})
