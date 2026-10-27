import type { Action, Dream, DreamId, Stats } from './types'

export const RULES = {
  rounds: 6,
  timePerRound: 6,
  maxActions: 3,
  choiceRound: 3,
  sustainableHealth: 50,
  sustainableSatisfaction: 60,
} as const

export const INITIAL_STATS: Stats = {
  money: 100, skill: 20, support: 20, health: 70, satisfaction: 70,
}

export const STAT_LABELS: Record<keyof Stats, string> = {
  money: '資金', skill: 'スキル', support: '人とのつながり', health: '心身の状態', satisfaction: '本人の満足度',
}

export const ROLES = [
  { id: 'plan', label: '計画担当', prompt: '次の段階に必要な準備は何ですか。' },
  { id: 'money', label: '資金担当', prompt: '次のラウンドにも資金を残せますか。' },
  { id: 'skill', label: '学習・スキル担当', prompt: '今のスキルでできること、学びたいことは？' },
  { id: 'support', label: '人とのつながり担当', prompt: '誰の力を借りると前に進めそうですか。' },
  { id: 'care', label: '心身のケア担当', prompt: '無理なく続けるための休息はありますか。' },
  { id: 'voice', label: '本人の意思担当', prompt: 'この計画は本人の大切なことに合っていますか。' },
]

export const REFLECTION_QUESTIONS = [
  '夢に近づくうえで、最も役立った支援は何でしたか。',
  '意見が分かれたとき、何を基準に決めましたか。',
  '本人の希望と、サポーターが良いと思う方法に違いはありましたか。',
  'もう一度挑戦するなら、何を変えますか。',
]

export const COMMON_ACTIONS: Action[] = [
  { id: 'study', label: '学習・練習', description: '基礎を学び、できることを少しずつ増やす。', category: 'common', time: 2, cost: 10, effects: { skill: 15, health: -5 } },
  { id: 'consult', label: '人に相談する', description: '経験者や地域の人に話を聞き、支えを広げる。', category: 'common', time: 1, cost: 0, effects: { support: 10, satisfaction: 5 } },
  { id: 'work', label: 'アルバイトをする', description: '活動資金を得る。体力の消耗にも気を配ろう。', category: 'common', time: 2, cost: -20, effects: { health: -10 } },
  { id: 'rest', label: '休息を取る', description: '活動から離れ、心と体を整える時間をつくる。', category: 'common', time: 2, cost: 0, effects: { health: 20, satisfaction: 5 } },
  { id: 'talk', label: '本人と話し合う', description: '本人の気持ちを聞き、これからの進め方を確かめる。', category: 'common', time: 1, cost: 0, effects: { satisfaction: 10 } },
  { id: 'reflect', label: '現状を振り返る', description: '立ち止まって考えを整理する。時間・資金・数値の変化なし。', category: 'common', time: 0, cost: 0, effects: {} },
]

interface ScenarioText {
  id: DreamId
  title: string
  icon: string
  character: Dream['character']
  stageTitles: [string, string, string]
  actionLabels: [string, string, string, string]
  actionDescriptions: [string, string, string, string]
  taskLabels: [string, string, string, string]
  eventDescriptions: [string, string, string, string, string, string]
  strategies: [string, string, string, string]
}

