require('dotenv').config();
const fs = require('fs')
const path = require('path')
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js')

// 봇 토큰은 환경변수에서 가져오거나 직접 입력
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN

// 슬래시 명령어 정의: /n8n 연결, /n8n 해제, /n8n 조회
const commands = [
  new SlashCommandBuilder()
    .setName('n8n')
    .setDescription('n8n 워크플로우와 이 채널 연결/해제')
    .addSubcommand((sub) =>
      sub
        .setName('연결')
        .setDescription('이 채널을 n8n 워크플로우에 연결합니다')
        .addStringOption((opt) =>
          opt.setName('웹훅주소').setDescription('n8n 웹훅 URL (필수)').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('해제').setDescription('이 채널의 n8n 연결을 해제합니다')
    )
    .addSubcommand((sub) =>
      sub.setName('조회').setDescription('이 채널에 연결된 n8n 웹훅 주소를 확인합니다')
    )
].map((cmd) => cmd.toJSON())

// Discord 클라이언트 생성
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  reconnect: true
})

// 봇이 준비되었을 때 — 슬래시 명령어 등록
client.once('ready', async () => {
  console.log(`봇 연결됨! ${client.user.tag}`)
  const rest = new REST({ version: '10' }).setToken(BOT_TOKEN)
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands })
    console.log('슬래시 명령어(/n8n 연결, /n8n 해제, /n8n 조회) 등록 완료')
  } catch (e) {
    console.error('슬래시 명령어 등록 실패:', e)
  }
})

// 연결이 끊겼을 때
client.on('disconnect', () => {
  console.log('봇 연결이 끊어졌습니다. 재연결을 시도합니다...')
})

// 재연결 시도 중
client.on('reconnecting', () => {
  console.log('봇 재연결 시도 중...')
})

// 재연결 성공
client.on('resume', () => {
  console.log('봇이 재연결되었습니다!')
})

// 에러 발생 시
client.on('error', (error) => {
  console.error('Discord 클라이언트 에러:', error)
})

// 웹소켓 에러 발생 시
client.on('warn', (warning) => {
  console.warn('Discord 클라이언트 경고:', warning)
})

// 프로세스 에러 처리
process.on('uncaughtException', (error) => {
  console.error('처리되지 않은 예외:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('처리되지 않은 Promise 거부:', reason)
})

if (!fs.existsSync('connections')) {
  fs.mkdirSync('connections')
}

const connections = {}

// 슬래시 명령어 처리: /n8n 연결, /n8n 해제, /n8n 조회
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'n8n') return

  const guildId = interaction.guildId
  const channelId = interaction.channelId
  const connectionId = `${guildId}-${channelId}`
  const subcommand = interaction.options.getSubcommand()

  await interaction.deferReply({ ephemeral: true })

  if (subcommand === '연결') {
    const webhookUrl = interaction.options.getString('웹훅주소')?.trim() || ''
    if (!webhookUrl) {
      await interaction.editReply(
        '웹훅 주소가 필요합니다. 사용법: `/n8n 연결 웹훅주소: http://웹훅URL`'
      )
      return
    }
    try {
      connections[connectionId] = webhookUrl
      const filePath = path.join('connections', `${connectionId}.txt`)
      fs.writeFileSync(filePath, webhookUrl, 'utf8')
      await interaction.editReply('이 채널이 n8n에 연결되었습니다. (웹훅 저장됨)')
    } catch (err) {
      console.error(err)
      await interaction.editReply('연결 저장 중 오류가 났습니다.')
    }
    return
  }

  if (subcommand === '해제') {
    try {
      delete connections[connectionId]
      const filePath = path.join('connections', `${connectionId}.txt`)
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      await interaction.editReply('이 채널의 n8n 연결이 해제되었습니다.')
    } catch (err) {
      console.error(err)
      await interaction.editReply('해제 처리 중 오류가 났습니다.')
    }
    return
  }

  if (subcommand === '조회') {
    let webhookUrl = connections[connectionId]
    if (webhookUrl === undefined) {
      try {
        const filePath = path.join('connections', `${connectionId}.txt`)
        webhookUrl = fs.existsSync(filePath)
          ? fs.readFileSync(filePath, 'utf8').trim()
          : ''
      } catch {
        webhookUrl = ''
      }
    }
    if (!webhookUrl) {
      await interaction.editReply('이 채널에는 연결된 n8n 웹훅이 없습니다. `/n8n 연결` 로 연결해주세요.')
      return
    }
    await interaction.editReply(`**연결된 웹훅 주소:**\n${webhookUrl}`)
  }
})


// 메시지가 생성되었을 때 (채팅이 올라왔을 때)
client.on('messageCreate', async (message) => {
  // 봇 자신의 메시지는 무시
  if (message.author.bot) return

  const content = message.content
console.log(content)

  const target = {
    guild: message.guild?.id,
    guildName: message.guild?.name,
    channel: message.channel.id,
    channelName: message.channel.name,
    author: message.author.id,
    authorName: message.author.username,
    authorRoles: message.member?.roles.cache.map(role => role.id),
    authorRoleNames: message.member?.roles.cache.map(role => role.name),
    content: message.content,
    createdAt: message.createdAt.toLocaleString('ko-KR'),
    attachments: message.attachments?.map(attachment => attachment.url) || [],
  }

  const connectionId = `${target.guild}-${target.channel}`
  if (!connections[connectionId]) {
    try {
      connections[connectionId] = fs.readFileSync(`connections/${connectionId}.txt`, 'utf8') || ''
    } catch (error) {
      connections[connectionId] = ''
    }
  }
  const connection = connections[connectionId]
  if (connection) {
    try {
      fetch(connection, {
        method: 'POST',
        body: JSON.stringify(target)
      })
    } catch (e) {}
  }
})

// 봇 로그인
client.login(BOT_TOKEN).catch((error) => {
  console.error('봇 로그인 실패:', error)
  console.error('DISCORD_BOT_TOKEN 환경변수를 설정하거나 코드에 봇 토큰을 입력해주세요.')
  process.exit(1)
})
