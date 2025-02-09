import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';

// Returns the Base64 encoded string for embedding
async function fetchEmojiSvgBase64(emoji) {
	const url = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/15.1.0/svg/${emoji}.svg`;
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to fetch emoji SVG: ${emoji} ${res.statusText}`);
	}
	const svgText = await res.text();
	return Buffer.from(svgText).toString('base64');
}

// Assemble the SVG and convert it to PNG with sharp
export async function getImage(emoji) {
	// 1000x1000 canvas. White background, with 100px padding inside, and emoji placed in 700x700 area
	const emojiBase64 = await fetchEmojiSvgBase64(emoji);
	const svgTemplate = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000">
      <rect width="100%" height="100%" fill="#fff" />
      <image href="data:image/svg+xml;base64,${emojiBase64}" x="200" y="200" width="600" height="600" />
    </svg>
  `;
	return await sharp(Buffer.from(svgTemplate)).png().toBuffer();
}

async function ensureNotesDir() {
	const notesDir = path.resolve('notes');
	try {
		await fs.access(notesDir);
	} catch {
		await fs.mkdir(notesDir);
	}
}

async function generateAllTwemoji() {
	await ensureNotesDir();
	const notesDir = path.resolve('notes');
	const apiUrl = 'https://api.cdnjs.com/libraries/twemoji/15.1.0';
	let data;
	try {
		const res = await fetch(apiUrl);
		data = await res.json();
	} catch (err) {
		console.error('Failed to fetch twemoji list:', err);
		return;
	}
	// Get the list of files from the rawFiles array
	let files = [];
	if (data.rawFiles && Array.isArray(data.rawFiles)) {
		files = data.rawFiles;
	}

	// Only target files that start with "svg/" and end with ".svg"
	const svgFiles = files.filter((file) => file.startsWith('svg/') && file.endsWith('.svg'));
	// Remove "svg/" and ".svg" from the file name to get the emoji code (e.g. "svg/1f602.svg" → "1f602")
	const emojis = svgFiles.map((file) => file.substring(4, file.length - 4));

	// Generate images for each emoji
	for (const emoji of emojis) {
		try {
			console.log(`Generating image for emoji ${emoji}`);
			const buffer = await getImage(emoji);
			const filename = path.join(notesDir, `${emoji}.png`);
			await fs.writeFile(filename, buffer);
			console.log(`Saved ${filename}`);
		} catch (err) {
			console.error(`Error generating image for ${emoji}:`, err);
		}
	}
	console.log('All images generated successfully.');
}

generateAllTwemoji();