const scenarios: ScenarioText[] = [
  {
    id: 'cafe', title: '小さなカフェを開きたい', icon: '☕',
    character: {
      name: '森 ひなた',
      background: '喫茶店で働く24歳。休日には、近所の人へ手づくりのお菓子をふるまっています。',
      motivation: 'ひとりで来ても安心でき、近所の人がゆっくり話せる居場所をつくりたい。',
      strength: '人の話を聞くのが得意。接客の経験がある。',
      difficulty: '経営や資金計画は勉強中。準備を一人で抱え込みがち。',
      values: 'お客さんとの会話と、無理なく長く続けられる働き方。',
      refusal: '開店を急ぐために、休みなく働き続ける計画は受け入れません。',
      quote: '「また来たい」と思える、小さな居場所にしたいんです。',
    },
    stageTitles: ['学んで、地域の声を聞く', '小さく開いて、確かめる', '続けられるお店を開く'],
    actionLabels: ['地域のニーズを調べる', '小さな試営業をする', 'メニューと運営を改善する', 'カフェを正式に開く'],
    actionDescriptions: ['近所の人に、過ごしやすいお店やメニューについて聞く。', '少人数を招き、接客と営業の流れを試す。', '試営業の声をもとに、メニューと無理のない当番を整える。', '衛生・予算・運営の準備を確認し、地域にお店を開く。'],
    taskLabels: ['地域のニーズ調査を終える', '試営業を行う', 'メニューと運営の改善を終える', '正式に開店する'],
    eventDescriptions: ['近所の店主が相談に乗ってくれます。今だけ「人に相談する」のつながりがさらに＋5。', '地域の講習会に空きが出ました。今だけ「学習・練習」の費用が5点安くなります。', '試営業の材料が値上がり。「小さな試営業をする」の費用が今だけ5点増えます。本人と方針も選びましょう。', '試営業の記録を整理する手助けが届きました。「メニューと運営を改善する」の時間が今だけ1点減ります。', 'いつもの相談相手が少し忙しい時期です。「人に相談する」のつながりは今だけ＋5になります。', '地域の人から開店準備の支援が届きました。「カフェを正式に開く」の費用が今だけ5点安くなります。'],
    strategies: ['対話の時間を大切にする', '席数を絞り、近所の声をゆっくり聞く方針。本人も安心しています。', '無理のない範囲で広く知らせる', '営業日を限定し、仲間と分担して紹介する方針。本人も賛成しています。'],
  },
  {
    id: 'manga', title: '自分の漫画を作品として届けたい', icon: '✒️',
    character: {
      name: '青山 凪',
      background: '大学に通う21歳。ノートに描きためてきた物語を、初めて短編漫画にまとめようとしています。',
      motivation: '日常の小さな孤独と、人との出会いを描いた物語を、誰かに届けたい。',
      strength: '人物の気持ちを丁寧に描ける。伝えたいテーマがある。',
      difficulty: '最後まで仕上げた経験が少ない。構成や発表方法に迷っている。',
      values: '自分が伝えたいテーマを残し、納得できる作品にすること。',
      refusal: '流行に合わせるために、自分の創作テーマをすべて捨てる案は受け入れません。',
      quote: '上手さだけでなく、私が描きたい気持ちを届けたいです。',
    },
    stageTitles: ['物語と人物を育てる', '草稿を描き、声を聞く', '仕上げて、作品を届ける'],
    actionLabels: ['物語と人物を設計する', '草稿を描いて感想を聞く', '感想をもとに原稿を磨く', '完成作品を公開する'],
    actionDescriptions: ['テーマを確かめ、短編のあらすじと登場人物をまとめる。', '最後まで草稿を描き、読者に伝わるか確かめる。', '本人の表現を守りながら、構成や絵をわかりやすく整える。', '最終原稿を確認し、作品を投稿または公開する。受賞や売上は条件ではない。'],
    taskLabels: ['物語と人物の設計を終える', '草稿を完成し、感想を聞く', '最終原稿の改善を終える', '完成作品を投稿・公開する'],
    eventDescriptions: ['創作仲間が相談に乗ってくれます。今だけ「人に相談する」のつながりがさらに＋5。', '図書館の作画講座に参加できます。今だけ「学習・練習」の費用が5点安くなります。', '試し刷りの費用が上がりました。「草稿を描いて感想を聞く」の費用が今だけ5点増えます。本人と表現の方針も選びましょう。', '読者から改善のヒントをもらえました。「感想をもとに原稿を磨く」の時間が今だけ1点減ります。', '創作仲間は今週立て込んでいます。「人に相談する」のつながりは今だけ＋5になります。', '発表を手伝う人が見つかりました。「完成作品を公開する」の費用が今だけ5点安くなります。'],
    strategies: ['原テーマを丁寧に描き込む', '主人公の気持ちを描き込むため、話し合いの時間を取る方針。本人が望んでいます。', 'テーマを保ち、見せ方を工夫する', 'テーマは変えず、読みやすい構成と紹介文を工夫する方針。本人も納得しています。'],
  },
  {
    id: 'music', title: '地域の音楽イベントを開きたい', icon: '♫',
    character: {
      name: '高橋 奏',
      background: '地域の音楽サークルで活動する27歳。年齢や経験を問わず楽しめる集まりを企画しています。',
      motivation: '演奏する人も聴く人も、音楽を通じて近所の人とつながれる機会をつくりたい。',
      strength: '仲間と演奏する経験がある。参加者の声を聞くのが好き。',
      difficulty: '主催は初めて。会場や予算、安全の準備が必要。',
      values: '誰もが参加しやすいことと、安心して過ごせる安全な運営。',
      refusal: '規模を大きくするために、安全確認や参加しやすさを省く案は受け入れません。',
      quote: '上手な人だけでなく、聴くだけの人にも居場所がほしいです。',
    },
    stageTitles: ['学んで、参加者の声を聞く', '仲間と小さな試演をする', '安全を整え、本番を開く'],
    actionLabels: ['参加者の希望を調べる', '仲間と小規模な試演をする', '会場・安全・予算を整える', '地域の音楽イベントを開く'],
    actionDescriptions: ['地域の人に、参加しやすい時間や必要な配慮を聞く。', '協力者と小さく試演し、参加者の感想を聞く。', '試演をもとに、導線・音量・当番・予算を確認する。', '協力者と準備を最終確認し、安全に配慮した本番を開く。'],
    taskLabels: ['参加者の希望を調べ終える', '協力者と試演を行う', '会場・安全・予算の準備を終える', '地域の音楽イベントを開催する'],
    eventDescriptions: ['経験のある主催者が相談に乗ってくれます。今だけ「人に相談する」のつながりがさらに＋5。', '地域の企画講座を利用できます。今だけ「学習・練習」の費用が5点安くなります。', '試演用の会場費が上がりました。「仲間と小規模な試演をする」の費用が今だけ5点増えます。本人と参加の方針も選びましょう。', '試演の感想から改善点が見えました。「会場・安全・予算を整える」の時間が今だけ1点減ります。', '協力者の一部が忙しい時期です。「人に相談する」のつながりは今だけ＋5になります。', '地域から機材の貸し出しがありました。「地域の音楽イベントを開く」の費用が今だけ5点安くなります。'],
    strategies: ['少人数で安心できる場にする', '参加者の声を聞く時間を取り、小さく丁寧に開く方針。本人が大切にしています。', '安全を守り、参加の入口を広げる', '安全担当を残したうえで、見学や短い出演も募集する方針。本人も賛成しています。'],
  },
]

