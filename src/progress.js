import Tinybar from 'tinybar'

const tinybar = new Tinybar()

export default {
  delay: null,
  loading: false,

  start() {
    clearTimeout(this.delay)

    this.delay = setTimeout(() => {
      this.loading = true
      tinybar.go(10)
    }, 250)
  },

  increment() {
    if (this.loading) {
      tinybar.go(50)
    }
  },

  stop() {
    clearTimeout(this.delay)

    if (this.loading) {
      tinybar.go(100)
      this.loading = false
    }
  },
}
