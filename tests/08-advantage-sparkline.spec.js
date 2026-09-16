const { test, expect } = require("./fixtures");
const { startTwoPlayerGame, squareId, getAdvantageValues } = require("./helpers");

test.describe("Black Advantage sparkline", () => {
	test("sits between the board and the display-toggle checkboxes", async ({ page }) => {
		await startTwoPlayerGame(page);

		const order = await page.evaluate(() => {
			const ids = ["game-container", "advantage-container", "show-checkboxes-container"].map((id) =>
				id === "show-checkboxes-container"
					? document.querySelector(".show-checkboxes-container")
					: document.getElementById(id)
			);
			// Compare document position pairwise: -2/-4 both mean "before".
			return {
				afterBoard: !!(ids[0].compareDocumentPosition(ids[1]) & Node.DOCUMENT_POSITION_FOLLOWING),
				beforeCheckboxes: !!(ids[1].compareDocumentPosition(ids[2]) & Node.DOCUMENT_POSITION_FOLLOWING),
			};
		});

		expect(order.afterBoard).toBe(true);
		expect(order.beforeCheckboxes).toBe(true);
		await expect(page.locator("#advantage-container")).toBeVisible();
	});

	test("starts with a single zero point (2-2, no advantage)", async ({ page }) => {
		await startTwoPlayerGame(page);
		expect(await getAdvantageValues(page)).toEqual([0]);
	});

	test("adds one point per move, equal to black disks minus white disks", async ({ page }) => {
		await startTwoPlayerGame(page);

		await page.click(`#${squareId(2, 3)}`); // D3 (Black), flips D4: 4 black vs 1 white
		expect(await getAdvantageValues(page)).toEqual([0, 3]);

		await page.click(`#${squareId(2, 4)}`); // E3 (White), flips E4 back: 3 vs 3
		expect(await getAdvantageValues(page)).toEqual([0, 3, 0]);
	});

	test("updates on Undo", async ({ page }) => {
		await startTwoPlayerGame(page);
		await page.click(`#${squareId(2, 3)}`); // D3
		await page.click(`#${squareId(2, 4)}`); // E3
		expect(await getAdvantageValues(page)).toEqual([0, 3, 0]);

		await page.click("#undo");
		expect(await getAdvantageValues(page)).toEqual([0, 3]);

		await page.click("#undo");
		expect(await getAdvantageValues(page)).toEqual([0]);
	});

	test("bar width is scaled up 50% from the 3px/1px baseline (barWidth 5 + barSpacing 1)", async ({
		page,
	}) => {
		await startTwoPlayerGame(page);
		await page.click(`#${squareId(2, 3)}`); // D3
		await page.click(`#${squareId(2, 4)}`); // E3
		const n = (await getAdvantageValues(page)).length; // 3 points

		const width = Number(await page.locator("#advantage-sparkline canvas").getAttribute("width"));

		expect(width).toBe(6 * n - 1); // (barWidth 5 + barSpacing 1) * n - barSpacing
	});

	test("tooltip shows the move number, signed advantage, and black/white disk counts", async ({ page }) => {
		// Regression test: getCurrentRegionFields() (jquery.sparkline) always
		// returns an ARRAY of field objects, even for a plain (non-stacked) bar
		// chart - reading fields.value/.offset directly (instead of
		// fields[0].value/.offset) silently produced "undefined" in the tooltip.
		await startTwoPlayerGame(page);
		await page.click(`#${squareId(2, 3)}`); // D3, flips D4: Black 4, White 1, advantage +3

		const canvas = page.locator("#advantage-sparkline canvas");
		const box = await canvas.boundingBox();
		await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2); // hover the last bar

		const tooltip = page.locator(".jqstooltip");
		await expect(tooltip).toBeVisible();
		const text = await tooltip.innerText();
		expect(text).not.toContain("undefined");
		expect(text).toBe("After move 1 — Advantage: +3 (Black: 4, White: 1)");
	});

	test("reflects the position navigated to, not just the live end of the game", async ({ page }) => {
		await startTwoPlayerGame(page);
		await page.click(`#${squareId(2, 3)}`); // D3
		await page.click(`#${squareId(2, 4)}`); // E3
		expect(await getAdvantageValues(page)).toEqual([0, 3, 0]);

		await page.locator("#history-content .move-item").first().click(); // back to move #1
		expect(await getAdvantageValues(page)).toEqual([0, 3]);
	});

	test("resets to a single zero point when a new game starts", async ({ page }) => {
		await startTwoPlayerGame(page);
		await page.click(`#${squareId(2, 3)}`); // D3
		expect(await getAdvantageValues(page)).toEqual([0, 3]);

		await page.click("#stop");
		await expect(page.locator("body")).toHaveClass(/setup-active/);
		await startTwoPlayerGame(page);

		expect(await getAdvantageValues(page)).toEqual([0]);
	});

	test("does not push #undo/#stop into unreachable space on a short viewport", async ({ page }) => {
		// Regression test: .game-active #game vertically centers its children
		// (justify-content). Adding the sparkline made the column taller than
		// many viewports, and centering overflowing flex content pushes the
		// top out into negative scroll territory a browser can never scroll
		// back to - #undo/#stop became permanently unclickable. Use a
		// deliberately short viewport to keep catching this regardless of the
		// column's exact height.
		await page.setViewportSize({ width: 800, height: 500 });
		await startTwoPlayerGame(page);

		const top = await page.locator("#undo").evaluate((el) => el.getBoundingClientRect().top);
		expect(top).toBeGreaterThanOrEqual(0);

		await expect(page.locator("#undo")).toBeVisible();
		await page.click("#stop"); // throws if Playwright can't scroll/click it
		await expect(page.locator("body")).toHaveClass(/setup-active/);
	});
});
