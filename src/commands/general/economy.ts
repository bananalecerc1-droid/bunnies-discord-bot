import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    Message,
    User,
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import {
    addExperience,
    formatMoney,
    getEconomySettings,
    getEconomyAccount,
    properties,
    stockMarket,
    totalPropertyValue,
    totalStockValue,
    totalWealth,
} from '../../economy/economyManager';
import { EconomyAccount, EconomyProperty } from '../../models/EconomyAccount';

const HELP_COMMANDS = [
    '`!رصيد` - عرض رصيدك',
    '`!ايداع [مبلغ]` - إيداع فلوس',
    '`!سحب [مبلغ]` - سحب فلوس',
    '`!تحويل [@منشن] [مبلغ]` - تحويل فلوس',
    '`!سرقة [@منشن]` - سرقة شخص',
    '`!سطو` - سطو على بنك',
    '`!سوق` - عرض سوق الأسهم',
    '`!شراء [شركة] [عدد]` - شراء أسهم',
    '`!بيع [شركة] [عدد]` - بيع أسهم',
    '`!محفظتي` - عرض محفظتك',
    '`!عقارات` - عرض العقارات',
    '`!شراء_عقار [رقم]` - شراء عقار',
    '`!عقاراتي` - عقاراتك',
    '`!إيجارات` - جمع الإيجارات',
    '`!عمل` - العمل لكسب فلوس',
    '`!مهمة` - مهمة عشوائية',
    '`!يومي` - مكافأة يومية',
    '`!مستوى` - عرض مستواك',
    '`!ترتيب` - ترتيب الأغنياء',
    '`!سجل` - سجل عملياتك',
];

const BANK_HELP = [
    '`!رصيد` - عرض الكاش والبنك',
    '`!ايداع 1000` - نقل الكاش إلى البنك',
    '`!سحب 500` - نقل المال من البنك إلى الكاش',
    '`!تحويل @الشخص 1000` - تحويل من الكاش إلى شخص',
    '`!سطو` - محاولة السطو على بنوك السيرفر',
];

const isMessage = (interaction: ChatInputCommandInteraction | Message): interaction is Message =>
    interaction instanceof Message;

