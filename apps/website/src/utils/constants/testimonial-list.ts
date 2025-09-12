export interface TestimonialItem {
  id: string
  name: string
  comment: string
  from: FromPlatforms
  avatar?: string
  link?: string
}

enum FromPlatforms {
  Chrome = 'Chrome',
  Firefox = 'Firefox',
  Edge = 'Edge',
  X = 'X',
}

export const testimonialList: TestimonialItem[] = [
  {
    id: 'Xander Lowe',
    name: 'Xander Lowe',
    comment: '非常棒的翻译软件，简洁好用，响应速度也快！',
    from: FromPlatforms.Chrome,
    avatar: '/images/user/Xander Lowe.png',
  },
  {
    id: 'Allen Chang',
    name: 'Allen Chang',
    avatar: '/images/user/Allen Chang.jpg',
    from: FromPlatforms.Chrome,
    comment: '非常完美',
  },
  {
    id: '핌르르',
    name: '핌르르',
    avatar: '/images/user/핌르르.jpg',
    from: FromPlatforms.Chrome,
    comment: '使用体验真的很丝滑 很喜欢阅读模式 期待未来支持越来越多模型',
  },
  {
    id: 'songkeys',
    name: 'songkeys',
    avatar: '/images/user/songkeys.jpg',
    from: FromPlatforms.X,
    comment: '不光复刻了沉浸式翻译的原版功能，它还带 AI 逐字逐句的陪读讲解。外语学习轻松更上一层楼。🤯👍开源，免费，为爱发电。快来点个 🌟star 支持一下！',
    link: 'https://x.com/songkeys/status/1942254042979226083',
  },
  {
    id: 'XiaoPeng Liu',
    name: 'XiaoPeng Liu',
    avatar: '/images/user/XiaoPeng Liu.png',
    from: FromPlatforms.Chrome,
    comment: '加油加油，$100的加持下希望早日功成。',
  },
  {
    id: '孟令涵',
    name: '孟令涵',
    avatar: '/images/user/孟令涵.png',
    from: FromPlatforms.Chrome,
    comment: '真的很好用，双语翻译对照参考。',
  },
  {
    id: 'Lionel Meng',
    name: 'Lionel Meng',
    avatar: '/images/user/Lionel Meng.jpg',
    from: FromPlatforms.Chrome,
    comment: '开源沉浸式翻译插件，简洁而方便而快捷。',
  },
  {
    id: 'chang liu',
    name: 'chang liu',
    avatar: '/images/user/chang liu.png',
    from: FromPlatforms.Chrome,
    comment: '可以自定义api，翻译速度比沉浸式翻译快，开源，github上积极回应，体验很不错',
  },
  {
    id: 'Holden “Holden for Work”',
    name: 'Holden “Holden for Work”',
    avatar: '/images/user/Holden.png',
    from: FromPlatforms.Chrome,
    comment: '开源 & 体验很好，希望持续优化，增加 AI 辅助的相关能力',
  },
  {
    id: 'MS R',
    name: 'MS R',
    avatar: '/images/user/MS R.png',
    from: FromPlatforms.Chrome,
    comment: 'Recently noticed this open-source translation software on the forum. The overall design is quite good, though it seems to still be in its early stages with more features being added. Hope it keeps getting better in the future!',
  },
]
