import fs from 'fs'
import crypto from 'crypto'

import { RSA_PKCS1_PADDING as padding } from 'constants'

import Axios from 'axios'

const PUBLIC_KEY = fs.readFileSync(process.env['DRIPPY_PUBLIC_KEY'] as string);

const axios = Axios.create({
    baseURL: 'https://api.drippy.live/api',
    headers: {
        'Authorization': `Bearer ${process.env['DRIPPY_API_TOKEN']}`
    }
});

const encrypt = (data: any): string => {
    const text = Buffer.from(JSON.stringify(data));

    return crypto.publicEncrypt({
        key: PUBLIC_KEY, padding
    }, text).toString('base64');
}

export default class Drippy {

    public static async stream(name: string, data: string): Promise<string> {
        if (name !== 'YOUTUBE_MUSIC') {
            const { data: object } = await axios.post('/data',
                { name, data }
            );

            return encrypt(object);
        }

        return encrypt({ id: name, uri: `https://youtu.be/${data}` });
    }

}