function amountFrom(value: string | undefined): number | null {
    if (!value || !/^\d+$/.test(value)) return null;
    const amount = Number(value);
    return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

function cooldownMessage(account: EconomyAccount, key: keyof EconomyAccount['cooldowns'], duration: number): string | null {
    const remaining = duration - (Date.now() - account.cooldowns[key]);
    if (remaining <= 0) return null;
    const minutes = Math.ceil(remaining / 60000);
    return `⏰ استنى ${minutes} دقيقة`;
}

function saveTransaction(account: EconomyAccount, transaction: EconomyAccount['transactions'][number]): void {
    account.transactions.push(transaction);
    if (account.transactions.length > 100) account.transactions.shift();
}

function findStock(companyQuery: string): [string, (typeof stockMarket)[string]] | null {
    const entry = Object.entries(stockMarket).find(([name, stock]) =>
        name.includes(companyQuery) || stock.symbol.toLowerCase() === companyQuery.toLowerCase(),
    );
    return entry ?? null;
}

async function reply(message: Message, content: string, embed?: EmbedBuilder): Promise<void> {
    if (embed) await message.reply({ embeds: [embed] });
    else await message.reply(content);
}

async function getTargetAccount(message: Message, target: User, settings: ReturnType<typeof getEconomySettings>): Promise<EconomyAccount> {
    return getEconomyAccount(message.guild!.id, target.id, target.username, settings);
}

export const command: Command = {
    name: 'economy',
    enabled: true,
    aliases: [
        'اقتصاد', 'مساعدة', 'اوامر', 'economy', 'help', 'رصيد', 'حسابي', 'balance', 'bal', 'ايداع', 'إيداع', 'dep',
        'سحب', 'تحويل', 'ارسال', 'with', 'transfer', 'سرقة', 'rob', 'سطو', 'bankrob',
        'سوق', 'stocks', 'شراء', 'buy', 'بيع', 'sell', 'محفظتي', 'portfolio',
        'عقارات', 'properties', 'شراء_عقار', 'buyproperty', 'عقاراتي',
        'myproperties', 'إيجارات', 'collect', 'عمل', 'work', 'مهمة', 'quest',
        'يومي', 'daily', 'مستوى', 'level', 'ترتيب', 'top', 'سجل', 'history',
        'بنك', 'مساعدة_البنك', 'bank', 'bankhelp', 'helpbank',
        'ألوان', 'لون', 'colors', 'color', 'ايموجي', 'emoji', 'كراش', 'crash', 'نرد', 'dice', 'زر', 'button', 'تحدي', 'challenge', 'أرقام', 'numbers', 'لعبة', 'game', 'اكس-او', 'xo', 'خمن', 'guess', 'عجلة', 'wheel', 'حظ', 'luck', 'حرف', 'letter', 'توصيل', 'connect', 'تطابق', 'match', 'فواكه', 'fruits', 'روليت', 'roulette', 'اختباء', 'hide', 'مخاطرة', 'risk', 'نمط', 'pattern', 'الغام', 'ألغاز', 'mystery', 'riddles', 'سلوت', 'slot', 'قمار', 'مقامرة', 'رهان', 'blackjack', 'بلاك-جاك',
        'استثمار', 'invest', 'investment', 'تداول', 'trade', 'trading', 'كشف', 'كشف_الحساب', 'الوقت', 'time', 'الوظائف', 'jobs', 'هدية', 'gift', 'اسعار', 'أسعار', 'prices', 'حماية', 'حرامية', 'thieves', 'توب', 'toplist', 'تسديد', 'سداد', 'pay', 'قرض', 'loan', 'نهب', 'loot', 'راتب', 'salary', 'بخشيش', 'tip', 'تسريع', 'boost', 'المزاد', 'مزاد', 'auction', 'الشعبية', 'popularity',
        'استثمار', 'invest', 'investment', 'تداول', 'trade', 'trading', 'كشف', 'كشف_الحساب', 'الوقت', 'time', 'الوظائف', 'jobs', 'هدية', 'gift', 'اسعار', 'أسعار', 'prices', 'حماية', 'حرامية', 'thieves', 'توب', 'toplist', 'تسديد', 'سداد', 'pay', 'قرض', 'loan', 'نهب', 'loot', 'راتب', 'salary', 'بخشيش', 'tip', 'تسريع', 'boost', 'المزاد', 'مزاد', 'auction', 'الشعبية', 'popularity',
    ],
    async execute(interaction, args, _client): Promise<void> {
        if (!isMessage(interaction) || !interaction.guild) return;

        const message = interaction;
        const guild = message.guild;
        if (!guild) return;
        const economySettings = getEconomySettings(_client);
        const money = (amount: number): string => formatMoney(amount, economySettings);
        if (!economySettings.enabled) {
            await reply(message, '❌ نظام الاقتصاد معطّل من مسؤول السيرفر.');
            return;
        }
        const rawCommandName = message.content.trim().split(/\s+/)[0] ?? '';
        const commandName = rawCommandName.startsWith(_client?.config?.defaultPrefix ?? '!')
            ? rawCommandName.slice((_client?.config?.defaultPrefix ?? '!').length).toLowerCase()
            : rawCommandName.toLowerCase();
        const command = commandName || args.shift()?.toLowerCase() || 'help';
        const account = await getEconomyAccount(guild.id, message.author.id, message.author.username, economySettings);
        const gameCommands = new Set(['ألوان', 'لون', 'colors', 'color', 'ايموجي', 'emoji', 'كراش', 'crash', 'نرد', 'dice', 'زر', 'button', 'تحدي', 'challenge', 'أرقام', 'numbers', 'لعبة', 'game', 'اكس-او', 'xo', 'خمن', 'guess', 'عجلة', 'wheel', 'حظ', 'luck', 'حرف', 'letter', 'توصيل', 'connect', 'تطابق', 'match', 'فواكه', 'fruits', 'روليت', 'roulette', 'اختباء', 'hide', 'مخاطرة', 'risk', 'نمط', 'pattern', 'الغام', 'ألغاز', 'mystery', 'riddles']);
        const gamblingCommands = new Set(['سلوت', 'slot', 'قمار', 'مقامرة', 'رهان', 'blackjack', 'بلاك-جاك']);
        if (gamblingCommands.has(command)) {
            await reply(message, '🚫 ألعاب القمار والرهان غير متاحة. استخدم ألعاب التحدي المجانية مثل `!نرد` أو `!تحدي` أو `!عجلة`.');
            return;
        }
        if (gameCommands.has(command)) {
            if (command === 'لعبة' || command === 'game') {
                await reply(message, '🎮 الألعاب المجانية: ألوان، ايموجي، كراش، نرد، زر، تحدي، أرقام، اكس-او، خمن، عجلة، حظ، حرف، توصيل، تطابق، فواكه، روليت، اختباء، مخاطرة، نمط، الغام.\n🚫 لا توجد ألعاب قمار أو رهان.');
                return;
            }
            const now = Date.now();
            const reward = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;
            const gameKeys: Record<string, string> = {
                'ألوان': 'colors', 'لون': 'colors', colors: 'colors', color: 'colors', 'ايموجي': 'emoji', emoji: 'emoji',
                'كراش': 'crash', crash: 'crash', 'نرد': 'dice', dice: 'dice', 'زر': 'button', button: 'button',
                'تحدي': 'challenge', challenge: 'challenge', 'أرقام': 'numbers', numbers: 'numbers', 'اكس-او': 'xo', xo: 'xo',
                'خمن': 'guess', guess: 'guess', 'حرف': 'letter', letter: 'letter', 'توصيل': 'connect', connect: 'connect',
                'تطابق': 'match', match: 'match', 'فواكه': 'fruits', fruits: 'fruits', 'روليت': 'roulette', roulette: 'roulette',
                'اختباء': 'hide', hide: 'hide', 'مخاطرة': 'risk', risk: 'risk', 'نمط': 'pattern', pattern: 'pattern',
                'الغام': 'mystery', 'ألغاز': 'mystery', mystery: 'mystery', riddles: 'mystery', 'عجلة': 'wheel', wheel: 'wheel', 'حظ': 'wheel', luck: 'wheel'
            };
            const names: Record<string, string> = {
                'ألوان': 'الألوان', 'لون': 'الألوان', colors: 'الألوان', color: 'الألوان', 'ايموجي': 'الإيموجي', emoji: 'الإيموجي',
                'كراش': 'كراش آمن', crash: 'كراش آمن', 'نرد': 'النرد', dice: 'النرد', 'زر': 'الزر', button: 'الزر',
                'تحدي': 'التحدي', challenge: 'التحدي', 'أرقام': 'الأرقام', numbers: 'الأرقام', 'اكس-او': 'إكس-أو', xo: 'إكس-أو',
                'خمن': 'خمن الرقم', guess: 'خمن الرقم', 'حرف': 'الحرف', letter: 'الحرف', 'توصيل': 'التوصيل', connect: 'التوصيل',
                'تطابق': 'التطابق', match: 'التطابق', 'فواكه': 'الفواكه', fruits: 'الفواكه', 'روليت': 'عجلة المكاسب', roulette: 'عجلة المكاسب',
                'اختباء': 'الاختباء', hide: 'الاختباء', 'مخاطرة': 'تحدي المخاطرة', risk: 'تحدي آمن', 'نمط': 'النمط', pattern: 'النمط',
                'الغام': 'الألغاز', 'ألغاز': 'الألغاز', mystery: 'الألغاز', riddles: 'الألغاز', 'عجلة': 'عجلة المكاسب', wheel: 'عجلة المكاسب', 'حظ': 'الحظ', luck: 'الحظ'
            };
            if (command === 'خمن' || command === 'guess') {
                const guess = amountFrom(args[0]);
                const secret = (message.author.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) + Math.floor(now / 60000)) % 10 + 1;
                if (!guess) { await reply(message, '🔢 خمن رقمًا من 1 إلى 10 باستخدام `!خمن [الرقم]`'); return; }
                const guessPrize = economySettings.gameRewards.guess || { min: 250, max: 250 };
                if (guess === secret) { const prize = reward(guessPrize.min, guessPrize.max); account.cash += prize; account.stats.totalEarned += prize; saveTransaction(account, { type: 'مكافأة خمن', amount: prize, date: now }); await account.save(); await reply(message, `🎯 صحيح! ربحت 💰 ${money(prize)}`); }
                else await reply(message, `❌ ليس هذا الرقم. جرّب مرة أخرى قبل انتهاء الجولة.`);
                return;
            }
            const configuredPrize = economySettings.gameRewards[gameKeys[command]] || { min: 25, max: 250 };
            const earned = reward(configuredPrize.min, configuredPrize.max);
            const resultText = gameKeys[command] === 'wheel' || gameKeys[command] === 'roulette' ? `🎡 مبروك! العجلة كلها مكاسب — ربحت 💰 ${money(earned)}` : `🎮 لعبت **${names[command] || 'لعبة'}** وربحت 💰 ${money(earned)}`;
            account.cash += earned;
            account.stats.totalEarned += earned;
            saveTransaction(account, { type: `لعبة: ${names[command] || command}`, amount: earned, date: now });
            addExperience(account, 5);
            await account.save();
            await reply(message, resultText);
            return;
        }
        const userId = message.author.id;

        const utilityCommands = new Set(['استثمار', 'invest', 'investment', 'تداول', 'trade', 'trading', 'كشف', 'كشف_الحساب', 'الوقت', 'time', 'الوظائف', 'jobs', 'هدية', 'gift', 'اسعار', 'أسعار', 'prices', 'حماية', 'حرامية', 'thieves', 'توب', 'toplist', 'تسديد', 'سداد', 'pay', 'قرض', 'loan', 'نهب', 'loot', 'راتب', 'salary', 'بخشيش', 'tip', 'تسريع', 'boost', 'المزاد', 'مزاد', 'auction', 'الشعبية', 'popularity']);
        if (utilityCommands.has(command)) {
            if (command === 'استثمار' || command === 'invest' || command === 'investment' || command === 'اسعار' || command === 'أسعار' || command === 'prices' || command === 'تداول' || command === 'trade' || command === 'trading') {
                const market = Object.entries(stockMarket).map(([name, stock]) => `📈 **${name}** (${stock.symbol}) — ${money(stock.price)}`).join('\n');
                await reply(message, '', new EmbedBuilder().setColor(0x3498db).setTitle('📈 الاستثمار والتداول').setDescription(`${market}\n\nاستخدم !شراء [الشركة] [العدد] و !بيع [الشركة] [العدد].`));
                return;
            }
            if (command === 'كشف' || command === 'كشف_الحساب') { await reply(message, `📋 كشف حسابك: كاش ${money(account.cash)} | بنك ${money(account.bank)} | ثروتك ${money(totalWealth(account))}`); return; }
            if (command === 'الوقت' || command === 'time') { await reply(message, `🕒 الوقت الآن: <t:${Math.floor(Date.now() / 1000)}:F>`); return; }
            if (command === 'الوظائف' || command === 'jobs') { await reply(message, '💼 الوظائف: استخدم `!عمل` للعمل و`!راتب` للمكافأة اليومية.'); return; }
            if (command === 'هدية' || command === 'gift') { account.cash += 300; account.stats.totalEarned += 300; saveTransaction(account, { type: 'هدية', amount: 300, date: Date.now() }); await account.save(); await reply(message, '🎁 استلمت هدية مجانية: 💰 300'); return; }
            if (command === 'توب' || command === 'toplist' || command === 'الشعبية' || command === 'popularity') { await reply(message, '🏆 استخدم `!ترتيب` لعرض أغنى أعضاء السيرفر.'); return; }
            if (command === 'حماية') { await reply(message, '🛡️ حسابك محمي: لا توجد ألعاب قمار أو خسائر عشوائية في النظام الجديد.'); return; }
            if (command === 'حرامية' || command === 'thieves' || command === 'نهب' || command === 'loot') { await reply(message, '🚫 أوامر السرقة والنهب متوقفة لحماية اقتصاد السيرفر.'); return; }
            if (command === 'قرض' || command === 'loan' || command === 'تسديد' || command === 'سداد' || command === 'pay') { await reply(message, '🏦 القروض غير مفعلة حاليًا. استخدم البنك والإيداع والسحب بدلًا منها.'); return; }
            if (command === 'راتب' || command === 'salary' || command === 'بخشيش' || command === 'tip' || command === 'تسريع' || command === 'boost') { const earned = command === 'راتب' || command === 'salary' ? 500 : 150; account.cash += earned; account.stats.totalEarned += earned; saveTransaction(account, { type: `مكافأة: ${command}`, amount: earned, date: Date.now() }); await account.save(); await reply(message, `✅ حصلت على مكافأة مجانية: 💰 ${money(earned)}`); return; }
            if (command === 'المزاد' || command === 'مزاد' || command === 'auction') { await reply(message, '🔨 المزاد قيد التجهيز وسيكون بدون رهانات أو خسائر.'); return; }
        }
        if (command === 'bank' || command === 'bankhelp' || command === 'helpbank' || command === 'بنك') {
            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('🏦 مساعدة البنك')
                .setDescription('دليل بسيط للكاش والفلوس الموجودة في البنك.')
                .addFields({ name: 'الأوامر', value: BANK_HELP.join('\n') })
                .setFooter({ text: 'الكاش للتحويلات والمشتريات، وفلوس البنك محفوظة بأمان.' });
            await reply(message, '', embed);
            return;
        }

        if (command === 'economy' || command === 'help' || command === 'مساعدة') {
            const embed = new EmbedBuilder()
                .setColor(0xf39c12)
                .setTitle('📚 أوامر الاقتصاد')
                .setDescription('هذه أموال افتراضية داخل السيرفر فقط. كل الأوامر تبدأ بـ `!`.')
                .addFields({ name: 'الأوامر', value: HELP_COMMANDS.join('\n') })
                .setFooter({ text: '🏦 البنك الافتراضي للسيرفر' });
            await reply(message, '', embed);
            return;
        }

        if (command === 'رصيد' || command === 'balance' || command === 'bal') {
            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle(`💳 حساب ${message.author.username}`)
                .setThumbnail(message.author.displayAvatarURL())
                .addFields(
                    { name: '💵 الكاش', value: money(account.cash), inline: true },
                    { name: '🏦 البنك', value: `${money(account.bank)} / ${money(account.bankLimit)}`, inline: true },
                    { name: '📈 الأسهم', value: money(totalStockValue(account)), inline: true },
                    { name: '🏠 العقارات', value: money(totalPropertyValue(account)), inline: true },
                    { name: '💰 الثروة الكلية', value: money(totalWealth(account)), inline: false },
                    { name: '⭐ المستوى', value: `${account.level}`, inline: true },
                    { name: '📊 الخبرة', value: `${account.xp}/${account.xpNeeded}`, inline: true },
                )
                .setFooter({ text: '🏦 البنك الافتراضي للسيرفر' })
                .setTimestamp();
            await reply(message, '', embed);
            return;
        }

        if (command === 'ايداع' || command === 'dep') {
            const amount = amountFrom(args[0]);
            if (!amount) return reply(message, '⚠️ اكتب مبلغ صحيح');
            if (account.cash < amount) return reply(message, '❌ فلوسك في الكاش أقل من المطلوب');
            if (account.bank + amount > account.bankLimit) return reply(message, `❌ البنك مليان! حدك ${money(account.bankLimit)}`);
            account.cash -= amount;
            account.bank += amount;
            saveTransaction(account, { type: 'إيداع', amount, date: Date.now() });
            await account.save();
            await reply(message, `✅ أودعت ${money(amount)} في البنك`);
            return;
        }

        if (command === 'سحب' || command === 'with') {
            const amount = amountFrom(args[0]);
            if (!amount) return reply(message, '⚠️ اكتب مبلغ صحيح');
            if (account.bank < amount) return reply(message, '❌ رصيدك البنكي أقل من المطلوب');
            account.bank -= amount;
            account.cash += amount;
            saveTransaction(account, { type: 'سحب', amount, date: Date.now() });
            await account.save();
            await reply(message, `✅ سحبت ${money(amount)} من البنك`);
            return;
        }

        if (command === 'تحويل' || command === 'transfer') {
            if (!economySettings.transfersEnabled) return reply(message, '❌ التحويلات معطّلة من مسؤول السيرفر.');
            const target = message.mentions.users.first();
            const amount = amountFrom(args[0]) ?? amountFrom(args[1]);
            if (!target || !amount) return reply(message, '⚠️ الاستخدام: !تحويل @منشن المبلغ');
            if (target.bot) return reply(message, '🤖 ما تقدر تحول لبوت');
            if (account.cash < amount) return reply(message, '❌ ما عندك كاش كافي');
            const targetAccount = await getTargetAccount(message, target, economySettings);
            account.cash -= amount;
            targetAccount.cash += amount;
            saveTransaction(account, { type: 'تحويل', amount, to: target.username, date: Date.now() });
            saveTransaction(targetAccount, { type: 'استلام', amount, from: message.author.username, date: Date.now() });
            await account.save();
            await targetAccount.save();
            await reply(message, `✅ حولت ${money(amount)} إلى ${target.username}`);
            return;
        }

        if (command === 'سرقة' || command === 'rob') {
            const target = message.mentions.users.first();
            if (!target || target.id === userId) return reply(message, '⚠️ الاستخدام: !سرقة @منشن');
            if (target.bot) return reply(message, '🤖 لا يمكن سرقة بوت');
            const cooldown = cooldownMessage(account, 'rob', 5 * 60 * 1000);
            if (cooldown) return reply(message, cooldown);
            const targetAccount = await getTargetAccount(message, target, economySettings);
            account.cooldowns.rob = Date.now();
            if (targetAccount.cash <= 0) return reply(message, '❌ هذا الشخص مفلس');
            const stealPercentage = Math.floor(Math.random() * 20) + 10;
            const stealAmount = Math.floor(targetAccount.cash * stealPercentage / 100);
            account.stats.totalRobs += 1;
            if (Math.random() > 0.4) {
                targetAccount.cash -= stealAmount;
                account.cash += stealAmount;
                account.stats.successfulRobs += 1;
                addExperience(account, 20);
                await targetAccount.save();
                await account.save();
                await reply(message, `🎯 سرقت ${money(stealAmount)} من ${target.username}`);
            } else {
                const fine = Math.floor(stealAmount * 0.5);
                account.cash = Math.max(0, account.cash - fine);
                targetAccount.cash += fine;
                account.stats.failedRobs += 1;
                await targetAccount.save();
                await account.save();
                await reply(message, `❌ فشلت السرقة! دفعت غرامة ${money(fine)}`);
            }
            return;
        }

        if (command === 'سطو' || command === 'bankrob') {
            const cooldown = cooldownMessage(account, 'rob', 30 * 60 * 1000);
            if (cooldown) return reply(message, cooldown);
            account.cooldowns.rob = Date.now();
            const accounts = await EconomyAccount.find({ guildId: guild.id });
            const totalBankMoney = accounts.reduce((sum, entry) => sum + entry.bank, 0);
            if (totalBankMoney <= 0) return reply(message, '🏦 البنك فاضي حالياً');
            const stealAmount = Math.floor(totalBankMoney * 0.1);
            if (Math.random() > 0.7) {
                account.cash += stealAmount;
                account.stats.successfulRobs += 1;
                addExperience(account, 50);
                await account.save();
                await reply(message, `🏦🔥 سطوت على البنك وسرقت ${money(stealAmount)}!`);
            } else {
                const fine = Math.floor(stealAmount * 0.3);
                account.cash = Math.max(0, account.cash - fine);
                account.stats.failedRobs += 1;
                await account.save();
                await reply(message, `🚔 انمسكت! دفعت غرامة ${money(fine)}`);
            }
            return;
        }

        if (command === 'سوق' || command === 'stocks') {
            const stockList = Object.entries(stockMarket).map(([name, stock]) => {
                const previous = stock.history.at(-2);
                const change = previous ? ((stock.price - previous) / previous * 100).toFixed(2) : '0.00';
                const trend = Number(change) > 0 ? '📈' : Number(change) < 0 ? '📉' : '➡️';
                return `${trend} **${name}** (${stock.symbol})\nالسعر: ${money(stock.price)} | التغير: ${change}%`;
            }).join('\n\n');
            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('📈 سوق الأسهم')
                .setDescription(stockList)
                .setFooter({ text: 'تتحدث الأسعار كل 5 دقائق' })
                .setTimestamp();
            await reply(message, '', embed);
            return;
        }

        if (command === 'شراء' || command === 'buy') {
            const amount = amountFrom(args.at(-1));
            const companyName = args.slice(0, -1).join(' ');
            const stockEntry = companyName && amount ? findStock(companyName) : null;
            if (!stockEntry || !amount) return reply(message, '⚠️ الاستخدام: !شراء [اسم الشركة أو الرمز] [عدد الأسهم]');
            const [stockName, stock] = stockEntry;
            const totalCost = stock.price * amount;
            if (account.cash < totalCost) return reply(message, '❌ فلوسك ما تكفي');
            const holding = account.stocks[stockName] ?? { amount: 0, avgPrice: 0, company: stockName };
            holding.avgPrice = ((holding.avgPrice * holding.amount) + totalCost) / (holding.amount + amount);
            holding.amount += amount;
            account.stocks[stockName] = holding;
            account.cash -= totalCost;
            saveTransaction(account, { type: 'شراء أسهم', company: stockName, amount, price: stock.price, date: Date.now() });
            addExperience(account, 10);
            await account.save();
            await reply(message, `✅ اشتريت ${amount} سهم من ${stockName} بـ ${money(totalCost)}`);
            return;
        }

        if (command === 'بيع' || command === 'sell') {
            const amount = amountFrom(args.at(-1));
            const companyName = args.slice(0, -1).join(' ');
            const stockEntry = companyName && amount ? findStock(companyName) : null;
            if (!stockEntry || !amount) return reply(message, '⚠️ الاستخدام: !بيع [اسم الشركة أو الرمز] [عدد الأسهم]');
            const [stockName, stock] = stockEntry;
            const holding = account.stocks[stockName];
            if (!holding || holding.amount < amount) return reply(message, '❌ ما عندك هذا العدد من الأسهم');
            const totalSell = stock.price * amount;
            holding.amount -= amount;
            account.cash += totalSell;
            if (holding.amount === 0) delete account.stocks[stockName];
            saveTransaction(account, { type: 'بيع أسهم', company: stockName, amount, price: stock.price, date: Date.now() });
            await account.save();
            await reply(message, `✅ بعت ${amount} سهم من ${stockName} بـ ${money(totalSell)}`);
            return;
        }

        if (command === 'محفظتي' || command === 'portfolio') {
            const holdings = Object.values(account.stocks);
            if (holdings.length === 0) return reply(message, '📊 ما عندك أسهم. اشتر من السوق بـ !شراء');
            const portfolio = holdings.map((holding) => {
                const currentPrice = stockMarket[holding.company]?.price ?? 0;
                const profit = (currentPrice - holding.avgPrice) * holding.amount;
                return `📊 **${holding.company}**\nالأسهم: ${holding.amount} | السعر الحالي: ${money(currentPrice)}\n${profit >= 0 ? '✅' : '❌'} الربح: ${money(profit)}`;
            }).join('\n\n');
            await reply(message, '', new EmbedBuilder().setColor(0x9b59b6).setTitle('📊 محفظتك الاستثمارية').setDescription(portfolio));
            return;
        }

        if (command === 'عقارات' || command === 'properties') {
            const list = properties.map((property, index) =>
                `${index + 1}. 🏠 **${property.name}**\nالسعر: ${money(property.price)} | الإيجار: ${money(property.rent)} / يوم | النوع: ${property.type}`,
            ).join('\n\n');
            await reply(message, '', new EmbedBuilder().setColor(0xe67e22).setTitle('🏠 العقارات المتاحة').setDescription(list));
            return;
        }

        if (command === 'شراء_عقار' || command === 'buyproperty') {
            const index = amountFrom(args[0]);
            if (!index || index > properties.length) return reply(message, '⚠️ اكتب رقم العقار الصحيح');
            const property = properties[index - 1];
            if (account.cash < property.price) return reply(message, '❌ فلوسك ما تكفي');
            const owned: EconomyProperty = { ...property, boughtAt: Date.now(), lastCollect: Date.now() };
            account.cash -= property.price;
            account.properties.push(owned);
            saveTransaction(account, { type: 'شراء عقار', property: property.name, amount: property.price, price: property.price, date: Date.now() });
            addExperience(account, 30);
            await account.save();
            await reply(message, `✅ اشتريت ${property.name} بـ ${money(property.price)}`);
            return;
        }

        if (command === 'عقاراتي' || command === 'myproperties') {
            if (account.properties.length === 0) return reply(message, '🏠 ما عندك عقارات');
            const list = account.properties.map((property, index) =>
                `${index + 1}. 🏠 ${property.name} — الإيجار: ${money(property.rent)}/يوم`,
            ).join('\n');
            await reply(message, '', new EmbedBuilder().setColor(0x1abc9c).setTitle('🏠 عقاراتك').setDescription(list));
            return;
        }

        if (command === 'إيجارات' || command === 'collect') {
            if (account.properties.length === 0) return reply(message, '🏠 ما عندك عقارات');
            const now = Date.now();
            let totalRent = 0;
            for (const property of account.properties) {
                const daysPassed = Math.floor((now - property.lastCollect) / (24 * 60 * 60 * 1000));
                if (daysPassed > 0) {
                    totalRent += property.rent * daysPassed;
                    property.lastCollect = now;
                }
            }
            if (totalRent === 0) return reply(message, '⏰ ما في إيجارات جديدة. ارجع بعد يوم');
            account.cash += totalRent;
            account.stats.totalEarned += totalRent;
            saveTransaction(account, { type: 'إيجارات', amount: totalRent, date: now });
            addExperience(account, 15);
            await account.save();
            await reply(message, `✅ جمعت ${money(totalRent)} من الإيجارات`);
            return;
        }

        if (command === 'عمل' || command === 'work') {
            const cooldown = cooldownMessage(account, 'work', 60 * 60 * 1000);
            if (cooldown) return reply(message, cooldown);
            account.cooldowns.work = Date.now();
            const jobs = ['برمجت موقع', 'سويت تصميم', 'اشتغلت في مطعم', 'دربت ناس', 'صلحت سيارات'];
            const job = jobs[Math.floor(Math.random() * jobs.length)];
            const salary = Math.floor(Math.random() * 1000) + 500 + account.level * 100;
            account.cash += salary;
            account.stats.totalEarned += salary;
            addExperience(account, 25);
            await account.save();
            await reply(message, `💼 ${job} وكسبت ${money(salary)}`);
            return;
        }

        if (command === 'مهمة' || command === 'quest') {
            const cooldown = cooldownMessage(account, 'crime', 2 * 60 * 60 * 1000);
            if (cooldown) return reply(message, cooldown);
            account.cooldowns.crime = Date.now();
            const quests = [
                { name: 'تهريب بضاعة', reward: 2000, risk: 0.3 },
                { name: 'سرقة محل مجوهرات', reward: 5000, risk: 0.5 },
                { name: 'اختراق حسابات', reward: 3000, risk: 0.4 },
                { name: 'صفقة أسلحة', reward: 8000, risk: 0.6 },
            ];
            const quest = quests[Math.floor(Math.random() * quests.length)];
            if (Math.random() > quest.risk) {
                account.cash += quest.reward;
                account.stats.totalEarned += quest.reward;
                account.stats.totalCrimes += 1;
                addExperience(account, 40);
                await account.save();
                await reply(message, `🎯 نجحت في ${quest.name} وكسبت ${money(quest.reward)}`);
            } else {
                const fine = Math.floor(quest.reward * 0.4);
                account.cash = Math.max(0, account.cash - fine);
                account.stats.totalCrimes += 1;
                await account.save();
                await reply(message, `🚔 انمسكت في ${quest.name}! خسرت ${money(fine)}`);
            }
            return;
        }

        if (command === 'يومي' || command === 'daily') {
            if (!economySettings.dailyRewardEnabled) return reply(message, '❌ المكافآت اليومية معطّلة من مسؤول السيرفر.');
            const cooldown = cooldownMessage(account, 'daily', economySettings.dailyCooldownHours * 60 * 60 * 1000);
            if (cooldown) return reply(message, cooldown);
            account.cooldowns.daily = Date.now();
            const reward = Math.floor(Math.random() * (economySettings.dailyRewardMax - economySettings.dailyRewardMin + 1))
                + economySettings.dailyRewardMin + account.level * 200;
            account.cash += reward;
            account.stats.totalEarned += reward;
            addExperience(account, 15);
            await account.save();
            await reply(message, `🎁 استلمت مكافأتك اليومية: ${money(reward)}`);
            return;
        }

        if (command === 'مستوى' || command === 'level') {
            const embed = new EmbedBuilder()
                .setColor(0xf1c40f)
                .setTitle(`⭐ مستوى ${message.author.username}`)
                .addFields(
                    { name: 'المستوى', value: `${account.level}`, inline: true },
                    { name: 'الخبرة', value: `${account.xp}/${account.xpNeeded}`, inline: true },
                    { name: 'حد البنك', value: money(account.bankLimit), inline: true },
                    { name: 'إجمالي الأرباح', value: money(account.stats.totalEarned), inline: true },
                    { name: 'عمليات السرقة', value: `${account.stats.totalRobs}`, inline: true },
                    { name: 'الجرائم', value: `${account.stats.totalCrimes}`, inline: true },
                );
            await reply(message, '', embed);
            return;
        }

        if (command === 'ترتيب' || command === 'top') {
            const accounts = await EconomyAccount.find({ guildId: guild.id }).sort({ bank: -1 }).limit(10);
            const lines = accounts.map((entry, index) => `${['🥇', '🥈', '🥉'][index] ?? `**${index + 1}.**`} ${entry.username} — ${money(totalWealth(entry))}`);
            await reply(message, '', new EmbedBuilder().setColor(0xf39c12).setTitle('🏆 أغنى اللاعبين').setDescription(lines.join('\n') || 'لا يوجد لاعبين بعد.'));
            return;
        }

        if (command === 'سجل' || command === 'history') {
            const lines = account.transactions.slice(-15).reverse().map((transaction) => {
                const date = new Date(transaction.date).toLocaleDateString('ar-SA');
                return `• ${transaction.type}: ${money(transaction.amount ?? transaction.price ?? 0)} — ${date}`;
            });
            await reply(message, '', new EmbedBuilder().setColor(0x95a5a6).setTitle('📋 سجل العمليات').setDescription(lines.join('\n') || '📋 ما في عمليات سابقة'));
        }
    },
};
