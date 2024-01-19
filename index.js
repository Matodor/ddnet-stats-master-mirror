import { promises as fs, createWriteStream, WriteStream } from 'fs';
import { dirname } from 'path';
import * as cheerio from 'cheerio';
import axios from 'axios';

async function getAvailableFiles() {
    const html = (await axios.get('https://ddnet.org/stats/master/')).data;
    const $ = cheerio.load(html);
    const files = $('a')
        .filter((i, el) => el.attribs.href.endsWith('.tar.zstd'))
        .map((i, el) => el.attribs.href.replace('.tar.zstd', ''))
        .toArray()
        .map((date) => [date, `https://ddnet.tw/stats/master/${date}.tar.zstd`]);

    return files;
}

async function getData() {
    let data;

    try {
        const content = await fs.readFile('data.json', { encoding: 'utf8' });
        data = JSON.parse(content);
    } catch (error) {
        data = {};
    }

    return data;
}

async function writeData(data) {
    await fs.writeFile('data.json', JSON.stringify(data, null, 4), { encoding: 'utf8' });
}

async function download(date, link) {
    console.log(`Starting download ${date} (${link})`);

    const filePath = `stats/${new Date(date).getUTCFullYear()}/${date}.tar.zstd`;
    const dir = dirname(filePath);

    await fs.mkdir(dir, { recursive: true });

    const response = await axios.get(link, {
        responseType: 'stream',
    });

    /** @type {WriteStream} */
    const writeStream = response.data.pipe(createWriteStream(filePath, {
        flags: 'w',
    }));

    const task = new Promise((resolve, reject) => {
        writeStream.on('finish', function () {
            resolve({ date, filePath });
        });

        writeStream.on('error', function () {
            reject();
        });
    });

    task.then(() => {
        console.log(`Downloaded ${date} (${filePath})`);
    });

    return task;
}

async function main() {
    const files = await getAvailableFiles();
    const data = await getData();

    for (let i = 0; i < files.length; i++) {
        const date = files[i][0];
        const link = files[i][1];

        if (data[date]) {
            continue;
        }

        const { filePath } = await download(date, link);
        data[date] = true;
    }

    await writeData(data);
    console.log('Finished');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
