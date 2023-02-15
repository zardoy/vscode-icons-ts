import * as fs from 'fs';
import { basename, join } from 'path';
import stream from 'stream';
import got from 'got';

import { promisify } from 'util';
import yauzl from 'yauzl';

const pipeline = promisify(stream.pipeline);

(async () => {
  const extZip = './vscode-icons.zip';
  await pipeline(
    got.stream(
      'https://marketplace.visualstudio.com/_apis/public/gallery/publishers/vscode-icons-team/vsextensions/vscode-icons/latest/vspackage'
    ),
    fs.createWriteStream(extZip)
  );
  const zipfile = await promisify(yauzl.open as any)(extZip);
  const iconsPath = './dist/icons';
  let openReadStream = promisify(zipfile.openReadStream.bind(zipfile));

  let extractedIcons = 0;
  let wroteData = true;
  zipfile.on('entry', async (entry) => {
    const { fileName } = entry;
    let writeFilePath: string | undefined;
    if (fileName.startsWith('extension/icons/')) {
      writeFilePath = join(iconsPath, basename(fileName));
      extractedIcons++;
    }
    if (fileName === 'extension/dist/src/vsicons-icon-theme.json') {
      writeFilePath = 'data/generated/icons.json';
      wroteData = true;
    }
    if (writeFilePath) {
      fs.mkdirSync(join(writeFilePath, '..'), { recursive: true });
      pipeline(await openReadStream(entry), fs.createWriteStream(writeFilePath));
    }
  });
  zipfile.on('end', () => {
    if (!wroteData) throw new Error('No extension/dist/src/vsicons-icon-theme.json found');
    if (extractedIcons === 0) throw new Error('No extracted icons');
    console.log('Done. Extracted', extractedIcons, 'icons');
  });
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
