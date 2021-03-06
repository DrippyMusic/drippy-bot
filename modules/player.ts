import http from 'http'
import { Guild, GuildMember, MessageEmbed, TextChannel, VoiceConnection } from 'discord.js'

import { Provider } from './parse-utils'
import Drippy from '../modules/drippy-api'

const players = new Map<string, Player>();

export default class Player {

    private readonly guild: Guild;
    private readonly connection: VoiceConnection;
    private readonly channel: TextChannel;

    private readonly _queue: Track[] = [];

    private _current?: Track;

    private timeout!: ReturnType<typeof setTimeout>;

    public constructor(guild: Guild, connection: VoiceConnection, channel: TextChannel) {
        this.guild = guild;
        this.connection = connection;
        this.channel = channel;

        players.set(guild.id, this);
        this.connection.once('disconnect', () =>
            players.delete(this.guild.id)
        );
    }

    public add(...tracks: Track[]): void {
        tracks.forEach(e => this._queue.push(e));
        const embed = new MessageEmbed()
            .setDescription(`Queued ${tracks.length} track`);

        if (tracks.length > 1) {
            embed.setDescription(embed.description + 's');
        }

        this.channel.send(embed);
    }

    public remove(index: number): void {
        this._queue.splice(index, 1);
    }

    private async next(): Promise<void> {
        if (this._queue.length) {
            return this.play(this._queue.shift() as Track);
        }

        this.connection.disconnect();
    }

    public async play(track: Track): Promise<void> {
        this._current = track;

        return Drippy.stream(Provider[track.provider], track.id).then(token => {
            http.get(`http://localhost:4770/${token}`)
                .once('response', response =>
                    this.connection.play(response)
                        .once('start', () => {
                            const description = track.artists.map(e =>
                                `[${e.name}](${e.href})`
                            ).join(' • ');

                            const embed = new MessageEmbed()
                                .setURL(track.href)
                                .setTitle(track.title)
                                .setThumbnail(track.thumbnail)
                                .setDescription(description);

                            this.channel.send(embed);
                        }).once('finish', () => this.next())
                );
        }).catch(() => {
            const description = `Couldn't play track '[${track.title}](${track.href})'`;
            const embed = new MessageEmbed()
                .setColor('#ffab00')
                .setDescription(description);

            this.channel.send(embed);
            return this.next();
        });
    }

    public stop(reason?: string): void {
        this.connection.disconnect();

        if (reason && reason.length) {
            const embed = new MessageEmbed()
                .setDescription(reason);

            this.channel.send(embed);
        }
    }

    public skip(): void {
        this.connection.dispatcher.end();
        const embed = new MessageEmbed()
            .setDescription('Track skipped!');
        this.channel.send(embed);
    }

    public pause(): void {
        const dispatcher = this.connection.dispatcher;
        if (dispatcher.paused) {
            throw new Error("I'm already paused!");
        }

        return dispatcher.pause();
    }

    public resume(): void {
        const dispatcher = this.connection.dispatcher;
        if (!dispatcher.paused) {
            throw new Error("I'm currently not paused!");
        }

        return dispatcher.resume();
    }

    public contains(member: GuildMember): boolean {
        return member.voice.channel !== null && member.voice.channel.id === this.connection.channel.id;
    }

    public clear(): void {
        this._queue.length = 0;
    }

    public active(): void {
        clearTimeout(this.timeout);
    }

    public inactive(): void {
        this.timeout = setTimeout(() => {
            this.stop('Disconnected due to inactivity');
        }, 15 * 60 * 1000);
    }

    public shuffle(): void {
        const shuffled = this._queue.map(a =>
            ({ sort: Math.random(), value: a })
        ).sort((a, b) =>
            a.sort - b.sort
        ).map(a => a.value);

        this.clear();
        shuffled.forEach(e =>
            this._queue.push(e)
        );
    }

    public get paused(): boolean {
        return this.connection.dispatcher.paused;
    }

    public get current(): Track | undefined {
        return this._current;
    }

    public get queue(): Track[] {
        return [...this._queue];
    }

    public static get(guild: Guild): Player {
        return players.get(guild.id) as Player;
    }

    public static has(guild: Guild): boolean {
        return players.has(guild.id);
    }

}