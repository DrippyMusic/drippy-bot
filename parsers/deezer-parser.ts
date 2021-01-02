import axios from 'axios'
import cheerio from 'cheerio'

import { Provider } from '../modules/parse-utils'

const cover = (hash: string, size: number = 120) =>
    `https://e-cdns-images.dzcdn.net/images/cover/${hash}/${size}x${size}.jpg`;

class DeezerParser implements MediaParser {

    async parse(url: string, params: string[]): Promise<Track[]> {
        const tracks: any[] = [];

        const media_id = params.pop();
        const media_type = params.pop();

        const { data } = await axios.get(`https://deezer.com/${media_type}/${media_id}`);
        const $ = cheerio.load(data);

        const script = $('#naboo_content script')
            .last().html() as string;
        const match = /[{].+[}]/gi.exec(script);

        if (match !== null && match[0]) {
            const meta = JSON.parse(match[0]);

            switch (media_type) {
                case 'track':
                    tracks.push(meta.DATA);
                    break;
                case 'album':
                case 'playlist':
                    meta.SONGS['data'].forEach((e: any) =>
                        tracks.push(e)
                    );
                    break;
            }
        }

        return tracks.map(({ SNG_ID: id, SNG_TITLE: title, ARTISTS, ALB_PICTURE }) => ({
            provider: Provider.DEEZER,
            id, title, href: `https://deezer.com/track/${id}`,
            thumbnail: cover(ALB_PICTURE),
            artists: ARTISTS.map((e: any) => ({
                name: e.ART_NAME,
                href: `https://deezer.com/artist/${e.ART_ID}`
            }))
        }));
    }

}

export default new DeezerParser();