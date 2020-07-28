
export default {
  delay: null,
  loading: false,

  start() {
    this.loading = true
    document.dispatchEvent(new Event("inertia.start"))
  },

  increment() {
    if (this.loading) {
      document.dispatchEvent(new Event("inertia.increment"))
    }
  },

  stop() {
    clearTimeout(this.delay)

    if (this.loading) {
      document.dispatchEvent(new Event("inertia.stop"))
      this.loading = false
    }
  },
}
