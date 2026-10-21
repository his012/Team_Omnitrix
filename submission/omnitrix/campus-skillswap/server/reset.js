import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
fs.copyFileSync(path.join(dir,'seed.json'),path.join(dir,'db.json'));
console.log('Demo records reset to original 12 users, 25 gigs, 20 applications, and 8 reviews.');
