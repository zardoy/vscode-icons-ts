import * as fs from 'fs';
import { basename, join } from 'path';
import stream from 'stream';
import got from 'got';

import { promisify } from 'util';
import yauzl from 'yauzl';
import { exec, spawn } from 'child_process';

const pipeline = promisify(stream.pipeline);

(async () => {
  let stdout: string = await new Promise((resolve) => {
    exec('vsce show vscode-icons-team.vscode-icons', (err, stdout) => {
      if (err) throw err;
      resolve(stdout);
    });
  });
  stdout = String(stdout);
  const version = stdout.match(/Version:\s*(.+?)\n/)![1].trim();
  const extZip = './vscode-icons.zip';
  const downloadUrl = `https://open-vsx.org/api/vscode-icons-team/vscode-icons/${version}/file/vscode-icons-team.vscode-icons-${version}.vsix`;
  console.log('Download URL', downloadUrl);
  await pipeline(
    got.stream(
      downloadUrl
      // 'https://marketplace.visualstudio.com/_apis/public/gallery/publishers/vscode-icons-team/vsextensions/vscode-icons/12.2.0/vspackage',
      // {
      //   headers: {
      //     'user-agent':
      //       'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
      //   },
      // }
      // 'https://marketplace.visualstudio.com/_apis/public/gallery/publishers/vscode-icons-team/vsextensions/vscode-icons/12.2.0/vspackage',
      // {
      //   headers: {
      //     'user-agent':
      //       'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
      //   },
      // }
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
