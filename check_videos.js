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

            const savedId = lastIds[channel.id];
            const latestId = feed.items[0].id.split(':')[2];

            let notifyItems = []; // 通知する動画のリスト

            if (!savedId) {
                // 初回実行時：過去の動画が大量に通知されるのを防ぐため最新1件のみ
                notifyItems = [feed.items[0]];
                // 初回実行時：通知は一切行わず、IDの初期登録のみを行うにしたい場合以下に差し替え
                // notifyItems = [];
            } else {
                // 前回保存したIDが配列の何番目にあるか探す
                const lastIndex = feed.items.findIndex(item => item.id.split(':')[2] === savedId);

                if (lastIndex === -1) {
                    // 保存したIDが見つからない（RSSの保持上限15件を超えて大量更新された場合など）
                    notifyItems = [feed.items[0]];
                } else if (lastIndex > 0) {
                    // 前回保存したIDより上にある（新しい）動画をすべて取得し、
                    // 古い順（投稿順）に通知するために配列を反転させる
                    notifyItems = feed.items.slice(0, lastIndex).reverse();
                }
            }

            // 新着動画がある場合、順番に通知処理を実行
            for (const video of notifyItems) {
                console.log(`新着発見: ${channel.name} - ${video.title}`);

                await fetch(DISCORD_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: `**${feed.title}の新着動画が投稿されました！**\n${video.title}\n${video.link}`
                    })
                });

                // 【重要】Discordのスパム判定（Rate Limit）を避けるため1秒待機
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // 最後に最新のIDで上書き保存
            lastIds[channel.id] = latestId;

        } catch (err) {
            console.error(`Error processing ${channel.name}:`, err);
        }
    }
    // 全チャンネル処理後にID保存ファイルを更新
    fs.writeFileSync(DATA_FILE, JSON.stringify(lastIds, null, 2));
}

run();