module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
    'autoprefixer': {},
    'postcss-rem-to-responsive-pixel': {
      rootValue: 16,
      propList: ['*'],
      transformUnit: 'px',
    },
  },
}
