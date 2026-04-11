import { chromium } from '@playwright/test'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
await page.addInitScript(() => window.localStorage.clear())
await page.goto('http://127.0.0.1:3000/')
await page.waitForSelector('text=Machine:')
const clickButton = async (name) => page.getByRole('button', { name }).click()
const viewport = page.locator('main canvas').first()
const box = await viewport.boundingBox()
if (!box) throw new Error('no viewport')
const clickAt = async ({x,y}) => page.mouse.click(box.x + x, box.y + y)
await clickButton('Start a new sketch.')
await page.getByRole('button', { name: /Top Plane/ }).first().click()
await clickButton('Create rectangle geometry.')
await clickAt({ x: 520, y: 320 })
await clickAt({ x: 680, y: 440 })
await clickButton('Exit the active sketch.')
await page.getByRole('button', { name: /^Select .*sketch_primary\.region_primary-outer$/ }).click()
await clickButton('Create an extruded solid or surface.')
await page.getByRole('button', { name: 'Commit' }).click()
await page.waitForTimeout(1000)
const getHover = async () => {
  const text = await page.locator('body').textContent()
  return text?.match(/Hover target:\s*([\s\S]*?)Selection detail:/)?.[1]?.replace(/\s+/g, '').trim() ?? 'none'
}
const pts=[]
for (let y=140; y<=520; y+=40) {
  for (let x=420; x<=760; x+=40) {
    await page.mouse.move(box.x + x, box.y + y)
    await page.waitForTimeout(20)
    const hover = await getHover()
    if (hover !== 'none') pts.push({x,y,hover})
  }
}
console.log(JSON.stringify(pts,null,2))
await browser.close()
