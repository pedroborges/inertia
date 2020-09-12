import modal from './modal'

export default {
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

    window.addEventListener('popstate', this.restoreState.bind(this))
  },

  navigationType() {
    if (window.performance && window.performance.getEntriesByType('navigation').length) {
      return window.performance.getEntriesByType('navigation')[0].type
    }
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

  visit(url, { method = 'get', data = {}, replace = false, preserveScroll = false, preserveState = false, only = [] } = {}) {
    document.dispatchEvent(new Event('inertia:visit'))
    this.cancelActiveVisits()
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
        preserveState = typeof preserveState === 'function' ? preserveState(page.props) : preserveState
        preserveScroll = typeof preserveScroll === 'function' ? preserveScroll(page.props) : preserveScroll
        
        this.version = page.version
        this.setState(page, replace, preserveState)
        this.updatePage(component, page.props, { preserveState })
        this.setScroll(preserveScroll)
        document.dispatchEvent(new Event('inertia:load'))
      }
    })
  },

  setScroll(preserveScroll) {
    if (!preserveScroll) {
      document.querySelectorAll('html,body,[scroll-region]')
        .forEach(region => region.scrollTo(0, 0))
    }
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
      this.setPage(event.state)
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
