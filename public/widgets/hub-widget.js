(function () {
  'use strict'

  var currentScript = document.currentScript
  var defaultEvent = currentScript && currentScript.dataset ? currentScript.dataset.event : null
  var HUB_URL = currentScript && currentScript.src
    ? new URL(currentScript.src).origin
    : 'https://hub.yanbada.com'

  function openOverlay(eventSlug, view) {
    view = view || 'catalog'

    var overlay = document.createElement('div')
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:999999;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;'

    var container = document.createElement('div')
    container.style.cssText =
      'position:relative;background:#fff;border-radius:12px;width:100%;max-width:1200px;height:90vh;max-height:90dvh;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.3);'

    var closeBtn = document.createElement('button')
    closeBtn.innerHTML = '✕'
    closeBtn.setAttribute('aria-label', 'Close')
    closeBtn.style.cssText =
      'position:absolute;top:12px;right:12px;width:36px;height:36px;border-radius:50%;border:none;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.15);cursor:pointer;font-size:18px;z-index:10;'
    closeBtn.onclick = function () {
      document.body.removeChild(overlay)
    }

    var iframe = document.createElement('iframe')
    iframe.src = HUB_URL + '/e/' + eventSlug + '/' + view + '?embed=1'
    iframe.style.cssText = 'width:100%;height:100%;border:none;'
    iframe.setAttribute('title', 'Yanbada Hub')

    container.appendChild(closeBtn)
    container.appendChild(iframe)
    overlay.appendChild(container)
    document.body.appendChild(overlay)

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) document.body.removeChild(overlay)
    })

    window.addEventListener('message', function onMessage(e) {
      if (e.data && e.data.type === 'yanbada-hub-height' && e.source === iframe.contentWindow) {
        var h = Math.min(e.data.height, window.innerHeight * 0.9)
        container.style.height = h + 'px'
      }
    })
  }

  function init() {
    document.querySelectorAll('[data-yanbada-hub]').forEach(function (el) {
      var slug = el.dataset.yanbadaHub || defaultEvent
      var view = el.dataset.yanbadaView || 'catalog'
      if (!slug) return
      el.addEventListener('click', function (e) {
        e.preventDefault()
        openOverlay(slug, view)
      })
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