function buildDream(s: ScenarioText): Dream {
  const [research, practice, improve, final] = s.actionLabels
  return {
    id: s.id, title: s.title, icon: s.icon, character: s.character,
    actions: [
      ...COMMON_ACTIONS.map((action) => ({ ...action, effects: { ...action.effects } })),
      { id: 'research', label: research, description: s.actionDescriptions[0], category: 'dream', time: 2, cost: 10, effects: {}, once: true },
      { id: 'practice', label: practice, description: s.actionDescriptions[1], category: 'dream', time: 3, cost: 25, effects: { skill: 5, health: -10 }, requirements: { minStats: { skill: 40 }, actions: ['research'] }, once: true },
      { id: 'improve', label: improve, description: s.actionDescriptions[2], category: 'dream', time: 2, cost: 10, effects: { skill: 10, health: -5 }, requirements: { minStats: { skill: 50 }, actions: ['practice'] }, once: true },
      { id: 'final', label: final, description: s.actionDescriptions[3], category: 'dream', time: 3, cost: 35, effects: { health: -15, satisfaction: 5 }, requirements: { minStats: { skill: 60, support: 40, health: 40, satisfaction: 50 }, actions: ['research', 'practice', 'improve'] }, once: true },
    ],
    stages: [
      { id: 'stage1', title: s.stageTitles[0], tasks: [
        { id: 'skill35', label: 'スキル35以上に到達する', requirements: { minStats: { skill: 35 } } },
        { id: 'research', label: s.taskLabels[0], requirements: { actions: ['research'] } },
      ] },
      { id: 'stage2', title: s.stageTitles[1], tasks: [
        { id: 'practice', label: s.taskLabels[1], requirements: { actions: ['practice'] } },
        { id: 'support35', label: '人とのつながり35以上に到達する', requirements: { minStats: { support: 35 } } },
      ] },
      { id: 'stage3', title: s.stageTitles[2], tasks: [
        { id: 'improve', label: s.taskLabels[2], requirements: { actions: ['improve'] } },
        { id: 'final', label: s.taskLabels[3], requirements: { actions: ['final'] } },
      ] },
    ],
    events: [
      { title: '経験者からのアドバイス', description: s.eventDescriptions[0], adjustments: [{ actionId: 'consult', effects: { support: 5 } }] },
      { title: '学びのチャンス', description: s.eventDescriptions[1], adjustments: [{ actionId: 'study', cost: -5 }] },
      { title: '準備費用と、大切にしたい方針', description: s.eventDescriptions[2], adjustments: [{ actionId: 'practice', cost: 5 }] },
      { title: '前回の経験がヒントに', description: s.eventDescriptions[3], adjustments: [{ actionId: 'improve', time: -1 }] },
      { title: 'つながりのペースを調整', description: s.eventDescriptions[4], adjustments: [{ actionId: 'consult', effects: { support: -5 } }] },
      { title: '地域・仲間からの後押し', description: s.eventDescriptions[5], adjustments: [{ actionId: 'final', cost: -5 }] },
    ],
    strategies: [
      { id: 'care', title: s.strategies[0], description: s.strategies[1], attitude: '本人は、この進め方を望んでいます。', time: 1, cost: 0, effects: { satisfaction: 10 } },
      { id: 'reach', title: s.strategies[2], description: s.strategies[3], attitude: '本人は、この工夫に納得しています。', time: 0, cost: 5, effects: { support: 10, satisfaction: 5 } },
    ],
  }
}

export const DREAMS: Dream[] = scenarios.map(buildDream)

/** Reproducible example plans; useful when adjusting the values above. */
export const EXAMPLE_PATH = [
  ['study', 'research', 'consult'],
  ['study', 'consult', 'rest'],
  ['practice', 'rest'],
  ['improve', 'work', 'rest'],
  ['final', 'consult', 'rest'],
  ['reflect', 'rest', 'consult'],
]
