'use strict'

const pdfjsLib = window['pdfjs-dist/build/pdf']
pdfjsLib.GlobalWorkerOptions.workerSrc = '../node_modules/pdfjs-dist/build/pdf.worker.js'

let pdf
let pageNo

const showPage = (() => {
  let viewport
  let scale
  let canvas
  let ctx
  return async (init) => {
    const page = await pdf.getPage(pageNo)
    if (init) {
      canvas = document.getElementById('pdf-canvas')
      ctx = canvas.getContext('2d')
      const defaultViewport = page.getViewport({ scale: 1 })
      scale = window.innerHeight / defaultViewport.viewBox[3]
      viewport = page.getViewport({ scale: scale })
      canvas.width = viewport.width ? viewport.width : viewport.viewBox[2]
      canvas.height = viewport.height ? viewport.height : `${viewport.viewBox[3]}`
    }

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    }
    page.render(renderContext)
    window.electron.sendMessage({ msg: 'page', page: pageNo })
  }
})()

const basename = filename => {
  return (/([^\\/]*)$/.exec(filename) || ['', ''])[1]
}

const loadPdf = async (filename) => {
  const _pdf = await pdfjsLib.getDocument(filename).promise
  document.title = `pp - ${basename(filename)}`
  pageNo = 1
  pdf = _pdf
  await showPage(true)
}

let stream
const cameraSwitch = async (cameraType, cameraId) => {
  const video = document.getElementById('camera')
  const container = document.getElementById('camera-container')
  try {
    if (stream !== undefined) {
      stream.getTracks().forEach(track => {
        track.stop()
      })
    }
  } finally {
    stream = undefined
    video.srcObject = null
  }
  if (cameraType === 'none') {
    container.style.display = 'none'
  } else if (cameraType === 'superpose' || cameraType === 'camera-only') {
    container.style.display = 'block'
    const [w, h] = [document.body.clientWidth, document.body.clientHeight]
    const [cw, ch] = cameraType === 'camera-only' ? [w, h] : [w / 4 | 0, h / 4 | 0] // width, height of camera view
    container.style.top = `${h - ch}px`
    container.style.left = `${w - cw}px`
    container.style.widt = `${cw}px`
    container.style.height = `${ch}px`
    try {
      if (stream !== undefined) {
        stream.getTracks().forEach(track => {
          track.stop()
        })
      }
    } finally {
      stream = undefined
      video.srcObject = null
    }
    try {
      const constraints = {
        audio: false,
        video: {
          deviceId: cameraId,
          width: cw,
          height: ch
        }
      }
      stream = await navigator.mediaDevices.getUserMedia(constraints)
      video.srcObject = stream
      video.autoplay = true
    } catch (e) {
      console.error(e)
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.addEventListener('message', (evt) => {
    const message = evt.data
    console.log(message)
    switch (message.msg) {
      case 'load':
        (async () => {
          await loadPdf(message.filename)
          window.electron.sendMessage({ msg: 'load', pages: pdf.numPages, filename: message.filename })
        })()
        break
      case 'page':
        if (message.absolute) {
          if (typeof message.value === 'number') {
            if (message.value >= 1 && message.value <= pdf.numPages) {
              pageNo = message.value
              showPage()
            }
          }
        } else {
          if (typeof message.value === 'number') {
            const newPageNo = pageNo + message.value
            if (newPageNo >= 1 && newPageNo <= pdf.numPages) {
              pageNo = newPageNo
              showPage()
            }
          }
        }
        break
      case 'camera':
        cameraSwitch(message.cameraType, message.cameraId)
        break
    }
  }, false)
})

window.addEventListener('mousemove', (evt) => {
  if (evt.shiftKey) {
    document.body.classList.add('pointer')
  } else {
    document.body.classList.remove('pointer')
  }
}, false)

window.addEventListener('click', (evt) => {
  const x = evt.clientX
  if (x <= document.body.clientWidth / 2) {
    if (pageNo >= 2) {
      pageNo--
    }
    showPage()
  } else {
    if (pageNo <= pdf.numPages - 1) {
      pageNo++
    }
    showPage()
  }
}, false)

window.addEventListener('keyup', (evt) => {
  if (['ArrowLeft', 'ArrowUp', 'p', 'PageUp', 'Backspace'].indexOf(evt.key) >= 0) {
    if (pageNo >= 2) {
      pageNo--
    }
    showPage()
  } else if (['ArrowRight', 'ArrowDown', 'n', ' ', 'PageDown', 'Enter'].indexOf(evt.key) >= 0) {
    if (pageNo <= pdf.numPages - 1) {
      pageNo++
    }
    showPage()
  }
}, false)
