
exports.handler = async (ctx, console, browser) => {
	let page;

	let frameUrls;
	page = await browser.newPage();
	try {
		frameUrls = await fetchAndStoreSadetutkaFrames(ctx, console, page);
	} finally {
		await page.close();
	}

	let meteogramUrl;
	page = await browser.newPage();
	try {
		meteogramUrl = await fetchAndStoreMeteogram(ctx, console, page);
	} finally {
		await page.close();
	}

	ctx.data = {
		frameUrls: frameUrls,
		meteogramUrl: meteogramUrl,
	};
}

async function fetchAndStoreSadetutkaFrames(ctx, console, page) {
	// has breakpoints for mobile resolution that makes map display different,
	// so better increase resolution
	await page.setViewport({
		width: 1280,
		height: 1024,
	})

	const url = 'https://www.foreca.fi/sadetutka/etela-suomi?1h';

	await ridOfCookieConsentDialog(page);

	await page.goto(url, { waitUntil: 'networkidle0' });

	// less noise on screenshots
	await hideMapOverlays(page);

	const map = await page.$('#map');
	if (!map) {
		throw new Error('Failed to find map')
	}

	const hoverOnStep = async (stepNumber) => {
		await page.hover('#step'+stepNumber);
	}

	// first step triggers loading all the images for the next steps as well
	await hoverOnStep(0);

	// dirty hack to assume all the step images have loaded
	await page.waitFor(5000);

	const frameUrls = [];

	// the map has 25 steps (= timestamps). hover over all of them in order to capture
	// each time for the gif we're about to make
	for (let stepNumber = 0; stepNumber < 25; stepNumber++) {
		// the labels are ID'd in UI [step0 .. step24]
		await hoverOnStep(stepNumber);

		const screenshot = await map.screenshot({ type: 'png' });

		const frameUrl = await ctx.uploadFile(stepNumber+'.png', screenshot, 'image/png');

		console.log(`uploaded ${frameUrl}`);

		frameUrls.push(frameUrl);
	}

	return frameUrls;
}

async function fetchAndStoreMeteogram(ctx, console, page) {
	await page.setViewport({
		width: 1280,
		height: 1024,
	})

	await ridOfCookieConsentDialog(page);

	await page.goto('https://www.foreca.fi/Finland/Tampere?1h', { waitUntil: 'networkidle0' });

	const meteogram = await page.$('#meteogram');
	if (!meteogram) {
		throw new Error('meteogram not found');
	}

	const meteogramPng = await meteogram.screenshot({ type: 'png' });

	return await ctx.uploadFile('meteogram.png', meteogramPng, 'image/png');
}

async function hideMapOverlays(page) {
	await page.addStyleTag({ content: `
		.ol-zoom,
		.ol-control-drag-button,
		.ol-attribution,
		.ol-control-home-button,
		.ol-custom-arealist-control,
		.playbtn { display: none }
	`});
}

async function ridOfCookieConsentDialog(page) {
	await page.setCookie({
		name: 'euconsent-v2',
		value: 'dummy', // doesn't seem to matter
		domain: 'www.foreca.fi',
	});
}
