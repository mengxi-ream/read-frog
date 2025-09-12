export interface TestimonialItem {
  id: string
  name: string
  comment: string
  from: FromPlatforms
  date: string
  avatar?: string
  link?: string
}

export enum FromPlatforms {
  Chrome = 'chrome',
  Edge = 'edge',
  X = 'x',
}

export const testimonialList: TestimonialItem[] = [
  {
    id: 'songkeys',
    name: 'songkeys',
    avatar: '/images/user/songkeys.jpg',
    from: FromPlatforms.X,
    comment: 'AI 逐字逐句的陪读讲解。外语学习轻松更上一层楼。🤯👍开源，免费，为爱发电。快来点个 🌟star 支持一下！',
    link: 'https://x.com/songkeys/status/1942254042979226083',
    date: '2025.07.08',
  },
  {
    id: '핌르르',
    name: '핌르르',
    avatar: '/images/user/핌르르.jpg',
    from: FromPlatforms.Chrome,
    comment: '使用体验真的很丝滑 很喜欢阅读模式 期待未来支持越来越多模型',
    date: '2025.08.11',
  },
  {
    id: 'Holden “Holden for Work”',
    name: 'Holden “Holden for Work”',
    avatar: '/images/user/Holden.png',
    from: FromPlatforms.Chrome,
    comment: '开源 & 体验很好，希望持续优化，增加 AI 辅助的相关能力',
    date: '2025.08.11',
  },
  {
    id: 'MS R',
    name: 'MS R',
    avatar: '/images/user/MS R.png',
    from: FromPlatforms.Chrome,
    comment: 'Recently noticed this open-source translation software on the forum. The overall design is quite good, though it seems to still be in its early stages with more features being added. Hope it keeps getting better in the future!',
    date: '2025.08.11',
  },
]
