import debounce from './debounce'
import modal from './modal'

export default {
  saveScrollPositions: null,
  resolveComponent: null,
  updatePage: null,
  version: null,
  visitId: null,
  abortController: null,
  page: null,

  init({ initialPage, resolveComponent, updatePage }) {
    this.resolveComponent = resolveComponent
    this.updatePage = updatePage

    if (window.history.state && this.navigationType() === 'back_forward') {
      this.setPage(window.history.state)
    } else if (window.sessionStorage.getItem('inertia.hardVisit')) {
      window.sessionStorage.removeItem('inertia.hardVisit')
      this.setPage(initialPage, { preserveState: true })
    } else {
      initialPage.url += window.location.hash
      this.setPage(initialPage)
    }

    this.saveScrollPositions = debounce(() => {
      this.setState({
        ...window.history.state,
        scrollRegions: Array.prototype.slice.call(this.scrollRegions()).map(region => {
          return {
            top: region.scrollTop,
            left: region.scrollLeft,
          }
        }),
      })
    }, 100)

    window.addEventListener('popstate', this.restoreState.bind(this))
  },

  navigationType() {
    if (window.performance && window.performance.getEntriesByType('navigation').length) {
      return window.performance.getEntriesByType('navigation')[0].type
    }
  },

  scrollRegions() {
    return document.querySelectorAll('[scroll-region]')
  },

  isInertiaResponse(response) {
    return response && response.headers.has('x-inertia')
  },

  hasBody(method) {
    return ['get', 'head'].includes(method) === false
  },

  getCookieValue(name) {
    let match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'))
    return match ? decodeURIComponent(match[3]) : null
  },

  cancelActiveVisits() {
    if (this.abortController) {
      this.abortController.abort()
    }

    this.abortController = new AbortController()
  },

  createVisitId() {
    this.visitId = {}
    return this.visitId
  },

  visit(url, { method = 'get', data = {}, replace = false, preserveScroll = false, preserveState = false, only = [], headers = {} } = {}) {
    document.dispatchEvent(new Event('inertia:visit'))
    this.cancelActiveVisits()
    this.saveScrollPositions()
    let visitId = this.createVisitId()

    url = url.toString();
    method = method.toLowerCase();

    // pass data as query params in get requests
    if (method === 'get' && Object.keys(data).length) {
      url +=
        '?' +
        Object.keys(data)
          .filter(key => data[key] !== undefined && data[key] !== null)
          .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(data[key]))
          .join('&')
    }

    return window.fetch(url, {
      method: method,
      ...this.hasBody(method) ? { body: JSON.stringify(data) } : {},
      signal: this.abortController.signal,
      credentials: 'include',
      headers: {
        ...headers,
        'Content-Type': 'application/json;charset=UTF-8',
        Accept: 'text/html, application/xhtml+xml',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Xsrf-Token': this.getCookieValue('XSRF-TOKEN'),
        'X-Inertia': true,
        ...(only.length ? {
          'X-Inertia-Partial-Component': this.page.component,
          'X-Inertia-Partial-Data': only.join(','),
        } : {}),
        ...(this.version ? { 'X-Inertia-Version': this.version } : {}),
      },
    }).then(response => {
      if (response.status === 409 && response.headers.has('x-inertia-location')) {
        document.dispatchEvent(new Event('inertia:load'))
        return this.hardVisit(true, response.headers.get('x-inertia-location'))
      } else if (this.isInertiaResponse(response)) {
        return response.json()
      } else {
        response.text().then(data => {
          document.dispatchEvent(new Event('inertia:load'))
          modal.show(data)
        })
      }
    }).catch(error => {
      if (error.name === 'AbortError') {
        return
      } else {
        return Promise.reject(error)
      }
    }).then(page => {
      if (page) {
        if (only.length) {
          page.props = { ...this.page.props, ...page.props }
        }

        return this.setPage(page, { visitId, replace, preserveScroll, preserveState })
      }
    })
  },

  hardVisit(replace, url) {
    window.sessionStorage.setItem('inertia.hardVisit', true)

    if (replace) {
      window.location.replace(url)
    } else {
      window.location.href = url
    }
  },

  setPage(page, { visitId = this.createVisitId(), replace = false, preserveScroll = false, preserveState = false } = {}) {
    this.page = page
    return Promise.resolve(this.resolveComponent(page.component)).then(component => {
      if (visitId === this.visitId) {
        this.version = page.version
        this.setState(page, replace, preserveState)
        this.updatePage(component, page.props, { preserveState }).then(() => {
          let scrollRegions = this.scrollRegions()

          scrollRegions.forEach(region => {
            region.addEventListener('scroll', this.saveScrollPositions)
          })

          if (!preserveScroll) {
            document.documentElement.scrollTop = 0
            document.documentElement.scrollLeft = 0
            scrollRegions.forEach(region => {
              region.scrollTop = 0
              region.scrollLeft = 0
            })
          }

          this.saveScrollPositions()
        })
        document.dispatchEvent(new Event('inertia:load'))
      }
    })
  },

  setState(page, replace = false, preserveState = false) {
    if (replace || page.url === `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState({
        ...{ cache: preserveState && window.history.state ? window.history.state.cache : {} },
        ...page,
      }, '', page.url)
    } else {
      window.history.pushState({
        cache: {},
        ...page,
      }, '', page.url)
    }
  },

  restoreState(event) {
    if (event.state) {
      document.dispatchEvent(new Event('inertia:visit'))
      this.page = event.state
      let visitId = this.createVisitId()
      return Promise.resolve(this.resolveComponent(this.page.component)).then(component => {
        if (visitId === this.visitId) {
          this.version = this.page.version
          this.setState(this.page)
          this.updatePage(component, this.page.props, { preserveState: false }).then(() => {
            if (this.page.scrollRegions) {
              this.scrollRegions().forEach((region, index) => {
                region.scrollTop = this.page.scrollRegions[index].top
                region.scrollLeft = this.page.scrollRegions[index].left
              })
            }
          })
          document.dispatchEvent(new Event('inertia:load'))
        }
      })
    }
  },

  replace(url, options = {}) {
    return this.visit(url, { preserveState: true, ...options, replace: true })
  },

  reload(options = {}) {
    return this.replace(window.location.href, options)
  },

  post(url, data = {}, options = {}) {
    return this.visit(url, { preserveState: true, ...options, method: 'post', data })
  },

  put(url, data = {}, options = {}) {
    return this.visit(url, { preserveState: true, ...options, method: 'put', data })
  },

  patch(url, data = {}, options = {}) {
    return this.visit(url, { preserveState: true, ...options, method: 'patch', data })
  },

  delete(url, options = {}) {
    return this.visit(url, { ...options, method: 'delete' })
  },

  remember(data, key = 'default') {
    let newState = { ...window.history.state }
    newState.cache = newState.cache || {}
    newState.cache[key] = data
    this.setState(newState)
  },

  restore(key = 'default') {
    if (window.history.state.cache && window.history.state.cache[key]) {
      return window.history.state.cache[key]
    }
  },
}
