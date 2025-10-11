export const QUOTES: Record<
  'eng' | 'jpn' | 'cn',
  {
    title: string
    author: string
    sentences: string[]
  }
> = {
  eng: {
    title: 'Spark: 5 Quotes',
    author: '— Naoki Matayoshi',
    sentences: [
      '1. As long as you\'re alive, there\'s no bad ending.',
      '2. Write down what you saw today in your own words while you\'re still alive.',
      '3. Mr. Kamiya isn\'t confronting the world; he\'s confronting something that might make the world turn its head.',
      '4. I believe comedians never truly retire.',
      '5. Even the days you spent aimlessly will one day become treasures.',
    ],
  },
  jpn: {
    title: '『火花』名言五選',
    author: '―― 又吉直樹',
    sentences: [
      '1. 生きている限り、バッドエンドはない。',
      '2. お前の言葉で今日見たものを生きてるうちに書けよ。',
      '3. 神谷さんが相手にしているのは世間やないねん。世間を振り向かせるかもしれん何かやねん。',
      '4. オレな、芸人には引退なんてないと思うねん。',
      '5. なんとなく過ごした日々も、後から宝物になるんですよ。',
    ],
  },
  cn: {
    title: '『火花』名言五选',
    author: '―― 又吉直树',
    sentences: [
      '1. 只要你还活着，就没有真正的结局。',
      '2. 用你自己的话写下今天你所看到的内容，趁你还活着的时候。',
      '3. 神谷先生并非在与世界对抗；他是在面对某种可能让世界为之侧目的事物。',
      '4. 我相信喜剧演员永远不会真正退休。',
      '5. 即使你曾经漫无目的地度过的日子，终有一天也会变成珍宝。',
    ],
  },
}
