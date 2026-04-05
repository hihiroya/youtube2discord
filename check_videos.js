require('dotenv').config();
const RSSParser = require('rss-parser');
const fs = require('fs');
const parser = new RSSParser();

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const CHANNELS_FILE = 'channels.json';
const DATA_FILE = 'last_video_id.json';

async function run() {
    const channels = JSON.parse(fs.readFileSync(CHANNELS_FILE, 'utf-8'));
    let lastIds = {};
    if (fs.existsSync(DATA_FILE)) {
        lastIds = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }

    for (const channel of channels) {
        try {
            const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`;
            const feed = await parser.parseURL(RSS_URL);
            if (!feed.items.length) continue;

            const latestVideo = feed.items[0];
            const latestId = latestVideo.id.split(':')[2];

            if (latestId !== lastIds[channel.id]) {
            console.log('新着動画を発見:', latestVideo.title);

            // Discordへ送信
            await fetch(DISCORD_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: `**${feed.title}の新着動画が投稿されました！**\n${latestVideo.title}\n${latestVideo.link}`
                })
            });
                lastIds[channel.id] = latestId;
            }
        } catch (err) {
            console.error(`Error processing ${channel.name}:`, err);
        }
    }
    // 全チャンネル処理後にID保存ファイルを更新
    fs.writeFileSync(DATA_FILE, JSON.stringify(lastIds, null, 2));
}

run();